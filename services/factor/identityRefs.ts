/**
 * T2-safe identity/commitment refs for Factor + Aegis (PRD §7, CLAUDE.md
 * Identity & Access Spine).
 *
 * This worktree predates `services/identity/personaReferences.ts` (its
 * `personaPublicRef`/`constitutionalRef` helpers do not exist here yet — see
 * the Phase 0 implementation-map doc's "worktree staleness" finding). This
 * module deliberately mirrors that helper's exact derivation (sha256 hex,
 * first 16 chars, namespaced) so that when this branch is reconciled with
 * the more current codebase the two are drop-in identical and one can
 * simply re-export the other — never two different hashing schemes for the
 * same concept (inv.engineering.036/037 in spirit, even though this
 * worktree predates that doc reference too).
 *
 * Never pass a raw persona_id (or any other T0 identifier) into
 * orchestration_events.metadata, a factor_case_events.payload, or any
 * aegis_assessments/aegis_findings field — always route it through
 * personaRef()/agentRef()/constitutionalRef() first.
 */

import { createHash } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256Hex16(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/** T2-safe commitment for a persona id. Same derivation as the more current
 *  codebase's `personaPublicRef` (sha256 hex, first 16 chars) — see header. */
export function personaRef(personaId: string): string {
  if (!personaId || typeof personaId !== 'string') {
    throw new Error('personaRef: personaId is required');
  }
  return sha256Hex16(personaId);
}

/** Namespaced constitutional commitment for a non-persona identifier that
 *  must also cross a receipt/chain boundary as a commitment, never a raw
 *  value (case ids, assessment ids, authority-chain ids). */
export function constitutionalRef(namespace: string, id: string): string {
  return sha256Hex16(`${namespace}:${id}`);
}

/**
 * A raw persona UUID must never be handed to a receipt-bound field. This
 * guard is the same shape as `computeReceiptCommitment`'s guard in the more
 * current codebase's `services/receipts/receiptCommitment.ts` — refuse
 * loudly at the call site rather than silently hash-on-the-fly (which would
 * hide a caller reaching for the wrong field).
 */
export function assertNotRawPersonaId(value: string, fieldName: string): void {
  if (UUID_RE.test(value)) {
    throw new Error(
      `${fieldName}: looks like a raw persona/agent UUID (T0). Pass personaRef(id) or ` +
        'the resolved agent DID — this field is receipt/chain-bound and must never carry a T0 identifier.',
    );
  }
}
