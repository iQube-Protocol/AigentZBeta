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
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { listRegisteredCapabilities } from '@/services/constitutional/capabilityRegistry';

export const dynamic = 'force-dynamic';

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

  const receipts = await listActivityReceiptsForPersona(persona.personaId, {
    actionTypes: ['capability_registered'],
    limit: 100,
  });
  const myReceiptIds = new Set(receipts.map((r) => r.id));

  const capabilities = myReceiptIds.size > 0 ? await listRegisteredCapabilities() : [];
  const mine = capabilities.filter(
    (c) => c.registeredReceiptId != null && myReceiptIds.has(c.registeredReceiptId),
  );

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
