import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import crypto from 'crypto';

export async function webhooksRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // DVN attestation webhook to drive canonical sale + deferred mint
  app.post('/dvn/attest', async (req: any, reply: any) => {
    const signature = (req.headers['x-dvn-signature'] || '').toString();
    const secret = process.env.DVN_WEBHOOK_SECRET || '';
    const body = req.body || {};
    if (!secret || !signature) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const payload = JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    if (expected !== signature) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    // TODO: update x402_txs: set dvn_status, proof_ref, advance canonical/deferred flows
    // TODO: trigger entitlement issuance if conditions met
    app.log.info({ evt: 'dvn_attest', body });
    return reply.code(200).send({ ok: true });
  });

  // Friendly GET to indicate correct usage (avoid 404 confusion)
  app.get('/dvn/attest', async (_req, reply) => {
    return reply.code(405).send({ error: 'method_not_allowed', hint: 'Use POST /webhooks/dvn/attest' });
  });
}
