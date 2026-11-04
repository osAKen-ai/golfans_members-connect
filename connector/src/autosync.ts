// Cloud replacement for the M5 launchd jobs (ai.osaken.golfans-ito-watch / golfans-ito-sync-kick).
// Every 5 minutes (Cron Trigger): fingerprint Ito-san's chatgpt.site, and when it changed and has
// settled, start the existing auto-sync-ito.yml workflow. The workflow stays the only writer: it
// fetches, validates, commits, and verifies production. This file never touches the repo itself.
// Optional completion notice: OFF unless NOTIFY_ENABLED === 'true'.

const REPO = 'osAKen-ai/golfans_members-connect';
const WORKFLOW = 'auto-sync-ito.yml';
const UPSTREAM = 'https://takarazuka-members-portal-demo.tsuyoshi-ito515118.chatgpt.site';
const PROD_URL = 'https://golfans-members-connect.pages.dev';
// Same pages and same Cloudflare beacon strip as .github/scripts/sync_ito_portal.py.
const PAGES: Record<string, string> = { 'index.html': '/', 'proxy.html': '/proxy?agent=agent-yamada' };
const CF_BEACON_RE = /<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g;
const LOCAL_ONLY = new Set(['supabase-sync.js']);
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const STATE_KEY = 'autosync:state:v1';
const MIN = 60_000;
const SETTLE_MS = 5 * MIN;       // watch.sh: same signature for 5 minutes
const MAX_WAIT_MS = 30 * MIN;    // watch.sh: or 30 minutes since the change was first seen
const RETRY_MS = 30 * MIN;       // after a failed run, try again once per 30 minutes
const MAX_RETRIES = 2;           // then wait for the next change or the Actions schedule backstop
const LOST_MS = 15 * MIN;        // dispatched run never appeared

export type State = {
  pages: Record<string, string>;
  assets: Record<string, string>;
  cursor: number;
  obs: null | { firstSeen: number; lastChange: number; notBefore?: number; retries?: number };
  pending: null | { id: string; at: number; retries: number };
  lastScanAt?: number;
  lastResult?: { at: number; id: string; conclusion: string; commit?: string | null; notified?: string };
  lastNotifiedCommit?: string;
};

const empty = (): State => ({ pages: {}, assets: {}, cursor: 0, obs: null, pending: null });

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function jstHour(now: number) { return new Date(now + 9 * 3600_000).getUTCHours(); }
export function inActiveHours(now: number, spec = '8-22') {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(spec.trim());
  if (!m) return true;
  const h = jstHour(now);
  return h >= Number(m[1]) && h <= Number(m[2]);
}

// Relative refs in a page, same pattern as the Python syncer: (?:src|href)=["']([^"'#?]+)
export function pageRefs(html: string) {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)=["']([^"'#?]+)/g)) {
    const ref = m[1].replace(/^\.\//, '');
    if (!ref || /^[a-z]+:/i.test(ref) || ref.startsWith('/') || ref.startsWith('//')) continue;
    if (LOCAL_ONLY.has(ref) || ref in PAGES) continue;
    out.add(ref);
  }
  return out;
}
export function textRefs(text: string) {
  return new Set(Array.from(text.matchAll(/assets\/[A-Za-z0-9_.\-/]+/g), m => m[0]).filter(r => !LOCAL_ONLY.has(r)));
}

async function upstream(path: string) {
  const res = await fetch(UPSTREAM + (path.startsWith('/') ? path : '/' + path), {
    headers: { 'User-Agent': 'Golfans-Ito-Autosync', 'Cache-Control': 'no-cache' },
    redirect: 'follow', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`upstream ${res.status} ${path}`);
  return res;
}

async function github(env: any, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_ITO_SYNC_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Golfans-Ito-Autosync', 'Content-Type': 'application/json',
    },
    redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`github ${res.status} ${path.split('?')[0]}`);
  return res.status === 204 ? null : res.json();
}

