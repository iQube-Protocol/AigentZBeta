import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { createSession, getSession } from '../store/remoteSessions';
import { requireLevel } from '../auth/requireLevel';

export async function x402RemoteRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  // Issue a short-lived remote custody session for delegated operations
  app.post('/session', async (req: any, reply) => {
    const state = (req.headers['x-identity-state'] as string | undefined)?.toLowerCase();
    if (state === 'anonymous') {
      await requireLevel('anonymous')(req, reply as any);
    } else {
      await requireLevel('persona')(req, reply as any);
    }
    const ttlSec = (req.body?.ttlSec as number) || 900;
    const caps = (req.body?.caps as string[]) || [];
    const sess = createSession({ did: req.did, persona: req.persona, ttlSec, caps });
    return { sessionId: sess.id, did: sess.did, persona: sess.persona, expiresIn: Math.floor((sess.expiresAt - Date.now())/1000) };
  });

   // Friendly GET to indicate correct usage (avoid 404 confusion)
  app.get('/session', async (_req, reply) => {
    return reply.code(405).send({ error: 'method_not_allowed', hint: 'Use POST /x402/remote/session' });
  });

  // Delegated signing/authorization under DVN oversight
  app.post('/sign', async (_req: any) => {
    // TODO: perform delegated signing via enclave + policy checks
    return { ok: true, signatureId: 'rc_sig_demo' };
  });

  // Status of remote custody session or operation
  app.get('/status/:id', async (req: any) => {
    const { id } = req.params as any;
    const sess = getSession(id);
    if (!sess) return { id, status: 'not_found' };
    return { id: sess.id, status: sess.status, expiresAt: sess.expiresAt };
  });
}
