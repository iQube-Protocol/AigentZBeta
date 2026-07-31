/**
 * commercialSpine — compute where a persona sits along the metaMe commercial
 * spine, and what the next step is.
 *
 * Spine (operator-canonical, 2026-06-21):
 *   Passport -> aigentMe Delegation -> Standing -> Founder Office -> Venture Lab
 *   -> [verticals: Mobility (HMS), metaKnyt / metaMedia / metaLegal]
 *
 * aigentMe (via delegation) helps the citizen establish Standing; HMS and
 * metaKnyt/metaMedia/metaLegal are Venture Lab venture-building verticals, not
 * peer rails — they hang off the Venture Lab stage.
 *
 * This is the backbone for (a) journey-stitching CTAs, (b) golden-path NBEs,
 * and (c) the matrix-based commercial funnel. Every probe soft-fails so a
 * pending migration never breaks the read. T1-safe.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStandingScore } from '@/services/standing/standingScore';

export type SpineStageId =
  | 'passport'
  | 'aigentme_delegation'
  | 'standing'
  | 'founder_office'
  | 'venture_lab';

export interface SpineStage {
  id: SpineStageId;
  label: string;
  complete: boolean;
  /** Short human detail about the persona's state at this stage. */
  detail: string;
  /** Semantic routing key the FE maps to a cartridge/tab (no hardcoded URLs). */
  target: string;
}

export interface SpineVertical {
  id: 'mobility' | 'metaknyt';
  label: string;
  active: boolean;
}

export interface CommercialSpineState {
  stages: SpineStage[];
  verticals: SpineVertical[];
  /** First incomplete stage — the next best step along the spine. */
  nextStep: { id: SpineStageId; label: string; cta: string; target: string } | null;
  standingScore: number;
  ventureCount: number;
}

async function probeCount(
  admin: SupabaseClient,
  table: string,
  filter: (q: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(table).select('*', { count: 'exact', head: true });
    q = filter(q);
    const { count } = await q;
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

export async function getCommercialSpineState(
  admin: SupabaseClient,
  personaId: string,
): Promise<CommercialSpineState> {
  // ── Passport ────────────────────────────────────────────────────────────────
  // An authenticated persona generally already holds a Passport; we confirm via
  // the records table and give the benefit of the doubt if the probe errors.
  let hasPassport = true;
  try {
    const { data, error } = await admin
      .from('polity_passport_records')
      .select('id')
      .eq('persona_id', personaId)
      .limit(1);
    if (!error) hasPassport = (data?.length ?? 0) > 0;
  } catch {
    hasPassport = true;
  }

  // ── aigentMe delegation ──────────────────────────────────────────────────────
  const aigentMeCount = await probeCount(admin, 'agent_root_identity', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq('sponsor_persona_id', personaId),
  );
  const hasAigentMe = aigentMeCount > 0;

  // ── Standing ─────────────────────────────────────────────────────────────────
  const standing = await computeStandingScore(admin, personaId);

  // ── Founder Office / ventures ────────────────────────────────────────────────
  const ventureCount = await probeCount(admin, 'venture_qubes', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq('owner_persona_id', personaId).eq('status', 'active'),
  );
  const hasFounderOffice = ventureCount > 0;

  // ── Venture Lab (a venture actively building: formation+) ─────────────────────
  const buildingCount = await probeCount(admin, 'venture_qubes', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any)
      .eq('owner_persona_id', personaId)
      .in('venture_stage', ['formation', 'launch', 'growth', 'scale', 'institution']),
  );
  const inVentureLab = buildingCount > 0;

  // ── Verticals (hang off Venture Lab) ──────────────────────────────────────────
  const mobilityCount = await probeCount(admin, 'mobility_cases', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq('persona_id', personaId),
  );

  const stages: SpineStage[] = [
    {
      id: 'passport',
      label: 'Passport',
      complete: hasPassport,
      detail: hasPassport ? 'Passport claimed' : 'Claim your Polity Passport',
      target: 'passport',
    },
    {
      id: 'aigentme_delegation',
      label: 'aigentMe Delegation',
      complete: hasAigentMe,
      detail: hasAigentMe ? 'aigentMe activated' : 'Activate + delegate your aigentMe',
      target: 'aigentme',
    },
    {
      id: 'standing',
      label: 'Standing',
      complete: standing.qualified,
      detail: standing.qualified
        ? `Standing ${standing.score} (${standing.verifiedFactCount} verified facts)`
        : 'Establish Standing — make declarations, verify facts',
      target: 'standing',
    },
    {
      id: 'founder_office',
      label: 'Founder Office',
      complete: hasFounderOffice,
      detail: hasFounderOffice
        ? `${ventureCount} VentureQube${ventureCount === 1 ? '' : 's'}`
        : 'Create your first VentureQube',
      target: 'founder-office',
    },
    {
      id: 'venture_lab',
      label: 'Venture Lab',
      complete: inVentureLab,
      detail: inVentureLab
        ? `${buildingCount} venture${buildingCount === 1 ? '' : 's'} building`
        : 'Advance a venture to formation',
      target: 'venture-lab',
    },
  ];

  const verticals: SpineVertical[] = [
    { id: 'mobility', label: 'Mobility (HMS)', active: mobilityCount > 0 },
    { id: 'metaknyt', label: 'metaKnyt / metaMedia / metaLegal', active: false },
  ];

  const firstIncomplete = stages.find((s) => !s.complete) ?? null;
  const CTA: Record<SpineStageId, string> = {
    passport: 'Claim your Passport',
    aigentme_delegation: 'Activate aigentMe',
    standing: 'Establish your Standing',
    founder_office: 'Open Founder Office',
    venture_lab: 'Advance a venture',
  };

  return {
    stages,
    verticals,
    nextStep: firstIncomplete
      ? {
          id: firstIncomplete.id,
          label: firstIncomplete.label,
          cta: CTA[firstIncomplete.id],
          target: firstIncomplete.target,
        }
      : null,
    standingScore: standing.score,
    ventureCount,
  };
}