// One scan: both pages every tick (their ?v= stamps change with almost every edit), plus a rotating
// batch of the other files so an edit without a ?v= bump is still caught within ~25 minutes.
// Stays far under the Workers Free limit of 50 subrequests per invocation.
export async function scan(state: State, batch: number) {
  let changed: string[] = [];
  const refs = new Set<string>();
  for (const [name, path] of Object.entries(PAGES)) {
    const html = await (await upstream(path)).text();
    const hash = await sha256(html.replace(CF_BEACON_RE, ''));
    if (state.pages[name] && state.pages[name] !== hash) changed.push(name);
    state.pages[name] = hash;
    for (const r of pageRefs(html)) refs.add(r);
  }
  for (const known of Object.keys(state.assets)) if (known.startsWith('assets/')) refs.add(known);
  const list = [...refs].sort();
  for (const gone of Object.keys(state.assets)) if (!refs.has(gone)) delete state.assets[gone];
  const n = Math.min(batch, list.length);
  for (let i = 0; i < n; i++) {
    const ref = list[(state.cursor + i) % list.length];
    const res = await upstream(ref);
    let hash: string;
    if (/\.(js|css|html|json|svg|txt)$/i.test(ref)) {
      const text = (await res.text()).replace(CF_BEACON_RE, '');
      for (const r of textRefs(text)) if (!(r in state.assets)) state.assets[r] = '';
      hash = await sha256(text);
    } else {
      const bytes = await crypto.subtle.digest('SHA-256', await res.arrayBuffer());
      hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    }
    if (state.assets[ref] && state.assets[ref] !== hash) changed.push(ref);
    state.assets[ref] = hash;
  }
  state.cursor = list.length ? (state.cursor + n) % list.length : 0;
  return changed;
}

function notifyText(env: any, at: number) {
  const t = new Date(at + 9 * 3600_000);
  const hhmm = `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  return env.NOTIFY_TEXT_TEMPLATE
    ? String(env.NOTIFY_TEXT_TEMPLATE).replace('{time}', hhmm).replace('{url}', PROD_URL)
    : `伊藤さん、ポータルの更新を本番に反映しました（${hhmm} JST）。${PROD_URL} ご確認ください。\nオサケン内ミシェル`;
}

// Returns a short status string. Never throws for a missing token: it just does not send.
export async function notify(env: any, at: number): Promise<string> {
  if (env.NOTIFY_ENABLED !== 'true') return 'off';
  const text = notifyText(env, at);
  if (env.NOTIFY_CHANNEL === 'line') {
    if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.LINE_NOTIFY_TO) return 'line_not_configured';
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: env.LINE_NOTIFY_TO, messages: [{ type: 'text', text }] }),
    });
    return res.ok ? 'line_sent' : `line_error_${res.status}`;
  }
  if (!env.SLACK_NOTIFY_TOKEN || !env.SLACK_NOTIFY_CHANNEL) return 'slack_not_configured';
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${env.SLACK_NOTIFY_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: env.SLACK_NOTIFY_CHANNEL, text, unfurl_links: false }),
  });
  const data: any = await res.json().catch(() => ({}));
  return data?.ok ? 'slack_sent' : `slack_error_${data?.error || res.status}`;
}

async function dispatch(env: any, state: State, now: number, retries: number) {
  const id = crypto.randomUUID();
  await github(env, `actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { selftest_failure: false, publish_request_id: id } }),
  });
  state.pending = { id, at: now, retries };
  state.obs = null;
}

