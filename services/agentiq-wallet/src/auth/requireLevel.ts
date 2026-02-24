import { FastifyReply, FastifyRequest } from 'fastify';
import { getAnonCaps } from '../db/config';
import { getAnonAlias, markAliasHuman, getAnonDailySpent } from '../db/anonymous';
import { verifyCaptcha } from './captcha';

export type RequireLevel = 'anonymous' | 'persona' | 'root' | 'kybe';

export function requireLevel(level: RequireLevel) {
  return async function (req: FastifyRequest & any, reply: FastifyReply) {
    const _state = (req.headers['x-identity-state'] as string | undefined)?.toLowerCase();
    if (level === 'persona') {
      if (!req.personaId) {
        return reply.code(403).send({ error: 'forbidden', reason: 'persona_required' });
      }
      return;
    }
    if (level === 'anonymous') {
      // Expect alias_commitment either in header or body
      const alias_commitment = (req.headers['x-alias-commitment'] as string) || (req.body as any)?.alias_commitment;
      if (!alias_commitment) {
        return reply.code(400).send({ error: 'bad_request', reason: 'alias_commitment_required' });
      }
      const caps = await getAnonCaps();
      const alias = await getAnonAlias(alias_commitment);
      if (!alias) {
        return reply.code(403).send({ error: 'forbidden', reason: 'alias_not_found' });
      }
      const now = Date.now();
      const exp = new Date(alias.expires_at).getTime();
      if (now > exp) {
        return reply.code(403).send({ error: 'forbidden', reason: 'alias_expired' });
      }
      // Optional personhood proof via CAPTCHA if required
      if (caps.requirePersonhood && alias.personhood_status !== 'verified_human') {
        const captchaToken = ((req.headers['x-captcha-token'] as string) || (req.body as any)?.captcha_token || '').toString();
        const ok = await verifyCaptcha(captchaToken);
        if (!ok) {
          return reply.code(403).send({ error: 'forbidden', reason: 'personhood_required' });
        }
        await markAliasHuman(alias_commitment);
      }
      // Optional caps validation if amount provided
      const amountQ = Number((req.body as any)?.amount_qcents || 0);
      if (amountQ > 0) {
        if (amountQ > caps.txCap) {
          return reply.code(403).send({ error: 'forbidden', reason: 'anon_tx_cap_exceeded', cap_qcents: caps.txCap });
        }
        const spent = await getAnonDailySpent(alias_commitment);
        if (spent + amountQ > caps.dailyCap) {
          return reply.code(403).send({ error: 'forbidden', reason: 'anon_daily_cap_exceeded', cap_qcents: caps.dailyCap });
        }
      }
      // Attach for downstream handlers
      (req as any).alias_commitment = alias_commitment;
      return;
    }
    if (level === 'root') {
      return reply.code(501).send({ error: 'not_implemented', reason: 'root_did_required' });
    }
    if (level === 'kybe') {
      return reply.code(501).send({ error: 'not_implemented', reason: 'kybe_proof_required' });
    }
  };
}
