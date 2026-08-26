/**
 * Canary — PRD-EPI-001 §2 artifact model contract.
 *
 * Pins the two sequencing fixes Aletheon's pre-ratification review caught
 * (see PRD-EPI-001's Amendment log): PROTOCOL_FREEZE_ARTIFACT_KINDS must
 * EXCLUDE execution-run/research-package (else protocol-ratified becomes
 * unreachable), and ARTIFACT_LIFECYCLE must stay distinct vocabulary from
 * EXPERIMENT_LIFECYCLE so the two per-altitude state machines never collide.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ARTIFACT_LIFECYCLE,
  EXPERIMENT_LIFECYCLE,
  PROTOCOL_FREEZE_ARTIFACT_KINDS,
  type FrozenArtifactKind,
} from '../types/research';
import { currentCrystalArtifactId, deriveProtocolRatified, getCurrentCrystalArtifact } from '../services/research/artifacts';

const mockListResearchObjects = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: vi.fn(),
  writeLifecycleReceipt: vi.fn(),
}));

function crystalRow(id: string, lifecycleState: 'draft' | 'validated' | 'frozen') {
  return {
    objectKind: 'artifact' as const,
    objectId: id,
    payload: { kind: 'crystal-version', experimentId: 'EXP-P1', contentHash: null, commitmentHash: null, frozenAt: null, signedBy: [] },
    lifecycleState,
    receiptId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  mockListResearchObjects.mockReset();
  mockListResearchObjects.mockResolvedValue({ ok: true, objects: [] });
});

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

/**
 * currentCrystalArtifactId / getCurrentCrystalArtifact — the lineage-aware
 * resolver (operator ruling, 2026-08-27, "Crystal v1/v2 lineage collision").
 * The key invariant under test, in the operator's own words: "A frozen
 * predecessor Crystal must never satisfy the freeze state of a successor
 * Crystal candidate."
 */
describe('currentCrystalArtifactId — the crystal-version lineage resolver', () => {
  it('defaults to generation 1 when nothing has ever been provisioned', async () => {
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [] });
    expect(await currentCrystalArtifactId('EXP-P1')).toBe('EXP-P1/crystal-vP1');
    expect(await getCurrentCrystalArtifact('EXP-P1')).toBeNull();
  });

  it('returns the SAME generation while it is still draft/validated — idempotent, never mints a new one just for being read again', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [crystalRow('EXP-P1/crystal-vP1', 'validated')],
    });
    expect(await currentCrystalArtifactId('EXP-P1')).toBe('EXP-P1/crystal-vP1');
    const active = await getCurrentCrystalArtifact('EXP-P1');
    expect(active?.id).toBe('EXP-P1/crystal-vP1');
    expect(active?.lifecycle).toBe('validated');
  });

  it('THE CORE INVARIANT: once the only generation is frozen, advances to the NEXT generation rather than reporting the frozen one as current', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [crystalRow('EXP-P1/crystal-vP1', 'frozen')],
    });
    expect(await currentCrystalArtifactId('EXP-P1')).toBe('EXP-P1/crystal-vP2');
    // getCurrentCrystalArtifact returns null, NOT the frozen vP1 — a frozen
    // predecessor is never confusable with "the active successor candidate."
    const active = await getCurrentCrystalArtifact('EXP-P1');
    expect(active).toBeNull();
  });

  it('once a successor is itself provisioned (not yet frozen), that successor is current — the frozen predecessor is never revisited', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [crystalRow('EXP-P1/crystal-vP1', 'frozen'), crystalRow('EXP-P1/crystal-vP2', 'validated')],
    });
    expect(await currentCrystalArtifactId('EXP-P1')).toBe('EXP-P1/crystal-vP2');
    const active = await getCurrentCrystalArtifact('EXP-P1');
    expect(active?.id).toBe('EXP-P1/crystal-vP2');
    expect(active?.lifecycle).toBe('validated');
  });

  it('continues the lineage past generation 2 once vP2 is also frozen', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [crystalRow('EXP-P1/crystal-vP1', 'frozen'), crystalRow('EXP-P1/crystal-vP2', 'frozen')],
    });
    expect(await currentCrystalArtifactId('EXP-P1')).toBe('EXP-P1/crystal-vP3');
  });

  it('is scoped per experiment — a different experimentId never reads another experiment’s generation', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [
        { ...crystalRow('EXP-P1/crystal-vP1', 'frozen'), payload: { ...crystalRow('EXP-P1/crystal-vP1', 'frozen').payload, experimentId: 'EXP-P1' } },
      ],
    });
    // EXP-P2 has no rows of its own in the fixture above, so it must resolve
    // its own generation 1 — never see EXP-P1's frozen vP1.
    expect(await currentCrystalArtifactId('EXP-P2')).toBe('EXP-P2/crystal-vP1');
  });
});
