/**
 * GET  /api/assistant/experience-guide
 * POST /api/assistant/experience-guide
 *
 * Personal ExperienceGuide — Sphere×Maturity lattice, alignment state,
 * repair risks, precedence mode.
 *
 * Per metaMe Cartridge PRD (Personal ExperienceGuide layer).
 *
 * Storage piggy-backs on the existing ExperienceQube row via the
 * `blak.personalGuide` key. No new table. PersonaId resolved from spine;
 * never read from query or body.
 *
 * GET returns a T1 shape: the guide payload as stored, or { configured:
 * false } when the user has not yet completed onboarding.
 *
 * POST upserts the whole guide payload (the wizard sends a complete state).
 * Emits an `experience_model_updated` activity receipt scoped to the
 * `personal-guide` surface so the user sees the assessment in their feed.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getPersonalGuide,
  upsertPersonalGuide,
} from '@/services/iqube/experienceQube';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  ALIGNMENT_LABEL,
  MATURITY_LEVELS,
  SPHERE_AXES,
  SPHERE_LABEL,
  backfillSphereAlignment,
  defaultSphereAlignment,
  defaultSphereMaturity,
  deriveOverallAlignment,
  type AlignmentState,
  type MaturityLevel,
  type PersonalGuideData,
  type PrecedenceMode,
  type RepairRisk,
  type SphereAxis,
} from '@/types/experienceGuide';

export const dynamic = 'force-dynamic';

const VALID_SPHERES = new Set<SphereAxis>(SPHERE_AXES);
const VALID_MATURITY = new Set<MaturityLevel>(MATURITY_LEVELS);
const VALID_ALIGNMENT = new Set<AlignmentState>([
  'aligned',
  'drifting',
  'at_risk',
  'repair',
]);
const VALID_PRECEDENCE = new Set<PrecedenceMode>([
  'auto',
  'energy',
  'body',
  'mind',
  'emotion',
  'relationship',
  'community',
  'legacy',
]);

interface ApiSurface {
  configured: boolean;
  guide: PersonalGuideData | null;
}

// ─────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const guide = await getPersonalGuide(context.personaId);
    const body: ApiSurface = { configured: !!guide, guide };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/experience-guide] read failed: ${msg}`);
    return NextResponse.json(
      { error: 'read-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POST — upsert
// ─────────────────────────────────────────────────────────────────────────

interface PostBody {
  sphereMaturity?: Partial<Record<SphereAxis, MaturityLevel>>;
  sphereAlignment?: Partial<Record<SphereAxis, AlignmentState>>;
  alignmentState?: AlignmentState;
  repairRisks?: RepairRisk[];
  precedenceMode?: PrecedenceMode;
  focusIntent?: string;
}

function sanitiseRepairRisks(raw: unknown): RepairRisk[] {
  if (!Array.isArray(raw)) return [];
  const out: RepairRisk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<RepairRisk>;
    if (typeof r.sphere !== 'string' || !VALID_SPHERES.has(r.sphere as SphereAxis)) continue;
    if (typeof r.signal !== 'string' || r.signal.trim().length === 0) continue;
    out.push({
      sphere: r.sphere as SphereAxis,
      signal: r.signal.slice(0, 500),
      ...(typeof r.suggestion === 'string' && r.suggestion.trim().length > 0
        ? { suggestion: r.suggestion.slice(0, 500) }
        : {}),
    });
    if (out.length >= 14) break; // 7 spheres × 2 risks max, generous cap
  }
  return out;
}

function buildPayload(raw: unknown, existing: PersonalGuideData | null): PersonalGuideData {
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;

  const base = existing
    ? existing.sphereMaturity
    : defaultSphereMaturity();
  const sphereMaturity = { ...base };
  if (body.sphereMaturity && typeof body.sphereMaturity === 'object') {
    for (const sphere of SPHERE_AXES) {
      const v = body.sphereMaturity[sphere];
      if (typeof v === 'string' && VALID_MATURITY.has(v as MaturityLevel)) {
        sphereMaturity[sphere] = v as MaturityLevel;
      }
    }
  }

  // Per-sphere alignment. Seed from the existing record (preferring its
  // own per-sphere map, falling back to fanning out the legacy overall
  // alignmentState if that is all we ever saved). Then overlay any values
  // the client sent.
  const alignmentSeed = existing?.sphereAlignment
    ? existing.sphereAlignment
    : existing?.alignmentState
      ? backfillSphereAlignment(existing.alignmentState)
      : defaultSphereAlignment();
  const sphereAlignment = { ...alignmentSeed };
  if (body.sphereAlignment && typeof body.sphereAlignment === 'object') {
    for (const sphere of SPHERE_AXES) {
      const v = body.sphereAlignment[sphere];
      if (typeof v === 'string' && VALID_ALIGNMENT.has(v as AlignmentState)) {
        sphereAlignment[sphere] = v as AlignmentState;
      }
    }
  }

  // Overall alignment — always derived from sphereAlignment so the headline
  // tracks the per-sphere data. The body.alignmentState is accepted for
  // back-compat but ignored if it contradicts the derived value.
  const alignmentState: AlignmentState = deriveOverallAlignment(sphereAlignment);

  const precedenceMode: PrecedenceMode =
    typeof body.precedenceMode === 'string' && VALID_PRECEDENCE.has(body.precedenceMode)
      ? body.precedenceMode
      : existing?.precedenceMode ?? 'auto';

  const repairRisks = body.repairRisks !== undefined
    ? sanitiseRepairRisks(body.repairRisks)
    : existing?.repairRisks ?? [];

  const focusIntent =
    typeof body.focusIntent === 'string' && body.focusIntent.trim().length > 0
      ? body.focusIntent.slice(0, 1000)
      : existing?.focusIntent;

  const payload: PersonalGuideData = {
    sphereMaturity,
    sphereAlignment,
    alignmentState,
    repairRisks,
    precedenceMode,
    lastAssessedAt: new Date().toISOString(),
    ...(focusIntent ? { focusIntent } : {}),
    ...(existing?.goalAlignmentPattern ? { goalAlignmentPattern: existing.goalAlignmentPattern } : {}),
  };
  return payload;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const existing = await getPersonalGuide(context.personaId);
    const payload = buildPayload(raw, existing);
    const saved = await upsertPersonalGuide(context.personaId, payload);

    // Best-effort receipt. Summary names the surface so it is
    // distinguishable from venture-level ExperienceModel updates in the
    // feed.
    const summary = existing
      ? `Personal ExperienceGuide reassessed (${ALIGNMENT_LABEL[saved.alignmentState]}, precedence: ${SPHERE_LABEL[saved.precedenceMode as SphereAxis] ?? 'auto'})`
      : `Personal ExperienceGuide set up (${ALIGNMENT_LABEL[saved.alignmentState]})`;

    await createActivityReceipt({
      personaId: context.personaId,
      activeCartridge: 'metame',
      actionType: 'experience_model_updated',
      summary,
      agentsInvoked: ['aigent-me'],
      toolsUsed: [],
      iqubesUsed: ['PersonaQube', 'ExperienceQube'],
      contextShared: ['personal-guide'],
    }).catch(() => undefined);

    const body: ApiSurface = { configured: true, guide: saved };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/experience-guide] upsert failed: ${msg}`);
    return NextResponse.json(
      { error: 'upsert-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
