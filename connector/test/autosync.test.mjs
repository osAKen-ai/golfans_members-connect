// Cron autosync tests. Every outbound request is answered by the mock below; nothing real is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

const UP = 'takarazuka-members-portal-demo.tsuyoshi-ito515118.chatgpt.site';
const T0 = Date.UTC(2026, 10, 5, 1, 0); // 2026-11-05 10:00 JST
const MIN = 60_000;
let beacon = 0;
const page = (v, extra = '') => `<html><head><link href="app.css?v=${v}"></head><body>${extra}<script src="app.js?v=${v}"></script><script src="supabase-sync.js"></script>` +
  `<script>(function(){function c(){var b=a.contentDocument||x;window.__CF$cv$params={r:'${beacon++}'}}})();</script></body></html>`;

function world() {
  const w = {
    files: { '/': () => page('1'), '/proxy': () => page('1'), '/app.js': () => 'const img="assets/crest.jpeg";', '/app.css': () => 'body{}', '/assets/crest.jpeg': () => 'JPEG' },
    runs: [], commits: [], calls: [], dispatched: [],
  };
  w.outbound = async request => {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.text() : null;
    w.calls.push({ host: url.hostname, path: url.pathname, method: request.method, body, auth: request.headers.get('Authorization') });
    if (url.hostname === UP) {
      const f = w.files[url.pathname];
      return f ? new Response(f()) : new Response('nf', { status: 404 });
    }
    if (url.hostname === 'api.github.com') {
      if (url.pathname.endsWith('/dispatches')) {
        const id = JSON.parse(body).inputs.publish_request_id;
        w.dispatched.push(id);
        w.runs.unshift({ id: 1000 + w.dispatched.length, display_title: `Ito publish ${id}`, status: 'queued', conclusion: null });
        return new Response(null, { status: 204 });
      }
      if (url.pathname.endsWith('/runs')) return Response.json({ workflow_runs: w.runs });
      if (url.pathname.endsWith('/commits')) return Response.json(w.commits);
    }
    if (url.hostname === 'slack.com') return Response.json({ ok: true });
    if (url.hostname === 'api.line.me') return Response.json({});
    throw new Error('unexpected outbound ' + url.href);
  };
  return w;
}

async function harness(t, bindings = {}) {
  const w = world();
  const mf = new Miniflare({
    modules: true, scriptPath: resolve('dist/worker.mjs'),
    compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
    kvNamespaces: ['OAUTH_KV'],
    bindings: { AUTOSYNC_ENABLED: 'true', AUTOSYNC_HOURS: '8-22', GITHUB_ITO_SYNC_TOKEN: 'test-only-token', ...bindings },
    outboundService: w.outbound,
  });
  await mf.ready;
  t.after(() => mf.dispose());
  const worker = await mf.getWorker();
  const kv = await mf.getKVNamespace('OAUTH_KV');
  const tick = async at => { const before = w.calls.length; await worker.scheduled({ cron: '*/5 * * * *', scheduledTime: new Date(at) }); return w.calls.slice(before); };
  const state = async () => JSON.parse(await kv.get('autosync:state:v1'));
  const finish = (conclusion = 'success') => { w.runs[0].status = 'completed'; w.runs[0].conclusion = conclusion; };
  return { w, tick, state, finish };
}

test('disabled flag: no outbound at all', async t => {
  const h = await harness(t, { AUTOSYNC_ENABLED: 'false' });
  assert.equal((await h.tick(T0)).length, 0);
});

test('first tick makes one baseline dispatch; success without commit sends nothing', async t => {
  const h = await harness(t);
  const calls = await h.tick(T0);
  assert.equal(h.w.dispatched.length, 1);
  assert.ok(calls.length <= 50, 'subrequest budget');
  assert.ok(!calls.some(c => c.path.includes('supabase-sync.js')), 'local-only file is not watched');
  await h.tick(T0 + 5 * MIN); // still queued
  assert.equal(h.w.dispatched.length, 1);
  h.finish();
  await h.tick(T0 + 10 * MIN);
  const s = await h.state();
  assert.equal(s.pending, null);
  assert.equal(s.lastResult.commit, null);
  assert.ok(!h.w.calls.some(c => c.host === 'slack.com' || c.host === 'api.line.me'));
});

test('beacon-only differences are not a change', async t => {
  const h = await harness(t);
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  for (let i = 2; i < 8; i++) await h.tick(T0 + i * 5 * MIN);
  assert.equal(h.w.dispatched.length, 1);
});

test('page change: waits until stable for 5 minutes, then dispatches once', async t => {
  const h = await harness(t);
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  h.w.files['/'] = () => page('2');
  await h.tick(T0 + 10 * MIN);
  assert.equal(h.w.dispatched.length, 1, 'settling, not yet');
  await h.tick(T0 + 15 * MIN);
  assert.equal(h.w.dispatched.length, 2);
  await h.tick(T0 + 20 * MIN);
  assert.equal(h.w.dispatched.length, 2, 'no duplicate while run is pending');
});

