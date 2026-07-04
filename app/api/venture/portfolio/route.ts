/**
 * GET  /api/venture/portfolio — the persona's cross-venture portfolio
 *                               (ventures + derived intelligence + saved
 *                               thesis/priorities).
 * POST /api/venture/portfolio — save the portfolio-level thesis, notes, and
 *                               priority ordering.
 *
 * Gated to the Venture Portfolio wizard (Pro/Elite). Admins bypass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getPersonaPlan } from '@/services/billing/personaPlan';
import { getVenturePortfolio, saveVenturePortfolio } from '@/services/venture/venturePortfolio';
import { listVentureQubes } from '@/services/venture/ventureQubeService';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import {
  accrueCapabilityStanding,
  computeIntentClarity,
  computeIdentityDepth,
} from '@/services/crm/standingAccrualService';
import type { VentureOperatingModel, VentureQubeV1, ProofOfOutcomeClaim, VentureSignalEvidenceLayer, VentureThesisLayer } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

async function gate(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false as const, status: 401, error: 'Not authenticated' };
  const admin = getSupabaseServer();
  if (!admin) return { ok: false as const, status: 503, error: 'database unavailable' };
  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  let canPortfolio = isAdmin;
  if (!isAdmin) {
    const plan = await getPersonaPlan(admin, persona.personaId);
    // The Founder Office (any paid tier) unlocks the operating model; this row
    // also holds it, so any Founder Office tier may read/write here. The
    // portfolio-specific surfaces (multi-venture priorities/thesis) are gated in
    // the UI by `portfolio` access.
    if (!plan.wizardAccess.operatingModel) {
      return { ok: false as const, status: 403, error: 'The operating brief requires entering the Founder Office (Founder tier or above).' };
    }
    canPortfolio = plan.wizardAccess.portfolio;
  }
  return { ok: true as const, personaId: persona.personaId, admin, canPortfolio };
}

export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const portfolio = await getVenturePortfolio(g.admin, g.personaId);
  return NextResponse.json({ ok: true, canPortfolio: g.canPortfolio, ...portfolio });
}

export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const body = (await req.json().catch(() => ({}))) as {
    thesis?: string | null;
    notes?: string | null;
    priorities?: string[];
    operatingModel?: VentureOperatingModel | null;
  };
  // The operating model is available to any Founder Office tier; the portfolio
  // fields (thesis/notes/priorities) are Founder Pro/Elite only. Strip them for
  // Founder-tier callers so a tier-1 save persists only the operating brief.
  const input = g.canPortfolio
    ? body
    : { operatingModel: body.operatingModel };

  // Sprint 3b — detect objectives newly moved to 'completed' so we can
  // auto-generate a ProofOfOutcomeClaim in the primary VentureQube.
  // Read the PREVIOUS objectives before the save to diff against the incoming.
  let prevCompletedLabels: Set<string> = new Set();
  if (body.operatingModel?.activeObjectives) {
    const prev = await getVenturePortfolio(g.admin, g.personaId).catch(() => null);
    prevCompletedLabels = new Set(
      (prev?.operatingModel?.activeObjectives ?? [])
        .filter((o) => o.status === 'completed')
        .map((o) => o.objective),
    );
  }

  const result = await saveVenturePortfolio(g.admin, g.personaId, input);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });

  // Sprint 4 — recompute Capability Standing after every portfolio save.
  // Reads the primary VentureQube's signal evidence + thesis layer so the
  // four confidence dimensions are always live. Best-effort, never blocks.
  void recomputeCapabilityStanding(g.admin, g.personaId, body.operatingModel).catch(() => {});

  // Auto-claim: for each objective that is now 'completed' but wasn't before,
  // create a self-declared ProofOfOutcomeClaim in the persona's primary VentureQube.
  // The claim starts as 'claimed' — it accrues NOTHING to Standing until an
  // admin verifier moves it to 'verified'. This maintains the verification gate.
  if (body.operatingModel?.activeObjectives) {
    const newlyCompleted = body.operatingModel.activeObjectives.filter(
      (o) => o.status === 'completed' && !prevCompletedLabels.has(o.objective),
    );
    if (newlyCompleted.length > 0) {
      await createAutoClaimsForCompletedObjectives(g.personaId, newlyCompleted).catch(() => {
        // Best-effort — never block the portfolio save response on claim creation.
      });
    }
  }

  const portfolio = await getVenturePortfolio(g.admin, g.personaId);
  return NextResponse.json({ ok: true, ...portfolio });
}

/**
 * Recompute Capability Standing after a portfolio save. Reads the primary
 * active VentureQube's signal evidence + thesis layer (live data) and the
 * citizen's passport depth, then calls accrueCapabilityStanding. Monotone —
 * only increases standing, never decreases it on signal noise.
 */
