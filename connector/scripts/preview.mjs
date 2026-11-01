import { Miniflare } from 'miniflare';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const code = 'local-preview-'.padEnd(43, 'x');
const mf = new Miniflare({
  host: '127.0.0.1', port: 18817, modules: true,
  scriptPath: resolve('dist/worker.mjs'),
  compatibilityDate: '2026-07-30',
  compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
  kvNamespaces: ['OAUTH_KV'],
  bindings: { ALLOW_LOCAL_OAUTH: 'true', ITO_CONNECTOR_CODE_SHA256: createHash('sha256').update(code).digest('hex'), GITHUB_ITO_SYNC_TOKEN: 'local-preview-only-not-a-real-token' },
  outboundService: async () => Response.json({ workflow_runs: [] }),
});
console.log('Local OAuth/MCP preview:', String(await mf.ready));
console.log('Preview uses a dummy GitHub credential; it cannot publish.');
process.on('SIGINT', async () => { await mf.dispose(); process.exit(0); });
