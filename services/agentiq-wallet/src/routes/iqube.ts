import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function iqubeRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  app.post('/send', async (req: any) => {
    // TODO: transfer iQube ownership or initiate canonical sale via x402 metadata
    return { ok: true, transferId: 'iqube_tx_demo', did: req.did, persona: req.persona };
  });

  app.post('/authorize', async (req: any) => {
    // TODO: grant iQube access entitlement per RCH policy
    return { ok: true, grantId: 'grant_demo' };
  });

  app.get('/entitlements', async (req: any) => {
    // TODO: list entitlements for DID/persona from QubeBase
    return { entitlements: [], did: req.did, persona: req.persona };
  });
}
