/**
 * Personhood proof verification — weak proof (CAPTCHA) and strong proof
 * (World ID). PRD §6.1, §16; 2026-06-13 hackathon-submission plan §Sprint 2.
 *
 * Weak proof — Cloudflare Turnstile (TURNSTILE_SECRET_KEY).
 * Strong proof — Worldcoin World ID Cloud Verifier (WORLD_ID_APP_ID +
 *   WORLD_ID_ACTION_ID). Verifies the IDKit proof bundle via the
 *   developer.worldcoin.org cloud endpoint — no on-chain calls, no SDK
 *   install required for the server-side verification step.
 *
 * signal_hash (2026-07-18 fix): every <WorldIdButton> call site in this repo
 * passes a `signal` prop (the passport id), which IDKitWidget bakes into the
 * proof's public inputs client-side via its own hashToField(signal). The
 * cloud verify endpoint's `signal_hash` field must be given that SAME hashed
 * value — sending the raw signal string there (the prior bug) never matches
 * what the proof was generated against, so verification fails every time a
 * signal is used (which is always, in this codebase). Fixed by hashing with
 * @worldcoin/idkit-core's hashToField (already an installed transitive dep of
 * @worldcoin/idkit — no new package) before it reaches the wire. Verified
 * against Worldcoin's own documented backend pattern:
 * `import { hashToField } from "@worldcoin/idkit-core/hashing"`.
 *
 * Dev fallback: when secrets are unset (local/dev sandbox), tokens
 * prefixed 'dev-' verify successfully so the flow is testable without
 * the providers. Real World ID nullifier hashes are base16 hex; they
 * never collide with 'dev-' prefix.
 */

import { hashToField } from '@worldcoin/idkit-core/hashing';

export type PersonhoodProofType = 'captcha' | 'world_id' | 'agent_declaration' | 'operator_attestation';

export interface ProofVerification {
  ok: boolean;
  proofType: PersonhoodProofType;
  proofRef: string | null;
  error?: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const WORLD_ID_VERIFY_URL = 'https://developer.worldcoin.org/api/v2/verify';

export interface WorldIdProofPayload {
  /** The semaphore proof. */
  proof: string;
  /** Merkle tree root the proof was generated against. */
  merkle_root: string;
  /** Nullifier hash — unique per (action, user). Persisted to prevent re-use. */
  nullifier_hash: string;
  /** Verification level — 'orb' (max strength) or 'device'. */
  verification_level: 'orb' | 'device';
  /** Optional action_id override; defaults to WORLD_ID_ACTION_ID. */
  action?: string;
  /** Optional signal — opaque per-request data that bound to the proof. */
  signal?: string;
}

/**
 * Verify a World ID proof bundle against the Worldcoin Cloud Verifier.
 *
 * The verifier returns:
 *   - 200 + { success: true, ... } when the proof is valid AND the
 *     (action, nullifier_hash) pair has not been seen before by Worldcoin's
 *     side. We persist nullifier_hash on the passport record so the same
 *     human can't double-verify a second persona's passport.
 *   - 4xx with an error code when invalid.
 *
 * Dev fallback: when WORLD_ID_APP_ID is unset, tokens of the form
 * 'dev-worldid-orb' / 'dev-worldid-device' verify successfully so the
 * flow is testable locally.
 */
export async function verifyWorldIdProof(
  payload: WorldIdProofPayload,
): Promise<ProofVerification> {
  const appId = process.env.WORLD_ID_APP_ID;
  const defaultAction = process.env.WORLD_ID_ACTION_ID ?? 'polity-passport-verify';

  // Dev fallback path — accept canary tokens when no app_id configured.
  if (!appId) {
    if (typeof payload.proof === 'string' && payload.proof.startsWith('dev-worldid-')) {
      const level = payload.proof.includes('orb') ? 'orb' : 'device';
      return {
        ok: true,
        proofType: 'world_id',
        proofRef: `dev:worldid:${level}:${payload.nullifier_hash || randomNullifier()}`,
      };
    }
    return {
      ok: false,
      proofType: 'world_id',
      proofRef: null,
      error: 'World ID provider not configured (set WORLD_ID_APP_ID + WORLD_ID_ACTION_ID)',
    };
  }

  try {
    const res = await fetch(`${WORLD_ID_VERIFY_URL}/${appId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nullifier_hash: payload.nullifier_hash,
        merkle_root: payload.merkle_root,
        proof: payload.proof,
        verification_level: payload.verification_level,
        action: payload.action ?? defaultAction,
        // MUST be hashToField(signal).digest, not the raw signal string — the
        // client-side proof was generated against the hashed value (see the
        // module header note). Omitted entirely when no signal was used,
        // matching IDKitWidget's own behavior of only hashing when passed one.
        signal_hash: payload.signal ? hashToField(payload.signal).digest : undefined,
      }),
    });
    const json = (await res.json()) as { success?: boolean; code?: string; detail?: string };
    if (res.ok && json.success) {
      return {
        ok: true,
        proofType: 'world_id',
        proofRef: `worldid:${payload.verification_level}:${payload.nullifier_hash}`,
      };
    }
    return {
      ok: false,
      proofType: 'world_id',
      proofRef: null,
      error: `World ID verification failed: ${json.code ?? 'unknown'} ${json.detail ?? ''}`.trim(),
    };
  } catch (e) {
    return {
      ok: false,
      proofType: 'world_id',
      proofRef: null,
      error: e instanceof Error ? e.message : 'World ID request failed',
    };
  }
}

function randomNullifier(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

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
