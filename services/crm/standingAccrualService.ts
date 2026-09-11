/**
 * Standing accrual service (Phases 2 + 3).
 *
 * Phase 2 (live): the Standing keystone — Personal/Delegated/Stewardship —
 * extends the existing reputation engine without replacing it. Reputation
 * deltas continue to accrue on completeTask exactly as today; this service
 * additively records a Standing delta on the same event and rolls it into
 * crm_persona_reputation.
 *
 * Phase 3 (added here): Sponsorship Capacity Protocol. The sponsor lookup
 * (crm_personas.identity_persona_id → personas.id → polity_passport_records
 * → agent_root_identity → sponsor's identity persona → sponsor's crm_persona)
 * is resolved here so Delegated/Stewardship accrual works without callers
 * having to wire it. When the contributor's standing_overall crosses the
 * Standing threshold, the sponsor's personas.sponsorship_capacity_earned is
 * incremented (work-potential staking — never time-driven).
 *
 * Why a single seam: per Extend-Don't-Duplicate, accrual must be synchronous
 * with reputation accrual (atomic, no polling worker), so we invoke it from
 * completeTask right after updatePersonaReputation. Event-driven by design —
 * a bad agent at 12 months must not outrank a good agent at 2 weeks.
 *
 * Bucket: standing_overall in [0..) maps to standing_bucket in [0..4] in
 * steps of 25 — reuses the existing 0..4 reputation bucket primitive in the
 * SmartWalletDrawer dot strip.
 */

import { getCrmClient } from './crmDataAccess';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { syncStandingToRQH } from '@/services/crm/taskCanisterService';

const STANDING_CVS_FACTOR = 1; // 1:1 — CVS is the canonical contribution score
const DELEGATED_FACTOR = 0.5;   // sponsor gets half-credit on sponsored Personal
const STEWARDSHIP_FACTOR = 0.25; // sponsor gets quarter-credit as stewardship
const BUCKET_STEP = 25;
const STANDING_THRESHOLD = 50;  // bucket 2 = "earned Standing"
const CAPACITY_INCREMENT = 2;    // sponsor's capacity grows by 2 per crossing (3 → 5 example)

// Sprint 4 — Capability Standing blend constants.
// Consequence lanes (personal + delegated + stewardship) carry 70% weight;
// Capability Standing (front-half) carries the remaining 30%, capped at 40
// points so signal noise cannot overwhelm verified outcomes.
const CAPABILITY_CEILING = 40;
const CONSEQUENCE_WEIGHT = 0.70;
const CAPABILITY_BLEND_FACTOR = 0.75; // 40 × 0.75 = 30 effective points in the overall

export interface StandingAccrual {
  personal: number;
  delegated: number;
  stewardship: number;
  overall: number;
  bucket: number;
  thresholdCrossed: boolean;
  sponsorCapacityCredited: boolean;
}

export interface AccrueStandingInput {
  /** The CRM persona being credited (the contributor). */
  crmPersonaId: string;
  /**
   * Optional explicit sponsor CRM persona id. When omitted, the sponsor is
   * resolved automatically via the identity spine
   * (crm_personas.identity_persona_id → polity_passport_records →
   * agent_root_identity). Passing null disables sponsor accrual.
   */
  sponsorCrmPersonaId?: string | null;
  /** Contribution Value Score from the just-completed task. */
  cvs: number;
  /** Routing tag from the task template; defaults to 'personal'. */
  standingType?: 'personal' | 'delegated' | 'stewardship' | null;
  /** Source event id (reputation event id) for audit linkage. */
  sourceEventId?: string | null;
  /**
   * The canonical runtime agent id (`services/horizen/registrableAgents.ts`,
   * e.g. 'aigent-nakamoto') that is the SUBJECT of this Standing credit —
   * the exact id the Horizen Journey's Standing observer
   * (`services/journey/standingEvidenceProjection.ts::resolveStandingEvidence`)
   * must be able to find this receipt under via its
   * `agents_invoked` containment lookup. 2026-08-23 operator directive: a
   * `standing_accrued` receipt previously always carried
   * `agentsInvoked: ['aigent-z']` regardless of which agent's Standing was
   * actually credited, making genuine per-agent accrual invisible to its own
   * observer. NEVER derive this from a display name or infer it — callers
   * that credit a specific registrable agent's Standing (e.g. Financial
   * Services passing `request.requestingAgentId`) MUST supply the same
   * canonical id that agent is registered under everywhere else. Omitted
   * (the default) preserves the prior `agentsInvoked: ['aigent-z']` behavior
   * unchanged for human/citizen-driven accrual paths that credit no specific
   * runtime agent (task completion, venture outcomes, campaign rules,
   * delegate standing) — this field is additive, not a behavior change for
   * every existing caller.
   */
  subjectAgentRef?: string | null;
  /**
   * The agent that coordinated/orchestrated this accrual, if any (e.g.
   * 'aigent-z'). Recorded ONLY in the receipt's `actionInput` for audit —
   * NEVER placed into `agentsInvoked` and NEVER substituted for
   * `subjectAgentRef`, so an orchestrator can never be mistaken for the
   * Standing subject by `resolveStandingEvidence`'s containment lookup
   * (operator: "Aigent Z orchestration does not become the Standing subject
   * merely because it coordinated the act").
   */
  orchestratorAgentRef?: string | null;
  /**
   * The REQUESTING/consuming agent whose interaction produced this credit
   * (e.g. a Financial Services consumer whose successfully-delivered request
   * caused the PROVIDER to be credited) — recorded ONLY in `actionInput`,
   * for interaction/context evidence. 2026-08-23 operator directive: "Preserve
   * requester identity as interaction/context evidence, not as the recipient
   * of provider contribution Standing." Like `orchestratorAgentRef`, this is
   * NEVER placed into `agentsInvoked` and NEVER substituted for
   * `subjectAgentRef` — the requester coordinated the interaction; it did not
   * perform the credited work.
   */
  requestingAgentRef?: string | null;
}

