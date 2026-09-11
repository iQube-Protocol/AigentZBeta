/**
 * KNYT Persona iQube — trinity staging surface.
 *
 * POST /api/iqube/persona/knyt/mint
 *   Stages the persona for on-chain minting:
 *     1. Load the caller's nakamoto_knyt_personas row
 *     2. Split into plaintext metaQube + encrypted blakQube (AES-256-GCM)
 *     3. Push the ciphertext to Autonomys Auto Drive
 *     4. Create/refresh the iQube trinity (iq_meta_qubes / iq_blak_qubes /
 *        iq_token_qubes) and the iqube_mint_stubs join row
 *   Returns the trinity ids the mint call needs — `metaQubeId` becomes the
 *   on-chain metaIdentifier, `tokenQubeId` is the row that receives the chain
 *   anchor once POST /api/core/mint-tokenqube succeeds.
 *
 * GET /api/iqube/persona/knyt/mint
 *   Reads the current trinity without staging, so the drawer can render the
 *   metaQube and blakQube tabs (and any existing chain anchor) on open.
 *
 * The staging logic itself lives in ../../_lib so the KNYT and Qripto surfaces
 * share one implementation.
 *
 * TODO (production): derive the master key from the FIO handle PPK via
 * personaFioService.getPersonaKeys() instead of PERSONA_IQUBE_ENCRYPTION_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { readPersonaTrinity, resolvePersonaCaller, stagePersonaIQube } from "../../_lib";

export const dynamic = "force-dynamic";

const DEV_KEY_WARNING =
  "WARNING: using dev zero-key. Set PERSONA_IQUBE_ENCRYPTION_KEY (64 hex chars) for production.";

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolvePersonaCaller(request, "knyt");
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const trinity = await stagePersonaIQube(resolved.caller, "knyt");

    return NextResponse.json({
      // stub_id kept for the pre-trinity callers that still read it.
      stub_id: trinity.stubId,
      status: trinity.status,
      ...trinity,
      message: "KNYT Persona iQube staged. Trinity registered; ready to mint.",
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
    const resolved = await resolvePersonaCaller(request, "knyt");
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const trinity = await readPersonaTrinity(resolved.caller, "knyt");
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
