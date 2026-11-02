# golfans_members-connect

**Golfans × Members' Connect プラットフォーム**
宝塚ゴルフ倶楽部 会員専用ポータル ＆ クラウド同期プロトタイプ

## 開発引継ぎの入口

- **[開発引継ぎ資料一覧・版管理](docs/handoff/2026-11-02/README.md)**：伊藤剛さん共有の原PDFを内容そのままで保管し、v2.0・承認済みv2.1と改訂経緯を参照できます。
- **[開発引継ぎ・本番化計画 v2.1](docs/handoff/2026-11-02/development-handoff-v2.1.md)**：構成図、画面例、既存資産、現行API/保存構造、本番化要件、責任分担案、受入条件。
- **[伊藤さん共有原資料・本文控え](docs/handoff/2026-11-02/original-ito-handoff.md)**：利用体験と操作意図の出どころを確認するための控え。

## 現在の構成

- フロントエンド：PWA / HTML5 / CSS3 / JavaScript（Vanilla）
- 配信：Cloudflare Pages（https://takarazuka.golfans.com）
- 保存・取得API：Cloudflare Pages Functions（`/api/sync`）
- データベース：Supabase（`golfans_player_states` に画面状態を保存・取得）

現在は、DBへの保存・読込を備えた動作プロトタイプです。実際の予約在庫、本人確認・代理権限、同時更新、実通知の本番適合・完成は別途確認します。

## 双方のAIから継続改修できること

本番化の要件として、**伊藤さんのChatGPTと長田さん側AIが共通の最新コードへアクセスし、指示した時に修正・プレビュー・検査・反映結果の確認まで進められる仕組み**を求めます。開発会社への都度依頼や定期同期の時刻待ちを前提にしません。

既存MCPコネクタは更新起動・状況照会を担います。双方のAIからのコード取得・編集・検査までの接続は、追加設計・実装・受入の対象です。同時変更の衝突と一方向同期による上書きを防ぎ、変更履歴と復旧手順を残します。

## コード・運用の入口

- 会員画面：[`index.html`](index.html)、[`app.js`](app.js)
- 代理人画面：[`proxy.html`](proxy.html)、[`proxy.js`](proxy.js)
- データ保存・読込：[`supabase-sync.js`](supabase-sync.js)、[`functions/api/sync.js`](functions/api/sync.js)
- 自動更新：[`auto-sync-ito.yml`](.github/workflows/auto-sync-ito.yml)
- 手動更新・コネクタ：[`connector/OPERATIONS.txt`](connector/OPERATIONS.txt)
- AI間連絡：[`COLLAB_BOARD.md`](COLLAB_BOARD.md)

最終更新：2026-11-02 / 編集：オサケン内Codex
