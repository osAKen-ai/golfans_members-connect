#!/usr/bin/env python3
"""伊藤さん ChatGPT デモサイト (chatgpt.site) → リポジトリ作業ツリーへの取り込み（検証付き）。

2026-10-28 Claude Code 改修。旧版（Agy 作・M5Pro launchd 15分 + Actions 30分の二重書込）を置き換える。

設計の約束:
  - このスクリプトは git を一切操作しない。commit / push / 反映確認は
    .github/workflows/auto-sync-ito.yml だけが行う（書き手は GitHub Actions の 1 つだけ）。
  - 全ファイルを一時ディレクトリに取得 → 全検証に合格したときだけ作業ツリーへ書く。
    1 つでも取得失敗・検証失敗があれば 1 バイトも書かずに exit 1（＝ワークフロー失敗 → Issue 通知）。
  - Golfans 側フック（supabase-sync.js 読込・proxy.js の Supabase pull）が外れたら
    「黙って劣化した版を出す」のではなく失敗として止める。

使い方:
  python3 .github/scripts/sync_ito_portal.py            # カレントの repo ルートへ書く（Actions 用）
  python3 .github/scripts/sync_ito_portal.py --out DIR  # 別ディレクトリへ書く（手元での確認用）
  python3 .github/scripts/sync_ito_portal.py --check    # 取得・検証だけ行い何も書かない
終了コード: 0=成功（差分有無は --list の出力 / JSON で判断） 1=失敗
"""

import argparse
import hashlib
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

BASE_URL = "https://takarazuka-members-portal-demo.tsuyoshi-ito515118.chatgpt.site"
BASE_HOST = urllib.parse.urlparse(BASE_URL).netloc
SYNC_TAG = '<script src="supabase-sync.js?v=20261028-cloud-sync"></script>'

# 取得元パス → 保存名。proxy は ?agent= 付きで配信されるため明示的に対応付ける
PAGES = {"index.html": "/", "proxy.html": "/proxy?agent=agent-yamada"}

# 各ページに必ず含まれているべき目印（ログイン画面・エラー画面・空ページの取り込みを防ぐ）
REQUIRED_MARKERS = {
    "index.html": ["<title>宝塚ゴルフ倶楽部", 'id="menu"', 'id="reservationSummary"'],
    "proxy.html": ["<title>予約代理人", 'id="proxyMain"', "proxy.js"],
}
# 含まれていたら取り込まない文字列（Cloudflare チャレンジ・ログイン・エラーページ）
FORBIDDEN_MARKERS = ["Just a moment...", "cf-chl-", "Attention Required!", "<title>404", "<title>Error"]

# 既存ファイルからこれ以上縮んだら事故とみなす（伊藤さんの意図的な大幅削除なら手動で取り込む）
MIN_SIZE_RATIO = 0.5

# Golfans 自前のファイル。上流からは取らない
LOCAL_ONLY = {"supabase-sync.js"}

PROXY_ANCHOR = "state=proxyReadReservations(id);proxyGo('home');"
PROXY_HOOK = (
    "state=proxyReadReservations(id);if(id==='ito'&&window.GolfansSync&&typeof window.GolfansSync.pull"
    "==='function'){window.GolfansSync.pull(false);}proxyGo('home');"
)
CF_BEACON_RE = re.compile(r"<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument.*?</script>", re.S)


class SyncError(Exception):
    pass


