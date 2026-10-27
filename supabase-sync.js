'use strict';
// supabase-sync.js — Golfans Members' Connect (宝塚ゴルフ倶楽部 会員専用ポータル & 代理人画面) Supabase クラウド同期モジュール
//
// 予約、同伴者リスト、競技会申込、プロフィール公開設定、代理予約を
// クラウド上の Supabase (Golfansバックエンド) へ非同期永続化し、複数端末・メンバー画面・代理人画面間で完全同期する。

(function() {
  const SUPABASE_API = '/api/sync';
  const MEMBER_ID = '0889582';
  let isHydrating = false;

  const isProxyPage = location.pathname.endsWith('proxy') || location.pathname.endsWith('proxy.html');

  function ensureSyncBanner() {
    let bar = document.getElementById('sb-sync-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'sb-sync-bar';
    bar.style.cssText = 'background:#041b38;color:#d8e6f8;padding:6px 16px;font-size:11.5px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid rgba(177,122,37,.45);z-index:99;position:relative;';
    bar.innerHTML =
      '<span id="sb-sync-status">⚡ Golfans クラウドDB 接続確認中...</span>' +
      '<button type="button" id="sb-sync-btn" style="background:#b17a25;color:#fff;border:0;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;">🔄 DB同期</button>';

    if (isProxyPage) {
      const demoBar = document.querySelector('.proxy-demo-bar');
      if (demoBar && demoBar.parentNode) {
        demoBar.parentNode.insertBefore(bar, demoBar.nextSibling);
      } else {
        document.body.prepend(bar);
      }
    } else {
      const welcome = document.querySelector('.welcome');
      if (welcome && welcome.parentNode) {
        welcome.parentNode.insertBefore(bar, welcome.nextSibling);
      } else {
        document.body.prepend(bar);
      }
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

  function getLocalPortalData() {
    try {
      return JSON.parse(localStorage.getItem('takarazuka-portal-v1')) || {};
    } catch {
      return {};
    }
  }

  function buildSyncPayload() {
    if (isProxyPage) {
      const data = getLocalPortalData();
      return {
        reservations: data.reservations || [],
        reservationHistory: data.reservationHistory || [],
        companions: data.companions || [],
        line: Boolean(data.line),
        events: data.events || {},
        eventApplications: data.eventApplications || {},
        profileContent: data.profileContent || { bio: '', instagram: '', facebook: '', x: '', line: '', public: false },
        profileVisibility: data.profileVisibility || { portrait: 'icon', name: 'initials', competition: false, bio: false, line: false, instagram: false, facebook: false, x: false }
      };
    }

    return {
      reservations: (typeof state !== 'undefined' && state.reservations) || [],
      reservationHistory: (typeof state !== 'undefined' && state.reservationHistory) || [],
      companions: ((typeof state !== 'undefined' && state.companions) || []).map(c => ({
        id: c.id,
        name: c.name,
        kana: c.kana,
        type: c.type,
        phone: c.phone,
        publicVisibility: c.publicVisibility
      })),
      line: Boolean(typeof state !== 'undefined' && state.line),
      events: (typeof state !== 'undefined' && state.events) || {},
      eventApplications: (typeof state !== 'undefined' && state.eventApplications) || {},
      profileContent: (typeof state !== 'undefined' && state.profileContent) || { bio: '', instagram: '', facebook: '', x: '', line: '', public: false },
      profileVisibility: (typeof state !== 'undefined' && state.profileVisibility) || { portrait: 'icon', name: 'initials', competition: false, bio: false, line: false, instagram: false, facebook: false, x: false }
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
        const count = ((isProxyPage ? getLocalPortalData() : state).reservations || []).length;
        setSyncStatus(`✓ Golfans クラウドDB 同期済（予約 ${count}件 · 会員 0889582 · ${t}）`, true);
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
      const resp = await fetch(SUPABASE_API + '?member_id=' + encodeURIComponent(MEMBER_ID) + '&_t=' + Date.now());
      const data = await resp.json();
      if (data && data.ok && data.found && data.state) {
        isHydrating = true;
        const remote = data.state;

        if (isProxyPage) {
          // 代理人画面の場合
          let local = getLocalPortalData();
          if (Array.isArray(remote.reservations)) local.reservations = remote.reservations;
          if (Array.isArray(remote.reservationHistory)) local.reservationHistory = remote.reservationHistory;
          try {
            localStorage.setItem('takarazuka-portal-v1', JSON.stringify(local));
          } catch {}

          if (typeof proxyMember !== 'undefined' && proxyMember === 'ito') {
            if (typeof state !== 'undefined') {
              state.reservations = local.reservations;
              state.reservationHistory = local.reservationHistory;
            }
            if (typeof proxyRender === 'function') proxyRender();
          }
        } else {
          // メンバー専用画面の場合
          if (Array.isArray(remote.reservations)) {
            state.reservations = remote.reservations;
          }
          if (Array.isArray(remote.reservationHistory)) {
            state.reservationHistory = remote.reservationHistory;
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
          if (typeof current !== 'undefined' && current && current.k && typeof render === 'function') {
            render(current.k, current.arg);
          }
        }

        isHydrating = false;
        const count = ((isProxyPage ? getLocalPortalData() : state).reservations || []).length;
        const t = new Date().toLocaleTimeString('ja-JP');
        setSyncStatus(`✓ Golfans クラウドDB 同期完了（予約 ${count}件 · ${t}）`, true);
        if (manual && typeof toast === 'function') toast('Golfans クラウドDBから最新データを同期しました');
      } else {
        await pushToSupabase();
      }
    } catch (e) {
      isHydrating = false;
      setSyncStatus('⚠️ ローカルモード（クラウド待機）', false);
    }
  }

  // フック処理
  if (isProxyPage) {
    // proxy.js 用フック
    function hookProxyMutation() {
      if (typeof window.proxySaveMutation === 'function' && !window.proxySaveMutation.__hooked) {
        const origProxySave = window.proxySaveMutation;
        window.proxySaveMutation = function(fn) {
          origProxySave.apply(this, arguments);
          if (typeof proxyMember !== 'undefined' && proxyMember === 'ito') {
            pushToSupabase();
          }
        };
        window.proxySaveMutation.__hooked = true;
      }
    }
    hookProxyMutation();
    setTimeout(hookProxyMutation, 500);
    setTimeout(hookProxyMutation, 1500);
  } else {
    // index.html 用フック
    const origSave = window.save;
    if (typeof origSave === 'function') {
      window.save = function() {
        origSave.apply(this, arguments);
        pushToSupabase();
      };
    }
  }

  // ウィンドウ復帰時・タブ切替時に自動同期
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullFromSupabase(false);
    }
  });

  window.GolfansSync = {
    pull: pullFromSupabase,
    push: pushToSupabase
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => pullFromSupabase(false));
  } else {
    pullFromSupabase(false);
  }
})();
