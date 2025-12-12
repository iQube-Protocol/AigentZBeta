import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function entitlementsRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  app.post('/:txId', async (req: any) => {
    const { txId } = req.params as any;
    // TODO: issue entitlements based on DVN attestation for txId
    return { ok: true, txId };
  });
}
