/**
 * Standing accrual service (Phase 2).
 *
 * The Standing keystone — Personal/Delegated/Stewardship — extends the
 * existing reputation engine without replacing it. Reputation deltas continue
 * to accrue on completeTask exactly as today; this service additively records
 * a Standing delta on the same event and rolls it into crm_persona_reputation.
 *
 * Why a single seam: per Extend-Don't-Duplicate, accrual must be synchronous
 * with reputation accrual (atomic, no polling worker), so we invoke it from
 * completeTask right after updatePersonaReputation. Event-driven by design —
 * Standing is never time-driven (per the PRD: a bad agent at 12 months must
 * not outrank a good agent at 2 weeks).
 *
 * MVP scope:
 *   - Personal Standing accrual is fully wired (this service + the
 *     completeTask hook). Standing delta = task CVS scaled by the configured
 *     factor (KISS — matches the cvs-as-source-of-truth pattern in the
 *     existing reputation accrual).
 *   - Delegated + Stewardship accrual are plumbed (call signature accepts a
 *     sponsor crmPersonaId) but the cross-table sponsor lookup
 *     (crm_personas.identity_persona_id → personas.id → agent_root_identity.
 *     sponsor_persona_id → sponsor's crm_persona) lands with Phase 3 where
 *     Sponsorship Capacity also reads sponsor relationships. Until then,
 *     callers pass sponsorCrmPersonaId = null and only Personal accrues.
 *
 * Bucket: standing_overall in [0..) maps to standing_bucket in [0..4] in
 * steps of 25 — reuses the existing 0..4 reputation bucket primitive in the
 * SmartWalletDrawer dot strip.
 */

import { getCrmClient } from './crmDataAccess';

const STANDING_CVS_FACTOR = 1; // 1:1 — CVS is the canonical contribution score
const DELEGATED_FACTOR = 0.5;   // sponsor gets half-credit on sponsored Personal
const STEWARDSHIP_FACTOR = 0.25; // sponsor gets quarter-credit as stewardship
const BUCKET_STEP = 25;

export interface StandingAccrual {
  personal: number;
  delegated: number;
  stewardship: number;
  overall: number;
  bucket: number;
}

export interface AccrueStandingInput {
  /** The CRM persona being credited (the contributor). */
  crmPersonaId: string;
  /**
   * The CRM persona id of the contributor's sponsor, if any. Pass null when
   * the contributor is a citizen or the sponsor mapping has not yet been
   * resolved (Phase 3 wires this).
   */
  sponsorCrmPersonaId: string | null;
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
  overall: number;
}

async function readStanding(
  client: ReturnType<typeof getCrmClient>,
  crmPersonaId: string,
): Promise<ExistingStanding | null> {
  const { data } = await client
    .from('crm_persona_reputation')
    .select('standing_personal, standing_delegated, standing_stewardship, standing_overall')
    .eq('persona_id', crmPersonaId)
    .maybeSingle();
  if (!data) return null;
  return {
    personal: Number(data.standing_personal ?? 0),
    delegated: Number(data.standing_delegated ?? 0),
    stewardship: Number(data.standing_stewardship ?? 0),
    overall: Number(data.standing_overall ?? 0),
  };
}

async function writeStanding(
  client: ReturnType<typeof getCrmClient>,
  crmPersonaId: string,
  next: ExistingStanding,
): Promise<void> {
  const overall = next.personal + next.delegated + next.stewardship;
  const bucket = bucketFor(overall);
  const existing = await readStanding(client, crmPersonaId);
  if (existing) {
    await client
      .from('crm_persona_reputation')
      .update({
        standing_personal: next.personal,
        standing_delegated: next.delegated,
        standing_stewardship: next.stewardship,
        standing_overall: overall,
        standing_bucket: bucket,
        updated_at: new Date().toISOString(),
      })
      .eq('persona_id', crmPersonaId);
  } else {
    // No reputation row yet — the existing reputation accrual path created
    // one for this crm_persona, but if it didn't (e.g. the Standing accrual
    // is being invoked outside the task path), insert with defaults.
    await client.from('crm_persona_reputation').insert({
      persona_id: crmPersonaId,
      standing_personal: next.personal,
      standing_delegated: next.delegated,
      standing_stewardship: next.stewardship,
      standing_overall: overall,
      standing_bucket: bucket,
    });
  }
}

/**
 * Accrue Standing for a single task completion. Returns the resulting Standing
 * vector for the contributor (sponsor side is accumulated silently).
 *
 * Failure-mode: this service is best-effort. If the Phase 2 migration has not
 * yet been applied, the standing_* columns won't exist and the underlying
 * Supabase update will error — we swallow that and log so completeTask never
 * fails on a deferred Standing write. Same pattern as the verify-worldid
 * hardening sweep.
 */
export async function accrueStanding(input: AccrueStandingInput): Promise<StandingAccrual | null> {
  const client = getCrmClient();
  const category = input.standingType ?? 'personal';

  const personalDelta = STANDING_CVS_FACTOR * input.cvs;
  const sponsorPersonalCredit =
    input.sponsorCrmPersonaId && category !== 'stewardship' ? DELEGATED_FACTOR * input.cvs : 0;
  const sponsorStewardshipCredit = input.sponsorCrmPersonaId ? STEWARDSHIP_FACTOR * input.cvs : 0;

  try {
    // Contributor side — Personal Standing.
    const existing = (await readStanding(client, input.crmPersonaId)) ?? {
      personal: 0,
      delegated: 0,
      stewardship: 0,
      overall: 0,
    };
    const next = {
      personal: existing.personal + personalDelta,
      delegated: existing.delegated,
      stewardship: existing.stewardship,
      overall: 0, // recomputed in writeStanding
    };
    await writeStanding(client, input.crmPersonaId, next);

    // Sponsor side — Delegated + Stewardship Standing (Phase 3 fully wires
    // the sponsor lookup; this branch no-ops when sponsorCrmPersonaId is null).
    if (input.sponsorCrmPersonaId) {
      const sponsorExisting = (await readStanding(client, input.sponsorCrmPersonaId)) ?? {
        personal: 0,
        delegated: 0,
        stewardship: 0,
        overall: 0,
      };
      const sponsorNext = {
        personal: sponsorExisting.personal,
        delegated: sponsorExisting.delegated + sponsorPersonalCredit,
        stewardship: sponsorExisting.stewardship + sponsorStewardshipCredit,
        overall: 0,
      };
      await writeStanding(client, input.sponsorCrmPersonaId, sponsorNext);
    }

    // Tag the reputation event with the standing delta for audit linkage
    // (best-effort — no-op when sourceEventId is omitted).
    if (input.sourceEventId) {
      await client
        .from('crm_reputation_events')
        .update({
          standing_category: category,
          standing_accrual_delta: personalDelta,
        })
        .eq('id', input.sourceEventId);
    }

    const overall = next.personal + next.delegated + next.stewardship;
    return {
      personal: next.personal,
      delegated: next.delegated,
      stewardship: next.stewardship,
      overall,
      bucket: bucketFor(overall),
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
