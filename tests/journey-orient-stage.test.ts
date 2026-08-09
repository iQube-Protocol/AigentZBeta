/**
 * Threshold Journey — Orient stage + Consequence Fork (operator spec,
 * 2026-08-09). Canaries for the new spine segment (Claim -> Orient ->
 * Passport), the contextual ritual resolver (services/journey/
 * orientationContext.ts), the acknowledgment route, and the Consequence
 * Fork's rendering topology in JourneyRunSurface.tsx.
 *
 * All `vi.mock` calls live at module scope (vitest hoists them above every
 * import) — mirrors tests/aigentme-disposition-agent-scoping.test.ts's own
 * pattern. A mock declared inside a `describe` callback runs too late for
 * vitest's hoisting and throws a ReferenceError; this file deliberately
 * shares ONE mock per module across every describe block below that needs it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { VALIDATION_PROGRAMME_JOURNEY } from '@/services/journey/validationProgrammeJourney';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
}));

const byId = (id: string) => {
  const s = HORIZEN_MONEYPENNY_JOURNEY.stages.find((x) => x.id === id);
  if (!s) throw new Error(`no stage "${id}"`);
  return s;
};

// ═══════════════════════════════════════════════════════════════════════════
describe('Orient sits between Claim and Passport on the admission spine', () => {
  it('Claim routes to Orient, never straight to Passport', () => {
    expect(byId('claim').nextStageId).toBe('orient');
  });

  it('Orient requires only Claim, and routes on to Passport', () => {
    expect(byId('orient').prerequisites).toEqual(['claim']);
    expect(byId('orient').nextStageId).toBe('passport');
  });

  it('Passport now requires Orient, not Claim directly — the gate this stage exists to add', () => {
    expect(byId('passport').prerequisites).toEqual(['orient']);
  });

  it('Orient completes on exactly one signal — the operator’s explicit acknowledgment act', () => {
    expect(byId('orient').completionEvidence).toEqual(['orientationComplete']);
    expect(byId('orient').receiptTypes).toContain('orientation_ritual_completed');
    // Subject-tagged, same discipline as Claim/Register (operator directive, 2026-08-08).
    expect(byId('orient').receiptsScopedToSubjectAgent).toBe(true);
  });

  it('Orient never bypasses state — it has a real surface, not a click-only panel', () => {
    const orient = byId('orient');
    expect(orient.surfaces.length).toBeGreaterThan(0);
    expect(orient.surfaces[0].ref).toBe('orientation-panel');
    expect(orient.permittedActions).toEqual(['acknowledge-orientation-ritual']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('the Consequence Fork — Ratify upper, Ingest middle, Standing lower', () => {
  it('assigns exactly one stage to each fork position', () => {
    expect(byId('verify').forkPosition).toBe('upper');
    expect(byId('deploy').forkPosition).toBe('middle');
    expect(byId('standing').forkPosition).toBe('lower');
  });

  it('fork branches remain independent — no new inter-branch dependency introduced', () => {
    // Standing's prerequisite on Deploy is PRE-EXISTING (ingestion eligibility,
    // 2026-08-03) — not a dependency Orient/the fork introduced. Ratify and
    // Deploy must not depend on each other or on Standing.
    expect(byId('verify').prerequisites).toEqual(['aigentme']);
    expect(byId('deploy').prerequisites).toEqual(['aigentme']);
    expect(byId('standing').prerequisites).toEqual(['deploy']);
    expect(byId('verify').prerequisites).not.toContain('deploy');
    expect(byId('verify').prerequisites).not.toContain('standing');
    expect(byId('deploy').prerequisites).not.toContain('verify');
    expect(byId('deploy').prerequisites).not.toContain('standing');
    expect(byId('standing').prerequisites).not.toContain('verify');
  });

  it('none of the three fork stages carries a nextStageId — a branch is not a step on a line', () => {
    expect(byId('verify').nextStageId).toBeUndefined();
    expect(byId('deploy').nextStageId).toBe('standing'); // internal to the branch, pre-existing
    expect(byId('standing').nextStageId).toBeUndefined();
  });

  it('a journey with no forkPosition-tagged stages renders no fork at all (purely additive)', () => {
    const forked = VALIDATION_PROGRAMME_JOURNEY.stages.filter((s) => s.forkPosition);
    expect(forked).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JourneyRunSurface renders the fork as one trident after the spine, never mixed in', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'components/journey/JourneyRunSurface.tsx'),
    'utf8',
  );

  it('splits stages into spine vs fork by forkPosition, never by id or position', () => {
    expect(source).toMatch(/const spineStages = journey\.stages\.filter\(\(s\) => !s\.forkPosition\)/);
    expect(source).toMatch(/const forkStages = journey\.stages\.filter\(\(s\) => s\.forkPosition\)/);
  });

  it('the numbered strip maps over spineStages, not the raw journey.stages', () => {
    const stripAt = source.indexOf('ref={stripRef}');
    const mapAt = source.indexOf('.map(', stripAt);
    expect(source.slice(stripAt, mapAt + 20)).toMatch(/spineStages\.map/);
  });

  it('anchors the fork INSIDE the same horizontal strip as the spine — never a detached block underneath (2026-08-09 trident correction)', () => {
    const stripAt = source.indexOf('ref={stripRef}');
    const spineMapAt = source.indexOf('spineStages.map(', stripAt);
    const forkBlockAt = source.indexOf('forkStages.length > 0', stripAt);
    expect(spineMapAt).toBeGreaterThan(-1);
    expect(forkBlockAt).toBeGreaterThan(spineMapAt);
    // THE ASSERTION THAT FAILS ON THE DEFECT: the historical implementation
    // closed the strip's own <div> (via a stray `mt-2` sibling block) BEFORE
    // reaching the fork. The corrected geometry keeps both inside one
    // container — no `</div>` closes the strip between the spine map and the
    // fork block.
    const between = source.slice(spineMapAt, forkBlockAt);
    expect(between, 'the strip container closes before the fork — the fork is a detached block again').not.toMatch(
      /<\/div>\s*$/,
    );
    expect(source, 'the old detached fork block (mt-2 border-t) has returned').not.toMatch(
      /mt-2 flex items-stretch gap-2 border-t border-slate-800\/60/,
    );
  });

  it('the fork continues the spine\'s own connector line into the junction, never starting a second line', () => {
    // The tick immediately after the fork's gate is styled exactly like a
    // spine connector (emerald when the last spine stage is done, slate
    // otherwise) — the SAME visual language, not a second palette.
    const forkBlockAt = source.indexOf('forkStages.length > 0');
    const section = source.slice(forkBlockAt, forkBlockAt + 600);
    expect(section).toMatch(/lastSpineDone/);
    expect(section).toMatch(/bg-emerald-500\/50.*bg-slate-700|bg-slate-700.*bg-emerald-500\/50/s);
  });

  it('walks fork rows in upper, middle, lower order — Ratify, Ingest, Standing', () => {
    const rowsMatch = source.match(/const FORK_ROWS[\s\S]*?\];/);
    expect(rowsMatch).not.toBeNull();
    // Matches only the array's object-literal entries (`{ position: 'x' },`) —
    // deliberately excludes the preceding `Array<{ position: 'upper' | ... }>`
    // type annotation on the same declaration, which would otherwise add a
    // spurious leading 'upper'.
    const order = Array.from(rowsMatch![0].matchAll(/\{ position: '([a-z]+)' \}/g)).map((m) => m[1]);
    expect(order).toEqual(['upper', 'middle', 'lower']);
  });

  it('each fork row is keyed and driven by its OWN stage — no shared/collapsed state', () => {
    const forkBlockAt = source.indexOf('forkStages.length > 0');
    const forkSection = source.slice(forkBlockAt, forkBlockAt + 3000);
    expect(forkSection).toMatch(/forkStages\.find\(\(s\) => s\.forkPosition === position\)/);
    expect(forkSection).toMatch(/key=\{stage\.id\}/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('resolveOrientationContext — the ritual is resolved from STATE, never agent name', () => {
  beforeEach(() => {
    mockListActivityReceiptsForPersona.mockReset();
  });

  it('no prior Passport-adjacent act for this operator → first-time principal ritual', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
    const { resolveOrientationContext } = await import('@/services/journey/orientationContext');
    const ctx = await resolveOrientationContext('persona-new', { displayName: 'Aigent MoneyPenny' });
    expect(ctx.ritualKind).toBe('principal-first-constitutional-act');
    expect(ctx.capsule).toContain('Aigent MoneyPenny');
    expect(ctx.capsule).not.toContain('{{agentDisplayName}}');
  });

  it('a prior sponsorship/passport act for ANY agent → acknowledge-existing-relationship, never re-derived per agent', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([{ id: 'r1', actionType: 'agent_sponsorship_recorded' }]);
    const { resolveOrientationContext } = await import('@/services/journey/orientationContext');
    const ctx = await resolveOrientationContext('persona-existing', { displayName: 'Aigent Nakamoto' });
    expect(ctx.ritualKind).toBe('acknowledge-existing-relationship');
    expect(ctx.capsule).toContain('Aigent Nakamoto');
  });

  it('the prior-act query is persona-scoped only — never agent-scoped (the question is about the PERSON)', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
    const { resolveOrientationContext } = await import('@/services/journey/orientationContext');
    await resolveOrientationContext('persona-x', { displayName: 'Aigent MoneyPenny' });
    const [personaArg, optsArg] = mockListActivityReceiptsForPersona.mock.calls[0];
    expect(personaArg).toBe('persona-x');
    expect(optsArg.agentsInvoked).toBeUndefined();
    expect(optsArg.actionTypes).toEqual(expect.arrayContaining(['agent_sponsorship_recorded', 'passport_issued']));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('orient/acknowledge route — completion is the act, never the read', () => {
  function makeGetRequest(query: Record<string, string> = {}): NextRequest {
    return { nextUrl: { searchParams: new URLSearchParams(query) } } as unknown as NextRequest;
  }
  function makePostRequest(body: Record<string, unknown>): NextRequest {
    return {
      nextUrl: { searchParams: new URLSearchParams() },
      json: async () => body,
    } as unknown as NextRequest;
  }

  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-arkagent' });
    mockCreateActivityReceipt.mockClear();
    mockListActivityReceiptsForPersona.mockReset();
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
  });

  it('GET reports orientationComplete=false and a resolved ritual when no acknowledgment receipt exists', async () => {
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await GET(makeGetRequest({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.orientationComplete).toBe(false);
    expect(json.orientationContext.ritualKind).toBe('principal-first-constitutional-act');
  });

  it('POST writes exactly one orientation_ritual_completed receipt, scoped to the selected agent', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await POST(makePostRequest({ agentSlug: 'nakamoto' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.orientationComplete).toBe(true);

    const calls = mockCreateActivityReceipt.mock.calls.map((c) => c[0]);
    const written = calls.filter((c) => c.actionType === 'orientation_ritual_completed');
    expect(written).toHaveLength(1);
    expect(written[0].agentsInvoked).toEqual(['aigent-nakamoto']);
  });

  it('POST is idempotent — an existing receipt for this agent suppresses a second write', async () => {
    mockListActivityReceiptsForPersona.mockImplementation(async (_personaId: string, opts: any) => {
      if (opts?.actionTypes?.includes('orientation_ritual_completed')) {
        return [{ id: 'existing-receipt', actionType: 'orientation_ritual_completed' }];
      }
      return [];
    });
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await POST(makePostRequest({ agentSlug: 'moneypenny' }));
    expect(res.status).toBe(200);
    const written = mockCreateActivityReceipt.mock.calls
      .map((c) => c[0])
      .filter((c) => c.actionType === 'orientation_ritual_completed');
    expect(written).toHaveLength(0);
  });

  it('a fresh acknowledgment for one agent never satisfies another — scoped by agentsInvoked', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    await POST(makePostRequest({ agentSlug: 'nakamoto' }));
    await POST(makePostRequest({ agentSlug: 'moneypenny' }));
    const calls = mockCreateActivityReceipt.mock.calls
      .map((c) => c[0])
      .filter((c) => c.actionType === 'orientation_ritual_completed');
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.agentsInvoked[0]).sort()).toEqual(['aigent-moneypenny', 'aigent-nakamoto']);
  });
});
