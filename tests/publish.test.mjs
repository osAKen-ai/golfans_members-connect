import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequest } from '../functions/api/publish.js';

const key = 'test-only-key-'.padEnd(43, 'x');
const env = { ITO_PUBLISH_KEY_SHA256: createHash('sha256').update(key).digest('hex'), GITHUB_ITO_SYNC_TOKEN: 'server-only-test-token' };
const id = '12345678-1234-4234-8234-123456789abc';
const done = { id: 100, workflow_id: 399056234, head_branch: 'main', status: 'completed', conclusion: 'success', updated_at: '2026-11-01T09:00:00Z' };
function request(method = 'GET', query = '', options = {}) {
  return new Request('https://example.test/api/publish' + query, {
    method,
    headers: { Authorization: `Bearer ${key}`, Origin: 'https://example.test', ...options.headers },
    ...(method === 'POST' ? { body: JSON.stringify(options.body || { request_id: id }) } : {}),
  });
}
function intercept(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    const next = responses.shift();
    assert.ok(next, 'Unexpected upstream request');
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}
const json = data => Response.json(data);

test('unconfigured and unauthorized requests never reach GitHub', async t => {
  const calls = intercept(t, []);
  assert.equal((await onRequest({ request: request('POST'), env: {} })).status, 503);
  assert.equal((await onRequest({ request: request('POST', '', { headers: { Authorization: 'Bearer incorrect' } }), env })).status, 401);
  assert.equal(calls.length, 0);
});
test('cross-origin and originless writes are rejected', async t => {
  const calls = intercept(t, []);
  assert.equal((await onRequest({ request: request('POST', '', { headers: { Origin: 'https://other.test' } }), env })).status, 403);
  assert.equal((await onRequest({ request: new Request('https://example.test/api/publish', { method: 'POST', headers: { Authorization: `Bearer ${key}` } }), env })).status, 403);
  assert.equal(calls.length, 0);
});
test('access link becomes an HttpOnly session without dispatching', async t => {
  const calls = intercept(t, []);
  const response = await onRequest({ request: request('POST', '?session=1'), env });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('Set-Cookie');
  assert.ok(cookie.includes('HttpOnly; Secure; SameSite=Strict'));
  assert.ok(cookie.includes('Path=/api/publish;'));
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 0);
});
test('session cookie authenticates status reads', async t => {
  intercept(t, [json({ workflow_runs: [] })]);
  const response = await onRequest({ request: new Request('https://example.test/api/publish', { headers: { Cookie: `ito_publish_access=${key}` } }), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, run: null });
});
test('client cannot select a different repository, branch, or workflow', async t => {
  const calls = intercept(t, []);
  const response = await onRequest({ request: request('POST', '', { body: { request_id: id, ref: 'other', repo: 'elsewhere' } }), env });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
test('dispatch is restricted to the existing workflow and carries its own request ID', async t => {
  const calls = intercept(t, [json({ workflow_runs: [done] }), new Response(null, { status: 204 })]);
  const response = await onRequest({ request: request('POST'), env });
  const data = await response.json();
  assert.equal(response.status, 202);
  assert.equal(data.accepted, true);
  assert.equal(data.request_id, id);
  assert.equal(data.run_id, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.github.com/repos/osAKen-ai/golfans_members-connect/actions/workflows/auto-sync-ito.yml/dispatches');
  assert.deepEqual(JSON.parse(calls[1].body), { ref: 'main', inputs: { selftest_failure: false, publish_request_id: id } });
  assert.equal(calls[1].redirect, 'manual');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(JSON.stringify(data).includes(env.GITHUB_ITO_SYNC_TOKEN), false);
});
test('new GitHub dispatch response can bind the run immediately', async t => {
  intercept(t, [json({ workflow_runs: [] }), json({ workflow_run_id: 101 })]);
  const response = await onRequest({ request: request('POST'), env });
  assert.equal((await response.json()).run_id, 101);
});
test('existing request and active run do not dispatch again', async t => {
  const calls = intercept(t, [json({ workflow_runs: [{ ...done, display_title: `Ito publish ${id}` }] }), json({ workflow_runs: [{ ...done, status: 'in_progress', conclusion: null }] })]);
  const duplicate = await (await onRequest({ request: request('POST'), env })).json();
  assert.equal(duplicate.already_requested, true);
  const active = await (await onRequest({ request: request('POST'), env })).json();
  assert.equal(active.accepted, false);
  assert.equal(active.run.status, 'in_progress');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => !call.method));
});
test('a scheduled success cannot stand in for a button request', async t => {
  const calls = intercept(t, [json({ workflow_runs: [done, { ...done, id: 101, display_title: 'Ito publish another-request' }] }), json({ workflow_runs: [{ ...done, id: 102, display_title: `Ito publish ${id}` }] })]);
  const missing = await (await onRequest({ request: request('GET', '?request_id=' + id), env })).json();
  assert.equal(missing.run, null);
  const found = await (await onRequest({ request: request('GET', '?request_id=' + id), env })).json();
  assert.equal(found.run.id, 102);
  assert.ok(calls.every(call => call.url.endsWith('&event=workflow_dispatch')));
});
test('run lookup cannot expose another workflow or branch', async t => {
  intercept(t, [json({ ...done, workflow_id: 9 }), json({ ...done, head_branch: 'other' }), json(done)]);
  for (const expected of [404, 404, 200]) assert.equal((await onRequest({ request: request('GET', '?run_id=100'), env })).status, expected);
});
test('dispatch timeout is reported as uncertain and never retried', async t => {
  const calls = intercept(t, [json({ workflow_runs: [] }), new Error('secret upstream diagnostics')]);
  const response = await onRequest({ request: request('POST'), env });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: 'acceptance_unknown' });
  assert.equal(calls.length, 2);
});
test('invalid IDs and unsupported methods do not call upstream', async t => {
  const calls = intercept(t, []);
  assert.equal((await onRequest({ request: request('GET', '?run_id=../secrets'), env })).status, 400);
  assert.equal((await onRequest({ request: request('GET', '?request_id=not-a-uuid'), env })).status, 400);
  assert.equal((await onRequest({ request: new Request('https://example.test/api/publish', { method: 'DELETE' }), env })).status, 405);
  assert.equal(calls.length, 0);
});
