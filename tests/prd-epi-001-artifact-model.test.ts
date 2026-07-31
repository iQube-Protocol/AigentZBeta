/**
 * Canary — PRD-EPI-001 §2 artifact model contract.
 *
 * Pins the two sequencing fixes Aletheon's pre-ratification review caught
 * (see PRD-EPI-001's Amendment log): PROTOCOL_FREEZE_ARTIFACT_KINDS must
 * EXCLUDE execution-run/research-package (else protocol-ratified becomes
 * unreachable), and ARTIFACT_LIFECYCLE must stay distinct vocabulary from
 * EXPERIMENT_LIFECYCLE so the two per-altitude state machines never collide.
 */

import { describe, it, expect } from 'vitest';
import {
  ARTIFACT_LIFECYCLE,
  EXPERIMENT_LIFECYCLE,
  PROTOCOL_FREEZE_ARTIFACT_KINDS,
  type FrozenArtifactKind,
} from '../types/research';
import { deriveProtocolRatified } from '../services/research/artifacts';

describe('PRD-EPI-001 §2 — artifact lifecycle contract', () => {
  it('ARTIFACT_LIFECYCLE shares no state name with EXPERIMENT_LIFECYCLE', () => {
    const shared = ARTIFACT_LIFECYCLE.filter((s) => (EXPERIMENT_LIFECYCLE as readonly string[]).includes(s));
    expect(shared).toEqual([]);
  });

  it('PROTOCOL_FREEZE_ARTIFACT_KINDS excludes execution-run and research-package (Aletheon review, 2026-07-22)', () => {
    const kinds = PROTOCOL_FREEZE_ARTIFACT_KINDS as readonly FrozenArtifactKind[];
    expect(kinds).not.toContain('execution-run');
    expect(kinds).not.toContain('research-package');
  });

  it('PROTOCOL_FREEZE_ARTIFACT_KINDS includes every protocol-phase artifact PRD-EPI-001 §2.1 names', () => {
    const kinds = PROTOCOL_FREEZE_ARTIFACT_KINDS as readonly FrozenArtifactKind[];
    for (const k of [
      'crystal-version',
      'arm-config',
      'task-set',
      'answer-key',
      'judge-config',
      'analysis-config',
      'interpretation-table',
    ] as const) {
      expect(kinds).toContain(k);
    }
  });

  it('deriveProtocolRatified reports every required kind missing for an unknown/empty experiment', async () => {
    const result = await deriveProtocolRatified('EXP-TEST-EMPTY-EXPERIMENT-NO-ARTIFACTS');
    expect(result.ready).toBe(false);
    expect(result.missing.length).toBe(PROTOCOL_FREEZE_ARTIFACT_KINDS.length);
    expect(result.present.length).toBe(0);
  });
});