test('continuous edits: dispatch after 30 minutes at most', async t => {
  const h = await harness(t);
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  for (let i = 2; i <= 9; i++) { h.w.files['/'] = () => page('e' + i); await h.tick(T0 + i * 5 * MIN); }
  assert.equal(h.w.dispatched.length, 2);
});

test('asset edit without ?v= bump is caught by the rotating check', async t => {
  const h = await harness(t, { AUTOSYNC_ASSET_BATCH: '1' });
  await h.tick(T0); h.finish();
  for (let i = 1; i <= 4; i++) await h.tick(T0 + i * 5 * MIN); // learn every file
  h.w.files['/app.js'] = () => 'const img="assets/crest.jpeg"; // edited';
  for (let i = 5; i <= 12; i++) await h.tick(T0 + i * 5 * MIN);
  assert.equal(h.w.dispatched.length, 2);
});

test('another run already active: no dispatch until it ends', async t => {
  const h = await harness(t);
  h.w.runs.push({ id: 1, display_title: 'Ito portal sync', status: 'in_progress' });
  await h.tick(T0);
  assert.equal(h.w.dispatched.length, 0);
  h.w.runs[0].status = 'completed'; h.w.runs[0].conclusion = 'success';
  await h.tick(T0 + 5 * MIN);
  assert.equal(h.w.dispatched.length, 1);
});

test('failure: retry after 30 minutes, at most twice', async t => {
  const h = await harness(t);
  await h.tick(T0); h.finish('failure');
  await h.tick(T0 + 5 * MIN);
  await h.tick(T0 + 20 * MIN);
  assert.equal(h.w.dispatched.length, 1, 'backing off');
  await h.tick(T0 + 36 * MIN);
  assert.equal(h.w.dispatched.length, 2);
  h.finish('failure'); await h.tick(T0 + 41 * MIN); await h.tick(T0 + 72 * MIN);
  assert.equal(h.w.dispatched.length, 3);
  h.finish('failure'); for (let i = 0; i < 12; i++) await h.tick(T0 + (80 + i * 10) * MIN);
  assert.equal(h.w.dispatched.length, 3, 'gives up; Actions schedule remains as backstop');
});

test('off hours (JST 23:00): no upstream or dispatch', async t => {
  const h = await harness(t);
  const calls = await h.tick(Date.UTC(2026, 10, 5, 14, 0));
  assert.equal(calls.length, 0);
});

test('notify ON (slack, dummy token, mocked): only after a successful run that committed', async t => {
  const h = await harness(t, { NOTIFY_ENABLED: 'true', NOTIFY_CHANNEL: 'slack', SLACK_NOTIFY_TOKEN: 'test-only-slack', SLACK_NOTIFY_CHANNEL: 'C_TEST_ONLY' });
  await h.tick(T0); h.finish('failure'); await h.tick(T0 + 5 * MIN);
  assert.ok(!h.w.calls.some(c => c.host === 'slack.com'), 'no notice on failure');
  h.w.commits = [{ sha: 'abc1234def', commit: { message: 'feat(auto-sync): sync Ito-san portal (2 files)' } }];
  await h.tick(T0 + 36 * MIN); h.finish('success'); await h.tick(T0 + 41 * MIN);
  const sent = h.w.calls.filter(c => c.host === 'slack.com');
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].body);
  assert.equal(body.channel, 'C_TEST_ONLY');
  assert.match(body.text, /本番に反映しました/);
  assert.match(body.text, /オサケン内ミシェル$/);
  assert.equal((await h.state()).lastResult.notified, 'slack_sent');
});

test('notify ON but no token: does not send, records not_configured', async t => {
  const h = await harness(t, { NOTIFY_ENABLED: 'true' });
  h.w.commits = [{ sha: 'abc1234def', commit: { message: 'feat(auto-sync): sync Ito-san portal (1 files)' } }];
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  assert.ok(!h.w.calls.some(c => c.host === 'slack.com' || c.host === 'api.line.me'));
  assert.equal((await h.state()).lastResult.notified, 'slack_not_configured');
});

test('notify OFF by default even when a commit landed', async t => {
  const h = await harness(t);
  h.w.commits = [{ sha: 'abc1234def', commit: { message: 'feat(auto-sync): sync Ito-san portal (1 files)' } }];
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  assert.ok(!h.w.calls.some(c => c.host === 'slack.com' || c.host === 'api.line.me'));
  assert.equal((await h.state()).lastResult.notified, 'off');
});

test('notify via LINE uses push API (mocked)', async t => {
  const h = await harness(t, { NOTIFY_ENABLED: 'true', NOTIFY_CHANNEL: 'line', LINE_CHANNEL_ACCESS_TOKEN: 'test-only-line', LINE_NOTIFY_TO: 'Utest' });
  h.w.commits = [{ sha: 'abc1234def', commit: { message: 'feat(auto-sync): sync Ito-san portal (1 files)' } }];
  await h.tick(T0); h.finish(); await h.tick(T0 + 5 * MIN);
  const sent = h.w.calls.filter(c => c.host === 'api.line.me');
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].body).to, 'Utest');
});
