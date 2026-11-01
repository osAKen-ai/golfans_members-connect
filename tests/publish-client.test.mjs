import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../publish.js', import.meta.url), 'utf8');
const id = '12345678-1234-4234-8234-123456789abc';
async function page(responses, { storage = new Map(), hash = '' } = {}) {
  const nodes = new Map();
  for (const name of ['publishButton', 'checkButton', 'statusTitle', 'statusDetail', 'statusDot']) {
    nodes.set(name, { disabled: name === 'publishButton', hidden: name === 'checkButton', textContent: '', dataset: {}, handlers: {}, closest() { return { setAttribute() {} }; }, addEventListener(event, callback) { this.handlers[event] = callback; } });
  }
  const calls = [], timers = [];
  const location = { pathname: '/publish', search: '', hash };
  vm.runInNewContext(source, {
    document: { hidden: false, getElementById: name => nodes.get(name), addEventListener() {} },
    location,
    history: { replaceState(_a, _b, path) { assert.equal(path, '/publish'); location.hash = ''; } },
    sessionStorage: { getItem: name => storage.get(name), setItem: (name, value) => storage.set(name, value), removeItem: name => storage.delete(name) },
    crypto: { randomUUID: () => id },
    URLSearchParams, AbortSignal, Date, JSON, Number,
    setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
    async fetch(url, options) {
      calls.push({ url, options });
      const next = responses.shift();
      assert.ok(next, 'Unexpected browser request');
      if (next instanceof Error) throw next;
      return next;
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, calls, timers, storage, location };
}
const ok = data => Response.json(data);

test('lost dispatch response keeps the operation ID and checks only that operation after reload', async () => {
  const storage = new Map();
  const first = await page([ok({ ok: true, run: null }), new Error('connection lost'), ok({ ok: true, run: null })], { storage });
  await first.nodes.get('publishButton').handlers.click();
  assert.equal(first.nodes.get('publishButton').disabled, true);
  await first.nodes.get('checkButton').handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.calls.filter(call => call.options.method === 'POST').length, 1);
  assert.equal(first.calls.at(-1).url, '/api/publish?request_id=' + id);
  assert.equal(first.nodes.get('statusTitle').textContent, '受付済みです');
  const restored = await page([ok({ ok: true, run: null })], { storage });
  assert.equal(restored.calls.length, 1);
  assert.equal(restored.calls[0].options.method, 'GET');
  assert.equal(restored.calls[0].url, '/api/publish?request_id=' + id);
  assert.equal(restored.nodes.get('publishButton').disabled, true);
});
test('failed workflow is not presented as a successful publication', async () => {
  const p = await page([ok({ ok: true, run: null }), ok({ ok: true, accepted: true, run_id: 101, request_id: id }), ok({ ok: true, run: { id: 101, status: 'completed', conclusion: 'failure' } })]);
  await p.nodes.get('publishButton').handlers.click();
  await p.timers.at(-1)();
  assert.equal(p.nodes.get('statusTitle').textContent, '反映を確認できませんでした');
  assert.equal(p.nodes.get('publishButton').disabled, false);
});
test('access link exchanges a session but never stores the access key in web storage', async () => {
  const key = 'test-only-key-'.padEnd(43, 'x');
  const p = await page([ok({ ok: true }), ok({ ok: true, run: null })], { hash: '#access=' + key });
  assert.equal(p.location.hash, '');
  assert.equal(p.calls[0].url, '/api/publish?session=1');
  assert.equal(p.calls[0].options.headers.Authorization, 'Bearer ' + key);
  assert.equal(p.calls[1].options.headers.Authorization, undefined);
  assert.equal([...p.storage.values()].some(value => value.includes(key)), false);
  assert.equal(p.calls.some(call => call.url === '/api/publish' && call.options.method === 'POST'), false);
});
