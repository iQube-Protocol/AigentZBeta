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
    const writeResult = await writeStanding(client, input.crmPersonaId, next);
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
 * Input signals for Capability Standing computation. All confidence scores are
 * 0-1 (null treated as 0). identityDepth is a step function derived from the
 * citizen's passport state (see `computeIdentityDepth`).
 */
export interface CapabilitySignals {
  /** VentureQube signalEvidence.demandConfidence — is anyone waiting? */
  demandConfidence: number | null;
  /** VentureQube signalEvidence.opportunityConfidence — is the market real? */
  opportunityConfidence: number | null;
  /** VentureQube signalEvidence.capabilityConfidence — can they plausibly deliver? */
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
 * Compute the raw Capability Standing score (0–CAPABILITY_CEILING) from signal
 * evidence. Exported so callers can preview the score before writing.
 */
export function computeCapabilityScore(signals: CapabilitySignals): number {
  const clamp01 = (v: number | null) => Math.max(0, Math.min(1, v ?? 0));
  const weighted =
    clamp01(signals.demandConfidence) * CAPABILITY_SIGNAL_WEIGHTS.demand +
    clamp01(signals.opportunityConfidence) * CAPABILITY_SIGNAL_WEIGHTS.opportunity +
    clamp01(signals.capabilityConfidence) * CAPABILITY_SIGNAL_WEIGHTS.capability +
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
    const writeResult = await writeStanding(client, crmPersonaId, next);
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
