/**
 * IRL-REVIEW-001 §12 — canaries for the Lab surface.
 *
 * The workflow canaries live in `tests/independent-review-capability.test.ts`.
 * These guard the four things a UI can break that the engine cannot:
 *
 *   1. THE SAME-FAMILY GUARD IS SERVER-SIDE. A dropdown that filters options is
 *      a courtesy; a direct POST ignores it. The refusal must live in the API,
 *      and the request shape must make a client-asserted family unrepresentable.
 *   2. THE UI'S DISABLED SET IS DERIVED. The options a human sees and the rule
 *      the server enforces must come from ONE piece of family metadata, or the
 *      dropdown and the refusal disagree and somebody "fixes" the wrong side.
 *   3. THE PREVIEW IS THE PACKAGE. Not a projection of it. A human looks at the
 *      preview in order to trust what they cannot see.
 *   4. NO RESOLUTION PATH WRITES TO THE CORPUS. accept · revise · defer ·
 *      reject record a governed resolution; the freeze stays separate.
 *
 * Plus the gate: BOTH denial canaries AND a positive-reachability canary. A
 * gate canary that only ever asserts refusals passes just as happily on a
 * surface nobody can reach — which is a different outage, not a success.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The gate is exercised for real below, not only grepped. A source assertion
 * that the file "contains cartridgeFlags?.isAdmin" survives the check being
 * neutered to `if (false && !persona.cartridgeFlags?.isAdmin)` — a mutation
 * that opens the surface to every authenticated caller while leaving the canary
 * green. It was caught doing exactly that during mutation testing (S5c), so the
 * gate now has a behavioural canary and the greps are supporting evidence.
 */
const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({ from: () => ({}) }),
}));

import {
  resolveReviewerSelection,
  toSelectableModels,
} from '@/app/api/research/review/_lib/resolveSelection';
import { ReviewRefusal, type ModelCatalogueEntry } from '@/services/research/review';
import { EXP_P1_REVIEWER_PAIR } from '@/services/research/review/templates/expP1Admissibility';
import {
  REVIEW_ACTION_EFFECT,
  REVIEW_RESULT_ACTIONS,
  REVIEW_QUEUE_STATES,
} from '@/services/research/independentReviewStore';

const REPO = join(__dirname, '..');
const read = (p: string) => readFileSync(join(REPO, p), 'utf8');

const PANEL = 'components/composer/IndependentReviewPanel.tsx';
const ROUTE = 'app/api/research/review/route.ts';
const DETAIL_ROUTE = 'app/api/research/review/[reviewId]/route.ts';
const MODELS_ROUTE = 'app/api/research/review/models/route.ts';
const GATE = 'app/api/research/review/_lib/gate.ts';
const SELECTION = 'app/api/research/review/_lib/resolveSelection.ts';
const STORE = 'services/research/independentReviewStore.ts';

const entry = (id: string, family: string | null, over: Partial<ModelCatalogueEntry> = {}): ModelCatalogueEntry => ({
  id,
  family,
  familyEvidence: family ? 'modelSource' : null,
  offline: false,
  deprecationDate: null,
  raw: { id },
  ...over,
});

const CATALOGUE = [
  entry(EXP_P1_REVIEWER_PAIR.R1.modelId, 'meta-llama'),
  entry(EXP_P1_REVIEWER_PAIR.R2.modelId, 'qwen'),
  entry('llama-3.1-8b', 'meta-llama'),
  entry('mystery-model', null),
  entry('retired-model', 'deepseek', { deprecationDate: '2026-01-01' }),
  entry('down-model', 'mistral', { offline: true }),
];
const AT = '2026-07-29T00:00:00.000Z';

// ── 1. The server is the authority on families ──────────────────────────────