function bucketFor(overall: number): number {
  if (overall <= 0) return 0;
  return Math.min(4, Math.floor(overall / BUCKET_STEP));
}

interface ExistingStanding {
  personal: number;
  delegated: number;
  stewardship: number;
  /** Sprint 4 — Capability Standing (front-half agency signal). */
  capability: number;
  overall: number;
}

async function readStanding(
  client: ReturnType<typeof getCrmClient>,
  crmPersonaId: string,
): Promise<ExistingStanding | null> {
  const { data } = await client
    .from('crm_persona_reputation')
    .select('standing_personal, standing_delegated, standing_stewardship, standing_capability, standing_overall')
    .eq('persona_id', crmPersonaId)
    .maybeSingle();
  if (!data) return null;
  return {
    personal: Number(data.standing_personal ?? 0),
    delegated: Number(data.standing_delegated ?? 0),
    stewardship: Number(data.standing_stewardship ?? 0),
    capability: Number((data as Record<string, unknown>).standing_capability ?? 0),
    overall: Number(data.standing_overall ?? 0),
  };
}

async function writeStanding(
  client: ReturnType<typeof getCrmClient>,
  crmPersonaId: string,
  next: ExistingStanding,
  lane: 'consequence' | 'capability' = 'consequence',
): Promise<{ overall: number; bucket: number }> {
  // Consequence Standing (personal + delegated + stewardship) contributes 70%;
  // Capability Standing (front-half agency signal, ceiling 40) contributes 30%.
  // This blend ensures capability formation is meaningful without displacing
  // verified outcomes as the dominant Standing signal.
  const consequenceTotal = next.personal + next.delegated + next.stewardship;
  const capabilityContrib = Math.min(CAPABILITY_CEILING, next.capability ?? 0);
  const overall = consequenceTotal * CONSEQUENCE_WEIGHT + capabilityContrib * CAPABILITY_BLEND_FACTOR;
  const bucket = bucketFor(overall);
  const existing = await readStanding(client, crmPersonaId);
  const capabilityCol = { standing_capability: next.capability ?? 0 };
  if (existing) {
    await client
      .from('crm_persona_reputation')
      .update({
        standing_personal: next.personal,
        standing_delegated: next.delegated,
        standing_stewardship: next.stewardship,
        ...capabilityCol,
        standing_overall: overall,
        standing_bucket: bucket,
        updated_at: new Date().toISOString(),
      })
      .eq('persona_id', crmPersonaId);
  } else {
    await client.from('crm_persona_reputation').insert({
      persona_id: crmPersonaId,
      standing_personal: next.personal,
      standing_delegated: next.delegated,
      standing_stewardship: next.stewardship,
      ...capabilityCol,
      standing_overall: overall,
      standing_bucket: bucket,
    });
  }

  // Auto-sync to RQH canister — fire-and-forget, never blocks the write.
  void (async () => {
    try {
      const { data: crmRow } = await client
        .from('crm_personas')
        .select('identity_persona_id')
        .eq('id', crmPersonaId)
        .maybeSingle();
      const identityPersonaId = crmRow?.identity_persona_id;
      if (!identityPersonaId) return;
      await syncStandingToRQH({
        crmPersonaId,
        identityPersonaId,
        standing: {
          personal: next.personal,
          delegated: next.delegated,
          stewardship: next.stewardship,
          capability: next.capability ?? 0,
          overall,
          bucket,
        },
        lane,
      });
    } catch {
      /* best-effort — RQH sync failure never propagates */
    }
  })();

  return { overall, bucket };
}

