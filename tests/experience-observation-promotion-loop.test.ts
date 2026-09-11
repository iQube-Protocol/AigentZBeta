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

  it("fires the re-evaluation trigger for ALL THREE stages (2026-09-01 follow-up) — each now backed by real evidence", () => {
    const fnStart = src.indexOf('const handlePrimaryCta = useCallback(');
    const fnEnd = src.indexOf('}, [observe, stageId, journeyId, stageKey', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/selectStage\(nextStageId, 'stage-satisfaction-evidence-change'\);/);
  });

  it('the promotion write is fire-and-forget — never blocks navigation (selectStage always runs)', () => {
    const fnStart = src.indexOf('const handlePrimaryCta = useCallback(');
    const fnEnd = src.indexOf('}, [observe, stageId, journeyId, stageKey', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/observeExperienceInteraction\(/);
    expect(fn).toMatch(/selectStage\(nextStageId,/);
    // No `await`/`.then` gating selectStage on the observation call.
    expect(fn).not.toMatch(/await observeExperienceInteraction/);
  });
});

describe('LEARN — stronger, kind-discriminated evidence (2026-09-01 follow-up)', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));

  it('a page render or single click can never satisfy LEARN: Continue is gated on ALL THREE concept cards, not on the generic Continue click', () => {
    const fnStart = src.indexOf("const primaryCtaDisabled =");
    const fnEnd = src.indexOf(';', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/stageKey === 'learn' && !learnSatisfied/);
  });

  it("learnSatisfied requires EVERY LEARN_CONCEPTS id acknowledged, not just one", () => {
    expect(src).toMatch(/LEARN_CONCEPTS\.every\(\(c\) => acknowledgedConcepts\.has\(c\.id\)\)/);
  });

  it('each concept acknowledgment promotes with a distinct capabilityId and the LEARN interactionKind — never the bare DISCOVER-style presence-only write', () => {
    const fnStart = src.indexOf('const handleConceptAcknowledge = useCallback(');
    const fnEnd = src.indexOf('[observe, stageId, journeyId, personaId],\n  );', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/LEARN_INTERACTION_KIND,/);
    expect(fn).toMatch(/conceptId,/);
  });

  it("LEARN_CONCEPTS declares exactly the three-axis Advisor/Architect/Runtime ids", () => {
    expect(src).toMatch(/id:\s*'advisor'/);
    expect(src).toMatch(/id:\s*'architect'/);
    expect(src).toMatch(/id:\s*'runtime'/);
  });
});

describe('EXPLORE — real MoneyPenny capability interaction, not a bare Continue (2026-09-01 follow-up)', () => {
  const src = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));

  it('renders the REAL serviceCatalog as individually clickable capability chips, never a plain joined display string', () => {
    expect(src).toMatch(/services\.map\(\(service\) =>/);
    expect(src).toMatch(/onClick=\{\(\) => handleCapabilityInteract\(service\.serviceId\)\}/);
    // The old plain `.join(' · ')` highlightLine rendering is gone.
    expect(src).not.toMatch(/\.join\(' · '\)/);
  });

  it('Continue is gated on at least one real capability interacted with', () => {
    expect(src).toMatch(/const exploreSatisfied = interactedCapabilities\.size > 0;/);
    const fnStart = src.indexOf('const primaryCtaDisabled =');
    const fnEnd = src.indexOf(';', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/stageKey === 'explore' && !exploreSatisfied/);
  });

  it('each capability interaction promotes with the REAL FinancialServiceDefinition.serviceId as capabilityId and the EXPLORE interactionKind', () => {
    const fnStart = src.indexOf('const handleCapabilityInteract = useCallback(');
    const fnEnd = src.indexOf('[observe, stageId, journeyId, personaId],\n  );', fnStart);
    const fn = src.slice(fnStart, fnEnd);
    expect(fn).toMatch(/EXPLORE_INTERACTION_KIND,/);
    expect(fn).toMatch(/capabilityId,/);
  });
});

