/**
 * `ensureAgentRegistryActivation` — the ONE idempotent transition that
 * materializes `registryActivated` (Constitutional State Model Correction,
 * operator-ratified 2026-08-11).
 *
 * ── THE CORRECTED DOCTRINE ────────────────────────────────────────────────
 *
 * The prior model conflated AigentQube existence, Factory ingestion,
 * constitutional activation, delegation, operation and Standing into one
 * blocking sequence gated on `capability_registered` (Factory/Ingest
 * evidence — a technical fact) standing in for constitutional activation (a
 * governance fact). The corrected rule:
 *
 *   registryActivated =
 *     iQubeRegistryPresent ∧ sponsorBindingEstablished ∧ agentPassportIssued
 *
 * No Delegate prerequisite. No Operate prerequisite. No
 * `capability_registered` involvement at all — Factory ingestion stays
 * purely technical/process evidence (`capability_registered`), never
 * constitutional-activation evidence (`agent_registry_activated`, this
 * module's own receipt type). Activation awards NO Standing: admission
 * creates eligibility to participate, never accrual. Standing is earned by
 * an independently qualifying consequential act — see
 * `services/journey/agentStateAxes.ts`'s `contributionAccrued`.
 *
 * ── DERIVED, NOT AN OPERATOR ACTION ───────────────────────────────────────
 *
 * There is no "Activate" button anywhere in this codebase and there must
 * never be one. Once the three predicates are observed true, this function
 * establishes the fact automatically — the journey renders
 * `Passport → Activate → Delegate`, but Activate is a resolved state
 * transition the operator witnesses, not a ceremony they perform.
 *
 * ── IDEMPOTENCY IS STRUCTURAL ─────────────────────────────────────────────
 *
 * Gated on the SAME settled-fact mechanism every other one-time transition
 * in this codebase uses (`services/journey/settledFacts.ts`, predicate
 * `registry_activated`). `settleFact` returns `alreadySettled: true` on a
 * second attempt and never overwrites, so this function may be called any
 * number of times — from a fresh admission, a legacy reconciliation, a
 * concurrent request — and the fact lands exactly once.
 *
 * ── FIVE-VALUED OUTCOME, NEVER A BARE BOOLEAN ─────────────────────────────
 *
 *   already-active         — settled previously; this call changed nothing.
 *   not-eligible            — one or more predicates are false right now.
 *   eligible-awaiting-actor — all three predicates ARE true, but no
 *                             authenticated persona was present to attribute
 *                             the establishing act to. This is an
 *                             OPERATIONAL gap, never a constitutional
 *                             finding — an unauthenticated preflight read
 *                             must never report "not eligible" when the
 *                             agent genuinely is.
 *   freshly-established     — established for the first time, by this call.
 *   legacy-reconciled        — established for the first time, by this call,
 *                             for an agent whose predicates were already
 *                             true before this mechanism existed (the
 *                             caller asserts this via `provenance`).
 *
 * ── CALL SITES (exactly two, both explicit — never a UI button) ──────────
 *
 *   1. The Passport completion path — `services/journey/
 *      agentAdmissionState.ts`'s `resolveAgentAdmissionState`, the exact
 *      boundary where this codebase observes "Passport is now complete" for
 *      any agent (it already performs one idempotent self-heal write at
 *      this same boundary — the RootDID mint for a migrated agent). Calls
 *      with `provenance: 'freshly-established'`.
 *   2. Explicit legacy reconciliation — `POST /api/ops/journey/
 *      reconcile-registry-activation` (app/api/ops/journey/
 *      reconcile-registry-activation/route.ts), an operator-invoked action,
 *      never automatic. Calls with `provenance: 'legacy-reconciled'`.
 *
 * A GET read (the journey `state` route) only ever READS the settled fact
 * this function produces — it must never call this function directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { readSettledFact, settleFact, isSettled } from './settledFacts';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export interface RegistryActivationPredicates {
  /** The agent's AigentQube row exists in `registry_assets`. */
  registryPresent: boolean;
  /** `agent_root_identity.sponsor_persona_id` / `sponsor_passport_id` is set. */
  sponsorBindingEstablished: boolean;
  /** An approved `agent_participant` Delegate Passport exists for this agent. */
  agentPassportIssued: boolean;
}

export type RegistryActivationOutcome =
  | 'already-active'
  | 'not-eligible'
  | 'eligible-awaiting-actor'
  | 'freshly-established'
  | 'legacy-reconciled';

export interface RegistryActivationResult {
  registryActivated: boolean;
  /** True only when THIS call performed the write. */
  activatedNow: boolean;
  receiptId: string | null;
  outcome: RegistryActivationOutcome;
}

export async function ensureAgentRegistryActivation(
  admin: SupabaseClient,
  agent: RegistrableAgentConfig,
  actorPersonaId: string | null,
  predicates: RegistryActivationPredicates,
  provenance: 'freshly-established' | 'legacy-reconciled' = 'freshly-established',
): Promise<RegistryActivationResult> {
  const existing = await readSettledFact(admin, agent.aigentQubeId, agent.runtimeAgentId, 'registry_activated');
  if (isSettled(existing)) {
    return {
      registryActivated: true,
      activatedNow: false,
      receiptId: existing?.evidenceRefs?.[0] ?? null,
      outcome: 'already-active',
    };
  }

  const eligible =
    predicates.registryPresent && predicates.sponsorBindingEstablished && predicates.agentPassportIssued;
  if (!eligible) {
    return { registryActivated: false, activatedNow: false, receiptId: null, outcome: 'not-eligible' };
  }

  // Eligible, but nobody to attribute the establishing act to yet. Never
  // reported as "not eligible" — that would be a lie about a constitutional
  // question in order to paper over an operational one.
  if (!actorPersonaId) {
    return { registryActivated: false, activatedNow: false, receiptId: null, outcome: 'eligible-awaiting-actor' };
  }

  let settlement;
  try {
    settlement = await settleFact(admin, agent.aigentQubeId, {
      subject: agent.runtimeAgentId,
      predicate: 'registry_activated',
      object: { provenance },
      evidenceRefs: [],
      resolutionAuthority: actorPersonaId,
    });
  } catch {
    return { registryActivated: false, activatedNow: false, receiptId: null, outcome: 'not-eligible' };
  }
  if (!settlement.ok) {
    return { registryActivated: false, activatedNow: false, receiptId: null, outcome: 'not-eligible' };
  }
  if (settlement.alreadySettled) {
    // A concurrent request settled it between our read and our write.
    return { registryActivated: true, activatedNow: false, receiptId: null, outcome: 'already-active' };
  }

  const receipt = await createActivityReceipt({
    personaId: actorPersonaId,
    activeCartridge: 'agentiq',
    actionType: 'agent_registry_activated',
    summary:
      `${agent.displayName} became constitutionally active in the iQube Registry ` +
      `(${provenance === 'legacy-reconciled' ? 'legacy reconciliation of already-established evidence' : 'Passport + sponsorship newly established'}) — no Standing awarded.`,
    agentsInvoked: [agent.runtimeAgentId],
    actionInput: {
      provenance,
      aigentQubeId: agent.aigentQubeId,
      registryPresent: predicates.registryPresent,
      sponsorBindingEstablished: predicates.sponsorBindingEstablished,
      agentPassportIssued: predicates.agentPassportIssued,
      standingAwarded: false,
    },
  });

  return {
    registryActivated: true,
    activatedNow: true,
    receiptId: receipt?.id ?? null,
    outcome: provenance,
  };
}