describe('the same-family guard is server-side and authoritative', () => {
  it('refuses a same-family pair chosen through the API, whatever the UI showed', () => {
    expect(() =>
      resolveReviewerSelection({
        selection: {
          R1: { reviewerType: 'external-model', modelId: EXP_P1_REVIEWER_PAIR.R1.modelId },
          R2: { reviewerType: 'external-model', modelId: 'llama-3.1-8b' },
        },
        catalogue: CATALOGUE,
        runAtIso: AT,
      }),
    ).toThrowError(/family/i);
  });

  it('a client cannot assert a family — the request shape has no field for one', () => {
    // The strongest form of the guard: not "we ignore what they send" but
    // "there is nowhere to send it". A selection carrying a family is dropped
    // by the resolver's own typing, and the resolved assignment's family comes
    // from the catalogue every time.
    const { assignments } = resolveReviewerSelection({
      selection: {
        R1: { reviewerType: 'external-model', modelId: EXP_P1_REVIEWER_PAIR.R1.modelId, modelFamily: 'pretend' } as never,
        R2: { reviewerType: 'external-model', modelId: EXP_P1_REVIEWER_PAIR.R2.modelId },
      },
      catalogue: CATALOGUE,
      runAtIso: AT,
    });
    expect(assignments[0].modelFamily).toBe('meta-llama');
    expect(assignments[1].modelFamily).toBe('qwen');
    expect(JSON.stringify(assignments)).not.toContain('pretend');
    // Requested AND resolved are both recorded either way.
    expect(assignments[0].requestedModelId).toBe(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(assignments[0].resolvedModelId).toBe(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(assignments[0].modelFamilyEvidence).toBe('modelSource');
  });

  it('accepts the ratified default pair and reports it as NOT an amendment', () => {
    const r = resolveReviewerSelection({ selection: {}, catalogue: CATALOGUE, runAtIso: AT });
    expect(r.assignments[0].requestedModelId).toBe(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(r.assignments[1].requestedModelId).toBe(EXP_P1_REVIEWER_PAIR.R2.modelId);
    expect(r.isPairAmendment).toBe(false);
    expect(r.amendedFrom).toBe(EXP_P1_REVIEWER_PAIR.pairVersion);
  });

  it('a changed slot is visible AS a change, never silently absorbed', () => {
    const r = resolveReviewerSelection({
      selection: { R1: { reviewerType: 'external-model', modelId: 'llama-3.1-8b' } },
      catalogue: CATALOGUE,
      runAtIso: AT,
    });
    expect(r.isPairAmendment).toBe(true);
  });

  it('refuses unknown lineage, an offline model and a deprecated model', () => {
    const bad = (modelId: string) =>
      resolveReviewerSelection({
        selection: { R1: { reviewerType: 'external-model', modelId } },
        catalogue: CATALOGUE,
        runAtIso: AT,
      });
    expect(() => bad('mystery-model')).toThrowError(/lineage/i);
    expect(() => bad('down-model')).toThrowError(/offline/i);
    expect(() => bad('retired-model')).toThrowError(/deprecat/i);
    try {
      bad('not-in-catalogue');
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe('pinned-model-unavailable');
    }
  });

  it('a human slot must be attributable, and two humans cannot be one person', () => {
    expect(() =>
      resolveReviewerSelection({
        selection: { R2: { reviewerType: 'human', humanReviewerRef: '  ' } },
        catalogue: CATALOGUE,
        runAtIso: AT,
      }),
    ).toThrowError(/attributable/i);
    expect(() =>
      resolveReviewerSelection({
        selection: {
          R1: { reviewerType: 'human', humanReviewerRef: 'steward.a' },
          R2: { reviewerType: 'human', humanReviewerRef: 'steward.a' },
        },
        catalogue: CATALOGUE,
        runAtIso: AT,
      }),
    ).toThrowError(/both reviewer slots/i);
  });

  it('the human slot reuses the model-reviewer schema — same rubric and prompt versions', () => {
    const { assignments } = resolveReviewerSelection({
      selection: { R2: { reviewerType: 'human', humanReviewerRef: 'steward.b' } },
      catalogue: CATALOGUE,
      runAtIso: AT,
    });
    expect(assignments[1].reviewerType).toBe('human');
    expect(assignments[1].humanReviewerRole).toBe('independent-review-steward');
    expect(assignments[1].promptVersion).toBe(assignments[0].promptVersion);
    expect(assignments[1].rubricVersion).toBe(assignments[0].rubricVersion);
    // No model lineage is fabricated for a human.
    expect(assignments[1].modelFamily).toBeUndefined();
    expect(assignments[1].resolvedModelId).toBeUndefined();
  });

  it('the route delegates the decision to the shared resolver, not to a local copy', () => {
    const route = read(ROUTE);
    expect(route).toContain('resolveReviewerSelection');
    // The one decision function must not be reimplemented in the route.
    expect(/modelFamily\s*[!=]==?/.test(route)).toBe(false);
  });
});

// ── 2. The UI's disabled set is derived from the server's metadata ──────────

describe("the UI's option list is derived from the server's family metadata", () => {
  it('the catalogue endpoint returns family + selectability per model', () => {
    const models = toSelectableModels(CATALOGUE, AT);
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));
    expect(byId['mystery-model'].selectable).toBe(false);
    expect(byId['mystery-model'].unselectableReason).toMatch(/lineage/i);
    expect(byId['down-model'].selectable).toBe(false);
    expect(byId['retired-model'].selectable).toBe(false);
    expect(byId[EXP_P1_REVIEWER_PAIR.R1.modelId].family).toBe('meta-llama');
    expect(byId[EXP_P1_REVIEWER_PAIR.R1.modelId].selectable).toBe(true);
  });

  it('the panel holds NO model list of its own', () => {
    const panel = read(PANEL);
    // A hand-maintained list in the client is the drift this canary exists for.
    expect(panel).not.toContain(EXP_P1_REVIEWER_PAIR.R1.modelId);
    expect(panel).not.toContain(EXP_P1_REVIEWER_PAIR.R2.modelId);
    expect(/\bmeta-llama\b|\bqwen\b|\bmistral\b/i.test(panel)).toBe(false);
  });

  it("the panel's disabled logic reads the family field the server sent", () => {
    const panel = read(PANEL);
    expect(panel).toContain('/api/research/review/models');
    // familyOf() reads models[] from that response; optionsFor() compares the
    // two slots' families and disables the collision. Both must be present, and
    // the disable must be driven by `m.family`, not by an id pattern.
    expect(panel).toContain('const familyOf');
    expect(panel).toContain('m.family && otherFamily && m.family === otherFamily');
    expect(panel).toContain('!m.selectable');
  });

  it('the panel does not treat its own guard as the control', () => {
    const panel = read(PANEL);
    // It must SAY the server is authoritative — a reader who believes the
    // dropdown is the control will eventually delete the server check as
    // redundant.
    expect(/authoritative|server will refuse|The refusal that matters happens in the API/i.test(panel)).toBe(true);
  });
});

// ── 3. The preview is the package ───────────────────────────────────────────

describe('the redacted preview is the dispatched package, not a projection', () => {
  it('the route returns redactedPreview(pkg) and dispatches the same object', () => {
    const route = read(ROUTE);
    expect(route).toContain('const preview = redactedPreview(plan.pkg);');
    expect(route).toContain('pkg: plan.pkg,');
    // A second projection built for display would look like this; it must not.
    expect(/preview\s*=\s*\{[^}]*subjects:\s*plan\.pkg\.subjects\.map/.test(route)).toBe(false);
  });

  it('the panel renders preview.package and preview.packageHash — no re-derivation', () => {
    const panel = read(PANEL);
    expect(panel).toContain('preview.package');
    expect(panel).toContain('preview.packageHash');
    expect(panel).toContain('hashVerified');
    // The client must never compute a hash of its own to display.
    expect(/createHash|sha256\(/.test(panel)).toBe(false);
  });

  it('the detail route re-verifies the stored package on read', () => {
    expect(read(DETAIL_ROUTE)).toContain('redactedPreview(record.package)');
  });
});

// ── 4. No UI path writes to the corpus ──────────────────────────────────────

describe('accept / revise / defer / reject record a resolution and nothing else', () => {
  it('all four actions exist and each states what it does NOT do', () => {
    expect([...REVIEW_RESULT_ACTIONS]).toEqual(['accept', 'revise', 'defer', 'reject']);
    for (const a of REVIEW_RESULT_ACTIONS) {
      expect(REVIEW_ACTION_EFFECT[a], a).toBeTruthy();
    }
    // `accept` is the one a reader will assume is a write.
    expect(REVIEW_ACTION_EFFECT.accept).toMatch(/does NOT ratify, freeze or admit/i);
    expect(REVIEW_ACTION_EFFECT.accept).toMatch(/separate governed act/i);
  });

  it('no route or store in this surface touches the corpus, Standing, or a freeze', () => {
    const forbidden = [
      /from\(\s*['"`]invariants['"`]/,
      /grantStanding\s*\(/,
      /setStanding\s*\(/,
      /canoniz[ea]\w*\s*\(/i,
      /freeze\w*\s*\(/i,
      /updateLifecycle\s*\(/,
    ];
    for (const f of [ROUTE, DETAIL_ROUTE, MODELS_ROUTE, GATE, SELECTION, STORE, PANEL]) {
      const src = read(f);
      for (const rx of forbidden) {
        expect(rx.test(src), `${f} matched ${rx}`).toBe(false);
      }
    }
  });

  it('the store writes to exactly one table', () => {
    const store = read(STORE);
    const tables = [...store.matchAll(/\.from\((\w+|['"`][\w.]+['"`])\)/g)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(['TABLE']));
    expect(store).toContain("const TABLE = 'research_objects'");
  });

  it('the resolution response states the four negative facts as data', () => {
    const route = read(DETAIL_ROUTE);
    for (const k of ['corpusWritten: false', 'standingGranted: false', 'lifecycleChanged: false', 'assetFrozen: false']) {
      expect(route, k).toContain(k);
    }
  });

  it('a resolution without a stated reason is refused', () => {
    expect(read(DETAIL_ROUTE)).toContain('a governed resolution requires a stated reason');
  });

  it('the queue states are the review\'s, and are not an asset lifecycle', () => {
    expect([...REVIEW_QUEUE_STATES]).toEqual(['planned', 'running', 'completed', 'contested', 'resolved']);
    // None of them is a corpus lifecycle value.
    for (const s of REVIEW_QUEUE_STATES) {
      expect(['proposed', 'canonical', 'superseded', 'deprecated']).not.toContain(s);
    }
  });
});

// ── 5. The gate — denial AND positive reachability ─────────────────────────

describe('the gate, exercised — denials AND positive reachability', () => {
  beforeEach(() => mockGetActivePersona.mockReset());

  const callGate = async (persona: unknown) => {
    mockGetActivePersona.mockResolvedValue(persona);
    const { requireReviewAccess } = await import('@/app/api/research/review/_lib/gate');
    return requireReviewAccess({} as never);
  };

  it('DENIES an unauthenticated caller with 401', async () => {
    const r = await callGate(null);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.response.status).toBe(401);
  });

  it('DENIES an authenticated NON-ADMIN caller with 403', async () => {
    // The mutation this exists for: neutering the admin check leaves every
    // source grep green while admitting every logged-in citizen.
    const r = await callGate({ personaId: 'p-1', cartridgeFlags: { isAdmin: false } });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.response.status).toBe(403);
  });

  it('DENIES a caller with no cartridgeFlags at all', async () => {
    const r = await callGate({ personaId: 'p-1' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.response.status).toBe(403);
  });

  it('ADMITS an admin caller — and attributes them by commitment, not by id', async () => {
    // Positive reachability: a gate canary made only of refusals passes just as
    // happily on a surface nobody can reach.
    const { personaPublicRef } = await import('@/services/identity/personaReferences');
    const r = await callGate({ personaId: 'p-1', cartridgeFlags: { isAdmin: true } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.caller.isAdmin).toBe(true);
    expect(r.caller.callerRef).toBe(personaPublicRef('p-1'));
    expect(r.caller.callerRef).not.toBe('p-1');
    expect(r.caller.admin).toBeTruthy();
  });
});

describe('the Lab surface is gated by the existing research gate', () => {
  it('reuses the SAME resolution as the other research routes — no new gate', () => {
    const gate = read(GATE);
    expect(gate).toMatch(
      /import \{[^}]*\bgetActivePersona\b[^}]*\} from '@\/services\/identity\/getActivePersona'/,
    );
    expect(gate).toContain("persona.cartridgeFlags?.isAdmin");
    // The same check the pre-existing research routes make.
    expect(read('app/api/research/lifecycle/route.ts')).toContain('cartridgeFlags?.isAdmin');
  });

  it('DENIES an unauthenticated caller and a non-admin caller, with distinct statuses', () => {
    const gate = read(GATE);
    expect(gate).toContain("error: 'unauthenticated' }, { status: 401 }");
    expect(gate).toContain("error: 'forbidden' }, { status: 403 }");
  });

  /**
   * Isolate one exported function's body by brace-matching from its opening
   * `{` — good enough for these route files (no template-literal braces
   * inside a route handler body) and precise where a whole-file grep is not:
   * GET and POST in the same file must be checked against DIFFERENT gates
   * since 2026-08-01 (see below), and a whole-file `.indexOf` cannot tell
   * which verb an occurrence belongs to.
   */
  function extractFunctionBody(src: string, signature: string): string {
    const start = src.indexOf(signature);
    if (start === -1) return '';
    // Balance PARENS first — a param destructuring like
    // `ctx: { params: Promise<{ reviewId: string }> }` contains braces of
    // its own, so the function body's `{` is the first one AFTER the
    // parameter list's closing `)`, not the first `{` after the signature.
    const parenStart = src.indexOf('(', start);
    let pDepth = 0;
    let parenEnd = -1;
    for (let i = parenStart; i < src.length; i++) {
      if (src[i] === '(') pDepth++;
      else if (src[i] === ')') {
        pDepth--;
        if (pDepth === 0) {
          parenEnd = i;
          break;
        }
      }
    }
    if (parenEnd === -1) return '';
    const braceStart = src.indexOf('{', parenEnd);
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(braceStart, i + 1);
      }
    }
    return src.slice(braceStart);
  }

  /** Assert `fnBody` awaits `gateFn` as its very first await and returns its refusal. */
  function expectGatesFirst(fnBody: string, gateFn: string, label: string) {
    const gateCall = `await ${gateFn}(req)`;
    expect(fnBody, `${label} does not await ${gateFn}`).toContain(gateCall);
    expect(fnBody, `${label} does not return the gate's refusal`).toContain('if (!gate.ok) return gate.response;');
    const gateAt = fnBody.indexOf(gateCall);
    const firstAwait = fnBody.search(/await (?!requireReviewAccess\(req\)|requireReviewReadAccess\(req\))/);
    expect(gateAt, `${label} does not gate`).toBeGreaterThan(-1);
    expect(firstAwait === -1 || gateAt < firstAwait, `${label} does work before it gates`).toBe(true);
  }

  it('POSITIVE REACHABILITY — every route admits an authorized caller before doing any work', () => {
    // Composed Liveness corollary 6: a gate canary that only ever asserts
    // refusals passes just as happily on a surface nobody can reach.
    //
    // TWO gates exist on purpose since 2026-08-01 (SPEC-IRL-WORKSPACE-001 §8,
    // the Validation Programme's reviewer-facing Crystal Review stage):
    // `requireReviewAccess` (admin-only — governs New Review's model
    // catalogue and every WRITE: creating/running a review, and the
    // accept/revise/defer/reject governed resolution) and
    // `requireReviewReadAccess` (admin OR a scoped reviewer grant — governs
    // ONLY the two READ paths: the queue list and one review's detail). This
    // is the render/authority split `researchWorkspaceRoles.ts`'s own header
    // describes, not a weakening of the original single-gate surface: no
    // route gained a WRITE path a reviewer can reach, and every route still
    // gates before doing any work.
    expect(new Set([ROUTE, DETAIL_ROUTE, MODELS_ROUTE]).size).toBe(3);

    const modelsSrc = read(MODELS_ROUTE);
    expectGatesFirst(extractFunctionBody(modelsSrc, 'export async function GET'), 'requireReviewAccess', `${MODELS_ROUTE} GET`);

    const listSrc = read(ROUTE);
    expectGatesFirst(extractFunctionBody(listSrc, 'export async function GET'), 'requireReviewReadAccess', `${ROUTE} GET`);
    expectGatesFirst(extractFunctionBody(listSrc, 'export async function POST'), 'requireReviewAccess', `${ROUTE} POST`);

    const detailSrc = read(DETAIL_ROUTE);
    expectGatesFirst(extractFunctionBody(detailSrc, 'export async function GET'), 'requireReviewReadAccess', `${DETAIL_ROUTE} GET`);
    expectGatesFirst(extractFunctionBody(detailSrc, 'export async function POST'), 'requireReviewAccess', `${DETAIL_ROUTE} POST`);

    // The governed-resolution POST and the review-creation POST are the
    // ONLY call sites of the strict admin-only gate on these two routes —
    // a reviewer-readable path calling it would be the WIDENING this canary
    // exists to catch (there is none: each route calls it exactly once, on
    // POST only).
    expect((listSrc.match(/await requireReviewAccess\(req\)/g) ?? []).length).toBe(1);
    expect((detailSrc.match(/await requireReviewAccess\(req\)/g) ?? []).length).toBe(1);
  });

  it('the reviewer-read gate never authorizes a write — it is a distinct, narrower function', () => {
    const gate = read(GATE);
    const readFn = extractFunctionBody(gate, 'export async function requireReviewReadAccess');
    expect(readFn).not.toBe('');
    // The read gate must never itself call the write-gate's admin-only
    // early-return pattern reused for a write path, and must never appear
    // inside a POST handler anywhere in this surface.
    for (const r of [ROUTE, DETAIL_ROUTE, MODELS_ROUTE]) {
      const postBody = extractFunctionBody(read(r), 'export async function POST');
      expect(postBody, `${r} POST must never accept a reviewer-read grant`).not.toContain('requireReviewReadAccess');
    }
  });

  it('attributes the caller by COMMITMENT, never by a raw persona id', () => {
    const gate = read(GATE);
    expect(gate).toContain('personaPublicRef(persona.personaId)');
    expect(gate).toContain('callerRef');
    for (const f of [ROUTE, DETAIL_ROUTE, MODELS_ROUTE]) {
      // No route may echo a raw persona id into a response or a record.
      expect(/personaId/.test(read(f)), `${f} references a raw personaId`).toBe(false);
    }
  });
});

// ── 6. House style + transport ─────────────────────────────────────────────

describe('the surface follows the house rules', () => {
  it('uses slate hairlines only — no white borders anywhere', () => {
    const panel = read(PANEL);
    expect(/border-white\//.test(panel), 'white hairline border').toBe(false);
    expect(/rgba\(255,\s*255,\s*255/.test(panel), 'white rgba hairline').toBe(false);
    expect(panel).toContain('border-slate-800');
    expect(panel).toContain('bg-slate-900/40');
  });

  it('reaches every spine endpoint through personaFetch and nothing else', () => {
    const panel = read(PANEL);
    expect(panel).toContain('import { personaFetch } from "@/utils/personaSpine"');
    // Strip the import line, then assert no bare fetch( call remains.
    const body = panel.split('\n').filter((l) => !l.includes('personaSpine')).join('\n');
    expect(/(?<!persona)[^.\w]fetch\s*\(/.test(body), 'a raw fetch( call').toBe(false);
    expect(/authedFetchHeaders/.test(panel)).toBe(false);
  });

  it('is mounted inside the experiments navigator, not as a separate destination', () => {
    const lab = read('components/composer/InvariantExperimentLab.tsx');
    expect(lab).toContain('import IndependentReviewPanel from "./IndependentReviewPanel"');
    expect(lab).toContain('id: "independent-review"');
    expect(lab).toContain('{tab === "independent-review" && <IndependentReviewPanel />}');
  });

  it('offers the three views SPEC §12 allows for the review workflow itself', () => {
    const panel = read(PANEL);
    expect(panel).toContain('"New Review"');
    expect(panel).toContain('"Review Queue"');
    expect(panel).toContain('"Review Result"');
  });

  // CFS-054 — a FOURTH view was added to this same tab (not a fourth view of
  // the Independent Review workflow itself): Crystal vP1 renders the Crystal
  // Readiness Report, Crystal Statistics, and Freeze Recommendation, plus a
  // freeze-ceremony PACKAGE PREVIEW. It reuses this tab's location (the
  // operator's "review tab") because crystal readiness is preparation for an
  // experiment's review, exactly like SPEC §12's own placement rationale for
  // Independent Review — but it is additive infrastructure, not a widening of
  // the three-view contract above. It must never gain a one-click freeze
  // action; see the 'no route or store in this surface touches ... a freeze'
  // canary above, which this view's source must also keep passing.
  it('adds Crystal vP1 as a fourth, additive view — with no freeze action anywhere in it', () => {
    const panel = read(PANEL);
    expect(panel).toContain('"Crystal vP1"');
    expect(panel).toContain('useState<"new" | "queue" | "result" | "crystal">');
    expect(panel).toMatch(/never freezes anything/i);
    expect(panel).not.toMatch(/>\s*Freeze\s*<\/button>/i);
  });
});
