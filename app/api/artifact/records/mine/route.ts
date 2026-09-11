/**
 * GET /api/artifact/records/mine — the caller's OWN produced software
 * artifacts, for the mySoftware myCluster tab (SPEC-MMC-002 §6.2 Phase 2;
 * PRD-MMC-IMPL-007 §0.2/§0.3, "closing that gap" addendum).
 *
 * Phase 1 could not read `artifact_records` as a persona-owned source: every
 * row was stamped `delegate: 'operator'`, with no per-persona column at all
 * (MySoftwareTab.tsx header + PRD-MMC-IMPL-007 §0.2). The 20260819000000
 * migration adds `actor_commitment` — a T2-safe one-way commitment of the
 * producing persona, the SAME formula app/api/artifact/produce-software/
 * route.ts already computes and (as of this pass) now persists via
 * services/artifact/pilots/softwarePilot.ts. This route is the first
 * persona-scoped read of that column.
 *
 * Ownership discipline: the caller is resolved ONLY via getActivePersona
 * (identity spine — no parallel resolver). The route computes
 * `actorCommitmentFor(persona.personaId)` (services/artifact/
 * artifactRecordStore.ts — the SAME derivation produce-software's route
 * already applies, factored so the two never drift) and filters
 * `listArtifactRecords({ actorCommitment })`. Neither `actorCommitment` nor
 * `personaId` ever leaves this function — the response carries only
 * display-safe fields, matching the T0/T1/T2 tiering CLAUDE.md mandates.
 *
 * Soft-fail: if the migration hasn't been applied yet (or Supabase isn't
 * configured), listArtifactRecords (artifactRecordStore.ts) already no-ops
 * and logs a warning — this route degrades to `{ records: [] }`, never a
 * 500, exactly like every other soft-fail path on this table.
 *
 * Rows written before this migration (or before a caller supplied
 * actorCommitment) carry `actor_commitment: null` and are correctly excluded
 * — they are genuinely unattributable, not a bug (SPEC-MMC-002 §0.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { actorCommitmentFor, listArtifactRecords } from '@/services/artifact/artifactRecordStore';

export const dynamic = 'force-dynamic';

/** T1-safe projection — actor_commitment (T2, server-internal) and delegate
 *  (still the generic 'operator' literal today) never leave this route. */
export interface MySoftwareArtifactSummary {
  artifactId: string;
  profile: string;
  consequenceClass: string;
  title: string;
  brief: string;
  artefactType: string | null;
  runtimeHost: string | null;
  permissions: unknown;
  contentHashPrefix: string;
  receiptId: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const actorCommitment = actorCommitmentFor(persona.personaId);
  const rows = await listArtifactRecords({ actorCommitment, limit: 50 });

  const records: MySoftwareArtifactSummary[] = rows.map((r) => ({
    artifactId: r.artifact_id,
    profile: r.profile,
    consequenceClass: r.consequence_class,
    title: r.title,
    brief: r.brief,
    artefactType: r.artefact_type ?? null,
    runtimeHost: r.runtime_host ?? null,
    permissions: r.permissions ?? null,
    contentHashPrefix: r.content_hash.slice(0, 12),
    receiptId: r.receipt_id,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ records });
}
