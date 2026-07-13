/**
 * /api/constitutional/implementation-pack — generate an Implementation Pack
 * (CFS-015 Strand Two, Phase 2).
 *
 * POST { goal: string, intentId?: string, domains?: string[] }
 *   → { ok: true, pack: ImplementationPack }
 *
 * Admin-gated (spine): pack generation spends provider credits. A best-effort
 * `implementation_pack_generated` activity receipt is recorded with the
 * grounding invariants' DB ids (CFS-008 §2 reuse-count instrumentation); the
 * receipt summary is T2-safe (goal excerpt + counts only — no T0 identifiers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { generateImplementationPack } from '@/services/constitutional/implementationPack';
import { attachReceiptToEvidence } from '@/services/constitutional/capabilityEvidence';
import { isRealizationMechanism, type ConstitutionalDecision } from '@/services/constitutional/constitutionalDecision';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { mirrorLifecycleToLinear } from '@/services/linear/lifecycleMirror';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if ('error' in gate) return gate.error;

  let body: { goal?: unknown; intentId?: unknown; domains?: unknown; capabilityEvidence?: unknown; sessionFindings?: unknown; decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.goal !== 'string' || body.goal.trim().length === 0) {
    return NextResponse.json({ error: 'goal (non-empty string) is required' }, { status: 400 });
  }
  const goal = body.goal.trim();
  if (body.intentId !== undefined && typeof body.intentId !== 'string') {
    return NextResponse.json({ error: 'intentId must be a string' }, { status: 400 });
  }
  if (
    body.domains !== undefined &&
    (!Array.isArray(body.domains) || body.domains.some((d) => typeof d !== 'string'))
  ) {
    return NextResponse.json({ error: 'domains must be an array of strings' }, { status: 400 });
  }
  const domains = body.domains as string[] | undefined;

  try {
    // Capability Evidence (CFS-029: a persisted constitutional primitive) —
    // what the pipeline knows about the capability surface travels into,
    // onto, and BEYOND this pack (the generator persists fresh evidence and
    // reads persisted evidence back when none is supplied). The legacy
    // `sessionFindings` body field is honoured.
    const rawEvidence = body.capabilityEvidence ?? body.sessionFindings;
    const capabilityEvidence =
      rawEvidence && typeof rawEvidence === 'object' && !Array.isArray(rawEvidence)
        ? (rawEvidence as import('@/services/constitutional/capabilityEvidence').CapabilityEvidence)
        : undefined;

    // A Constitutional Decision already taken at the DCC Decision stage
    // (CFS-029 §7.1) — honoured verbatim when structurally valid.
    const rawDecision = body.decision as ConstitutionalDecision | undefined;
    const decision =
      rawDecision &&
      typeof rawDecision === 'object' &&
      isRealizationMechanism(rawDecision.mechanism) &&
      typeof rawDecision.rationale === 'string'
        ? rawDecision
        : undefined;

    const pack = await generateImplementationPack({
      goal,
      intentId: body.intentId as string | undefined,
      context: domains && domains.length > 0 ? { domains } : undefined,
      capabilityEvidence,
      decision,
    });

    // Best-effort receipt — never blocks the response, but surface its id so
    // the dev loop can record the Development-class receipt (receipt-bug fix:
    // the loop never recorded receipts, so the Dev Receipts panel stayed empty).
    let receiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId: gate.persona.personaId,
        actionType: 'implementation_pack_generated',
        summary:
          `Implementation Pack generated (${pack.composedBy}, mechanism=${pack.implementationMechanism}): ` +
          `"${goal.slice(0, 140)}" — ${pack.invariantBindings.length} invariant bindings, ` +
          `${pack.areasToTouch.length} areas, ${pack.validationPlan.length} validation steps, ` +
          `canon ${pack.canonVersion}`,
        activeCartridge: 'agentiq',
        invariantsUsed: pack.invariantBindings.map((b) => b.id),
      });
      receiptId = receipt?.id ?? null;
    } catch (err) {
      console.warn(
        `[api/constitutional/implementation-pack] receipt write failed (non-blocking): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Linear mirror (observe-mode, soft-fail): the pack lands the cycle's
    // issue in Todo. T2-safe note only — pack id + receipt id.
    const linear = await mirrorLifecycleToLinear({
      delegate: 'operator',
      profile: 'software',
      brief: goal,
      phase: 'pack_generated',
      note: `Pack \`${pack.id}\` (${pack.implementationMechanism}, ${pack.invariantBindings.length} invariant bindings)${receiptId ? ` — receipt \`${receiptId}\`` : ''}`,
    });

    // CFS-029 §7.2 — fresh evidence is itself a receipted constitutional act:
    // a knowledge_curated receipt anchors the persistence, attached to the row.
    let evidenceReceiptId: string | null = null;
    if (capabilityEvidence && pack.capabilityEvidenceId) {
      try {
        const evReceipt = await createActivityReceipt({
          personaId: gate.persona.personaId,
          actionType: 'knowledge_curated',
          summary:
            `capability evidence recorded — "${goal.slice(0, 100)}" ` +
            `(${capabilityEvidence.existing?.length ?? 0} existing / ${capabilityEvidence.missing?.length ?? 0} missing` +
            `${typeof capabilityEvidence.reusePercent === 'number' ? ` · ${capabilityEvidence.reusePercent}% reuse` : ''})`,
          activeCartridge: 'agentiq',
          contextShared: ['capability-evidence'],
        });
        evidenceReceiptId = evReceipt?.id ?? null;
        if (evidenceReceiptId) await attachReceiptToEvidence(pack.capabilityEvidenceId, evidenceReceiptId);
      } catch (err) {
        console.warn(
          `[api/constitutional/implementation-pack] evidence receipt failed (non-blocking): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({ ok: true, pack, receiptId, evidenceReceiptId, linear });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pack_generation_failed';
    console.error('[api/constitutional/implementation-pack] generation failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
