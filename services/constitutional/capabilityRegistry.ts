/**
 * capabilityRegistry — Constitutional Acceptance made real (CFS-032 §4/§5,
 * ratified 2026-07-16; built same day per operator direction "let's build
 * them and close the loop").
 *
 * Registry Registration IS Constitutional Acceptance — one event, not two
 * stages: admitting a SHIPPED capability into this registry as a governed
 * `ConstitutionalObject` (kind 'capability') is the acceptance ceremony.
 * Everything before it is engineering; everything after it is constitutional
 * memory. The registry — not the receipt — closes the self-improvement loop:
 * only a registered capability is discoverable by the NEXT capability
 * request's Gap Analysis (`registeredCapabilityBlock` below feeds
 * `buildStageGroundData`).
 *
 * Standing (CFS-032 §5): registration is the ELIGIBILITY GATE, operational
 * evidence is the ACCRUAL TRIGGER. `recordOperationalValidation` REFUSES
 * (honest `{ ok: false, reason }`, never a silent no-op) when the capability
 * is not registered — verified-but-unregistered accrues nothing ever;
 * registered-but-unverified accrues nothing yet.
 *
 * Extend-don't-duplicate: the object shape, commitment discipline, and
 * steward-ownership pattern mirror `services/composition/canonicalAssets.ts`
 * (the P1 Canonical Asset Registry); the durable-store soft-fail pattern
 * mirrors `services/constitutional/capabilityEvidence.ts`. Receipts go
 * through the ONE `createActivityReceipt` path — both action types are
 * DVN-anchorable.
 *
 * T2 discipline: rows and objects carry capability facts, receipt ids, and
 * one-way commitments only. `personaId` is used server-side for the receipt
 * call and never stored in the registry (the table has no identity columns).
 */

import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  standingBandFor,
  type ConstitutionalObject,
} from '@/types/constitutionalObject';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

// ---------------------------------------------------------------------------
// Constants (canary-pinned)
// ---------------------------------------------------------------------------

/** A freshly-accepted capability enters at the EXPERIMENTAL band (< 0.3 —
 *  the band boundary in standingBandFor) — Standing accrues ONLY from
 *  operational evidence, never from registration itself (CFS-032 §5). */
export const REGISTRATION_STANDING = 0.25;

/** Each operational validation accrues this much, capped BELOW the canonical
 *  band floor (0.6): accrual can carry a capability experimental → validated,
 *  but 'canonical' requires a ratification ceremony (Law XI), never accrual
 *  alone. */
export const OPERATIONAL_VALIDATION_DELTA = 0.1;
export const ACCRUAL_STANDING_CAP = 0.55;

const STEWARD_COMMITMENT = commitment('platform-steward', 'capability-registry');

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** One-way T2-safe commitment (canonicalAssets pattern). */
function commitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

function contentCommitment(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

export interface RegisterCapabilityInput {
  /** Stable slug — the pack slug for pack-born capabilities. Idempotency key. */
  capabilityId: string;
  displayLabel: string;
  /** What the capability does, for future Gap Analysis to read. ≤ 500 chars kept. */
  description?: string;
  /** Provenance — the receipts that carried this capability here. */
  packId?: string;
  prNumber?: number;
  mergeCommit?: string;
  validationReceiptIds?: string[];
  deploymentReceiptId?: string;
  governingInvariants?: string[];
  /** How future work should treat it: 'compose' (default) | 'extend' | 'reference'. */
  reuseDisposition?: string;
}

/** PURE — builds the capability's ConstitutionalObject exactly as the
 *  Canonical Asset Registry builds its assets. No I/O, no receipts. */
export function buildCapabilityObject(input: RegisterCapabilityInput): ConstitutionalObject {
  const payload = {
    description: (input.description ?? '').slice(0, 500),
    packId: input.packId ?? null,
    prNumber: input.prNumber ?? null,
    mergeCommit: input.mergeCommit ?? null,
    reuseDisposition: input.reuseDisposition ?? 'compose',
  };
  const receiptIds = [
    ...(input.validationReceiptIds ?? []),
    ...(input.deploymentReceiptId ? [input.deploymentReceiptId] : []),
  ];
  return {
    identity: {
      id: input.capabilityId,
      kind: 'capability',
      ref: commitment('capability', input.capabilityId),
      displayLabel: input.displayLabel,
    },
    version: { version: 1, status: 'published' },
    standing: {
      standing: REGISTRATION_STANDING,
      band: standingBandFor(REGISTRATION_STANDING),
      reach: 0,
    },
    authority: {
      minStandingToCompose: 'experimental',
      ratificationRequired: false,
      governingInvariants: input.governingInvariants ?? [],
    },
    ownership: { ownerCommitment: STEWARD_COMMITMENT },
    provenance: {
      receiptIds,
      contentCommitment: contentCommitment(payload),
      source: 'capability-pipeline',
    },
    lifecycle: { state: 'published', order: ['draft', 'published', 'canonized', 'deprecated'] },
    dependencies: [],
    payload,
  };
}

// ---------------------------------------------------------------------------
// Durable store (soft-fail, capabilityEvidence pattern)
// ---------------------------------------------------------------------------

const MISSING = 'capability_registry';

function softFail(scope: string, message: string): void {
  if (message.includes(MISSING)) {
    console.warn(`[capability registry] migration 20260716000000 not applied; ${scope} skipped`);
  } else {
    console.error(`[capability registry] ${scope} failed:`, message);
  }
}

export interface RegisteredCapability {
  id: string;
  capabilityId: string;
  displayLabel: string;
  object: ConstitutionalObject;
  standing: number;
  standingBand: string;
  lifecycleState: string;
  operationalValidations: number;
  registeredReceiptId: string | null;
  createdAt: string;
}

function rowToCapability(row: Record<string, unknown>): RegisteredCapability {
  return {
    id: String(row.id),
    capabilityId: String(row.capability_id),
    displayLabel: String(row.display_label),
    object: row.object as ConstitutionalObject,
    standing: Number(row.standing),
    standingBand: String(row.standing_band),
    lifecycleState: String(row.lifecycle_state),
    operationalValidations: Number(row.operational_validations ?? 0),
    registeredReceiptId: row.registered_receipt_id ? String(row.registered_receipt_id) : null,
    createdAt: String(row.created_at),
  };
}

/** List every accepted capability, newest first. Soft-fails to []. */
export async function listRegisteredCapabilities(): Promise<RegisteredCapability[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from('capability_registry')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      softFail('list', error.message);
      return [];
    }
    return (data ?? []).map(rowToCapability);
  } catch (e) {
    softFail('list', e instanceof Error ? e.message : String(e));
    return [];
  }
}