/**
 * Resolve a sponsor's CRM persona id from the contributor's CRM persona id.
 * Returns null when the contributor isn't a sponsored agent or any link is
 * missing. Best-effort — never throws.
 *
 * Chain (T0 server-internal):
 *   contributor.crm_persona → identity persona id →
 *   polity_passport_records (participant passport, this identity_persona) →
 *   agent_root_identity (bound_passport_id) → sponsor identity persona id →
 *   reverse-lookup crm_persona (identity_persona_id = sponsor identity persona)
 */
async function resolveSponsorCrmPersonaId(
  crmClient: ReturnType<typeof getCrmClient>,
  contributorCrmPersonaId: string,
): Promise<string | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;

  // 1. crm_persona → identity persona id.
  const { data: contribCrm } = await crmClient
    .from('crm_personas')
    .select('identity_persona_id')
    .eq('id', contributorCrmPersonaId)
    .maybeSingle();
  const contributorIdentityPersonaId = contribCrm?.identity_persona_id;
  if (!contributorIdentityPersonaId) return null;

  // 2. Participant passport for that identity persona.
  const { data: passport } = await admin
    .from('polity_passport_records')
    .select('passport_id')
    .eq('persona_id', contributorIdentityPersonaId)
    .neq('passport_class', 'citizen')
    .limit(1)
    .maybeSingle();
  if (!passport?.passport_id) return null;

  // 3. agent_root_identity → sponsor identity persona id.
  const { data: agent } = await admin
    .from('agent_root_identity')
    .select('sponsor_persona_id')
    .eq('bound_passport_id', passport.passport_id)
    .maybeSingle();
  const sponsorIdentityPersonaId = agent?.sponsor_persona_id;
  if (!sponsorIdentityPersonaId) return null;

  // 4. sponsor identity persona id → sponsor crm_persona.
  const { data: sponsorCrm } = await crmClient
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', sponsorIdentityPersonaId)
    .maybeSingle();
  return sponsorCrm?.id ?? null;
}

/**
 * Credit the sponsor's sponsorship_capacity_earned when a sponsored agent
 * crosses the Standing threshold. The sponsor's identity persona id is
 * resolved from their CRM persona id; the write goes to the identity DB
 * (personas.sponsorship_capacity_earned). Best-effort — soft-fails on
 * deferred migration.
 */
async function creditSponsorCapacity(
  crmClient: ReturnType<typeof getCrmClient>,
  sponsorCrmPersonaId: string,
): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;

  const { data: sponsorCrm } = await crmClient
    .from('crm_personas')
    .select('identity_persona_id')
    .eq('id', sponsorCrmPersonaId)
    .maybeSingle();
  const sponsorIdentityPersonaId = sponsorCrm?.identity_persona_id;
  if (!sponsorIdentityPersonaId) return false;

  // Read-modify-write — atomic increment via Postgres would be nicer but the
  // capacity field is low-contention (event-driven, one increment per Standing
  // crossing per sponsor).
  const { data: sponsor, error: readErr } = await admin
    .from('personas')
    .select('sponsorship_capacity_earned')
    .eq('id', sponsorIdentityPersonaId)
    .maybeSingle();
  if (readErr) {
    if (readErr.message.includes('sponsorship_capacity_earned')) {
      console.warn('[standing accrual] migration 20260616200000 not applied; capacity credit skipped');
      return false;
    }
    console.error('[standing accrual] sponsor read failed:', readErr.message);
    return false;
  }
  const current = Number(sponsor?.sponsorship_capacity_earned ?? 0);
  const { error: updErr } = await admin
    .from('personas')
    .update({ sponsorship_capacity_earned: current + CAPACITY_INCREMENT })
    .eq('id', sponsorIdentityPersonaId);
  if (updErr) {
    console.error('[standing accrual] capacity credit failed:', updErr.message);
    return false;
  }
  return true;
}

/**
 * Accrue Standing for a single task completion. Returns the resulting Standing
 * vector for the contributor + threshold-crossing telemetry.
 *
 * Failure-mode: best-effort. If the Phase 2 migration has not yet been
 * applied, the standing_* columns won't exist and the underlying Supabase
 * update will error — we swallow that and log so completeTask never fails on
 * a deferred Standing write. Same pattern as the verify-worldid hardening
 * sweep.
 */