describe.each([
  ['KNYTS Bridge', 'app/api/journey/knyts-bridge/state/route.ts', 'services/journey/knytsBridgeCrossingJourney.ts', 'KNYTS_BRIDGE_CROSSING_JOURNEY'],
  ['Constitutional Internet Bridge', 'app/api/journey/constitutional-internet-bridge/state/route.ts', 'services/journey/constitutionalInternetBridgeJourney.ts', 'CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY'],
])('%s — fs-discover/fs-learn/fs-explore all read real evidence, never a stub', (_label, routePath, journeyPath, journeyConst) => {
  it('state route imports the three financialSovereigntyEvidence readers and reads them into stages[]', () => {
    const src = stripComments(readSource(routePath));
    expect(src).toMatch(
      /import \{ hasDiscoveredFinancialSovereignty, hasLearnedFinancialSovereignty, hasExploredFinancialSovereignty, hasPreparedFinancialProfile \} from '@\/services\/journey\/financialSovereigntyEvidence'/,
    );
    expect(src).toContain('hasDiscoveredFinancialSovereignty(persona?.personaId ?? null,');
    expect(src).toContain('hasLearnedFinancialSovereignty(persona?.personaId ?? null,');
    expect(src).toContain('hasExploredFinancialSovereignty(persona?.personaId ?? null,');
    expect(src).toContain(`${journeyConst}.id`);
    // B1 (2026-09-02): fs-prepare's completion is now real, sourced from
    // the persona's FinancialProfileQube — never a click/navigation event.
    expect(src).toContain('hasPreparedFinancialProfile(persona?.personaId ?? null)');
    expect(src).toMatch(/'fs-discover':\s*\{\s*discoverExperienceObserved\s*\}/);
    expect(src).toMatch(/'fs-learn':\s*\{\s*learnExperienceQualified\s*\}/);
    expect(src).toMatch(/'fs-explore':\s*\{\s*exploreCapabilityInteracted\s*\}/);
  });

  it("journey definition's fs-discover/fs-learn/fs-explore stages each require their own real evidence — never gate-less", () => {
    const src = stripComments(readSource(journeyPath));
    const discoverStart = src.indexOf(`id: 'fs-discover'`);
    const learnStart = src.indexOf(`id: 'fs-learn'`, discoverStart);
    const exploreStart = src.indexOf(`id: 'fs-explore'`, learnStart);
    const prepareStart = src.indexOf(`id: 'fs-prepare'`, exploreStart);
    expect(src.slice(discoverStart, learnStart)).toMatch(/completionEvidence:\s*\['discoverExperienceObserved'\]/);
    expect(src.slice(learnStart, exploreStart)).toMatch(/completionEvidence:\s*\['learnExperienceQualified'\]/);
    expect(src.slice(exploreStart, prepareStart)).toMatch(/completionEvidence:\s*\['exploreCapabilityInteracted'\]/);
  });
});

describe('hasQualifyingExperienceInteraction — the STRONGER, kind-discriminated read (2026-09-01 follow-up)', () => {
  const src = stripComments(readSource('services/journey/experienceObservationPromotion.ts'));

  it('is exported and filters by BOTH experienceRef AND interactionKind, never presence alone', () => {
    expect(src).toMatch(/export async function hasQualifyingExperienceInteraction\(/);
    expect(src).toMatch(/actionInput\?\.experienceRef !== experienceRef\) continue/);
    expect(src).toMatch(/actionInput\?\.interactionKind !== interactionKind\) continue/);
  });

  it('requires EVERY id in requiredCapabilityIds to have been observed — a single matching receipt is not enough for a multi-id requirement', () => {
    expect(src).toMatch(/requiredCapabilityIds\.every\(\(id\) => observedCapabilityIds\.has\(id\)\)/);
  });

  it("the '*' wildcard means 'any one real capability id', never 'any receipt regardless of kind'", () => {
    expect(src).toMatch(/requiredCapabilityIds\.length === 1 && requiredCapabilityIds\[0\] === '\*'/);
    expect(src).toMatch(/observedCapabilityIds\.size > 0/);
  });

  it('is a pure read: same discipline as hasObservedExperienceInteraction — no completion write, no CTP import', () => {
    expect(src).not.toMatch(/resolveJourneyState/);
    expect(src).not.toMatch(/from ['"]@\/services\/ctp\//);
  });
});

describe('financialSovereigntyEvidence.ts — single source of truth for the FS evidence contract', () => {
  const src = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));

  it('exports the three FS evidence readers, all thin wrappers over the generic promotion adapter', () => {
    expect(src).toMatch(/export function hasDiscoveredFinancialSovereignty\(/);
    expect(src).toMatch(/export function hasLearnedFinancialSovereignty\(/);
    expect(src).toMatch(/export function hasExploredFinancialSovereignty\(/);
    expect(src).toMatch(/from '@\/services\/journey\/experienceObservationPromotion'/);
  });

  it("LEARN requires the FS_LEARN_CONCEPT_IDS set under FS_LEARN_INTERACTION_KIND — not the wildcard", () => {
    expect(src).toMatch(/FS_LEARN_CONCEPT_IDS = \['advisor', 'architect', 'runtime'\] as const/);
    expect(src).toMatch(/hasQualifyingExperienceInteraction\(personaId, journeyId, 'fs-learn', FS_LEARN_INTERACTION_KIND, FS_LEARN_CONCEPT_IDS\)/);
  });

  it("EXPLORE requires only the wildcard under FS_EXPLORE_INTERACTION_KIND — any one real capability, not a fixed set", () => {
    expect(src).toMatch(/hasQualifyingExperienceInteraction\(personaId, journeyId, 'fs-explore', FS_EXPLORE_INTERACTION_KIND, \['\*'\]\)/);
  });

  it('owns no persistence of its own — never imports Supabase/receipt-writing directly', () => {
    expect(src).not.toMatch(/createActivityReceipt/);
    expect(src).not.toMatch(/getSupabaseServer/);
  });
});

describe('Drift guard: the client component\'s LEARN/EXPLORE literals match the server-side shared module (inv.engineering.036/037)', () => {
  // FinancialSovereigntyIntroStage.tsx is 'use client' and CANNOT import
  // financialSovereigntyEvidence.ts (it transitively touches Supabase — see
  // the client-bundle-safety invariant tested elsewhere in this repo), so
  // the concept ids and interactionKind literals are necessarily duplicated
  // by hand in two places. This test is the parity canary that stands in
  // for a real shared import — it must fail the build the moment either
  // side drifts from the other.
  const componentSrc = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));
  const sharedSrc = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));

  it('LEARN_INTERACTION_KIND / EXPLORE_INTERACTION_KIND literal strings match FS_LEARN_INTERACTION_KIND / FS_EXPLORE_INTERACTION_KIND', () => {
    expect(componentSrc).toMatch(/const LEARN_INTERACTION_KIND = 'learn-concept-acknowledged';/);
    expect(sharedSrc).toMatch(/FS_LEARN_INTERACTION_KIND = 'learn-concept-acknowledged';/);
    expect(componentSrc).toMatch(/const EXPLORE_INTERACTION_KIND = 'moneypenny-capability-interacted';/);
    expect(sharedSrc).toMatch(/FS_EXPLORE_INTERACTION_KIND = 'moneypenny-capability-interacted';/);
  });

  it('LEARN_CONCEPTS ids match FS_LEARN_CONCEPT_IDS exactly (same three ids, same order)', () => {
    const ids = [...componentSrc.matchAll(/id:\s*'(advisor|architect|runtime)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['advisor', 'architect', 'runtime']);
    expect(sharedSrc).toMatch(/FS_LEARN_CONCEPT_IDS = \['advisor', 'architect', 'runtime'\] as const/);
  });
});

