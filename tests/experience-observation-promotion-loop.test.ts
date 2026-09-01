/**
 * AEE-XP-001 §10/XP-6 (2026-09-01) — the generic experience-evidence loop's
 * first live proof (Financial Sovereignty DISCOVER). Source-level wiring
 * proof, the same established pattern as
 * tests/journey-copilot-assigned-companion-wiring.test.ts and
 * tests/journey-branch-immediate-reevaluation.test.ts, for a loop that
 * would otherwise need a live Supabase instance to exercise behaviorally:
 *
 *   FinancialSovereigntyIntroStage (DISCOVER "Continue")
 *     -> DCIR observe(aigentMeCapsuleEngagedEvent) [session-only, non-durable]
 *     -> personaFetch POST /api/journey/experience-observation
 *     -> promoteExperienceObservation -> activity_receipts
 *          (actionType: 'experience_interaction_observed',
 *           actionInput.experienceRef = `${journeyId}:fs-discover`)
 *     -> journey:select-stage { trigger: 'stage-satisfaction-evidence-change' }
 *     -> JourneyRunSurface's existing listener -> refresh()
 *     -> KNYTS/CI state route -> hasObservedExperienceInteraction()
 *          -> platformState.stages['fs-discover'].discoverExperienceObserved
 *     -> resolveJourneyState() -> fs-discover COMPLETE
 *     -> computeJourneyAeeOutcome() re-evaluates with the new state
 *
 * Also pins the seven required invariants (AEE-XP-001 §10/XP-6 acceptance
 * target) at the source level.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('ActivityActionType declares the ONE generic experience-observation literal', () => {
  const src = stripComments(readSource('services/receipts/activityReceiptService.ts'));

  it("declares 'experience_interaction_observed' in the ActivityActionType union", () => {
    expect(src).toMatch(/\|\s*'experience_interaction_observed'/);
  });

  it('does NOT invent a stage-specific literal (e.g. fs_discover_acknowledged) — explicitly rejected', () => {
    expect(src).not.toMatch(/fs_discover_acknowledged|fs_learn_acknowledged|fs_explore_acknowledged/);
  });
});

describe('Invariant: DCIR never becomes durable constitutional truth on its own — stays out of ANCHORABLE_ACTION_TYPES', () => {
  const src = stripComments(readSource('services/dvn/activityReceiptDvnPipeline.ts'));

  it("'experience_interaction_observed' is NOT in ANCHORABLE_ACTION_TYPES — low-value/observed, stays local", () => {
    const start = src.indexOf('ANCHORABLE_ACTION_TYPES = new Set');
    const end = src.indexOf(']);', start);
    const block = src.slice(start, end);
    expect(block).not.toMatch(/'experience_interaction_observed'/);
  });
});

describe('services/journey/experienceObservationPromotion.ts — the generic promotion adapter', () => {
  const src = stripComments(readSource('services/journey/experienceObservationPromotion.ts'));

  it('exports promoteExperienceObservation, hasObservedExperienceInteraction, buildExperienceRef', () => {
    expect(src).toMatch(/export async function promoteExperienceObservation\(/);
    expect(src).toMatch(/export async function hasObservedExperienceInteraction\(/);
    expect(src).toMatch(/export function buildExperienceRef\(/);
  });

  it('builds experienceRef generically as `${journeyId}:${stageId}` — never a hardcoded FS string', () => {
    expect(src).toMatch(/return `\$\{journeyId\}:\$\{stageId\}`;/);
  });

  it("tags every promoted observation with provenance: 'observed' — never silently promoted to 'declared'", () => {
    expect(src).toMatch(/provenance:\s*'observed'/);
    expect(src).not.toMatch(/provenance:\s*'declared'/);
  });

  it('Invariant: never imports resolveJourneyState or writes Journey completion — a pure evidence writer/reader', () => {
    expect(src).not.toMatch(/resolveJourneyState/);
    expect(src).not.toMatch(/JourneyStageStatus\.COMPLETE|status:\s*'complete'/i);
  });

  it('Invariant: never imports CTP — this is not a constitutional/consequential transition', () => {
    expect(src).not.toMatch(/from ['"]@\/services\/ctp\//);
  });
});

describe('POST /api/journey/experience-observation — the ONE generic HTTP boundary', () => {
  const src = stripComments(readSource('app/api/journey/experience-observation/route.ts'));

  it('resolves the caller through getActivePersona and refuses without a persona', () => {
    expect(src).toMatch(/import \{ getActivePersona \} from '@\/services\/identity\/getActivePersona'/);
    expect(src).toMatch(/if \(!persona\?\.personaId\)/);
  });

  it('attributes the write to the CALLER\'s own persona.personaId, never a client-supplied personaId', () => {
    expect(src).toMatch(/personaId:\s*persona\.personaId/);
    expect(src).not.toMatch(/personaId:\s*body\??\.personaId/);
  });

  it('delegates to promoteExperienceObservation — no parallel write path', () => {
    expect(src).toMatch(/import \{ promoteExperienceObservation \} from '@\/services\/journey\/experienceObservationPromotion'/);
    expect(src).toMatch(/await promoteExperienceObservation\(/);
  });
});

describe('FinancialSovereigntyIntroStage.tsx — DCIR + promotion + re-evaluation wiring', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));

  it('uses personaFetch, never raw fetch, for the spine-resolved observation endpoint (CLAUDE.md)', () => {
    expect(src).toMatch(/import \{ personaFetch \} from '@\/utils\/personaSpine'/);
    expect(src).toMatch(/personaFetch\('\/api\/journey\/experience-observation'/);
    expect(src).not.toMatch(/(?<!persona)\bfetch\(\s*['"`]\/api\/journey\/experience-observation/);
  });

  it('reuses the EXISTING generic DCIR constructor — no new DCIR event kind invented', () => {
    expect(src).toMatch(/import \{ aigentMeCapsuleEngagedEvent \} from '@\/services\/dcir\/eventStream'/);
    expect(src).toMatch(/observe\(aigentMeCapsuleEngagedEvent\(stageId\)\)/);
  });

  it("fires the re-evaluation trigger ONLY for 'discover' — LEARN/EXPLORE are deliberately unwired this pass", () => {
    expect(src).toMatch(/stageKey === 'discover' \? 'stage-satisfaction-evidence-change' : undefined/);
  });

  it('the promotion write is fire-and-forget — never blocks navigation (selectStage always runs)', () => {
    const fnStart = src.indexOf('const handlePrimaryCta = useCallback(');
    const fnEnd = src.indexOf('}, [observe,');
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/observeExperienceInteraction\(/);
    expect(fn).toMatch(/selectStage\(nextStageId, trigger\);/);
    // No `await`/`.then` gating selectStage on the observation call.
    expect(fn).not.toMatch(/await observeExperienceInteraction/);
  });
});

describe.each([
  ['KNYTS Bridge', 'app/api/journey/knyts-bridge/state/route.ts', 'services/journey/knytsBridgeCrossingJourney.ts', 'KNYTS_BRIDGE_CROSSING_JOURNEY'],
  ['Constitutional Internet Bridge', 'app/api/journey/constitutional-internet-bridge/state/route.ts', 'services/journey/constitutionalInternetBridgeJourney.ts', 'CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY'],
])('%s — fs-discover reads real evidence, never a stub', (_label, routePath, journeyPath, journeyConst) => {
  it('state route imports hasObservedExperienceInteraction and reads it into stages[\'fs-discover\']', () => {
    const src = stripComments(readSource(routePath));
    expect(src).toMatch(/import \{ hasObservedExperienceInteraction \} from '@\/services\/journey\/experienceObservationPromotion'/);
    expect(src).toContain('const discoverExperienceObserved = await hasObservedExperienceInteraction(');
    expect(src).toContain('persona?.personaId ?? null,');
    expect(src).toContain(`${journeyConst}.id,`);
    expect(src).toContain("'fs-discover',");
    expect(src).toMatch(/'fs-discover':\s*\{\s*discoverExperienceObserved\s*\}/);
  });

  it("journey definition's fs-discover stage requires discoverExperienceObserved to COMPLETE — never gate-less", () => {
    const src = stripComments(readSource(journeyPath));
    const stageStart = src.indexOf(`id: 'fs-discover'`);
    const stageEnd = src.indexOf(`id: 'fs-learn'`, stageStart);
    const stage = src.slice(stageStart, stageEnd);
    expect(stage).toMatch(/completionEvidence:\s*\['discoverExperienceObserved'\]/);
  });
});

describe('Invariant: navigation alone does not establish competence', () => {
  it('resolveJourneyState only flips COMPLETE from completionEvidence presence, never from a stage merely being visited', () => {
    const src = stripComments(readSource('services/journey/resolveJourneyState.ts'));
    // Same mechanism already governing every other evidenced stage in the
    // codebase (passport, remix, stand, personify, ...) — fs-discover adds
    // no special case to this function at all.
    expect(src).toMatch(/evidencePresence\(stage\.completionEvidence, evidence\)/);
  });
});

describe('Invariant: AEE never writes Journey completion — orchestrator stays a pure reader', () => {
  it('journeyAeeOrchestrator.ts has no Supabase/receipt-writing import', () => {
    const src = stripComments(readSource('services/adaptive/journeyAeeOrchestrator.ts'));
    expect(src).not.toMatch(/createActivityReceipt|promoteExperienceObservation/);
  });
});