export async function accrueStanding(input: AccrueStandingInput): Promise<StandingAccrual | null> {
  const client = getCrmClient();
  const category = input.standingType ?? 'personal';

  const personalDelta = STANDING_CVS_FACTOR * input.cvs;

  try {
    // Contributor side — Personal Standing.
    const existing = (await readStanding(client, input.crmPersonaId)) ?? {
      personal: 0,
      delegated: 0,
      stewardship: 0,
      capability: 0,
      overall: 0,
    };
    const next = {
      personal: existing.personal + personalDelta,
      delegated: existing.delegated,
      stewardship: existing.stewardship,
      capability: existing.capability,
      overall: 0, // recomputed in writeStanding
    };
    const writeResult = await writeStanding(client, input.crmPersonaId, next, 'consequence');
    const newOverall = writeResult.overall;
    const thresholdCrossed =
      existing.overall < STANDING_THRESHOLD && newOverall >= STANDING_THRESHOLD;

    // Sponsor lookup. Explicit null disables; explicit id overrides; undefined
    // triggers auto-resolution (Phase 3).
    let sponsorCrmPersonaId: string | null = null;
    if (input.sponsorCrmPersonaId === undefined) {
      sponsorCrmPersonaId = await resolveSponsorCrmPersonaId(client, input.crmPersonaId);
    } else {
      sponsorCrmPersonaId = input.sponsorCrmPersonaId;
    }

    const sponsorPersonalCredit =
      sponsorCrmPersonaId && category !== 'stewardship' ? DELEGATED_FACTOR * input.cvs : 0;
    const sponsorStewardshipCredit = sponsorCrmPersonaId ? STEWARDSHIP_FACTOR * input.cvs : 0;

    // Sponsor side — Delegated + Stewardship Standing.
    if (sponsorCrmPersonaId) {
      const sponsorExisting = (await readStanding(client, sponsorCrmPersonaId)) ?? {
        personal: 0,
        delegated: 0,
        stewardship: 0,
        capability: 0,
        overall: 0,
      };
      const sponsorNext = {
        personal: sponsorExisting.personal,
        delegated: sponsorExisting.delegated + sponsorPersonalCredit,
        stewardship: sponsorExisting.stewardship + sponsorStewardshipCredit,
        capability: sponsorExisting.capability,
        overall: 0,
      };
      await writeStanding(client, sponsorCrmPersonaId, sponsorNext);
    }

    // Capacity credit — fires once per threshold crossing per contributor.
    // Requires a sponsor link; otherwise it's a self-citizen earning Personal
    // Standing for themselves (their own capacity earning will come from
    // sponsoring others crossing thresholds, not from their own).
    let sponsorCapacityCredited = false;
    if (thresholdCrossed && sponsorCrmPersonaId) {
      sponsorCapacityCredited = await creditSponsorCapacity(client, sponsorCrmPersonaId);
    }

    // Tag the reputation event with the standing delta for audit linkage.
    if (input.sourceEventId) {
      await client
        .from('crm_reputation_events')
        .update({
          standing_category: category,
          standing_accrual_delta: personalDelta,
        })
        .eq('id', input.sourceEventId);
    }

    // Create a standing_accrued activity receipt so the accrual flows through
    // the DVN pipeline. Resolve the identity persona from the CRM row
    // (crmPersonaId → identity_persona_id). Fire-and-forget — never throws.
    void (async () => {
      try {
        const { data: crmRow } = await client
          .from('crm_personas')
          .select('identity_persona_id')
          .eq('id', input.crmPersonaId)
          .maybeSingle();
        const identityPersonaId = crmRow?.identity_persona_id;
        if (!identityPersonaId) return;
        // The Standing SUBJECT is whichever agent's credit this is — never
        // substituted with the orchestrator. `agentsInvoked` carries ONLY the
        // subject id so `resolveStandingEvidence`'s containment lookup can
        // never mistake a coordinating agent for the credited one.
        const agentsInvoked = input.subjectAgentRef ? [input.subjectAgentRef] : ['aigent-z'];
        await createActivityReceipt({
          personaId: identityPersonaId,
          actionType: 'standing_accrued',
          activeCartridge: 'metame',
          summary: `Standing accrued: +${personalDelta.toFixed(2)} ${category} (overall ${newOverall.toFixed(1)}, bucket ${bucketFor(newOverall)})`,
          agentsInvoked,
          iqubesUsed: ['VentureQube'],
          contextShared: ['standing_category', 'standing_delta', 'standing_overall'],
          actionInput: input.subjectAgentRef
            ? {
                subjectAgentRef: input.subjectAgentRef,
                orchestratorAgentRef: input.orchestratorAgentRef ?? null,
                requestingAgentRef: input.requestingAgentRef ?? null,
              }
            : null,
        });
      } catch {
        /* best-effort — receipt failure must never block standing accrual */
      }
    })();

    return {
      personal: next.personal,
      delegated: next.delegated,
      stewardship: next.stewardship,
      overall: newOverall,
      bucket: bucketFor(newOverall),
      thresholdCrossed,
      sponsorCapacityCredited,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('standing_')) {
      console.warn('[standing accrual] migration 20260616100000 not applied; Standing accrual skipped');
      return null;
    }
    console.error('[standing accrual] failed:', message);
    return null;
  }
}

