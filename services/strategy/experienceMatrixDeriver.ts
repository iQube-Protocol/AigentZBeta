/**
 * experienceMatrixDeriver — the SHARED source-of-truth derivation that turns a
 * persona's experience-guide setup (experience model + personalGuide) and their
 * VentureQube(s) into matrix POSITIONS, so the three matrix surfaces (aigentMe,
 * metaMe Studio, Venture Lab) are calibrated from ONE source instead of being
 * disconnected islands.
 *
 * This closes the gap: the experience guide becomes the source of truth and
 * calibration for every matrix the persona sees.
 *
 * Outputs two coordinate systems:
 *   - growth      → Venture Lab growth matrix (maturity Y × commercialization X)
 *   - experience  → Studio / customer matrix (engagement Y × sovereignty X)
 * plus per-venture growth coordinates so a persona's own ventures plot
 * automatically (no more manual/sample-only growth matrix).
 *
 * All mappings are explicit, documented design decisions (tunable). Best-effort:
 * soft-fails to sensible defaults if a table/migration is unavailable. T1-safe.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Axis vocabularies (must match the surfaces) ─────────────────────────────
const MATURITY_LABELS = ['Ideation', 'Validate', 'Prototype', 'Build', 'Early Revenue', 'Market Fit', 'Scale'];
const ENGAGEMENT_LEVELS = ['Recipient', 'Selector', 'Modifier', 'Producer', 'Builder', 'Steward'];
const SOVEREIGNTY_STAGES = ['Disheartened', 'Visitor', 'Initiate', 'Participant', 'Curator', 'Composer', 'Operator', 'Architect'];

// experience_qubes.current_stage → maturity Y (1..7) + sovereignty X label.
const EXPERIENCE_STAGE_TO_GROWTH_Y: Record<string, number> = {
  setup: 1, alpha_activation: 2, launch: 4, growth: 6, scale: 7,
};
const EXPERIENCE_STAGE_TO_SOVEREIGNTY: Record<string, string> = {
  setup: 'Visitor', alpha_activation: 'Initiate', launch: 'Composer', growth: 'Operator', scale: 'Architect',
};

// venture_qubes.venture_stage → maturity Y (1..7) + commercialization X (1..7).
const VENTURE_STAGE_TO_Y: Record<string, number> = {
  concept: 1, validation: 2, formation: 3, launch: 5, growth: 6, scale: 7, institution: 7,
};
const VENTURE_STAGE_TO_X: Record<string, number> = {
  concept: 1, validation: 2, formation: 3, launch: 4, growth: 5, scale: 6, institution: 7,
};

// personalGuide maturity ordinals (the 7×7 sphere ladder).
const MATURITY_ORDINAL: Record<string, number> = {
  noticing: 1, exploring: 2, experimenting: 3, practicing: 4, integrating: 5, sustaining: 6, stewarding: 7,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Same zone formula as the Venture Lab growth matrix (sum of axes).
function computeZone(y: number, x: number): string {
  const sum = y + x;
  if (sum <= 4) return 'formation';
  if (sum <= 7) return 'validation';
  if (sum <= 10) return 'activation';
  if (sum <= 12) return 'strategic';
  return 'scale';
}

export interface VentureGrowthPoint {
  ventureId: string;
  name: string;
  stage: string;
  yMaturity: number;
  xCommercialization: number;
  zone: string;
  confidence: number | null;
  /** True when synthesised from the experience model (no formal VentureQube). */
  derived?: boolean;
}

