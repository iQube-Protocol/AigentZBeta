/**
 * GET /api/constitutional/canonical-assets — the Canonical Asset Registry read
 * surface (CFS-022a §2, the P1 registry). READ-ONLY: it projects every canonical
 * asset that exists today (`services/composition/canonicalAssets.ts
 * listCanonicalAssets`) as a T2-safe view of its P0 ConstitutionalObject facets.
 * It NEVER mutates an asset and NEVER exposes a secret.
 *
 * The registry makes the canonical assets — the Bearing Instrument (A1),
 * metaVitruvian (A2), and the ratified CCF interpretation + its palette /
 * typography / material views (A3–A4) — visible as first-class constitutional
 * objects: identity · standing band · authority (governing invariants,
 * ratification) · provenance (content commitment, source) · lifecycle. Until the
 * G2 store lands this is the in-situ source the Composition engine's
 * `InSituAssetResolver` already reads; the surface just projects it.
 *
 * Admin-gated (resolvePersonaOrTimeout + cartridgeFlags.isAdmin), mirroring
 * /api/constitutional/model-routes: 503 on identity-spine timeout, 401 when
 * unauthenticated, 403 for a non-admin persona.
 *
 * T2-SAFE: only ids, refs (one-way commitments), kinds, display labels,
 * standing, bands, invariant ids, lifecycle states, and dependency refs are
 * serialised. Ownership is projected as the steward commitment only (never a
 * raw persona id — it is a commitment by construction). NO secrets.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { listCanonicalAssets } from '@/services/composition/canonicalAssets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  }
  if (pr.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!pr.persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // T2-safe projection of each canonical asset's P0 facets. The payload is NOT
  // serialised wholesale — only the named, safe facets — so a future asset with a
  // richer payload cannot silently widen the exposure surface.
  const assets = listCanonicalAssets().map((o) => ({
    id: o.identity.id,
    ref: o.identity.ref,
    kind: o.identity.kind,
    displayLabel: o.identity.displayLabel,
    versionStatus: o.version.status,
    standing: o.standing.standing,
    standingBand: o.standing.band,
    reach: o.standing.reach,
    ratificationRequired: o.authority.ratificationRequired,
    governingInvariants: o.authority.governingInvariants ?? [],
    provenanceSource: o.provenance.source,
    contentCommitment: o.provenance.contentCommitment ?? null,
    lifecycleState: o.lifecycle.state,
    dependencies: o.dependencies.map((d) => d.ref),
  }));

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    readOnly: true,
    count: assets.length,
    assets,
  });
}
