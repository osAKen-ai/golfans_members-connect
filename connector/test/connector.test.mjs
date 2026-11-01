import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

const code = 'test-only-connector-code-'.padEnd(43, 'x');
const redirect = 'https://chatgpt.com/connector_platform/oauth/callback';
const id = '12345678-1234-4234-8234-123456789abc';
const oldRun = { id: 100, workflow_id: 399056234, head_branch: 'main', status: 'completed', conclusion: 'success', updated_at: '2026-11-01T09:00:00Z' };

async function harness(t) {
  const upstream = [];
  const mf = new Miniflare({
    host: '127.0.0.1', port: 0, modules: true, scriptPath: resolve('dist/worker.mjs'),
    compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
    kvNamespaces: ['OAUTH_KV'],
    bindings: { ALLOW_LOCAL_OAUTH: 'true', ITO_CONNECTOR_CODE_SHA256: createHash('sha256').update(code).digest('hex'), GITHUB_ITO_SYNC_TOKEN: 'test-only-server-token' },
    outboundService: async request => {
      const url = new URL(request.url);
      assert.equal(url.hostname, 'api.github.com', 'No non-GitHub outbound requests allowed');
      upstream.push({ url: url.href, method: request.method, body: request.method === 'POST' ? await request.json() : null });
      if (request.method === 'POST') return Response.json({ workflow_run_id: 101 });
      if (url.pathname.endsWith('/actions/runs/101')) return Response.json({ ...oldRun, id: 101 });
      return Response.json({ workflow_runs: [oldRun] });
    },
  });
  const base = String(await mf.ready).replace(/\/$/, '');
  t.after(() => mf.dispose());
  const send = (path, options = {}) => mf.dispatchFetch(base + path, { redirect: 'manual', ...options });
  return { mf, base, send, upstream };
}

async function register(h, callback = redirect) {
  const response = await h.send('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: '<img src=x onerror=alert(1)>', redirect_uris: [callback], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
  assert.equal(response.status, 201);
  return response.json();
}

async function openConsent(h, client, callback = redirect) {
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: callback, scope: 'portal:status portal:publish offline_access', resource: h.base + '/mcp', state: 'test-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  const path = '/authorize?' + query;
  const response = await h.send(path);
  const html = await response.text();
  const cookies = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
  return { path, response, html, cookies, handle, verifier };
}

async function grant(h) {
  const client = await register(h);
  const consent = await openConsent(h, client);
  assert.equal(consent.response.status, 200);
  const response = await h.send(consent.path, { method: 'POST', headers: { Origin: h.base, Cookie: consent.cookies, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: consent.handle, decision: 'approve', code }).toString() });
  assert.equal(response.status, 302, await response.clone().text());
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://chatgpt.com');
  assert.equal(location.searchParams.get('state'), 'test-state');
  const exchangeBody = new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: redirect, code: location.searchParams.get('code'), code_verifier: consent.verifier, resource: h.base + '/mcp' });
  const tokenResponse = await h.send('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: exchangeBody.toString() });
  assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
  return { token: await tokenResponse.json(), client, exchangeBody };
}

async function rpc(h, token, method, params = {}, rpcId = 1) {
  const response = await h.send('/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-03-26' }, body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params }) });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  return JSON.parse(text);
}