// ─── Capability Standing (Sprint 4 — front-half agency signal) ────────────────

/**
 * Input signals for Capability Standing computation.
 *
 * TWO SCALES, DELIBERATELY. This interface carries signals from two different
 * producers and they do NOT share a range. Getting this wrong is the v1.0
 * defect (below), so the scale is documented per field and enforced by two
 * different normalisers in `computeCapabilityScore` — never one shared clamp.
 *
 *   0–100  demandConfidence · opportunityConfidence · capabilityConfidence
 *          VentureQube schema: `z.number().min(0).max(100)`
 *          (`services/iqube/ventureQubeSchema.ts:384`), produced by
 *          `metacommonsSignals.ts` whose own `clamp` is `min(100, …)`.
 *   0–1    intentClarity · identityDepth
 *          Derived HERE by `computeIntentClarity` / `computeIdentityDepth`.
 */
export interface CapabilitySignals {
  /** VentureQube signalEvidence.demandConfidence — is anyone waiting? **0–100.** */
  demandConfidence: number | null;
  /** VentureQube signalEvidence.opportunityConfidence — is the market real? **0–100.** */
  opportunityConfidence: number | null;
  /** VentureQube signalEvidence.capabilityConfidence — can they plausibly deliver? **0–100.** */
  capabilityConfidence: number | null;
  /** Derived from thesis field completeness + active objectives count (0-1). */
  intentClarity: number | null;
  /** Step function: base persona 0.2 → passport issued 0.5 → World ID 0.8 → grade A 1.0. */
  identityDepth: number;
}

export interface CapabilityStandingResult {
  /** Raw Capability Standing score applied (0–CAPABILITY_CEILING). */
  capabilityScore: number;
  /** Incremental delta vs prior Capability Standing (0 when monotone ceiling reached). */
  delta: number;
  overall: number;
  bucket: number;
}

// Capability signal weights must sum to 1.0.
const CAPABILITY_SIGNAL_WEIGHTS = {
  demand: 0.25,
  opportunity: 0.20,
  capability: 0.30,
  intent: 0.15,
  identity: 0.10,
} as const;

/**
 * The scoring formula version. Capability Standing is personhood-bound and
 * written to a MONOTONE ledger, so a change to the formula is not a refactor —
 * it changes what a citizen's recorded score means. The version travels with
 * every correction so an auditor can tell which formula produced which number.
 *
 *   capability-standing/v1.0 — SATURATED. Passed the three 0–100 VentureQube
 *     confidence signals through a `clamp01`, so any value ≥ 1 (i.e. nearly
 *     every real one) saturated to 1.0. Three of five weighted inputs pinned
 *     at maximum, collapsing the score to `0.75 + intent*0.15 + identity*0.10`
 *     — a 0.75 floor no citizen could fall below and a 0.25 band no venture
 *     signal could move. Differentiation destroyed; scores inflated.
 *   capability-standing/v1.1 — normalises the three percentage inputs by /100
 *     before weighting, and leaves the two already-0–1 inputs alone.
 */
export const CAPABILITY_STANDING_FORMULA_VERSION = 'capability-standing/v1.1';

/** Formula versions this service has previously written to the ledger.
 *  Recorded in the TYPE, not only in prose, so a re-baseline can identify
 *  which stored scores were produced by a superseded formula. */
export const SUPERSEDED_CAPABILITY_FORMULA_VERSIONS = ['capability-standing/v1.0'] as const;

/** 0–1 inputs. Null is absence of signal, which is zero — not a neutral prior. */
const clamp01 = (v: number | null) => Math.max(0, Math.min(1, v ?? 0));

