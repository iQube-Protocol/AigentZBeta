/**
 * Personhood proof verification — weak proof (CAPTCHA) for MVP, with the
 * interface shaped so strong proof (World ID) slots in behind the existing
 * ReputationService extension point later (PRD §6.1, §16; implementation
 * plan Stage 3 + the World ID stub in ReputationService.checkTokenQubePolicy).
 *
 * Provider: Cloudflare Turnstile when TURNSTILE_SECRET_KEY is set.
 * Dev fallback: when the secret is unset (local/dev sandbox), tokens prefixed
 * 'dev-' verify successfully so the flow is testable without the provider.
 */

export type PersonhoodProofType = 'captcha' | 'world_id' | 'agent_declaration' | 'operator_attestation';

export interface ProofVerification {
  ok: boolean;
  proofType: PersonhoodProofType;
  proofRef: string | null;
  error?: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyWeakProof(token: string, remoteIp?: string | null): Promise<ProofVerification> {
  const trimmed = (token || '').trim();
  if (!trimmed) {
    return { ok: false, proofType: 'captcha', proofRef: null, error: 'Proof token required' };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Dev sandbox — no provider configured. Accept dev-prefixed tokens only,
    // so accidental production deployment without the secret fails closed
    // for real traffic (real Turnstile tokens never start with 'dev-').
    if (trimmed.startsWith('dev-')) {
      return { ok: true, proofType: 'captcha', proofRef: `dev:${trimmed.slice(0, 24)}` };
    }
    return {
      ok: false,
      proofType: 'captcha',
      proofRef: null,
      error: 'CAPTCHA provider not configured',
    };
  }

  try {
    const body = new URLSearchParams({ secret, response: trimmed });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (json.success) {
      return { ok: true, proofType: 'captcha', proofRef: `turnstile:${Date.now()}` };
    }
    return {
      ok: false,
      proofType: 'captcha',
      proofRef: null,
      error: `CAPTCHA verification failed: ${(json['error-codes'] || []).join(', ') || 'unknown'}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'verification request failed';
    return { ok: false, proofType: 'captcha', proofRef: null, error: message };
  }
}