export type RegisterResult =
  | { ok: true; capability: RegisteredCapability; receiptId: string | null; alreadyRegistered: boolean }
  | { ok: false; reason: string };

/**
 * Constitutional Acceptance — admit a shipped capability into the registry.
 * Idempotent on capabilityId (re-registering returns the existing row with
 * `alreadyRegistered: true`, no duplicate receipt). Writes the DVN-anchorable
 * `capability_registered` receipt; a receipt failure is surfaced (receiptId
 * null) but never rolls back the registration — same honest-state contract
 * as the research-objects route.
 */
export async function registerCapability(
  personaId: string,
  input: RegisterCapabilityInput,
): Promise<RegisterResult> {
  const capabilityId = input.capabilityId.trim();
  if (!capabilityId) return { ok: false, reason: 'capabilityId required' };
  if (!input.displayLabel?.trim()) return { ok: false, reason: 'displayLabel required' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };

  try {
    // Idempotency: acceptance is a one-time ceremony per capability.
    const { data: existing } = await admin
      .from('capability_registry')
      .select('*')
      .eq('capability_id', capabilityId)
      .maybeSingle();
    if (existing) {
      return { ok: true, capability: rowToCapability(existing), receiptId: existing.registered_receipt_id ? String(existing.registered_receipt_id) : null, alreadyRegistered: true };
    }

    const object = buildCapabilityObject({ ...input, capabilityId });
    const { data, error } = await admin
      .from('capability_registry')
      .insert({
        capability_id: capabilityId,
        display_label: input.displayLabel.trim(),
        object,
        standing: object.standing.standing,
        standing_band: object.standing.band,
        lifecycle_state: 'published',
      })
      .select('*')
      .single();
    if (error) {
      softFail('register', error.message);
      return { ok: false, reason: error.message.includes(MISSING) ? 'capability_registry table missing — apply migration 20260716000000' : error.message };
    }

    let receiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId,
        actionType: 'capability_registered',
        activeCartridge: 'metame',
        summary:
          `Constitutional Acceptance: capability "${input.displayLabel.trim()}" admitted to the Capability Registry ` +
          `[cap=${capabilityId}] ref=${object.identity.ref}` +
          (input.prNumber ? ` PR#${input.prNumber}` : '') +
          (input.packId ? ` pack=${input.packId.slice(0, 40)}` : ''),
        agentsInvoked: ['aigent-z'],
        contextShared: ['capability_id', 'provenance_receipts', 'governing_invariants'],
        artifactsCreated: [capabilityId],
      });
      receiptId = receipt?.id ?? null;
      if (receiptId) {
        await admin.from('capability_registry').update({ registered_receipt_id: receiptId }).eq('id', data.id);
      }
    } catch (e) {
      console.error('[capability registry] acceptance receipt failed — registration stands, receipt missing:', e);
    }

    return { ok: true, capability: rowToCapability({ ...data, registered_receipt_id: receiptId }), receiptId, alreadyRegistered: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('register', msg);
    return { ok: false, reason: msg };
  }
}