export interface PersonaMatrixCalibration {
  /** What the calibration was primarily derived from. */
  source: 'venture_qube' | 'experience_model' | 'default';
  /** Venture Lab growth-matrix coordinate (the persona's headline position). */
  growth: { yMaturity: number; xCommercialization: number; zone: string; label: string };
  /** Studio / customer-matrix coordinate (engagement × sovereignty). */
  experience: { engagement: string; sovereignty: string };
  /** Every venture the persona owns, plotted on the growth matrix. */
  ventures: VentureGrowthPoint[];
  reason: string;
  hasExperienceModel: boolean;
  /**
   * True when one or more of the underlying reads (`experience_qubes`,
   * `venture_qubes`) threw rather than returning zero rows — the Track 2
   * invariant applied here (2026-09-01, AEE-XP-001 §10): "unknown is not
   * empty; read failure must never become state." `growth`/`experience`
   * above still carry a best-effort value (existing non-authoritative visual
   * surfaces — aigentMe, Studio, Venture Lab matrices — keep rendering it
   * unchanged), but any AUTHORITATIVE consumer (AEE, an ExperiencePrescription
   * assembler) MUST treat `uncertain: true` as genuinely UNKNOWN and must
   * never read `source === 'default'` alone as a confirmed beginner/Visitor
   * position when this is true — a failed read and a genuinely-unconfigured
   * persona are different states that must never collapse into one.
   */
  uncertain: boolean;
  /** Which underlying reads failed, when `uncertain` is true. Empty/omitted otherwise. */
  unreadableSources?: Array<'experience_qubes' | 'venture_qubes'>;
}

function confidenceToCommercialization(confidence: number | null, stage: string): number {
  if (typeof confidence === 'number' && confidence > 0) {
    return clamp(Math.round((confidence / 100) * 6) + 1, 1, 7);
  }
  return VENTURE_STAGE_TO_X[stage] ?? 1;
}

