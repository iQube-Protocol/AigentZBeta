/**
 * @deprecated
 * Qripto Persona iQube — trinity staging surface.
 *
 * POST /api/iqube/persona/qripto/mint — stage the persona (encrypt blakQube,
 *   push the ciphertext to Auto Drive, create/refresh the iQube trinity).
 * GET  /api/iqube/persona/qripto/mint — read the current trinity.
 *
 * DEPRECATION (Stage 2 C8, PRD v1.1 §A close-report checklist #4):
 * This is a parallel path that duplicates the canonical persona-iQube
 * staging surface at /api/iqube/persona/knyt/mint. Per Stage 0 audit
 * Deliverable 6, no live production consumer was identified. Operator
 * confirmed disposition as "defer to recommendation"; recommendation
 * is to mark @deprecated now and remove after the 30-day observation
 * window (parallel with the receipt-writer deprecation per v1.1 §A.4).
 *
 * Stage 5 mint saga supersedes this entire flow with a unified
 * services/registry/mintSaga.ts driver that handles every primitive
 * via the canonical resolver. New mint calls should target
 * POST /api/registry/iqube/[id]/mint (lands in Stage 5).
 *
 * Removal scheduled: 30 days after 2026-05-30, gated on operator
 * confirming no traffic against this route in dev/prod logs.
 *
 * Until removal it delegates to the same ../../_lib staging implementation as
 * the KNYT surface — what remains duplicated is the route file, not the logic.
 *
 * TODO (legacy): wire PERSONA_IQUBE_ENCRYPTION_KEY to FIO handle PPK
 * for production.
 */

import { NextRequest, NextResponse } from "next/server";
import { readPersonaTrinity, resolvePersonaCaller, stagePersonaIQube } from "../../_lib";

export const dynamic = "force-dynamic";

const DEV_KEY_WARNING =
  "WARNING: using dev zero-key. Set PERSONA_IQUBE_ENCRYPTION_KEY (64 hex chars) for production.";

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolvePersonaCaller(request, "qripto");
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const trinity = await stagePersonaIQube(resolved.caller, "qripto");

    return NextResponse.json({
      stub_id: trinity.stubId,
      status: trinity.status,
      ...trinity,
      message: "Qripto Persona iQube staged. Trinity registered; ready to mint.",
      _devMode: trinity.usingDevKey ? DEV_KEY_WARNING : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolvePersonaCaller(request, "qripto");
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const trinity = await readPersonaTrinity(resolved.caller, "qripto");
    if (!trinity) {
      return NextResponse.json({ staged: false });
    }

    return NextResponse.json({ staged: true, ...trinity });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
