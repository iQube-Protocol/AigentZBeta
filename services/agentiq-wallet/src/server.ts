import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import ssePlugin from 'fastify-sse-v2';
import { walletRoutes } from './routes/wallet';
import { x402Routes } from './routes/x402';
import { entitlementsRoutes } from './routes/entitlements';
import { sseRoutes } from './routes/sse';
import { iqubeRoutes } from './routes/iqube';
import { nlRoutes } from './routes/nl';
import { x402RemoteRoutes } from './routes/x402-remote';
import { webhooksRoutes } from './routes/webhooks';
import { verifyDidToken } from './auth/didVerifier';
import { getPersonaByDid } from './store/personas';
import { runMigrationsIfEnabled } from './db/migrate';
import { getSupabase } from './db/supabase';
import { resolveIdentityByDid } from './db/identity';

const app = Fastify({ logger: true });

app.register(fastifyCors, { origin: process.env.CORS_ORIGIN || '*' });
app.register(ssePlugin);

app.decorate('verifyDid', async (request: any, reply: any) => {
  const auth = request.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'unauthorized' });
  const token = auth.slice('Bearer '.length);
  try {
    // Dev bypass: allow a static bearer token for local testing
    const devBypass = process.env.WALLET_DEV_BEARER;
    const devMode = (process.env.WALLET_DEV_MODE || 'false') === 'true';
    if (devMode && devBypass && token === devBypass) {
      request.did = process.env.WALLET_DEV_DID || 'did:dev:tester';
      request.persona = process.env.WALLET_DEV_PERSONA || 'default';
      request.personaId = process.env.WALLET_DEV_PERSONA_ID || process.env.WALLET_DEV_FIO_HANDLE || 'dev@knyt';
      return;
    }
    const res = await verifyDidToken(token);
    request.did = res.did;
    request.personaId = res.personaId || undefined;
    request.persona = res.persona || 'default';
    // Resolve from DB (Supabase) to attach personId/personaId if possible
    try {
      const resolved = await resolveIdentityByDid(request.did);
      if (resolved) {
        if (resolved.personId) request.personId = resolved.personId;
        if (!request.personaId && resolved.personaId) request.personaId = resolved.personaId;
        if (!request.persona && resolved.fioHandle) request.persona = resolved.fioHandle;
      }
    } catch (e) {
      app.log.warn({ identity_resolve: 'failed', error: (e as Error).message });
    }
    // Dev fallback to in-memory mapping if still missing personaId
    if (!request.personaId) {
      const binding = getPersonaByDid(request.did);
      if (binding) request.personaId = binding.personaId;
    }
  } catch (e) {
    return reply.code(401).send({ error: 'invalid token' });
  }
});

app.get('/health', async () => ({ ok: true }));

// DB health check
app.get('/wallet/db/health', async (_req, _reply) => {
  try {
    const sb = getSupabase();
    // Light touch: try an authless call via service key by listing a non-sensitive RPC
    // We simply return ok if client was constructed; deeper checks occur after migrations
    return { ok: true, supabase: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

app.register(walletRoutes, { prefix: '/wallet' });
app.register(x402Routes, { prefix: '/x402' });
app.register(x402RemoteRoutes, { prefix: '/x402/remote' });
app.register(entitlementsRoutes, { prefix: '/entitlements' });
app.register(iqubeRoutes, { prefix: '/iqube' });
app.register(sseRoutes, { prefix: '/sse' });
app.register(nlRoutes, { prefix: '/wallet/nl' });
app.register(webhooksRoutes, { prefix: '/webhooks' });

const port = parseInt(process.env.PORT || '8090', 10);
// Optionally run migrations before listening
runMigrationsIfEnabled(app.log.info.bind(app.log))
  .catch((e) => app.log.error({ db_migrate: 'failed', error: (e as Error).message }))
  .finally(() => {
    app.listen({ port, host: '0.0.0.0' });
  });
