// Only the existing Ito sync workflow can be started. GitHub credentials stay on the server.
const REPO = 'osAKen-ai/golfans_members-connect';
const WORKFLOW = 'auto-sync-ito.yml';
const WORKFLOW_ID = 399056234;
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const COOKIE = 'ito_publish_access';

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function authorized(request, env) {
  const expected = env.ITO_PUBLISH_KEY_SHA256 || '';
  if (!/^[a-f0-9]{64}$/.test(expected) || !env.GITHUB_ITO_SYNC_TOKEN) return 'unconfigured';
  const token = readToken(request);
  if (!token) return false;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const actual = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  let different = 0;
  for (let i = 0; i < expected.length; i++) different |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}

function readToken(request) {
  const bearer = request.headers.get('Authorization');
  if (bearer) return bearer.match(/^Bearer ([A-Za-z0-9_-]{40,120})$/)?.[1];
  const cookie = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '='));
  return cookie?.match(/^ito_publish_access=([A-Za-z0-9_-]{40,120})$/)?.[1];
}

function summarize(run) {
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    started_at: run.run_started_at || run.created_at,
    updated_at: run.updated_at,
  };
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_ITO_SYNC_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Golfans-Ito-Publish',
      'Content-Type': 'application/json',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('upstream');
  if (response.status === 204) return null;
  return response.json();
}

async function runs(env, requestId = null) {
  const data = await github(env, `actions/workflows/${WORKFLOW}/runs?branch=main&per_page=50${requestId ? '&event=workflow_dispatch' : ''}`);
  if (!Array.isArray(data?.workflow_runs)) throw new Error('upstream');
  return data.workflow_runs;
}

export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) return reply({ ok: false, error: 'method_not_allowed' }, 405);
  // Browser requests must be same-origin; there is deliberately no cross-origin API.
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || (request.method === 'POST' && origin !== url.origin)) {
    return reply({ ok: false, error: 'forbidden' }, 403);
  }
  const auth = await authorized(request, env);
  if (auth === 'unconfigured') return reply({ ok: false, error: 'not_configured' }, 503);
  if (!auth) return reply({ ok: false, error: 'unauthorized' }, 401);
  if (request.method === 'POST' && url.searchParams.get('session') === '1') {
    const response = reply({ ok: true });
    response.headers.set('Set-Cookie', `${COOKIE}=${readToken(request)}; Path=/api/publish; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return response;
  }

  try {
    if (request.method === 'GET') {
      const runId = url.searchParams.get('run_id');
      const requestId = url.searchParams.get('request_id');
      if (requestId !== null && !/^[a-f0-9-]{36}$/.test(requestId)) return reply({ ok: false, error: 'invalid_request' }, 400);
      if (runId !== null) {
        if (!/^[1-9][0-9]{0,15}$/.test(runId)) return reply({ ok: false, error: 'invalid_run' }, 400);
        const run = await github(env, `actions/runs/${runId}`);
        if (run.workflow_id !== WORKFLOW_ID || run.head_branch !== 'main') return reply({ ok: false, error: 'invalid_run' }, 404);
        return reply({ ok: true, run: summarize(run) });
      }
      const list = await runs(env, requestId);
      const run = requestId ? list.find(run => run.display_title === `Ito publish ${requestId}`) : list[0];
      return reply({ ok: true, run: run ? summarize(run) : null });
    }

    let body;
    try { body = await request.json(); } catch { return reply({ ok: false, error: 'invalid_request' }, 400); }
    const requestId = body?.request_id;
    if (!body || Object.keys(body).some(key => key !== 'request_id') || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) {
      return reply({ ok: false, error: 'invalid_request' }, 400);
    }
    const list = await runs(env);
    const existing = list.find(run => run.display_title === `Ito publish ${requestId}`);
    if (existing) return reply({ ok: true, accepted: false, already_requested: true, run: summarize(existing) }, 202);
    const running = list.find(run => ACTIVE.has(run.status));
    if (running) return reply({ ok: true, accepted: false, run: summarize(running) }, 202);

    const requestedAt = new Date().toISOString();
    // No client-supplied repo, branch, workflow, or workflow inputs are forwarded.
    const result = await github(env, `actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main', inputs: { selftest_failure: false, publish_request_id: requestId } }),
    });
    return reply({
      ok: true,
      accepted: true,
      previous_run_id: list[0]?.id || 0,
      requested_at: requestedAt,
      request_id: requestId,
      run_id: result?.workflow_run_id || null,
    }, 202);
  } catch {
    // A dispatch timeout can mean GitHub accepted it. Never automatically retry a POST.
    return reply({ ok: false, error: request.method === 'POST' ? 'acceptance_unknown' : 'status_unavailable' }, 502);
  }
}
