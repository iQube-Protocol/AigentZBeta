/**
 * GET /api/constitutional/capability-registry/mine — the caller's OWN
 * registered capabilities (SPEC-MMC-002 §6.2 amendment, 2026-07-24 — the
 * "broaden mySoftware to the Capability Registry" course correction).
 *
 * `GET /api/constitutional/capability-registry` (the sibling route) is
 * admin-gated — it lists the WHOLE registry, the constitutional ledger. This
 * route answers a different, persona-scoped question: "which of those
 * capabilities did *I* register?" No admin gate — mirrors
 * `app/api/dev-command-center/sessions/route.ts`'s own reasoning ("sessions
 * are persona-owned, nothing more").
 *
 * Mechanism: `capability_registry` rows carry NO identity column at all (T2
 * discipline, CFS-032) — the only link back to a caller is the
 * `registered_receipt_id` each row stores, which points at an
 * `activity_receipts` row that DOES carry `persona_id` (server-side only,
 * never serialised). So: read the caller's own `capability_registered`
 * receipts (`listActivityReceiptsForPersona`, the same reader
 * `/api/assistant/receipts`/myLedger already uses), then keep only registry
 * rows whose `registeredReceiptId` is one of the caller's own receipt ids.
 * Never touches `personaId` beyond the initial spine resolution; the
 * response carries only capability facts already public on the admin route
 * (capabilityId, label, description, standing, band, lifecycle, brief,
 * receipt id) — no new T0/T1 exposure.
 *
 * POST (SPEC-MMC-002 §6.3 Phase 3, 2026-07-24) — two non-admin, persona-owned
 * mutating actions built on the SAME ownership re-derivation as the GET
 * above (never a client-supplied "is mine" flag; re-checked on every call):
 *   { action: 'archive', capabilityId }              → Archive: lifecycle → 'deprecated'
 *   { action: 'test', capabilityId, evidence }        → Test: operational validation
 * Both REFUSE (403) when `capabilityId` is not in the caller's own
 * re-derived set — a citizen may only archive/test-validate a capability
 * THEY registered. Neither action executes code, pushes a commit, or
 * deploys anything — Archive is a pure status-flag update, Test is a human
 * typing what they observed working (recordOperationalValidation already
 * enforces the ≥10-char evidence gate; unchanged here).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import {
  listRegisteredCapabilities,
  deprecateCapability,
  recordOperationalValidation,
  type RegisteredCapability,
} from '@/services/constitutional/capabilityRegistry';

export const dynamic = 'force-dynamic';

/**
 * The ONE ownership re-derivation this route uses — shared by GET and POST
 * so the mutating actions below can never diverge from what GET already
 * proves is "mine". Re-run on every call (never cached, never trusted from
 * a prior request).
 */
async function myRegisteredCapabilities(personaId: string): Promise<RegisteredCapability[]> {
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['capability_registered'],
    limit: 100,
  });
  const myReceiptIds = new Set(receipts.map((r) => r.id));
  if (myReceiptIds.size === 0) return [];
  const capabilities = await listRegisteredCapabilities();
  return capabilities.filter(
    (c) => c.registeredReceiptId != null && myReceiptIds.has(c.registeredReceiptId),
  );
}

export interface MyCapabilitySummary {
  capabilityId: string;
  displayLabel: string;
  description: string | null;
  standing: number;
  standingBand: string;
  lifecycleState: string;
  reuseDisposition: string | null;
  briefUrl: string | null;
  packId: string | null;
  registeredReceiptId: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const mine = await myRegisteredCapabilities(persona.personaId);

  const summaries: MyCapabilitySummary[] = mine.map((c) => {
    const payload = (c.object?.payload ?? {}) as {
      description?: string;
      reuseDisposition?: string;
      briefUrl?: string | null;
      packId?: string | null;
    };
    return {
      capabilityId: c.capabilityId,
      displayLabel: c.displayLabel,
      description: payload.description ?? null,
      standing: c.standing,
      standingBand: c.standingBand,
      lifecycleState: c.lifecycleState,
      reuseDisposition: payload.reuseDisposition ?? null,
      briefUrl: payload.briefUrl ?? null,
      packId: payload.packId ?? null,
      registeredReceiptId: c.registeredReceiptId,
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json({ capabilities: summaries });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ ok: false, error: 'action required: archive | test' }, { status: 400 });
  }

  const capabilityId = typeof body.capabilityId === 'string' ? body.capabilityId.trim() : '';
  if (!capabilityId) {
    return NextResponse.json({ ok: false, error: 'capabilityId required' }, { status: 400 });
  }

  // The ownership gate — re-derived fresh on every call, never trusted from
  // the client. A capability not in the caller's own re-derived set is
  // refused with 403 before either mutating service function is ever
  // reached, regardless of which action was requested.
  const mine = await myRegisteredCapabilities(persona.personaId);
  const owns = mine.some((c) => c.capabilityId === capabilityId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: `capability "${capabilityId}" is not one you registered — only its registrant may act on it` },
      { status: 403 },
    );
  }

  if (body.action === 'archive') {
    const result = await deprecateCapability(persona.personaId, { capabilityId });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({
      ok: true,
      alreadyDeprecated: result.alreadyDeprecated,
      receiptId: result.receiptId,
      capability: { capabilityId: result.capability.capabilityId, lifecycleState: result.capability.lifecycleState },
    });
  }

  if (body.action === 'test') {
    const evidence = typeof body.evidence === 'string' ? body.evidence : '';
    const result = await recordOperationalValidation(persona.personaId, { capabilityId, evidence });
    if (!result.ok) {
      // The eligibility-gate refusal is a 409 (a valid, resolved outcome),
      // other failures (e.g. evidence too short) are 400 — same convention
      // as the admin route's operational-validation branch.
      const gateRefusal = result.reason.includes('not registered');
      return NextResponse.json({ ok: false, error: result.reason }, { status: gateRefusal ? 409 : 400 });
    }
    return NextResponse.json({
      ok: true,
      receiptId: result.receiptId,
      standingBefore: result.standingBefore,
      standingAfter: result.standingAfter,
      capability: {
        capabilityId: result.capability.capabilityId,
        standing: result.capability.standing,
        standingBand: result.capability.standingBand,
        operationalValidations: result.capability.operationalValidations,
      },
    });
  }

  return NextResponse.json({ ok: false, error: `unknown action "${String(body.action)}"` }, { status: 400 });
}