/**
 * 0–100 inputs, normalised to the 0–1 the weighting expects.
 *
 * The `/ 100` is the whole v1.0 fix. It must be applied to the three
 * VentureQube confidence signals and to NOTHING else — dividing an
 * already-0–1 input by 100 is the mirror-image defect, silently zeroing a
 * real signal instead of saturating it. Both directions are canaried.
 */
const normalizePercent = (value: number | null): number => Math.max(0, Math.min(1, (value ?? 0) / 100));

/**
 * Compute the raw Capability Standing score (0–CAPABILITY_CEILING) from signal
 * evidence. Exported so callers can preview the score before writing.
 *
 * This function owns the scoring boundary, so normalisation happens HERE and
 * exactly once. Normalising at the call sites instead would mean every future
 * caller has to know which of its five inputs are percentages — the knowledge
 * that was missing when v1.0 was written.
 */
export function computeCapabilityScore(signals: CapabilitySignals): number {
  const weighted =
    normalizePercent(signals.demandConfidence) * CAPABILITY_SIGNAL_WEIGHTS.demand +
    normalizePercent(signals.opportunityConfidence) * CAPABILITY_SIGNAL_WEIGHTS.opportunity +
    normalizePercent(signals.capabilityConfidence) * CAPABILITY_SIGNAL_WEIGHTS.capability +
    clamp01(signals.intentClarity) * CAPABILITY_SIGNAL_WEIGHTS.intent +
    clamp01(signals.identityDepth) * CAPABILITY_SIGNAL_WEIGHTS.identity;
  return Math.round(weighted * CAPABILITY_CEILING * 100) / 100;
}

/**
 * Derive intentClarity (0-1) from VentureQube thesis layer completeness and
 * the count of active operating objectives. Exported for reuse across
 * wiring points (portfolio save, venture qube PATCH).
 *
 * Weights: thesis fields (4 × 0.10 = 0.40), active objectives (up to 3,
 * 0.20 each = 0.60 max). Saturates at 3 objectives so operators aren't
 * incentivised to pad the list.
 */
export function computeIntentClarity(
  thesisFields: {
    mission?: string | null;
    problemStatement?: string | null;
    valueProposition?: string | null;
    consequenceThesis?: string | null;
  } | null | undefined,
  activeObjectiveCount: number,
): number {
  const thesisScore = ['mission', 'problemStatement', 'valueProposition', 'consequenceThesis']
    .reduce((acc, k) => acc + ((thesisFields as Record<string, string | null | undefined> | null)?.[k]?.trim() ? 0.1 : 0), 0);
  const objectiveScore = Math.min(0.6, activeObjectiveCount * 0.2);
  return thesisScore + objectiveScore; // 0–1.0
}

/**
 * Derive identityDepth (0-1) from the citizen's passport state. The step
 * function ensures each verification milestone adds meaningful agency signal.
 */
export function computeIdentityDepth(passport: {
  issued: boolean;
  worldIdVerified: boolean;
  gradeA: boolean;
} | null): number {
  if (!passport) return 0.2; // base persona exists
  if (passport.gradeA) return 1.0;
  if (passport.worldIdVerified) return 0.8;
  if (passport.issued) return 0.5;
  return 0.3; // application in progress
}

/**
 * Accrue Capability Standing for a citizen from their current signal evidence.
 * Monotone: only ever increases, so a transient dip in signal scores doesn't
 * punish the citizen. Best-effort — swallows errors from deferred migrations.
 *
 * Accrual is capped at CAPABILITY_CEILING (40 pts); the blend weight in
 * writeStanding ensures it contributes ~30% of standing_overall.
 */
/**
 * Re-baseline a citizen's Capability Standing under a corrected formula.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `accrueCapabilityStanding` WITH A FLAG.
 * Ordinary accrual is monotone — `Math.max(existing, new)` — so a transient
 * dip in venture signal never punishes a citizen. That rule is correct and
 * stays. But it also means a score inflated by a DEFECTIVE FORMULA can never
 * come down through the ordinary path: v1.0's saturation floor of 0.75 is
 * above almost every honest v1.1 score, so every correction would be silently
 * discarded as `delta <= 0` and the defect would be permanent.
 *
 * The operator's ruling draws the line (2026-07-28):
 *
 *   "Monotone accrual protects earned history from ordinary signal
 *    fluctuation; it does not prohibit an attributable correction of a
 *    defective scoring function."
 *
 * So correction is a SEPARATE, EXPLICITLY AUTHORIZED act, not a parameter on
 * the ordinary one. A flag would let any accrual call site lower a score by
 * passing a boolean — the monotone guarantee would exist only by convention.
 *
 * THREE THINGS KEPT APART, per the ruling:
 *   1. Accrual history — immutable. Nothing here deletes a prior event.
 *   2. Current derived score — recomputed under the corrected formula.
 *   3. Correction event — records old, new, both formula versions and reason.
 *
 * The corrected score is authoritative PROSPECTIVELY. Past awards stand as
 * what was awarded under the code that existed at the time; rewriting them
 * would be falsifying history to make the ledger look like it was never wrong.
 */
