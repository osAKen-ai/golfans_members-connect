'use strict';
// supabase-sync.js — Golfans Members' Connect (宝塚ゴルフ倶楽部 会員専用ポータル) Supabase 同期モジュール
//
// 予約、同伴者リスト、競技会申込、プロフィール公開設定を
// クラウド上の Supabase (Golfansバックエンド) へ非同期永続化し、複数端末・リロード時にも同期する。

(function() {
  const SUPABASE_API = '/api/sync';
  const MEMBER_ID = '0889582';
  let isHydrating = false;

  function ensureSyncBanner() {
    let bar = document.getElementById('sb-sync-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'sb-sync-bar';
    bar.style.cssText = 'background:#041b38;color:#d8e6f8;padding:6px 16px;font-size:11.5px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid rgba(177,122,37,.45);';
    bar.innerHTML =
      '<span id="sb-sync-status">⚡ Golfans クラウドDB 接続確認中...</span>' +
      '<button type="button" id="sb-sync-btn" style="background:#b17a25;color:#fff;border:0;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;">🔄 DB同期</button>';
    const welcome = document.querySelector('.welcome');
    if (welcome && welcome.parentNode) {
      welcome.parentNode.insertBefore(bar, welcome.nextSibling);
    } else {
      document.body.prepend(bar);
    }
    document.getElementById('sb-sync-btn').onclick = () => pullFromSupabase(true);
    return bar;
  }

  function setSyncStatus(text, ok = true) {
    ensureSyncBanner();
    const el = document.getElementById('sb-sync-status');
    if (el) {
      el.textContent = text;
      el.style.color = ok ? '#a5f3c4' : '#ffd280';
    }
  }

  function buildSyncPayload() {
    return {
      reservations: state.reservations || [],
      companions: (state.companions || []).map(c => ({
        id: c.id,
        name: c.name,
        kana: c.kana,
        type: c.type,
        phone: c.phone,
        publicVisibility: c.publicVisibility
      })),
      line: Boolean(state.line),
      events: state.events || {},
      eventApplications: state.eventApplications || {},
      profileContent: state.profileContent || { bio: '', instagram: '', facebook: '', x: '', line: '', public: false },
      profileVisibility: state.profileVisibility || { portrait: 'icon', name: 'initials', competition: false, bio: false, line: false, instagram: false, facebook: false, x: false }
    };
  }

  async function pushToSupabase() {
    if (isHydrating) return;
    setSyncStatus('⏳ クラウドDBへ保存中...', false);
    try {
      const resp = await fetch(SUPABASE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: MEMBER_ID,
          member_name: '伊藤 剛 (宝塚GCポータル)',
          state: buildSyncPayload()
        })
      });
      const data = await resp.json();
      if (data && data.ok) {
        const t = new Date().toLocaleTimeString('ja-JP');
        setSyncStatus('✓ Golfans クラウドDB 同期済（会員番号 0889582 · ' + t + '）', true);
      } else {
        setSyncStatus('⚠️ ローカル保存済（クラウド待機）', false);
      }
    } catch (e) {
      setSyncStatus('⚠️ ローカル保存済（オフライン）', false);
    }
  }

  async function pullFromSupabase(manual = false) {
    ensureSyncBanner();
    setSyncStatus('⏳ クラウドDBから最新データを取得中...', false);
    try {
      const resp = await fetch(SUPABASE_API + '?member_id=' + encodeURIComponent(MEMBER_ID));
      const data = await resp.json();
      if (data && data.ok && data.found && data.state) {
        isHydrating = true;
        const remote = data.state;
        if (Array.isArray(remote.reservations)) {
          state.reservations = remote.reservations;
        }
        if (Array.isArray(remote.companions)) {
          const existingMap = new Map((state.companions || []).map(c => [c.name, c]));
          state.companions = remote.companions.map(rc => {
            const ex = existingMap.get(rc.name);
            return ex ? { ...ex, ...rc, extraVisits: ex.extraVisits } : { ...rc, extraVisits: [] };
          });
        }
        if (typeof remote.line === 'boolean') state.line = remote.line;
        if (remote.events) state.events = remote.events;
        if (remote.eventApplications) state.eventApplications = remote.eventApplications;
        if (remote.profileContent) state.profileContent = remote.profileContent;
        if (remote.profileVisibility) state.profileVisibility = remote.profileVisibility;

        try {
          localStorage.setItem('takarazuka-portal-v1', JSON.stringify(state));
        } catch {}
        if (typeof updateHome === 'function') updateHome();
        if (typeof refreshMenuProfileStatus === 'function') refreshMenuProfileStatus();
        if (current && current.k && typeof render === 'function') render(current.k, current.arg);
        isHydrating = false;

        const t = new Date().toLocaleTimeString('ja-JP');
        setSyncStatus('✓ Golfans クラウドDB 同期完了（予約 ' + (state.reservations || []).length + '件 / 同伴者 ' + (state.companions || []).length + '名 · ' + t + '）', true);
        if (manual && typeof toast === 'function') toast('Golfans クラウドDBから最新データを同期しました');
      } else {
        await pushToSupabase();
      }
    } catch (e) {
      isHydrating = false;
      setSyncStatus('⚠️ ローカルモード（クラウド待機）', false);
    }
  }

  const origSave = window.save;
  if (typeof origSave === 'function') {
    window.save = function() {
      origSave.apply(this, arguments);
      pushToSupabase();
    };
  }

  const footer = document.querySelector('.footer');
  if (footer) {
    footer.textContent = 'Golfans クラウドDB実動版 · 予約・同伴者・プロフィール公開設定はリアルタイム保存されます。';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => pullFromSupabase(false));
  } else {
    pullFromSupabase(false);
  }
})();
