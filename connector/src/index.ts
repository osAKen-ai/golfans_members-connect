import { OAuthProvider, AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { publishOperation } from '../../functions/api/publish.js';

const SCOPES = ['portal:status', 'portal:publish', 'offline_access'];
const providers = new Map<string, OAuthProvider>();
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

function page(body: string, status = 200, suppliedHeaders?: Headers) {
  const nonce = crypto.randomUUID();
  const headers = new Headers(suppliedHeaders);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>宝塚サイト更新 | 接続の確認</title><style nonce="${nonce}">*{box-sizing:border-box}body{font:15px/1.9 -apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;background:#fbfaf6;color:#173a31;margin:0;padding:32px 18px}main{max-width:480px;margin:5vh auto;background:#fffefb;border:1px solid #dddcd0;border-radius:20px;padding:30px}h1{font-size:25px;line-height:1.6}p,li{overflow-wrap:anywhere}.brand{font-size:12px;letter-spacing:.15em}label{display:block;margin-top:20px;font-weight:600}input{width:100%;font:inherit;padding:12px;border:1px solid #839079;border-radius:8px}button{font:inherit;border:1px solid #24543e;border-radius:8px;padding:12px 20px;background:#24543e;color:white;margin-top:20px;cursor:pointer}.cancel{background:transparent;color:#24543e;margin-left:8px}small{color:#58675e}a{color:inherit}</style><main><p class="brand">GOLFANS · MEMBERS’ CONNECT</p>${body}</main></html>`, { status, headers });
}

async function validCode(value: string, expected: string) {
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(value) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function validRedirect(uri: string, env: any) {
  const url = new URL(uri);
  if (url.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(url.hostname)) return true;
  return env.ALLOW_LOCAL_OAUTH === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:';
}

const consentHandler = {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    if (url.pathname === '/') return page(`<h1>宝塚サイト更新</h1><p>ChatGPTから、最新内容の反映と更新結果の確認ができます。</p><p>接続名：<strong>宝塚サイト更新</strong><br>認証方法：<strong>OAuth</strong></p><p>ChatGPTに次の接続先を伝えて、コネクタの追加方法を相談してください。</p><p><strong>${escape(url.origin)}/mcp</strong></p><p><small>接続用コードは、ChatGPTが開く認証画面にだけ入力してください。</small></p>`);
    if (url.pathname !== '/authorize') return new Response('Not found', { status: 404 });
    const oauth = env.OAUTH_PROVIDER;
    try {
      if (request.method === 'GET') {
        const auth = await oauth.parseAuthRequest(request);
        if (!validRedirect(auth.redirectUri, env)) return page('<h1>接続先を確認してください</h1><p>この接続先には許可できません。ChatGPTの接続設定からやり直してください。</p>', 400);
        const description = await oauth.describeConsent(auth);
        const consent = await oauth.beginConsent(auth);
        return page(`<h1>ChatGPTに更新操作を<br>許可しますか？</h1><p>接続アプリ：<strong>${escape(description.clientName)}</strong><br>接続先：<strong>${escape(description.redirectHost)}</strong></p><ul><li>宝塚デモサイトの最新内容を公開サイトへ反映する</li><li>受付・進行状況・反映結果を確認する</li></ul><p><small>接続後は、ChatGPTに「宝塚サイトをプッシュして」と依頼できます。</small></p><form method="post"><input type="hidden" name="handle" value="${escape(consent.handle)}"><label for="code">ご案内した接続用コード</label><input id="code" name="code" type="password" autocomplete="off" maxlength="120" required><button name="decision" value="approve">接続を許可する</button><button class="cancel" name="decision" value="deny" formnovalidate>キャンセル</button></form><p><small>コードはこの認証画面にだけ入力してください。ChatGPTの会話に貼る必要はありません。</small></p>`, 200, consent.headers);
      }
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (request.headers.get('Origin') !== url.origin) return page('<h1>接続をやり直してください</h1>', 403);
      const form = await request.formData();
      const handle = String(form.get('handle') || '');
      if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle);
        denied.headers.set('Location', denied.redirectTo);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      if (!await validCode(String(form.get('code') || ''), env.ITO_CONNECTOR_CODE_SHA256)) {
        return page(`<h1>接続用コードを確認してください</h1><p>入力したコードでは接続できませんでした。</p><a href="${escape(url.pathname + url.search)}">接続をやり直す</a>`, 401);
      }
      const approved = await oauth.approveConsent(request, handle, { scope: SCOPES });
      if (!validRedirect(approved.request.redirectUri, env)) return page('<h1>接続先を確認してください</h1>', 400);
      const result = await oauth.completeAuthorization({
        request: approved.request,
        userId: 'ito-publisher',
        metadata: { label: '宝塚サイト更新' },
        scope: approved.request.scope,
        props: { userId: 'ito-publisher' },
      });
      approved.headers.set('Location', result.redirectTo);
      approved.headers.set('Cache-Control', 'no-store');
      return new Response(null, { status: 302, headers: approved.headers });
    } catch (error) {
      if (error instanceof AuthorizationError || error instanceof CimdFetchError) return page('<h1>接続をやり直してください</h1><p>接続の確認が期限切れか、入力内容を確認できませんでした。ChatGPTの接続設定からもう一度お試しください。</p>', 400);
      return page('<h1>接続を確認できませんでした</h1><p>時間をおいて、もう一度お試しください。</p>', 503);
    }
  },
};

function toolResult(data: any, isError = false) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data, isError };
}