export async function rebaselineCapabilityStanding(
  crmPersonaId: string,
  signals: CapabilitySignals,
  correction: {
    /** The formula that produced the stored score. Must be a superseded one —
     *  re-baselining from the CURRENT version would be a no-op dressed as a
     *  correction, and is refused. */
    fromFormulaVersion: string;
    /** Why this citizen's score is being corrected. Written to the receipt. */
    reason: string;
  },
): Promise<(CapabilityStandingResult & { previousScore: number; formulaVersion: string }) | null> {
  if (!(SUPERSEDED_CAPABILITY_FORMULA_VERSIONS as readonly string[]).includes(correction.fromFormulaVersion)) {
    // Fail closed and say why. A correction that cannot name the defective
    // formula it is correcting is indistinguishable from an unattributed
    // downward write against a monotone ledger.
    throw new Error(
      `rebaselineCapabilityStanding: fromFormulaVersion '${correction.fromFormulaVersion}' is not a superseded formula ` +
        `(known: ${SUPERSEDED_CAPABILITY_FORMULA_VERSIONS.join(', ')}). A re-baseline must name the defective formula it corrects.`,
    );
  }

  const client = getCrmClient();
  try {
    const existing = await readStanding(client, crmPersonaId);
    if (!existing) return null;

    const newScore = computeCapabilityScore(signals);
    const previousScore = existing.capability;
    // The correction is authoritative in BOTH directions — that is the whole
    // point. No Math.max here, deliberately.
    const next: ExistingStanding = {
      personal: existing.personal,
      delegated: existing.delegated,
      stewardship: existing.stewardship,
      capability: newScore,
      overall: 0, // recomputed in writeStanding
    };
    const writeResult = await writeStanding(client, crmPersonaId, next, 'capability');

    // The correction receipt. Unlike the accrual receipt this is NOT
    // fire-and-forget: an unattributed correction to a monotone personhood
    // ledger is precisely what must never happen silently. If the receipt
    // cannot be written, the caller learns about it.
    const { data: crmRow } = await client
      .from('crm_personas')
      .select('identity_persona_id')
      .eq('id', crmPersonaId)
      .maybeSingle();
    const identityPersonaId = crmRow?.identity_persona_id;
    if (identityPersonaId) {
      await createActivityReceipt({
        personaId: identityPersonaId,
        actionType: 'standing_corrected',
        activeCartridge: 'metame',
        summary:
          `Capability Standing re-baselined: ${previousScore.toFixed(2)} → ${newScore.toFixed(2)} ` +
          `(${correction.fromFormulaVersion} → ${CAPABILITY_STANDING_FORMULA_VERSION}). ${correction.reason}`,
        agentsInvoked: ['aigent-z'],
        iqubesUsed: ['VentureQube'],
        contextShared: ['capability_score', 'standing_overall', 'formula_version', 'correction_reason'],
      });
    }

    return {
      capabilityScore: newScore,
      previousScore,
      formulaVersion: CAPABILITY_STANDING_FORMULA_VERSION,
      delta: Math.round((newScore - previousScore) * 100) / 100,
      overall: writeResult.overall,
      bucket: writeResult.bucket,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('standing_')) {
      console.warn('[capability standing] standing migration not applied; re-baseline skipped');
      return null;
    }
    // Unlike accrual, a failed correction is escalated rather than swallowed.
    console.error('[capability standing] RE-BASELINE FAILED:', message);
    throw e;
  }
}