def fetch(rel_path):
    url = urllib.parse.urljoin(BASE_URL + "/", rel_path.lstrip("/"))
    req = urllib.request.Request(url, headers={"User-Agent": "golfans-ito-sync/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            final_host = urllib.parse.urlparse(r.geturl()).netloc
            if final_host != BASE_HOST:
                raise SyncError(f"{rel_path}: 別ホストへリダイレクトされた ({r.geturl()})")
            return r.read(), r.headers.get("Content-Type", "")
    except SyncError:
        raise
    except Exception as e:
        raise SyncError(f"{rel_path}: 取得失敗 ({e})") from e


def decode(rel, raw):
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise SyncError(f"{rel}: UTF-8 として読めない（文字化けしたまま上書きしない）: {e}") from e


HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
SYNC_SCRIPT_RE = re.compile(
    r'<script\b[^>]*\bsrc=["\']/?supabase-sync\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
    re.I,
)


def _strip_js_comments(code):
    """文字列リテラルを壊さずに JS の // 行コメントと /* */ ブロックコメントを除去する。"""
    pattern = re.compile(
        r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)|(/\*.*?\*/|//[^\r\n]*)',
        re.S,
    )
    return pattern.sub(lambda m: m.group(1) if m.group(1) is not None else "", code)


def _has_active_html_sync_tag(text):
    active_html = HTML_COMMENT_RE.sub("", text)
    return bool(SYNC_SCRIPT_RE.search(active_html))


def _has_active_proxy_hook(text):
    active_js = _strip_js_comments(text)
    return (
        "window.GolfansSync" in active_js
        and "window.GolfansSync.pull(" in active_js
        and PROXY_HOOK in active_js
    )


def apply_hooks(rel, text):
    """Golfans 側フックを注入し、コメント外の実行コードとして存在することを確認する。外れたら SyncError。"""
    if rel in PAGES:
        text = CF_BEACON_RE.sub("", text)
        if not _has_active_html_sync_tag(text):
            if text.count("</body>") != 1:
                raise SyncError(f"{rel}: </body> が 1 個ではないため supabase-sync.js を注入できない")
            text = text.replace("</body>", f"{SYNC_TAG}</body>")
        if not _has_active_html_sync_tag(text):
            raise SyncError(f"{rel}: supabase-sync.js の有効な <script> 読込タグが入っていない（コメントのみ等は不可）")
    elif rel == "proxy.js":
        if not _has_active_proxy_hook(text):
            active_js = _strip_js_comments(text)
            if active_js.count(PROXY_ANCHOR) != 1 or text.count(PROXY_ANCHOR) != 1:
                raise SyncError(
                    "proxy.js: Supabase pull フックの差し込み位置が見つからない（上流の書き方が変わった）。"
                    "このまま出すと代理予約のクラウド同期が黙って止まるため取り込みを中止する。"
                    f" 期待した文字列: {PROXY_ANCHOR}"
                )
            text = text.replace(PROXY_ANCHOR, PROXY_HOOK)
        if not _has_active_proxy_hook(text):
            raise SyncError("proxy.js: コメント外の有効な Supabase pull フックが入っていない")
    return text


def validate_page(rel, text):
    for m in REQUIRED_MARKERS[rel]:
        if m not in text:
            raise SyncError(f"{rel}: 必須の目印 {m!r} が無い（ログイン画面・エラー画面の可能性）")
    for m in FORBIDDEN_MARKERS:
        if m in text:
            raise SyncError(f"{rel}: 取り込み禁止の文字列 {m!r} を含む（チャレンジ/エラーページ）")
    if "<html" not in text.lower() or "</html>" not in text.lower():
        raise SyncError(f"{rel}: HTML として不完全")


def check_shrink(rel, new_bytes, repo_dir):
    old_path = os.path.join(repo_dir, rel)
    if os.path.exists(old_path):
        old_size = os.path.getsize(old_path)
        if old_size > 1000 and len(new_bytes) < old_size * MIN_SIZE_RATIO:
            raise SyncError(f"{rel}: {old_size}B → {len(new_bytes)}B に縮小（{MIN_SIZE_RATIO:.0%} 未満）。壊れた取得の疑い")


def node_check(path):
    node = shutil.which("node")
    if not node:
        if os.environ.get("GITHUB_ACTIONS") == "true":
            raise SyncError("node が無いため JS 構文検査ができない")
        print("[WARN] node が無いので JS 構文検査を省略", file=sys.stderr)
        return
    p = subprocess.run([node, "--check", path], capture_output=True, text=True)
    if p.returncode != 0:
        raise SyncError(f"{os.path.basename(path)}: JS 構文エラー\n{p.stderr[-800:]}")


def _validate_asset_payload(rel, raw, ctype):
    if not raw:
        raise SyncError(f"{rel}: 0 バイト")
    ct = (ctype or "").lower()
    low_rel = rel.lower()
    if low_rel.endswith(".pdf"):
        if "text/html" in ct or not raw.startswith(b"%PDF-"):
            raise SyncError(f"{rel}: PDF ではない応答または破損データ (Content-Type={ctype!r}, magic={raw[:8]!r})")
    elif low_rel.endswith(".png"):
        if "text/html" in ct or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SyncError(f"{rel}: PNG ではない応答または破損データ (Content-Type={ctype!r})")
    elif low_rel.endswith((".jpg", ".jpeg")):
        if "text/html" in ct or not raw.startswith(b"\xff\xd8\xff"):
            raise SyncError(f"{rel}: JPEG ではない応答または破損データ (Content-Type={ctype!r})")
    elif low_rel.endswith(".webp"):
        if "text/html" in ct or not (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
            raise SyncError(f"{rel}: WEBP ではない応答または破損データ (Content-Type={ctype!r})")
    elif low_rel.endswith(".svg"):
        txt = decode(rel, raw)
        if "text/html" in ct or "<svg" not in txt.lower():
            raise SyncError(f"{rel}: SVG ではない応答 (Content-Type={ctype!r})")
    else:
        if "text/html" in ct and not low_rel.endswith(".html"):
            raise SyncError(f"{rel}: アセットに対して HTML が返された (Content-Type={ctype!r})")


def _resolve_rel_ref(base_rel, ref):
    ref = (ref or "").strip()
    if not ref or ref.startswith(("http:", "https:", "data:", "mailto:", "tel:", "javascript:", "blob:", "//", "#", "/cdn-cgi/", "cdn-cgi/")):
        return None
    ref = ref.split("#", 1)[0].split("?", 1)[0].strip()
    if not ref:
        return None
    if ref.startswith("/"):
        norm = posixpath.normpath(ref.lstrip("/"))
    else:
        base_dir = posixpath.dirname(base_rel)
        norm = posixpath.normpath(posixpath.join(base_dir, ref) if base_dir else ref)
    if norm in ("", ".") or norm.startswith("../") or "/../" in f"/{norm}/":
        raise SyncError(f"{base_rel}: 不正な相対パス参照 ({ref})")
    return norm


def collect(repo_dir):
    """上流から全ファイルを取得してメモリ上に {rel: bytes} を作る。失敗は即 SyncError。"""
    files = {}
    discovered = set()
    for rel, src in PAGES.items():
        raw, ctype = fetch(src)
        if "text/html" not in ctype.lower():
            raise SyncError(f"{rel}: Content-Type が HTML ではない ({ctype})")
        text = apply_hooks(rel, decode(rel, raw))
        validate_page(rel, text)
        for m in re.findall(r'(?:src|href)=["\']([^"\'#?]+)', text):
            resolved = _resolve_rel_ref(rel, m)
            if resolved and resolved not in PAGES and resolved not in LOCAL_ONLY:
                if "." in posixpath.basename(resolved):
                    discovered.add(resolved)
        files[rel] = text.encode("utf-8")

    queue = sorted(discovered - set(PAGES) - LOCAL_ONLY)
    seen = set(queue)
    while queue:
        rel = queue.pop(0)
        if ".." in rel.split("/"):
            raise SyncError(f"{rel}: 不正なパス")
        raw, ctype = fetch(rel)
        if rel.endswith((".js", ".css", ".html")):
            if rel.endswith((".js", ".css")) and "text/html" in (ctype or "").lower():
                raise SyncError(f"{rel}: JS/CSS に対して HTML が返された ({ctype})")
            text = apply_hooks(rel, decode(rel, raw))
            files[rel] = text.encode("utf-8")
            refs = set(re.findall(r"assets/[A-Za-z0-9_.\-/]+", text))
            if rel.endswith(".css"):
                for u in re.findall(r'url\(\s*["\']?([^"\')\s]+)["\']?\s*\)', text):
                    refs.add(u)
            elif rel.endswith(".html"):
                for m in re.findall(r'(?:src|href)=["\']([^"\'#?]+)', text):
                    refs.add(m)
            for raw_ref in sorted(refs):
                cleaned = raw_ref.rstrip(".")
                resolved = _resolve_rel_ref(rel, cleaned)
                if resolved and resolved not in PAGES and resolved not in LOCAL_ONLY and "." in posixpath.basename(resolved):
                    if resolved not in seen:
                        seen.add(resolved)
                        queue.append(resolved)
        else:
            _validate_asset_payload(rel, raw, ctype)
            files[rel] = raw

    if "proxy.js" not in files:
        raise SyncError("proxy.js が参照されていない（proxy.html の構造が変わった）")
    for rel, data in files.items():
        if rel.endswith((".html", ".js", ".css")):
            check_shrink(rel, data, repo_dir)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="書き込み先（省略時はカレントディレクトリ = repo ルート）")
    ap.add_argument("--check", action="store_true", help="取得と検証だけ行い、何も書かない")
    ap.add_argument("--list", help="追加・変更したファイル名を 1 行ずつ書き出す先（Actions が git add に使う）")
    args = ap.parse_args()
    repo_dir = os.path.abspath(args.out or os.getcwd())

    result = {"ok": False, "added": [], "changed": [], "error": None}
    try:
        files = collect(repo_dir)
        with tempfile.TemporaryDirectory() as tmp:
            for rel, data in files.items():
                p = os.path.join(tmp, rel)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as f:
                    f.write(data)
                if rel.endswith(".js"):
                    node_check(p)

        for rel, data in sorted(files.items()):
            p = os.path.join(repo_dir, rel)
            if not os.path.exists(p):
                result["added"].append(rel)
            elif open(p, "rb").read() != data:
                result["changed"].append(rel)

        if not args.check:
            for rel in result["added"] + result["changed"]:
                p = os.path.join(repo_dir, rel)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p + ".tmp", "wb") as f:
                    f.write(files[rel])
                os.replace(p + ".tmp", p)
        if args.list:
            with open(args.list, "w") as f:
                f.write("".join(r + "\n" for r in result["added"] + result["changed"]))
        result["ok"] = True
        result["fetched"] = len(files)
    except SyncError as e:
        result["error"] = str(e)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write("## 伊藤さんポータル取り込み\n\n```json\n" + json.dumps(result, ensure_ascii=False, indent=2) + "\n```\n")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