function mcpHandler(origin: string) {
  return {
    async fetch(request: Request, env: any, context: any) {
      if (new URL(request.url).pathname !== '/mcp') return new Response('Not found', { status: 404 });
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
      if (context.props?.userId !== 'ito-publisher' || !context.auth?.scope?.includes('portal:status')) return new Response('Forbidden', { status: 403 });
      const server = new McpServer({ name: 'golfans-ito-publish', version: '0.1.0' }, {
        instructions: '宝塚サイト専用。publish_latest_portalはユーザーが反映を依頼した場合に使う。受付は反映完了ではない。返されたrequest_idまたはrun_idでget_publish_statusを確認し、status=completedかつconclusion=successの場合だけ本番反映確認済みと報告する。通信エラー後は同じrequest_idで状況確認し、更新開始を繰り返さない。予約操作・メール送信・他サイトの更新機能はない。',
      });
      server.registerTool('publish_latest_portal', {
        title: '宝塚サイトの最新内容を反映する',
        description: '伊藤さんのデモサイトから最新内容を取り込み、既存のGitHub同期と本番反映確認を開始する。ユーザーから反映の依頼がある場合に使う。予約登録やメール送信はしない。',
        inputSchema: { request_id: z.string().uuid().optional().describe('再試行時は、前回と同じUUIDを指定する。初回は省略できる。') },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['portal:status', 'portal:publish'] }] },
      }, async ({ request_id }) => {
        if (!context.auth.scope.includes('portal:publish')) return toolResult({ ok: false, error: 'insufficient_scope' }, true);
        const operationId = request_id || crypto.randomUUID();
        const response = await publishOperation(new Request(`${origin}/api/publish`, { method: 'POST', body: JSON.stringify({ request_id: operationId }) }), env);
        const data = await response.json();
        return toolResult({ ...data, request_id: operationId }, !response.ok);
      });
      server.registerTool('get_publish_status', {
        title: '宝塚サイトの反映結果を確認する',
        description: '更新操作のrequest_idまたはrun_idで受付・進行・反映結果を確認する。両方省略すると直近の更新状況を返すが、その結果を特定の操作の完了として報告しない。',
        inputSchema: { request_id: z.string().uuid().optional(), run_id: z.string().regex(/^[1-9][0-9]{0,15}$/).optional() },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['portal:status'] }] },
      }, async ({ request_id, run_id }) => {
        const url = new URL(`${origin}/api/publish`);
        if (run_id) url.searchParams.set('run_id', run_id);
        else if (request_id) url.searchParams.set('request_id', request_id);
        const response = await publishOperation(new Request(url), env);
        return toolResult(await response.json(), !response.ok);
      });
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 65536 });
      await server.connect(transport);
      try {
        const response = await transport.handleRequest(request);
        const bytes = await response.arrayBuffer();
        return new Response(bytes.byteLength ? bytes : null, { status: response.status, headers: response.headers });
      } finally { await server.close(); }
    },
  };
}

export default {
  async fetch(request: Request, env: any, context: any) {
    const url = new URL(request.url);
    const origin = env.PUBLIC_BASE_URL || (env.ALLOW_LOCAL_OAUTH === 'true' ? url.origin : '');
    if (!origin || origin !== url.origin || !env.OAUTH_KV || !/^[a-f0-9]{64}$/.test(env.ITO_CONNECTOR_CODE_SHA256 || '') || !env.GITHUB_ITO_SYNC_TOKEN) {
      return new Response('Connector setup is not complete.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'golfans-ito-publish' }, { headers: { 'Cache-Control': 'no-store' } });
    let provider = providers.get(origin);
    if (!provider) {
      provider = new OAuthProvider({
        apiRoute: '/mcp', apiHandler: mcpHandler(origin), defaultHandler: consentHandler,
        authorizeEndpoint: '/authorize', tokenEndpoint: '/oauth/token', clientRegistrationEndpoint: '/oauth/register',
        scopesSupported: SCOPES, requiredScopes: ['portal:status'],
        resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin] },
        clientIdMetadataDocumentEnabled: true,
        accessTokenTTL: 900, refreshTokenTTL: 2592000,
      });
      providers.set(origin, provider);
    }
    return provider.fetch(request, env, context);
  },
};