test('OAuth discovery challenges unauthenticated MCP clients without contacting GitHub', async t => {
  const h = await harness(t);
  const response = await h.send('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
  assert.ok(response.headers.get('WWW-Authenticate')?.includes('resource_metadata'));
  const metadata = await (await h.send('/.well-known/oauth-authorization-server')).json();
  assert.equal(metadata.authorization_endpoint, h.base + '/authorize');
  assert.equal(metadata.token_endpoint, h.base + '/oauth/token');
  assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
  assert.equal(h.upstream.length, 0);
});

test('consent escapes client text, validates code and redirect, and refuses forged form posts', async t => {
  const h = await harness(t);
  const client = await register(h);
  const consent = await openConsent(h, client);
  assert.equal(consent.response.status, 200);
  assert.ok(consent.html.includes('&#60;img'));
  assert.equal(consent.html.includes('<img src=x'), false);
  assert.ok(consent.response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  const form = new URLSearchParams({ handle: consent.handle, decision: 'approve', code }).toString();
  const noCookie = await h.send(consent.path, { method: 'POST', headers: { Origin: h.base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  assert.equal(noCookie.status, 400);
  const wrong = await h.send(consent.path, { method: 'POST', headers: { Origin: h.base, Cookie: consent.cookies, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: consent.handle, decision: 'approve', code: 'wrong' }).toString() });
  assert.equal(wrong.status, 401);
  const evilClient = await register(h, 'https://evil.example/callback');
  assert.equal((await openConsent(h, evilClient, 'https://evil.example/callback')).response.status, 400);
  assert.equal(h.upstream.length, 0);
});

test('authorization-code flow with PKCE can list and call only the two publish tools', async t => {
  const h = await harness(t);
  const { token, exchangeBody } = await grant(h);
  assert.ok(token.access_token);
  assert.ok(token.refresh_token);
  const init = await rpc(h, token.access_token, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'local-protocol-test', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'golfans-ito-publish');
  const listed = await rpc(h, token.access_token, 'tools/list');
  assert.deepEqual(listed.result.tools.map(tool => tool.name).sort(), ['get_publish_status', 'publish_latest_portal']);
  const published = await rpc(h, token.access_token, 'tools/call', { name: 'publish_latest_portal', arguments: { request_id: id } });
  assert.equal(published.result.structuredContent.accepted, true, JSON.stringify({ result: published.result, upstream: h.upstream }));
  assert.equal(published.result.structuredContent.run_id, 101);
  assert.equal(h.upstream.filter(call => call.method === 'POST').length, 1);
  assert.deepEqual(h.upstream.find(call => call.method === 'POST').body, { ref: 'main', inputs: { selftest_failure: false, publish_request_id: id } });
  const status = await rpc(h, token.access_token, 'tools/call', { name: 'get_publish_status', arguments: { run_id: '101' } });
  assert.equal(status.result.structuredContent.run.conclusion, 'success');
  const unknown = await rpc(h, token.access_token, 'tools/call', { name: 'send_email', arguments: {} });
  assert.ok(unknown.error || unknown.result?.isError);
  assert.equal(h.upstream.filter(call => call.method === 'POST').length, 1);
  // Replaying a code also invalidates its grant. Check only after exercising it.
  const replay = await h.send('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: exchangeBody.toString() });
  assert.equal(replay.status, 400);
});

test('setup without a real credential remains closed', async t => {
  const mf = new Miniflare({ modules: true, scriptPath: resolve('dist/worker.mjs'), compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], kvNamespaces: ['OAUTH_KV'] });
  t.after(() => mf.dispose());
  const response = await mf.dispatchFetch('https://connector.example/mcp');
  assert.equal(response.status, 503);
});

test('refresh preserves access while a narrower token cannot start updates', async t => {
  const h = await harness(t);
  const { token, client } = await grant(h);
  const response = await h.send('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: token.refresh_token, resource: h.base + '/mcp', scope: 'portal:status' }).toString() });
  assert.equal(response.status, 200);
  const refreshed = await response.json();
  const read = await rpc(h, refreshed.access_token, 'tools/call', { name: 'get_publish_status', arguments: {} });
  assert.equal(read.result.structuredContent.ok, true);
  const write = await rpc(h, refreshed.access_token, 'tools/call', { name: 'publish_latest_portal', arguments: { request_id: id } });
  assert.equal(write.result.isError, true);
  assert.equal(write.result.structuredContent.error, 'insufficient_scope');
  assert.equal(h.upstream.filter(call => call.method === 'POST').length, 0);
});
