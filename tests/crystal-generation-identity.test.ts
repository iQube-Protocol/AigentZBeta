/**
 * Generation-identity repair (2026-09-05,
 * RES-2026-09-05-TRACK2-MEMBERSHIP-RECOVERY-GENERATION-BLIND-001 /
 * CI-2026-09-05-MEMBERSHIP-RECOVERY-MUST-BOUND-GENERATION-001).
 *
 * Covers the pieces NOT already exercised by
 * tests/crystal-cohort-membership.test.ts (which behaviorally proves
 * `resolveFrozenPredecessorContext` stays bounded to 15 predecessor members
 * after a 53-member successor generation is assigned into the same domain):
 *
 *   - services/invariants/store.ts: crystal_generation_id read/write + the
 *     listInvariants filter shape (source canary — see rationale inline)
 *   - services/research/artifacts.ts: ensureCurrentCrystalGenerationId
 *     provisions the generation object idempotently
 *   - the Stage 8 assign route: resolves + stamps the generation explicitly,
 *     skips it on a dry run, refuses the write if resolution fails
 *   - services/research/crystalDomains.ts::evaluateCrystalAssignment (pure,
 *     UNTOUCHED by this repair): the 58/53/5 regression shape the operator
 *     asked for, as a general-purpose scenario rather than tied to the live
 *     specific invariant ids
 *   - the migration: mechanical, assertion-guarded, exact-count backfill
 *   - THE PARITY/CANARY: a membership read that matters for generation and
 *     omits crystalGenerationId must fail visibly (regex-anchored on the
 *     real call site), never silently
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const mockListResearchObjects = vi.fn();
const mockUpsertResearchObject = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  listResearchObjects: (...args: unknown[]) => mockListResearchObjects(...args),
  upsertResearchObject: (...args: unknown[]) => mockUpsertResearchObject(...args),
  writeLifecycleReceipt: vi.fn(),
}));

import { ensureCurrentCrystalGenerationId } from '@/services/research/artifacts';
import { evaluateCrystalAssignment, EXP_P1_CRYSTAL_DOMAIN } from '@/services/research/crystalDomains';

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
  mockUpsertResearchObject.mockReset();
  mockUpsertResearchObject.mockResolvedValue({ ok: true });
});

describe('store.ts — crystal_generation_id read/write + filter (source canary)', () => {
  const SRC = 'services/invariants/store.ts';

  it('mapContextRow reads crystal_generation_id from the row, never invents one', () => {
    const src = stripComments(readSource(SRC));
    expect(src).toMatch(/crystalGenerationId:\s*\(row\.crystal_generation_id as string\) \?\? null,/);
  });

  it('upsertContext writes crystal_generation_id from the caller-supplied input, never a hardcoded value', () => {
    const src = stripComments(readSource(SRC));
    expect(src).toMatch(/crystal_generation_id:\s*input\.crystalGenerationId \?\? null,/);
  });

  it('listInvariants applies crystal_generation_id ONLY nested inside the domain branch', () => {
    // A generation id without the domain it was assigned in is not a
    // query (ListInvariantsFilter's own doc comment) — asserting the
    // nesting, not just the presence of both lines, is what would catch a
    // future edit that hoists the generation filter out to apply globally
    // across every domain.
    const src = stripComments(readSource(SRC));
    const fnAt = src.indexOf('export async function listInvariants(');
    const fnEnd = src.indexOf('\nexport async function updateInvariant(', fnAt);
    const block = src.slice(fnAt, fnEnd > -1 ? fnEnd : fnAt + 1200);
    const domainAt = block.indexOf('if (filter.domain) {');
    const genAt = block.indexOf("if (filter.crystalGenerationId) {");
    const domainBlockEnd = block.indexOf('if (invariantIds.length === 0) return [];');
    expect(domainAt).toBeGreaterThan(-1);
    expect(genAt).toBeGreaterThan(domainAt);
    expect(genAt).toBeLessThan(domainBlockEnd);
    expect(block).toMatch(/ctxQuery = ctxQuery\.eq\('crystal_generation_id', filter\.crystalGenerationId\);/);
  });
});

describe('artifacts.ts — ensureCurrentCrystalGenerationId provisions the generation as a first-class object, idempotently', () => {
  it('provisions a draft research_objects row when the current generation has never been provisioned', async () => {
    // vP1 is frozen; no vP2 row exists yet — currentCrystalArtifactId
    // resolves the next unused generation, which has no backing row.
    mockListResearchObjects.mockResolvedValue({ ok: true, objects: [crystalRow('EXP-P1/crystal-vP1', 'frozen')] });
    const id = await ensureCurrentCrystalGenerationId('EXP-P1');
    expect(id).toBe('EXP-P1/crystal-vP2');
    expect(mockUpsertResearchObject).toHaveBeenCalledTimes(1);
    expect(mockUpsertResearchObject).toHaveBeenCalledWith(
      expect.objectContaining({ objectKind: 'artifact', objectId: 'EXP-P1/crystal-vP2', lifecycleState: 'draft' }),
    );
  });

  it('is idempotent — does not re-provision once the generation object already exists', async () => {
    mockListResearchObjects.mockResolvedValue({
      ok: true,
      objects: [crystalRow('EXP-P1/crystal-vP1', 'frozen'), crystalRow('EXP-P1/crystal-vP2', 'draft')],
    });
    const id = await ensureCurrentCrystalGenerationId('EXP-P1');
    expect(id).toBe('EXP-P1/crystal-vP2');
    expect(mockUpsertResearchObject).not.toHaveBeenCalled();
  });
});

describe('evaluateCrystalAssignment — the 58/53/5 regression shape (pure function, untouched by this repair)', () => {
  it('53 eligible + 5 provenance-ineligible out of 58 successor candidates', () => {
    const eligible = Array.from({ length: 53 }, () =>
      evaluateCrystalAssignment({ declaration: EXP_P1_CRYSTAL_DOMAIN, status: 'validated', evidenceProvenance: 'external-established' }),
    );
    // Mirrors the live incident's own breakdown: 4 platform-derived + 1
    // platform-hypothesized, both outside eligibleProvenance.
    const ineligible = [
      ...Array.from({ length: 4 }, () =>
        evaluateCrystalAssignment({ declaration: EXP_P1_CRYSTAL_DOMAIN, status: 'validated', evidenceProvenance: 'platform-derived' }),
      ),
      evaluateCrystalAssignment({ declaration: EXP_P1_CRYSTAL_DOMAIN, status: 'validated', evidenceProvenance: 'platform-hypothesized' }),
    ];
    expect(eligible).toHaveLength(53);
    expect(ineligible).toHaveLength(5);
    expect(eligible.every((v) => v.admitted)).toBe(true);
    expect(ineligible.every((v) => !v.admitted && v.refusals.includes('evidence-provenance-ineligible'))).toBe(true);
    expect([...eligible, ...ineligible]).toHaveLength(58);
  });
});

describe('the Stage 8 assign route — resolves and stamps the generation explicitly (source canary)', () => {
  const ROUTE = 'app/api/research/crystal/[experimentId]/assign/route.ts';

  it('imports and calls ensureCurrentCrystalGenerationId', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/import \{ ensureCurrentCrystalGenerationId \} from '@\/services\/research\/artifacts';/);
    expect(src).toMatch(/crystalGenerationId = await ensureCurrentCrystalGenerationId\(experimentId\);/);
  });

  it('resolves the generation ONLY on a real write, never on a dry run', () => {
    const src = stripComments(readSource(ROUTE));
    const at = src.indexOf('let crystalGenerationId: string | null = null;');
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 500);
    expect(block).toMatch(/if \(!dryRun\) \{/);
  });

  it('refuses the write (503) rather than silently writing an untagged row if resolution fails', () => {
    const src = stripComments(readSource(ROUTE));
    const at = src.indexOf('crystalGenerationId = await ensureCurrentCrystalGenerationId(experimentId);');
    const block = src.slice(at, at + 400);
    expect(block).toMatch(/catch \(error\) \{/);
    expect(block).toMatch(/status: 503/);
  });

  it('every real upsertContext call is stamped with the resolved crystalGenerationId', () => {
    const src = stripComments(readSource(ROUTE));
    const at = src.indexOf('await upsertContext({');
    const block = src.slice(at, at + 300);
    expect(block).toMatch(/crystalGenerationId,/);
    // Resolved ONCE per request, not re-derived inside the per-invariant loop.
    expect((src.match(/ensureCurrentCrystalGenerationId\(experimentId\)/g) ?? []).length).toBe(1);
  });

  it('the resolution happens BEFORE the per-invariant loop, never inside it', () => {
    const src = stripComments(readSource(ROUTE));
    const resolveAt = src.indexOf('crystalGenerationId = await ensureCurrentCrystalGenerationId(experimentId);');
    const loopAt = src.indexOf('for (const id of invariantIds) {');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(loopAt).toBeGreaterThan(resolveAt);
  });
});

describe('THE PARITY/CANARY — a generation-mattering membership read must never omit crystalGenerationId', () => {
  const SRC = 'services/research/crystalCohortMembership.ts';

  it('resolveFrozenPredecessorContext calls listInvariants with BOTH domain and crystalGenerationId in the same call', () => {
    const src = stripComments(readSource(SRC));
    const fnAt = src.indexOf('export async function resolveFrozenPredecessorContext(');
    const fnEnd = src.indexOf('\n}', fnAt);
    const block = src.slice(fnAt, fnEnd);
    const callAt = block.indexOf('await listInvariants({');
    expect(callAt, 'resolveFrozenPredecessorContext must read membership via listInvariants').toBeGreaterThan(-1);
    const call = block.slice(callAt, block.indexOf('});', callAt));
    expect(call).toMatch(/domain:\s*declaration\.domain,/);
    expect(call).toMatch(/crystalGenerationId:\s*frozenPredecessor\.id,/);
  });

  it('the old generation-blind path (buildFrozenCrystalManifest) is no longer imported or called from this module', () => {
    // Stripped, not raw source: the module's own header legitimately
    // DOCUMENTS the prior defect and names buildFrozenCrystalManifest in
    // prose (the grep-vs-comment defect class sourceAuthority.ts exists to
    // avoid) — what must be gone is the import/call, i.e. any occurrence
    // OUTSIDE a comment.
    const src = stripComments(readSource(SRC));
    expect(src).not.toMatch(/buildFrozenCrystalManifest/);
  });
});

describe('the migration — mechanical, assertion-guarded, exact-count backfill', () => {
  const MIGRATION = 'supabase/migrations/20260930200000_invariant_contexts_crystal_generation.sql';

  it('adds the column and backfills the two verified clusters by their exact counts, never a guessed range', () => {
    const src = readSource(MIGRATION);
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS crystal_generation_id text;/);
    expect(src).toMatch(/predecessor_total <> 15 THEN/);
    expect(src).toMatch(/successor_total <> 53 THEN/);
    expect(src).toMatch(/created_at = '2026-09-05 10:06:41\.303889\+00';/);
    expect(src).toMatch(/SET crystal_generation_id = 'EXP-P1\/crystal-vP1'/);
    expect(src).toMatch(/SET crystal_generation_id = 'EXP-P1\/crystal-vP2'/);
    // Idempotent re-run: the UPDATE itself must not require the pre-image to
    // still be NULL (a second run would then assert 0 <> 15/53 and fail).
    expect(src).toMatch(/crystal_generation_id IS DISTINCT FROM 'EXP-P1\/crystal-vP1'/);
    expect(src).toMatch(/crystal_generation_id IS DISTINCT FROM 'EXP-P1\/crystal-vP2'/);
  });

  it('provisions the successor generation as a first-class research_objects row, not merely a label', () => {
    const src = readSource(MIGRATION);
    expect(src).toMatch(/'EXP-P1\/crystal-vP2',/);
    expect(src).toMatch(/'kind', 'crystal-version',/);
    expect(src).toMatch(/'draft'/);
    expect(src).toMatch(/ON CONFLICT \(object_kind, object_id\) DO NOTHING;/);
  });
});