export type OperationalValidationResult =
  | { ok: true; capability: RegisteredCapability; receiptId: string | null; standingBefore: number; standingAfter: number }
  | { ok: false; reason: string };

/** PURE — the accrual policy (canary-pinned): +delta, capped, never past the
 *  canonical floor by accrual alone. */
export function accrueCapabilityStanding(current: number): number {
  return Math.min(ACCRUAL_STANDING_CAP, Math.round((current + OPERATIONAL_VALIDATION_DELTA) * 100) / 100);
}

/**
 * Standing accrual trigger (CFS-032 §5). REFUSES when the capability is not
 * registered — registration is the eligibility gate; verified-but-unregistered
 * accrues nothing ever. Evidence is a short operator-supplied statement of
 * what was observed working in production (a Chrysalis Test pass, an operator
 * confirmation, a follow-up experiment) — required, never defaulted.
 */
export async function recordOperationalValidation(
  personaId: string,
  input: { capabilityId: string; evidence: string },
): Promise<OperationalValidationResult> {
  const capabilityId = input.capabilityId.trim();
  const evidence = input.evidence?.trim() ?? '';
  if (!capabilityId) return { ok: false, reason: 'capabilityId required' };
  if (evidence.length < 10) return { ok: false, reason: 'evidence required (≥ 10 chars) — Standing accrues from verified contribution, not from a click' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, reason: 'registry store unavailable' };

  try {
    const { data: row, error } = await admin
      .from('capability_registry')
      .select('*')
      .eq('capability_id', capabilityId)
      .maybeSingle();
    if (error) {
      softFail('operational-validation', error.message);
      return { ok: false, reason: error.message };
    }
    if (!row) {
      // The eligibility gate — honest refusal, never a silent no-op.
      return { ok: false, reason: `capability "${capabilityId}" is not registered — Constitutional Acceptance (registration) must precede Standing accrual (CFS-032 §5)` };
    }

    const standingBefore = Number(row.standing);
    const standingAfter = accrueCapabilityStanding(standingBefore);
    const band = standingBandFor(standingAfter);
    const object = row.object as ConstitutionalObject;
    const updatedObject: ConstitutionalObject = {
      ...object,
      standing: { ...object.standing, standing: standingAfter, band },
    };

    let receiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId,
        actionType: 'capability_operationally_validated',
        activeCartridge: 'metame',
        summary:
          `Operational validation: capability "${String(row.display_label)}" verified in production ` +
          `[cap=${capabilityId}] standing ${standingBefore.toFixed(2)} → ${standingAfter.toFixed(2)} (${band}). ` +
          `Evidence: ${evidence.slice(0, 300)}`,
        agentsInvoked: ['aigent-z'],
        contextShared: ['capability_id', 'standing_delta', 'operational_evidence'],
      });
      receiptId = receipt?.id ?? null;
    } catch (e) {
      console.error('[capability registry] operational-validation receipt failed:', e);
    }

    const { data: updated, error: upErr } = await admin
      .from('capability_registry')
      .update({
        standing: standingAfter,
        standing_band: band,
        object: updatedObject,
        operational_validations: Number(row.operational_validations ?? 0) + 1,
        last_operational_receipt_id: receiptId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (upErr) {
      softFail('operational-validation-update', upErr.message);
      return { ok: false, reason: upErr.message };
    }

    return { ok: true, capability: rowToCapability(updated), receiptId, standingBefore, standingAfter };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    softFail('operational-validation', msg);
    return { ok: false, reason: msg };
  }
}

// ---------------------------------------------------------------------------
// Gap Analysis ground-data seam — the loop-closing read
// ---------------------------------------------------------------------------

/**
 * The registered-capabilities block folded into the gap-analysis (and
 * context-assembly) stage ground data: this is what makes an ACCEPTED
 * capability discoverable by the NEXT capability request — the Registry, not
 * the receipt, closes the self-improvement loop (CFS-032 §4). Soft-fails to
 * '' so a missing migration never breaks the dev loop.
 */
export async function registeredCapabilityBlock(): Promise<string> {
  const caps = await listRegisteredCapabilities();
  if (caps.length === 0) return '';
  const lines = caps.slice(0, 40).map((c) => {
    const p = (c.object?.payload ?? {}) as { description?: string; reuseDisposition?: string };
    return `- ${c.displayLabel} [${c.capabilityId}] · standing ${c.standing.toFixed(2)} (${c.standingBand}) · disposition: ${p.reuseDisposition ?? 'compose'}${p.description ? ` — ${p.description}` : ''}`;
  });
  return [
    '### Accepted capabilities (Capability Registry — constitutionally accepted, REUSE before building)',
    ...lines,
  ].join('\n');
}