export async function deriveMatrixCalibration(
  admin: SupabaseClient,
  personaId: string,
): Promise<PersonaMatrixCalibration> {
  let currentStage = '';
  let hasExperienceModel = false;
  let avgMaturityOrdinal = 0;
  let experienceName = '';
  let experienceType = '';
  const unreadableSources: Array<'experience_qubes' | 'venture_qubes'> = [];

  // 1. Experience model + personalGuide (the SoT).
  //
  // Deliberately no try/catch around the read itself: a genuinely-missing
  // table is the ONE case this function treats as "not configured yet"
  // (matches the existing product default), everything else — a real
  // connectivity/permission/timeout failure — is UNKNOWN, not empty, and
  // must be recorded via `unreadableSources`, never silently folded into
  // the same branch as "no row found" (Track 2 invariant, 2026-09-01).
  try {
    const { data, error } = await admin
      .from('experience_qubes')
      .select('current_stage, experience_name, experience_type, blak_qube')
      .eq('persona_id', personaId)
      .maybeSingle();
    if (error) {
      const code = (error as { code?: string }).code;
      // PGRST205/42P01-class "relation does not exist" is a deployment-state
      // fact (migration not yet applied), not a read failure — preserve the
      // existing "no experience model configured" behavior for it. Anything
      // else (network, permission, timeout, malformed query) is unreadable.
      if (code !== 'PGRST205' && code !== '42P01') {
        unreadableSources.push('experience_qubes');
      }
    } else if (data) {
      hasExperienceModel = true;
      currentStage = String(data.current_stage ?? '');
      experienceName = String((data as { experience_name?: string }).experience_name ?? '');
      experienceType = String((data as { experience_type?: string }).experience_type ?? '');
      const guide = (data.blak_qube as { personalGuide?: { sphereMaturity?: Record<string, string> } } | null)
        ?.personalGuide;
      const sphereMaturity = guide?.sphereMaturity ?? {};
      const ordinals = Object.values(sphereMaturity)
        .map((m) => MATURITY_ORDINAL[String(m)] ?? 0)
        .filter((n) => n > 0);
      if (ordinals.length > 0) {
        avgMaturityOrdinal = ordinals.reduce((a, b) => a + b, 0) / ordinals.length;
      }
    }
  } catch {
    // A thrown (not just error-returning) read is unambiguously a failure,
    // never "not configured yet".
    unreadableSources.push('experience_qubes');
  }

  // 2. The persona's VentureQubes (per-venture growth points).
  const ventures: VentureGrowthPoint[] = [];
  try {
    const { data, error } = await admin
      .from('venture_qubes')
      .select('id, venture_name, venture_stage, venture_confidence')
      .eq('owner_persona_id', personaId)
      .eq('status', 'active');
    if (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'PGRST205' && code !== '42P01') {
        unreadableSources.push('venture_qubes');
      }
    }
    for (const v of data ?? []) {
      const stage = String((v as { venture_stage?: string }).venture_stage ?? 'concept');
      const confidence =
        (v as { venture_confidence?: number }).venture_confidence == null
          ? null
          : Number((v as { venture_confidence?: number }).venture_confidence);
      const y = VENTURE_STAGE_TO_Y[stage] ?? 1;
      const x = confidenceToCommercialization(confidence, stage);
      ventures.push({
        ventureId: String((v as { id: string }).id),
        name: String((v as { venture_name?: string }).venture_name ?? 'Venture'),
        stage,
        yMaturity: y,
        xCommercialization: x,
        zone: computeZone(y, x),
        confidence,
      });
    }
  } catch {
    unreadableSources.push('venture_qubes');
  }

  // 2b. Pass-through: if the persona has configured an experience model but no
  //     formal VentureQube yet, synthesise a venture point FROM the experience
  //     model so it still plots in the Venture Lab + Studio matrices. This is
  //     the "experience model flows into the matrices" wiring for the Lite path
  //     (before a VentureQube Pro exists).
  if (ventures.length === 0 && hasExperienceModel) {
    const y = (currentStage && EXPERIENCE_STAGE_TO_GROWTH_Y[currentStage]) || 1;
    const x = clamp(y - 1, 1, 7);
    ventures.push({
      ventureId: 'experience-model',
      name: experienceName || (experienceType ? `${experienceType} (experience model)` : 'Your venture'),
      stage: currentStage || 'setup',
      yMaturity: y,
      xCommercialization: x,
      zone: computeZone(y, x),
      confidence: null,
      derived: true,
    });
  }

  // 3. Headline growth position — prefer the most-advanced VentureQube, else the
  //    experience model stage, else a default Ideation/Pre-Market.
  let growthY: number;
  let growthX: number;
  let source: PersonaMatrixCalibration['source'];
  let reason: string;

  if (ventures.length > 0) {
    const lead = [...ventures].sort(
      (a, b) => b.yMaturity + b.xCommercialization - (a.yMaturity + a.xCommercialization),
    )[0];
    growthY = lead.yMaturity;
    growthX = lead.xCommercialization;
    source = lead.derived ? 'experience_model' : 'venture_qube';
    reason = lead.derived
      ? `Derived from experience model "${lead.name}" (stage ${lead.stage}) — no VentureQube yet.`
      : `Derived from lead VentureQube "${lead.name}" (stage ${lead.stage}).`;
  } else if (hasExperienceModel && currentStage) {
    growthY = EXPERIENCE_STAGE_TO_GROWTH_Y[currentStage] ?? 1;
    growthX = clamp(growthY - 1, 1, 7); // commercialization trails maturity pre-venture
    source = 'experience_model';
    reason = `Derived from experience model stage "${currentStage}" (no VentureQube yet).`;
  } else {
    growthY = 1;
    growthX = 1;
    source = 'default';
    reason =
      unreadableSources.length > 0
        ? `Unable to read ${unreadableSources.join(', ')} — position is a best-effort default, not a confirmed beginner state.`
        : 'No experience model or VentureQube configured yet — default position.';
  }

  // 4. Experience position (engagement × sovereignty).
  const sovereignty =
    (currentStage && EXPERIENCE_STAGE_TO_SOVEREIGNTY[currentStage]) ||
    (ventures.length > 0 ? 'Composer' : 'Visitor');
  const engagementIdx =
    avgMaturityOrdinal > 0 ? clamp(Math.round(((avgMaturityOrdinal - 1) / 6) * 5), 0, 5) : 0;
  const engagement = ENGAGEMENT_LEVELS[engagementIdx];

  return {
    source,
    growth: {
      yMaturity: growthY,
      xCommercialization: growthX,
      zone: computeZone(growthY, growthX),
      label: MATURITY_LABELS[growthY - 1] ?? 'Ideation',
    },
    experience: { engagement, sovereignty },
    ventures,
    reason,
    hasExperienceModel,
    uncertain: unreadableSources.length > 0,
    ...(unreadableSources.length > 0 ? { unreadableSources } : {}),
  };
}

export { ENGAGEMENT_LEVELS, SOVEREIGNTY_STAGES, MATURITY_LABELS };