export async function accrueCapabilityStanding(
  crmPersonaId: string,
  signals: CapabilitySignals,
): Promise<CapabilityStandingResult | null> {
  const client = getCrmClient();
  try {
    const existing = (await readStanding(client, crmPersonaId)) ?? {
      personal: 0,
      delegated: 0,
      stewardship: 0,
      capability: 0,
      overall: 0,
    };
    const newScore = computeCapabilityScore(signals);
    // Monotone: the stored capability only moves up.
    const nextCapability = Math.max(existing.capability, newScore);
    const delta = Math.round((nextCapability - existing.capability) * 100) / 100;
    if (delta <= 0) {
      return {
        capabilityScore: nextCapability,
        delta: 0,
        overall: existing.overall,
        bucket: bucketFor(existing.overall),
      };
    }
    const next: ExistingStanding = {
      personal: existing.personal,
      delegated: existing.delegated,
      stewardship: existing.stewardship,
      capability: nextCapability,
      overall: 0, // recomputed in writeStanding
    };
    const writeResult = await writeStanding(client, crmPersonaId, next, 'capability');

    // Create a standing_accrued receipt for the DVN pipeline. Resolve identity
    // persona from CRM row. Fire-and-forget — never blocks.
    void (async () => {
      try {
        const { data: crmRow } = await client
          .from('crm_personas')
          .select('identity_persona_id')
          .eq('id', crmPersonaId)
          .maybeSingle();
        const identityPersonaId = crmRow?.identity_persona_id;
        if (!identityPersonaId) return;
        await createActivityReceipt({
          personaId: identityPersonaId,
          actionType: 'standing_accrued',
          activeCartridge: 'metame',
          summary: `Capability Standing accrued: +${delta.toFixed(2)} (score ${nextCapability.toFixed(1)} / ${CAPABILITY_CEILING}, overall ${writeResult.overall.toFixed(1)})`,
          agentsInvoked: ['aigent-z'],
          iqubesUsed: ['VentureQube'],
          contextShared: ['capability_score', 'standing_delta', 'standing_overall'],
        });
      } catch {
        /* best-effort */
      }
    })();

    return {
      capabilityScore: nextCapability,
      delta,
      overall: writeResult.overall,
      bucket: writeResult.bucket,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('standing_capability')) {
      console.warn('[capability standing] migration 20260623100000 not applied; accrual skipped');
      return null;
    }
    if (message.includes('standing_')) {
      console.warn('[capability standing] standing migration not applied; accrual skipped');
      return null;
    }
    console.error('[capability standing] failed:', message);
    return null;
  }
}

/**
 * Fire-and-forget Capability Standing refresh triggered by aigentMe activity
 * (brief requests, venture-progress reviews, etc.). Reads the persona's
 * primary VentureQube + passport state and recomputes accrual.
 *
 * Call this from any aigentMe API route after resolving the persona — swallows
 * all errors so it never breaks the calling route.
 */
export async function refreshCapabilityStandingFromActivity(
  personaId: string,
): Promise<void> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return;

    // CRM persona lookup
    const crm = getCrmClient();
    const { data: crmPersona } = await crm
      .from('crm_personas')
      .select('id')
      .eq('identity_persona_id', personaId)
      .maybeSingle();
    const crmPersonaId = crmPersona?.id ? String(crmPersona.id) : null;
    if (!crmPersonaId) return;

    // Primary VentureQube — oldest (first created) is the orchestrating venture
    const { data: ventures } = await admin
      .from('venture_qubes')
      .select('id, layers, created_at')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: true })
      .limit(1);
    const venture = ventures?.[0] ?? null;
    const layers = (venture?.layers ?? {}) as Record<string, unknown>;
    const thesis = (layers.thesis ?? null) as Parameters<typeof computeIntentClarity>[0] | null;
    const signalEvidence = (layers.signalEvidence ?? null) as Record<string, number | null> | null;
    const intent = (layers.intent ?? null) as { founderIntents?: unknown[]; ventureIntents?: unknown[] } | null;

    const founderIntents = Array.isArray(intent?.founderIntents) ? intent.founderIntents : [];
    const ventureIntents = Array.isArray(intent?.ventureIntents) ? intent.ventureIntents : [];
    const activeObjectiveCount = [...founderIntents, ...ventureIntents].filter(
      (s) => typeof s === 'string' && (s as string).trim().length > 0,
    ).length;
    const intentClarity = computeIntentClarity(thesis, activeObjectiveCount);

    // Passport depth
    const { data: passport } = await admin
      .from('polity_passport_records')
      .select('issued_at, world_id_verified_at, passport_grade')
      .eq('persona_id', personaId)
      .eq('passport_class', 'citizen')
      .maybeSingle();
    const identityDepth = computeIdentityDepth(
      passport
        ? { issued: Boolean(passport.issued_at), worldIdVerified: Boolean(passport.world_id_verified_at), gradeA: passport.passport_grade === 'A' }
        : null,
    );

    await accrueCapabilityStanding(crmPersonaId, {
      demandConfidence: signalEvidence?.demandConfidence ?? null,
      opportunityConfidence: signalEvidence?.opportunityConfidence ?? null,
      capabilityConfidence: signalEvidence?.capabilityConfidence ?? null,
      intentClarity,
      identityDepth,
    });
  } catch {
    /* best-effort — never propagate */
  }
}
