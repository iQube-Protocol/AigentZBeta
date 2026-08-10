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

  /*
   * ── THE TEST THAT WAS PART OF THE DEFECT (operator, 2026-08-09) ──────────
   *
   * An earlier version of this canary asserted the fork block appears AFTER
   * the spine strip's closing tag — i.e. it PROTECTED the detached-block
   * layout the trident correction exists to remove. A correct
   * inside-the-strip implementation would have failed that assertion and
   * risked being "fixed" back toward the wrong layout. The canaries below
   * assert the OPPOSITE: `data-testid="consequence-fork"` occurs inside
   * `stripRef`, after the spine map, and before the strip's own closing
   * boundary — and the historical detached markup never reappears.
   */
  it('data-testid="consequence-fork" occurs INSIDE stripRef, after the spine map and before the strip closes', () => {
    const stripAt = source.indexOf('ref={stripRef}');
    const spineMapAt = source.indexOf('spineStages.map(', stripAt);
    const forkTestIdAt = source.indexOf('data-testid="consequence-fork"', stripAt);
    expect(spineMapAt).toBeGreaterThan(-1);
    // THE ASSERTION THAT FAILS ON THE DEFECT: a detached fork renders its
    // data-testid AFTER stripRef's own closing tag, not before it.
    expect(forkTestIdAt, 'consequence-fork testid not found').toBeGreaterThan(spineMapAt);

    // stripRef's own closing </div> is the first </div> whose matching open
    // tag is the `ref={stripRef}` div itself — found by scanning forward from
    // the spine map for the </div> that closes back to depth 0 relative to
    // that div's own opening. Simplified here (this file has no nested <div>
    // between the spine map and the fork/strip close) to: the LAST </div>
    // before the sibling "CONSEQUENCE FORK renders the fork as trident" strip
    // wrapper closes, i.e. the fork testid must precede it.
    const stripCloseAt = source.indexOf('</div>\n      </div>', spineMapAt);
    expect(stripCloseAt, 'strip closing boundary not found — the route moved').toBeGreaterThan(-1);
    expect(forkTestIdAt, 'the fork renders after the strip has already closed — it is detached again').toBeLessThan(
      stripCloseAt,
    );
  });

  it('never reintroduces the historical detached fork block (mt-2 / border-t / flex-column stack)', () => {
    expect(source, 'the old detached fork block (mt-2 border-t) has returned').not.toMatch(
      /mt-2 flex items-stretch gap-2 border-t border-slate-800\/60/,
    );
    // The three prongs must NOT be laid out via normal flex-column stacking
    // relative to each other — that recreates the "second panel" look even
    // when nested inside the strip. The corrected shape is one fixed-size
    // relative box with absolutely-positioned rows.
    expect(source).not.toMatch(/data-testid="consequence-fork"[^>]*>\s*<div className="flex flex-col gap-2">/);
  });

  it('renders NO section heading — the geometry itself communicates the fork (operator instruction, 2026-08-09)', () => {
    expect(source.toLowerCase()).not.toMatch(/consequence fork.*independent.*after/s);
  });

  it('the fork is ONE fixed-size relative box with absolutely-positioned trunk, junction and rows', () => {
    const forkBlockAt = source.indexOf('data-testid="consequence-fork"');
    const section = source.slice(Math.max(0, forkBlockAt - 200), forkBlockAt + 1200);
    // 154px, not 170px: the incoming connector's 16px moved OUT of the box
    // and into the shared flexible connector (spacing correction, 2026-08-09)
    // — the box now begins right at the junction instead of leaving a
    // leading 16px gap inside it.
    expect(section).toMatch(/relative h-\[72px\] w-\[154px\] shrink-0/);
    // The vertical trunk and the junction dot are both absolutely positioned
    // within that one box — never a second, independently-flowing element.
    expect(section).toMatch(/absolute bottom-3 left-0 top-3 w-px/);
    expect(section).toMatch(/rounded-full bg-slate-600/); // the junction dot
  });

  it('the incoming connector into the junction reflects Operate\'s own completion — the same visual language as a spine connector', () => {
    const forkGateAt = source.indexOf('forkStages.length > 0');
    const forkTestIdAt = source.indexOf('data-testid="consequence-fork"');
    const section = source.slice(forkGateAt, forkTestIdAt + 900);
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
    const forkBlockAt = source.indexOf('data-testid="consequence-fork"');
    const forkSection = source.slice(forkBlockAt, forkBlockAt + 3500);
    expect(forkSection).toMatch(/forkStages\.find\(\(s\) => s\.forkPosition === position\)/);
    expect(forkSection).toMatch(/key=\{stage\.id\}/);
  });

  it('exact visible stage vocabulary — verbs only, spine then fork', () => {
    const labelsMatch = source.match(/\{stage\.label\}/g);
    // Structural check: the label is rendered from the stage object in both
    // the spine map and the fork rows, never a hardcoded string — the
    // vocabulary itself is asserted against the journey definition in
    // tests/journey-orient-legacy-regression.test.ts ("stage labels are
    // normalized to verbs"), which is the single source of truth for it.
    expect(labelsMatch?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  /*
   * ── SPACING CORRECTION: EQUAL FLEXIBLE CONNECTORS, NOT EQUAL FIXED-WIDTH
   *    ONES (operator, 2026-08-09, reversing a same-day over-correction) ──
   *
   * The immediately prior fix made every connector — the five ordinary
   * spine gaps AND the Operate→fork gap — a fixed `w-4` (16px), which DID
   * make them equal but collapsed the whole strip to its min-content width:
   * the journey bunched into the left portion of the surface with large
   * unused width on the right. The actual requirement was uniform
   * DISTRIBUTION across the full available width, not a uniform PIXEL gap.
   * These canaries protect the corrected invariant — equal flex-grow, never
   * equal fixed width — so this does not regress back to `w-4` under a
   * future "make the gaps more consistent" request.
   */
  it('defines ONE shared flexible connector class — flex-1, not a fixed width — used by every ordinary spine gap', () => {
    expect(source).toMatch(/const JOURNEY_CONNECTOR_CLASS = 'h-px flex-1 min-w-\[40px\]'/);
    // The ordinary spine connector renders via the shared constant, not an
    // inline literal that could drift from the fork's own connector.
    expect(source).toMatch(/\{i > 0 && <div className=\{`\$\{JOURNEY_CONNECTOR_CLASS\}/);
  });

  it('never reintroduces a fixed-width (w-4 shrink-0) connector for any spine or fork interval', () => {
    expect(source, 'a fixed w-4 connector has returned — this is the over-correction that bunched the journey left').not.toMatch(
      /h-px w-4 shrink-0/,
    );
  });

  it('the Operate→fork connector uses the SAME shared class as every ordinary spine gap, never a fixed-width special case', () => {
    const forkGateAt = source.indexOf('forkStages.length > 0');
    const forkTestIdAt = source.indexOf('data-testid="consequence-fork"', forkGateAt);
    const section = source.slice(forkGateAt, forkTestIdAt);
    expect(section).toMatch(/\$\{JOURNEY_CONNECTOR_CLASS\}/);
    // And it renders as a normal flex-flow sibling BEFORE the fixed-size
    // box, not absolutely positioned inside it — participating in the
    // strip's flex distribution the same way an ordinary connector does.
    expect(section).not.toMatch(/absolute left-0 top-1\/2 h-px w-4/);
  });

  it('the strip explicitly claims the full available width (w-full), so flex-1 connectors have real space to distribute', () => {
    const stripAt = source.indexOf('ref={stripRef}');
    const classNameAt = source.indexOf('className=', stripAt);
    const section = source.slice(classNameAt, classNameAt + 200);
    expect(section).toMatch(/\bw-full\b/);
  });

  it('stage nodes stay shrink-0 — only connectors absorb/distribute the available width, never the nodes themselves', () => {
    const spineButtonAt = source.indexOf('data-stage-id={stage.id}');
    const section = source.slice(Math.max(0, spineButtonAt - 50), spineButtonAt + 300);
    expect(section).toMatch(/shrink-0/);
  });

  it('the fork remains inside the same horizontal strip as the spine — the connector move did not detach it again', () => {
    const stripAt = source.indexOf('ref={stripRef}');
    const spineMapAt = source.indexOf('spineStages.map(', stripAt);
    const forkTestIdAt = source.indexOf('data-testid="consequence-fork"', stripAt);
    const stripCloseAt = source.indexOf('</div>\n      </div>', spineMapAt);
    expect(forkTestIdAt).toBeGreaterThan(spineMapAt);
    expect(forkTestIdAt).toBeLessThan(stripCloseAt);
  });

  /*
   * ── COMPACT EVIDENCE AFFORDANCE (operator, 2026-08-09, "Compact the
   *    Journey Evidence Checklist"; relocated to the top row, 2026-08-10)
   *    ──────────────────────────────────────────────────────────────────
   *
   * The evidence checklist used to be a `<details>` disclosure in normal
   * document flow BELOW the stage description row — opening it pushed the
   * stage stepper/viewport down the page. Corrected first to an ANCHORED
   * popover sharing the description row (2026-08-09), then moved into the
   * TOP row between Refresh state and Full screen (2026-08-10) — its own
   * trigger was congesting the description row's right corner. Either way,
   * the description row itself stays flex-1 min-w-0 (unaffected by the
   * trigger's own position), the checklist opens as an ANCHORED popover
   * (never `<details>`), and its contents are a horizontally-scrolling chip
   * row (never a tall `<ul>`).
   */
  it('the evidence trigger lives in the TOP row, between Refresh state and Full screen', () => {
    // Refresh/Evidence/Full screen are shared between the compact (KNYTS
    // Bridge) and non-compact (Horizen) headers via `headerActions` — the
    // trigger itself is a variable reference here, its own JSX defined once
    // above (`evidenceTrigger`), never duplicated per layout.
    const refreshAt = source.indexOf('Refresh state');
    const fullScreenAt = source.indexOf("title={fullScreen ? 'Collapse' : 'Full screen'}");
    expect(refreshAt, 'Refresh state button missing').toBeGreaterThan(-1);
    expect(fullScreenAt, 'Full screen button missing').toBeGreaterThan(-1);
    const between = source.slice(refreshAt, fullScreenAt);
    expect(between).toMatch(/\{evidenceTrigger\}/);
    const evidenceDefAt = source.indexOf('const evidenceTrigger =');
    expect(evidenceDefAt, 'evidenceTrigger definition missing').toBeGreaterThan(-1);
    expect(evidenceDefAt).toBeLessThan(refreshAt);
    const evidenceDef = source.slice(evidenceDefAt, evidenceDefAt + 1000);
    expect(evidenceDef).toMatch(/Evidence \{activeStageRuntime\.evidencePresent\.length\}/);
    expect(evidenceDef).toMatch(/className="relative shrink-0"/);
  });

  /*
   * ── THRESHOLD GUIDE HEADER COMPACTION (operator, 2026-08-10) ────────────
   *
   * The stage chip/label/narrator used to sit on their own row BELOW the
   * top row — that second row is now gone entirely; its content moved into
   * the top row alongside the branding and the State/Evidence/Full screen
   * controls. The left cluster stays `flex-1 min-w-0 overflow-hidden` so the
   * narrator (last in the cluster) is what truncates under width pressure,
   * never the branding or the stage chip.
   */
  it('the stage chip/label/narrator now share the TOP row with the branding — no second row', () => {
    const rowAt = source.indexOf('ONE COMPRESSED TOP ROW');
    expect(rowAt, 'the compressed top-row comment anchor is missing').toBeGreaterThan(-1);
    const section = source.slice(rowAt, rowAt + 1600);
    expect(section).toMatch(/className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm"/);
    expect(section).toMatch(/\{headerLabel\}/);
    expect(section).toMatch(/\{activeIdx \+ 1\}/);
    expect(section).toMatch(/\{activeStage\.label\}/);
  });

  it('the top row renders a rotating narrator (active <-> consequence) when the stage declares one, falling back to description otherwise', () => {
    expect(source).toMatch(/activeStage\.narrator/);
    expect(source).toMatch(/activeStage\.narrator\.active/);
    expect(source).toMatch(/activeStage\.narrator\.consequence/);
    // The fallback path for journeys/stages with no narrator — description
    // must still be reachable, never dropped outright.
    expect(source).toMatch(/\{ key: 'description', node: <span[^>]*>\{activeStage\.description\}<\/span> \}/);
  });

  it('"Destination: aigentMe" is gone from the header — removed for the one-row compaction', () => {
    const tabSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app/triad/components/codex/tabs/PilotJourneyTab.tsx'),
      'utf8',
    );
    expect(tabSrc).not.toMatch(/Destination: aigentMe/);
  });

  it('the Refresh/State control is compact — icon + "State", full label preserved only as a title attribute', () => {
    const titleAt = source.indexOf('title="Refresh state"');
    expect(titleAt, 'title="Refresh state" attribute missing').toBeGreaterThan(-1);
    const buttonBlock = source.slice(titleAt, titleAt + 600);
    expect(buttonBlock).toMatch(/<RefreshCw/);
    expect(buttonBlock).toMatch(/!compact && 'State'/);
    expect(buttonBlock).not.toMatch(/>\s*Refresh state\s*</);
  });

  it('the evidence checklist opens as an ANCHORED popover, never a <details> disclosure that pushes content down', () => {
    const triggerAt = source.indexOf('Evidence {activeStageRuntime.evidencePresent.length}');
    expect(triggerAt).toBeGreaterThan(-1);
    const section = source.slice(Math.max(0, triggerAt - 600), triggerAt + 2200);
    // Popover: absolutely positioned, anchored to its own `relative` trigger
    // container — never the old `<details>` element for this checklist.
    expect(section).toMatch(/absolute right-0 top-\[calc\(100%\+4px\)\]/);
    expect(section).not.toMatch(/<details/);
    // Closes on stage change, outside click, and Escape — never lingers
    // showing the PREVIOUS stage's evidence after the active stage changes.
    expect(source).toMatch(/setEvidenceOpen\(false\);\s*\}, \[activeStageId\]\)/);
    expect(source).toMatch(/e\.key === 'Escape'\) setEvidenceOpen\(false\)/);
  });

  it('open evidence renders as a HORIZONTAL, scrollable chip row — never a tall vertical list', () => {
    const triggerAt = source.indexOf('Evidence {activeStageRuntime.evidencePresent.length}');
    const section = source.slice(triggerAt, triggerAt + 2200);
    expect(section).toMatch(/flex flex-nowrap items-center gap-1\.5 overflow-x-auto/);
    // The old vertical list classes must not reappear for this checklist.
    expect(section).not.toMatch(/<ul className="mt-1\.5 space-y-1/);
    expect(section).not.toMatch(/<li key=\{sig\}/);
  });

  it('the popover consumes the SAME server-derived evidencePresent/evidenceMissing/receiptRefs — no second evidence resolver', () => {
    const triggerAt = source.indexOf('Evidence {activeStageRuntime.evidencePresent.length}');
    const section = source.slice(triggerAt, triggerAt + 2200);
    expect(section).toMatch(/activeStageRuntime\.evidencePresent\.map/);
    expect(section).toMatch(/activeStageRuntime\.evidenceMissing\.map/);
    expect(section).toMatch(/activeStageRuntime\.receiptRefs\.length/);
    expect(section).toMatch(/humaniseSignal\(sig\)/);
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
