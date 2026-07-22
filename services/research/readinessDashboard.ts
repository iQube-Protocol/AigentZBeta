/**
 * EXP-P1 Readiness Dashboard — PRD-EPI-001 §10.
 *
 * The human-legible face of §2.2's protocol-ratified derivation: seven sections,
 * each gating a DIFFERENT macro transition — NOT one blanket "all green" bar.
 * The load-bearing honesty point (Aletheon review, 2026-07-22): Execution and
 * Publication are EXPECTED red until the experiment actually runs; only
 * Infrastructure / Crystal / Coverage / Freeze / Review gate `protocol-ratified`.
 *
 * Pure aggregation over already-built services — introduces no new state, no new
 * table, no new receipt path. Read-only.
 *
 * Server-only.
 */

import {
  listArtifacts,
  getArtifact,
  deriveProtocolRatified,
} from '@/services/research/artifacts';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { deriveOverview } from '@/services/research/lifecycle';
import type { FrozenArtifact } from '@/types/research';

export type ReadinessStatus = 'green' | 'amber' | 'red';

export interface ReadinessSection {
  section: string;
  status: ReadinessStatus;
  /** The macro transition (or build milestone) this section gates. */
  gates: string;
  /** Whether a non-green here blocks `protocol-ratified`. Execution/Publication
   * are false — they are LATER milestones, expected red pre-run, and must never
   * be read as "the dashboard is broken" (PRD-EPI-001 §10). */
  gatesProtocolRatified: boolean;
  detail: string;
}

export interface ReadinessDashboard {
  experimentId: string;
  sections: ReadinessSection[];
  /** True only when every `gatesProtocolRatified` section is green. Mirrors
   * deriveProtocolRatified — this is its dashboard projection. */
  protocolRatifiedReady: boolean;
  /** Sections whose red state is CORRECT before the run (Execution,
   * Publication) — surfaced explicitly so a viewer never misreads them. */
  expectedRedPreRun: string[];
}

/** green if a frozen artifact of this kind exists; amber if a draft/validated
 * one exists (in progress); red if none exists at all. */
function artifactStatus(artifacts: FrozenArtifact[], kind: FrozenArtifact['kind']): ReadinessStatus {
  const matching = artifacts.filter((a) => a.kind === kind);
  if (matching.some((a) => a.lifecycle === 'frozen')) return 'green';
  if (matching.length > 0) return 'amber';
  return 'red';
}

