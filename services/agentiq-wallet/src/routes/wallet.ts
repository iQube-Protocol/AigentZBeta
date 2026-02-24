import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { createPersonaHandle } from '../store/personas';
import { requireLevel } from '../auth/requireLevel';
import { getAnonCaps } from '../db/config';
import { registerAnonAlias, markAliasHuman } from '../db/anonymous';
import { verifyCaptcha } from '../auth/captcha';

export async function walletRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.addHook('preHandler', (req: any, reply, done) => (app as any).verifyDid(req, reply).then(() => done()).catch(done));

  app.post('/init', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    return { ok: true, did: req.did, persona: req.persona, personaId: req.personaId };
  });

  app.post('/link-fio', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    const body = req.body || {};
    const name = (body.name || '').toString();
    const domain = (body.domain || '').toString();
    if (!name || !domain) return { error: 'name and domain required' };
    const binding = createPersonaHandle(req.did, name, domain);
    req.personaId = binding.personaId;
    return { ok: true, personaId: binding.personaId };
  });

  app.get('/balances', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    // TODO: aggregate multichain balances by persona
    return { balances: [], did: req.did, persona: req.persona, personaId: req.personaId };
  });

  app.get('/transactions', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    // TODO: list persona-scoped txs from QubeBase
    return { transactions: [], did: req.did, persona: req.persona, personaId: req.personaId };
  });

  app.post('/request-payment', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    // TODO: create x402/FIO request-to-pay invoice and emit SSE
    return { ok: true, requestId: 'req_demo' };
  });

  app.get('/whoami', async (req: any, reply) => {
    await requireLevel('persona')(req, reply as any);
    return { did: req.did, persona: req.persona, personaId: req.personaId };
  });

  // Anonymous alias registration (escrow). Requires DID auth but not persona.
  app.post('/anon/register', async (req: any) => {
    const body = req.body || {};
    const alias_commitment = (body.alias_commitment || '').toString();
    const cohort_id = (body.cohort_id || '').toString();
    const mailbox_id = body.mailbox_id ? String(body.mailbox_id) : undefined;
    if (!alias_commitment || !cohort_id) return { error: 'alias_commitment and cohort_id required' };
    const caps = await getAnonCaps();
    let personhoodVerified = false;
    if (caps.requirePersonhood) {
      const captcha_token = (body.captcha_token || '').toString();
      personhoodVerified = await verifyCaptcha(captcha_token);
      if (!personhoodVerified) {
        return { error: 'personhood_required' };
      }
    }
    const rec = await registerAnonAlias({ alias_commitment, cohort_id, mailbox_id, ttlSec: caps.ttlSec });
    if (personhoodVerified) await markAliasHuman(alias_commitment);
    return { ok: true, alias_commitment, expires_at: rec.expires_at };
  });
}