describe('Required negative-test invariants (AEE-XP-001 §10/XP-6 follow-up acceptance target)', () => {
  it('an unrelated experience_interaction_observed receipt (different experienceRef) does not satisfy a stage — experienceRef equality is exact-match, not prefix/substring', () => {
    const src = stripComments(readSource('services/journey/experienceObservationPromotion.ts'));
    expect(src).toMatch(/actionInput\?\.experienceRef !== experienceRef\) continue/);
    expect(src).not.toMatch(/\.startsWith\(experienceRef\)|\.includes\(experienceRef\)/);
  });

  it('experienceRef is built as `${journeyId}:${stageId}` — a KNYTS receipt (journeyId=knyts-bridge-crossing) can never match a CI experienceRef (journeyId=constitutional-internet-bridge) unless explicitly re-keyed as inheritable evidence, which this codebase does not do', () => {
    const src = stripComments(readSource('services/journey/experienceObservationPromotion.ts'));
    expect(src).toMatch(/return `\$\{journeyId\}:\$\{stageId\}`;/);
    // No cross-journey inheritance/aliasing logic exists in the reader.
    expect(src).not.toMatch(/knyts-bridge-crossing.*constitutional-internet-bridge|constitutional-internet-bridge.*knyts-bridge-crossing/s);
  });

  it('a generic navigation/observation event with no interactionKind cannot satisfy LEARN or EXPLORE — only hasObservedExperienceInteraction (DISCOVER-only) accepts a bare presence check', () => {
    const src = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));
    expect(src).toMatch(/hasDiscoveredFinancialSovereignty[\s\S]*?hasObservedExperienceInteraction\(personaId, journeyId, 'fs-discover'\)/);
    expect(src).toMatch(/hasLearnedFinancialSovereignty[\s\S]*?hasQualifyingExperienceInteraction\(/);
    expect(src).toMatch(/hasExploredFinancialSovereignty[\s\S]*?hasQualifyingExperienceInteraction\(/);
  });

  it('no client code in FinancialSovereigntyIntroStage.tsx or financialSovereigntyEvidence.ts sets a stage COMPLETE directly', () => {
    const componentSrc = stripComments(readSource('components/journey/FinancialSovereigntyIntroStage.tsx'));
    const sharedSrc = stripComments(readSource('services/journey/financialSovereigntyEvidence.ts'));
    for (const src of [componentSrc, sharedSrc]) {
      expect(src).not.toMatch(/resolveJourneyState/);
      expect(src).not.toMatch(/JourneyStageStatus\.COMPLETE|status:\s*'complete'/i);
    }
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