export async function buildReadinessDashboard(experimentId: string): Promise<ReadinessDashboard> {
  const artifacts = await listArtifacts(experimentId);

  // ── Crystal (§3.1) — gates crystal-version freeze ──
  const crystalArtifactStatus = artifactStatus(artifacts, 'crystal-version');
  let crystalDetail: string;
  if (crystalArtifactStatus === 'green') {
    crystalDetail = 'Crystal vP1 snapshot is frozen + hash-committed.';
  } else {
    // Run the intrinsic readiness report so the dashboard shows WHY the crystal
    // isn't ready, not just that it isn't. Honest today: with Track 2 paused and
    // no crystal content yet, this reports the specific failing checks.
    const readiness = await runCrystalReadinessReport({ experimentId });
    const failing = readiness.checks.filter((c) => !c.passed).map((c) => c.name);
    crystalDetail =
      crystalArtifactStatus === 'amber'
        ? `Crystal draft exists but is not frozen. Readiness: ${readiness.ok ? 'passes' : `failing — ${failing.join(', ')}`}.`
        : `No crystal-version artifact yet (Track 2 crystal enlargement is separately chartered / paused). Intrinsic readiness: ${readiness.ok ? 'passes' : `failing — ${failing.join(', ')}`}.`;
  }

  // ── Coverage (§3.2) — gates task-set freeze ──
  const coverageStatus = artifactStatus(artifacts, 'task-set');
  const coverageDetail =
    coverageStatus === 'green'
      ? 'Task set is frozen (Task–Crystal Coverage Report passed).'
      : coverageStatus === 'amber'
        ? 'Task set drafted but not frozen — coverage not yet confirmed.'
        : 'No task set yet. Tasks are constructed only AFTER the crystal freezes (IRL-016 §5 sequence gate).';

  // ── Freeze (§2.2) — gates protocol-ratified ──
  const protocol = await deriveProtocolRatified(experimentId);
  const freezeStatus: ReadinessStatus = protocol.ready
    ? 'green'
    : protocol.present.length > 0
      ? 'amber'
      : 'red';
  const freezeDetail = protocol.ready
    ? 'All protocol-freeze artifacts are frozen — protocol-ratified is unlocked.'
    : `Frozen: ${protocol.present.length}/${protocol.present.length + protocol.missing.length}. Missing: ${protocol.missing.join(', ') || 'none'}.`;

  // ── Review (§4) — reviewer package reachable ──
  const reviewStatus = artifactStatus(artifacts, 'research-package');
  const reviewDetail =
    reviewStatus === 'green'
      ? 'Research/reviewer package exported and reachable.'
      : 'No research package yet — generated at/after freeze (PRD-EPI-001 §4).';

  // ── Execution (§2.2) — running / evaluated. EXPECTED red pre-run. ──
  const executionRuns = artifacts.filter((a) => a.kind === 'execution-run');
  const executionStatus: ReadinessStatus = executionRuns.length > 0 ? 'green' : 'red';
  const executionDetail =
    executionRuns.length > 0
      ? `${executionRuns.length} execution run(s) recorded.`
      : 'No execution runs yet — EXPECTED before the confirmatory run. Not a blocker for protocol-ratified.';

  // ── Publication (§2.2) — published. EXPECTED red pre-run. ──
  const overview = await deriveOverview();
  const entry = overview.find((e) => e.experiment.id === experimentId);
  const published = entry ? entry.lifecycle === 'published' || entry.lifecycle === 'replicated' : false;
  const publicationStatus: ReadinessStatus = published ? 'green' : 'red';
  const publicationDetail = published
    ? `Published (derived lifecycle: ${entry?.lifecycle}).`
    : 'Not published — EXPECTED before the run completes. Not a blocker for protocol-ratified.';

  const sections: ReadinessSection[] = [
    {
      section: 'Infrastructure',
      // §§2–7 shipped this session (artifact model, readiness reports, treatment
      // integrity, research package). This is a build-completion signal, not a
      // data derivation — green because the modules exist, with the standing
      // caveat that they have not been type-checked/executed in this sandbox.
      status: 'green',
      gates: 'design completion (§§2–7 built)',
      gatesProtocolRatified: true,
      detail:
        'PRD-EPI-001 §§2–7 infrastructure is built (artifact model, Crystal Readiness, Task Coverage, Treatment Integrity, Research Package). Not yet type-checked/run — verify with tsc/vitest before production.',
    },
    { section: 'Crystal', status: crystalArtifactStatus, gates: 'crystal-version freeze (§3.1)', gatesProtocolRatified: true, detail: crystalDetail },
    { section: 'Coverage', status: coverageStatus, gates: 'task-set freeze (§3.2)', gatesProtocolRatified: true, detail: coverageDetail },
    { section: 'Freeze', status: freezeStatus, gates: 'protocol-ratified (§2.2)', gatesProtocolRatified: true, detail: freezeDetail },
    { section: 'Review', status: reviewStatus, gates: 'reviewer package reachable (§4)', gatesProtocolRatified: true, detail: reviewDetail },
    { section: 'Execution', status: executionStatus, gates: 'running / evaluated (§2.2)', gatesProtocolRatified: false, detail: executionDetail },
    { section: 'Publication', status: publicationStatus, gates: 'published (§2.2)', gatesProtocolRatified: false, detail: publicationDetail },
  ];

  const protocolRatifiedReady = sections
    .filter((s) => s.gatesProtocolRatified)
    .every((s) => s.status === 'green');

  return {
    experimentId,
    sections,
    protocolRatifiedReady,
    expectedRedPreRun: ['Execution', 'Publication'],
  };
}
