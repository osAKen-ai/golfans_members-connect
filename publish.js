(() => {
  'use strict';
  const button = document.getElementById('publishButton');
  const check = document.getElementById('checkButton');
  const title = document.getElementById('statusTitle');
  const detail = document.getElementById('statusDetail');
  const dot = document.getElementById('statusDot');
  const storage = {
    get(name) { try { return sessionStorage.getItem(name); } catch { return null; } },
    set(name, value) { try { if (value === null) sessionStorage.removeItem(name); else sessionStorage.setItem(name, value); } catch { /* Keep working in memory. */ } },
  };
  const access = new URLSearchParams(location.hash.slice(1)).get('access');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  let pending = null;
  try { pending = JSON.parse(storage.get('ito-publish-pending')); } catch { /* Ignore invalid local state. */ }
  let busy = false;
  let timer;
  let pollCount = 0;

  function state(label, message, kind = '') {
    title.textContent = label;
    detail.textContent = message;
    dot.dataset.state = kind;
    title.closest('section').setAttribute('aria-busy', String(kind === 'working'));
  }
  function remember(value) {
    pending = value;
    storage.set('ito-publish-pending', value ? JSON.stringify(value) : null);
  }
  function schedule() {
    clearTimeout(timer);
    if (pollCount++ < 360) timer = setTimeout(() => refresh(), 5000);
    else {
      state('確認に時間がかかっています', '処理を再実行せず、「状況を確認する」で確認してください。');
      check.hidden = false;
    }
  }
  async function api(method = 'GET', runId = null, requestId = null) {
    const query = runId ? '?run_id=' + encodeURIComponent(runId) : requestId ? '?request_id=' + encodeURIComponent(requestId) : '';
    const response = await fetch('/api/publish' + query, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify({ request_id: pending.request_id }) } : {}),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error(method === 'POST' ? 'acceptance_unknown' : 'status_unavailable'); }
    if (!response.ok) throw new Error(data.error || 'status_unavailable');
    return data;
  }
  function date(value) {
    if (!value || Number.isNaN(Date.parse(value))) return '';
    return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function showRun(run) {
    if (run && run.status !== 'completed') {
      button.disabled = true;
      state('反映を進めています', '内容の確認から公開サイトへの反映まで、しばらくお待ちください。', 'working');
      schedule();
      return;
    }
    const alreadyRunning = pending?.already_running;
    remember(null);
    button.disabled = false;
    check.hidden = true;
    if (alreadyRunning) state('最新の内容を反映できます', '前の更新処理が終了しました。今の内容を反映するには、上のボタンを押してください。');
    else if (!run) state('反映できます', '最新の内容ができたら、上のボタンを押してください。');
    else if (run.conclusion === 'success') state('公開サイトへの反映を確認しました', date(run.updated_at) + ' · 最新の反映確認', 'success');
    else state('反映を確認できませんでした', '元の公開内容を確認のうえ、オサケンさんにお知らせください。', 'error');
  }
  function problem(code, posting = false) {
    if (code === 'unauthorized' || code === 'forbidden') {
      check.hidden = true;
      button.disabled = true;
      state('更新リンクを確認してください', '伊藤さん用の更新リンクから、もう一度開いてください。', 'error');
    } else if (code === 'not_configured') {
      check.hidden = true;
      button.disabled = true;
      state('更新ボタンを準備しています', '利用開始まで、もうしばらくお待ちください。');
    } else {
      button.disabled = posting || Boolean(pending);
      state(posting ? '受付状況を確認しています' : '状況を取得できませんでした', posting ? '処理が始まっている場合があります。再実行せず、「状況を確認する」を押してください。' : '時間をおいて「状況を確認する」を押してください。', 'error');
      check.hidden = false;
    }
  }
  async function refresh() {
    if (busy) return;
    if (document.hidden) { if (pending) schedule(); return; }
    busy = true;
    try {
      if (pending && !pending.run_id && !pending.request_id) {
        button.disabled = true;
        state('受付の確認が必要です', '再実行せず、オサケンさんに状況をご確認ください。', 'error');
        check.hidden = false;
        return;
      }
      const data = await api('GET', pending?.run_id, pending?.request_id);
      const run = data.run;
      if (pending && !pending.run_id) {
        if (!run) {
          button.disabled = true;
          state('受付済みです', '処理の開始を確認しています。', 'working');
          schedule();
          return;
        }
        remember({ ...pending, run_id: run.id });
      }
      showRun(run);
    } catch (error) { problem(error.message); }
    finally { busy = false; }
  }
  button.addEventListener('click', async () => {
    if (busy || button.disabled) return;
    busy = true;
    button.disabled = true;
    check.hidden = true;
    clearTimeout(timer);
    pollCount = 0;
    state('更新を受け付けています', 'この画面で、そのままお待ちください。', 'working');
    // Save before POST so a lost response or reload never triggers an automatic retry.
    remember({ requested_at: new Date().toISOString(), request_id: crypto.randomUUID(), run_id: null });
    try {
      const data = await api('POST');
      if (data.run) remember({ run_id: data.run.id, already_running: !data.already_requested });
      else remember({ requested_at: data.requested_at, request_id: data.request_id, run_id: data.run_id });
      state(data.accepted ? '受付済みです' : 'すでに反映中です', data.accepted ? '公開サイトへの反映が確認できるまで、しばらくお待ちください。' : '別の更新処理が進んでいます。完了後に、もう一度ボタンを押してください。', 'working');
      schedule();
    } catch (error) { problem(error.message, true); }
    finally { busy = false; }
  });
  check.addEventListener('click', () => { pollCount = 0; refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  async function start() {
    if (access) {
      try {
        const response = await fetch('/api/publish?session=1', {
          method: 'POST', headers: { Authorization: 'Bearer ' + access }, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'status_unavailable');
      } catch (error) { problem(error.message); return; }
    }
    refresh();
  }
  start();
})();