async function recomputeCapabilityStanding(
  admin: ReturnType<typeof getSupabaseServer>,
  personaId: string,
  operatingModel: VentureOperatingModel | null | undefined,
): Promise<void> {
  if (!admin) return;

  // Resolve the citizen's CRM persona ID.
  const crm = getCrmClient();
  const { data: crmPersona } = await crm
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();
  const crmPersonaId = crmPersona?.id ? String(crmPersona.id) : null;
  if (!crmPersonaId) return;

  // Fetch primary active venture for signal evidence + thesis.
  const ventures = await listVentureQubes(personaId).catch(() => []);
  const primary = ventures.find((v) => v.status === 'active') ?? ventures[0];
  let signalEvidence: VentureSignalEvidenceLayer | null = null;
  let thesisLayer: VentureThesisLayer | null = null;
  if (primary?.id) {
    const { data: row } = await admin
      .from('venture_qubes')
      .select('layers')
      .eq('id', primary.id)
      .maybeSingle();
    if (row?.layers) {
      const layers = row.layers as VentureQubeV1;
      signalEvidence = layers.signalEvidence ?? null;
      thesisLayer = layers.thesis ?? null;
    }
  }

  // Passport depth — step function from the citizen's passport record.
  const { data: passport } = await admin
    .from('polity_passport_records')
    .select('issued_at, world_id_verified_at, passport_grade')
    .eq('persona_id', personaId)
    .eq('passport_class', 'citizen')
    .maybeSingle();
  const identityDepth = computeIdentityDepth(
    passport
      ? {
          issued: Boolean(passport.issued_at),
          worldIdVerified: Boolean(passport.world_id_verified_at),
          gradeA: passport.passport_grade === 'A',
        }
      : null,
  );

  const activeObjectiveCount = (operatingModel?.activeObjectives ?? []).filter(
    (o) => o.status === 'active',
  ).length;
  const intentClarity = computeIntentClarity(thesisLayer, activeObjectiveCount);

  await accrueCapabilityStanding(crmPersonaId, {
    demandConfidence: signalEvidence?.demandConfidence ?? null,
    opportunityConfidence: signalEvidence?.opportunityConfidence ?? null,
    capabilityConfidence: signalEvidence?.capabilityConfidence ?? null,
    intentClarity,
    identityDepth,
  });
}

/**
 * Auto-generate self-declared ProofOfOutcomeClaims for operating objectives
 * that were just marked 'completed'. Claims start as 'claimed' — they are
 * surfaced to the operator in the cockpit with a "pending verification" badge
 * so they know to request steward verification before Standing accrues.
 *
 * T0 safety: personaId never enters the venture layers or the claim payload.
 * A T2-safe commitment ref is used where a trace is needed.
 */
async function createAutoClaimsForCompletedObjectives(
  personaId: string,
  objectives: Array<{ objective: string; status: string }>,
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;

  // Find the primary active VentureQube for this persona.
  const ventures = await listVentureQubes(personaId);
  const primary = ventures.find((v) => v.status === 'active') ?? ventures[0];
  if (!primary?.id) return;

  const { data: row } = await admin
    .from('venture_qubes')
    .select('layers')
    .eq('id', primary.id)
    .maybeSingle();
  if (!row) return;

  const layers = (row.layers ?? {}) as VentureQubeV1;
  const existing = layers.outcome?.proofOfOutcomeClaims ?? [];

  // Skip objectives that already have a matching claim (idempotency by description prefix).
  const existingDescriptions = new Set(existing.map((c) => c.description));

  const now = new Date().toISOString();
  const newClaims: ProofOfOutcomeClaim[] = [];
  for (const obj of objectives) {
    const description = `[Auto] Objective completed: ${obj.objective}`;
    if (existingDescriptions.has(description)) continue;
    // T2-safe idempotency key: hash of the objective text, not the personaId.
    const claimId = createHash('sha256')
      .update(`auto-claim:${primary.id}:${obj.objective}`)
      .digest('hex')
      .slice(0, 16);
    const claim: ProofOfOutcomeClaim = {
      claimId,
      description,
      verificationStatus: 'claimed',
      createdAt: now,
    };
    newClaims.push(claim);
  }

  if (newClaims.length === 0) return;

  const nextLayers: VentureQubeV1 = {
    ...layers,
    outcome: {
      ...layers.outcome,
      proofOfOutcomeClaims: [...existing, ...newClaims],
    },
  };
  await admin.from('venture_qubes').update({ layers: nextLayers }).eq('id', primary.id);
}
