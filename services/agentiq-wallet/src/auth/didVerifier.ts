import { Resolver } from 'did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getPkhResolver } from 'pkh-did-resolver';
import { verifyJWT, JwtPresentationPayload, JwtCredentialPayload } from 'did-jwt';

export type VerifyResult = {
  did: string;
  personaId?: string;
  persona?: string;
  method: string;
  claims: Record<string, any>;
};

function parseAllowedMethods(): Set<string> {
  const csv = process.env.WALLET_DID_METHODS || 'key,web,pkh';
  return new Set(csv.split(',').map((s) => s.trim()).filter(Boolean));
}

async function buildResolver(): Promise<Resolver> {
  const allowed = parseAllowedMethods();
  const registrars: Record<string, any> = {};

  if (allowed.has('key')) Object.assign(registrars, getKeyResolver());
  if (allowed.has('web')) Object.assign(registrars, getWebResolver());
  if (allowed.has('pkh')) Object.assign(registrars, getPkhResolver());

  // did:ion optional, dynamic import if present and enabled
  if (allowed.has('ion')) {
    try {
      // Try Sphereon's Ion resolver first
      const sphereon = await import('@sphereon/did-ion-resolver');
      if (sphereon && typeof (sphereon as any).getResolver === 'function') {
        Object.assign(registrars, (sphereon as any).getResolver());
      }
    } catch {
      try {
        // Fallback to decentralized-identity ion resolver if available
        const ionMod = await import('@decentralized-identity/ion-resolver');
        if (ionMod && typeof (ionMod as any).getResolver === 'function') {
          Object.assign(registrars, (ionMod as any).getResolver());
        }
      } catch {
        // ion resolver not installed; continue without it
      }
    }
  }

  return new Resolver(registrars);
}

export async function verifyDidToken(token: string): Promise<VerifyResult> {
  const resolver = await buildResolver();
  const { payload, issuer } = await verifyJWT(token, { resolver, audience: undefined });

  const sub = (payload as JwtCredentialPayload | JwtPresentationPayload).sub || issuer;
  if (!sub || typeof sub !== 'string') throw new Error('missing sub');

  const method = sub.split(':')[1] || 'unknown';
  const personaId = (payload as any).persona_id || (payload as any).personaId;
  const persona = (payload as any).persona || undefined;

  const claims: Record<string, any> = { ...payload } as any;

  return {
    did: sub,
    personaId,
    persona,
    method,
    claims,
  };
}