// The cron entry point. Returns a log line (also used by tests).
export async function tick(env: any, now = Date.now()): Promise<string> {
  if (env.AUTOSYNC_ENABLED !== 'true') return 'disabled';
  if (!env.OAUTH_KV || !env.GITHUB_ITO_SYNC_TOKEN) return 'not_configured';
  const raw = await env.OAUTH_KV.get(STATE_KEY);
  const first = !raw;
  const state: State = raw ? JSON.parse(raw) : empty();
  const save = () => env.OAUTH_KV.put(STATE_KEY, JSON.stringify(state));
  let log = '';

  // 1) Finish a run we started (also outside active hours).
  let runs: any[] | null = null;
  const listRuns = async () => (runs ??= ((await github(env, `actions/workflows/${WORKFLOW}/runs?branch=main&per_page=20`))?.workflow_runs || []));
  if (state.pending) {
    const p = state.pending;
    const run = (await listRuns()).find(r => r.display_title === `Ito publish ${p.id}`);
    if (!run) {
      if (now - p.at < LOST_MS) { await save(); return 'waiting_for_run'; }
      state.pending = null; log = 'run_lost;';
      if (p.retries < MAX_RETRIES) state.obs = { firstSeen: now - MAX_WAIT_MS, lastChange: now, retries: p.retries + 1 };
    } else if (run.status !== 'completed') {
      await save(); return 'run_active';
    } else if (run.conclusion === 'success') {
      // Success means: nothing to change, or committed AND production hashes verified (workflow step).
      const since = new Date(p.at - MIN).toISOString();
      const commits: any[] = (await github(env, `commits?sha=main&since=${since}&per_page=10`)) || [];
      const c = commits.find(c => String(c?.commit?.message || '').startsWith('feat(auto-sync)'));
      state.lastResult = { at: now, id: p.id, conclusion: 'success', commit: c?.sha || null };
      if (c && c.sha !== state.lastNotifiedCommit) {
        const result = await notify(env, now);
        state.lastResult.notified = result;
        if (result.endsWith('_sent')) state.lastNotifiedCommit = c.sha;
      }
      state.pending = null; log = `run_success commit=${c ? c.sha.slice(0, 7) : 'none'} notify=${state.lastResult.notified || 'n/a'};`;
    } else {
      state.lastResult = { at: now, id: p.id, conclusion: run.conclusion || 'unknown' };
      state.pending = null; log = `run_${run.conclusion};`;
      // The workflow already opened an Issue. Retry a limited number of times, slowly.
      if (p.retries < MAX_RETRIES) state.obs = { firstSeen: now, lastChange: now, notBefore: now + RETRY_MS, retries: p.retries + 1 };
    }
  }

  // 2) Watch only inside active hours (same as watch.sh: JST 8-22).
  if (!inActiveHours(now, env.AUTOSYNC_HOURS)) { await save(); return log + 'off_hours'; }

  const batch = Math.max(0, Math.min(30, Number(env.AUTOSYNC_ASSET_BATCH || 10)));
  let changed: string[];
  try { changed = await scan(state, batch); } catch (e: any) { await save(); return log + `scan_error ${e?.message || e}`; }
  state.lastScanAt = now;
  if (first) state.obs = { firstSeen: now - MAX_WAIT_MS, lastChange: now - SETTLE_MS }; // one baseline run after deploy
  if (changed.length) {
    log += `changed=${changed.slice(0, 5).join(',')};`;
    state.obs = state.obs ? { ...state.obs, lastChange: now } : { firstSeen: now, lastChange: now };
  }

  // 3) Debounce, then start the workflow (never while another run is active).
  const o = state.obs;
  if (o && (!o.notBefore || now >= o.notBefore) && (now - o.lastChange >= SETTLE_MS || now - o.firstSeen >= MAX_WAIT_MS)) {
    if ((await listRuns()).some(r => ACTIVE.has(r.status))) { await save(); return log + 'other_run_active'; }
    await dispatch(env, state, now, o.retries || 0);
    log += `dispatched ${state.pending!.id}`;
  } else if (o) log += 'settling';
  else log += 'no_change';
  await save();
  return log;
}

export async function status(env: any) {
  const raw = env.OAUTH_KV ? await env.OAUTH_KV.get(STATE_KEY) : null;
  const s: State | null = raw ? JSON.parse(raw) : null;
  return {
    enabled: env.AUTOSYNC_ENABLED === 'true', notify: env.NOTIFY_ENABLED === 'true' ? (env.NOTIFY_CHANNEL || 'slack') : 'off',
    last_scan_at: s?.lastScanAt ? new Date(s.lastScanAt).toISOString() : null,
    tracked_files: s ? Object.keys(s.pages).length + Object.keys(s.assets).length : 0,
    pending: s?.pending ? { id: s.pending.id, at: new Date(s.pending.at).toISOString() } : null,
    observing: !!s?.obs, last_result: s?.lastResult || null,
  };
}
