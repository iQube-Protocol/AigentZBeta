import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function x402Routes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  app.post('/quote', async (_req) => {
    // TODO: call x402 adapter to quote
    return { quoteId: 'q_demo' };
  });

  app.post('/sign', async (_req) => {
    // TODO: sign x402 payload (delegated signer)
    return { ok: true };
  });

  app.post('/send', async (_req) => {
    // TODO: submit x402 transfer and emit SSE
    return { ok: true, txId: 'tx_demo' };
  });

  app.post('/request', async (_req) => {
    // TODO: create request-to-pay invoice (x402 or FIO fallback)
    return { ok: true, requestId: 'req_demo' };
  });

  app.get('/status/:txId', async (req: any) => {
    const { txId } = req.params as any;
    // TODO: fetch x402 status from QubeBase/DVN
    return { txId, status: 'pending' };
  });
}
