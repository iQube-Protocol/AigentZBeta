/**
 * GET /api/research/overview — the IRL object model, live (CFS-019 §4).
 *
 * Registry (experiments + series) with lifecycle DERIVED from the canonical
 * record (experiment_results) — published/replicated are computed facts.
 * Persona-gated (T2-safe content only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { overviewWithPersistedLifecycle } from '@/services/research/lifecycle';
import { listArtifactRecords } from '@/services/artifact/artifactRecordStore';
import { PUBLICATION_REGISTER } from '@/services/artifact/publicationRegistry';
import { SERIES_REGISTRY, EXPERIMENT_LIFECYCLE } from '@/types/research';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Derived floor (computed from the canonical record) + the receipted
  // research-object state runs advance through the lifecycle. Two honest
  // mechanisms, surfaced side by side — never conflated.
  const overview = await overviewWithPersistedLifecycle();

  // AR/CPS observation (operator direction 2026-07-13): the lab copilot — and
  // any artifact-producing surface — is INFORMED of the current state of
  // artifact production in its space. Observed, never asserted; best-effort
  // (an empty store reads as zero records, honestly). T2-safe projection.
  const records = await listArtifactRecords({ limit: 8 }).catch(() => []);
  const artifactProduction = {
    recentRecords: records.map((r) => ({
      artifactId: r.artifact_id,
      profile: r.profile,
      consequenceClass: r.consequence_class,
      delegate: r.delegate,
      title: r.title.slice(0, 80),
      contentHashPrefix: r.content_hash.slice(0, 12),
      receiptId: r.receipt_id,
      // CVR-003: how many canonical invariants grounded this production
      // (0 for pre-migration rows and ungrounded/disposable-adjacent saves).
      groundedInvariants: Array.isArray(r.cited_invariant_ids) ? r.cited_invariant_ids.length : 0,
      createdAt: r.created_at,
    })),
    publications: PUBLICATION_REGISTER.map((p) => ({ number: p.number, title: p.title, state: p.state })),
  };

  return NextResponse.json({
    ok: true,
    lifecycleOrder: EXPERIMENT_LIFECYCLE,
    series: SERIES_REGISTRY,
    experiments: overview,
    artifactProduction,
    computedAt: new Date().toISOString(),
  });
}
