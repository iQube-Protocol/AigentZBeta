/**
 * B2 Prepare (2026-09-02): "the user reviews or establishes their
 * financial profile through the existing manual/upload workflow,
 * understands its limitations, and continues to intermediary Operate.
 * Reuse the same profile and review evidence. The legacy agent-candidate-
 * selection step is an implementation baseline to replace or relocate —
 * it does not satisfy the agreed Prepare experience."
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const STAGE_SRC = 'components/journey/FinancialSovereigntyPrepareCrossStage.tsx';

describe('The legacy agent-candidate-selection step is retired from Prepare\'s primary flow', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('no longer imports listRegistrableAgents', () => {
    expect(src).not.toMatch(/listRegistrableAgents/);
  });

  it('Prepare mode no longer shows "Choose an agent candidate"', () => {
    expect(src).not.toMatch(/Choose an agent candidate to bring with you/);
  });
});

describe('Prepare reuses the SAME canonical financial-profile read MoneyPenny itself uses — never a copied bridge snapshot (SC-03)', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('imports fetchFinancialProfileSummary from the shared module, not a re-implemented fetch', () => {
    expect(src).toMatch(/import \{ fetchFinancialProfileSummary, markFinancialProfileReviewed, type FinancialProfileSummary \} from '@\/services\/moneypenny\/financialProfileSummary'/);
  });

  it('MoneyPennyCopilotWorkspace.tsx uses the SAME shared module — one source of truth, not two fetches', () => {
    const workspaceSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));
    expect(workspaceSrc).toMatch(/from '@\/services\/moneypenny\/financialProfileSummary'/);
    expect(workspaceSrc).not.toMatch(/personaFetch\('\/api\/moneypenny\/financial-profile'/);
  });
});

describe('Prepare shows the review evidence and its limitations, honestly', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('renders an honest "no profile yet" state, not a fabricated one', () => {
    expect(src).toMatch(/No financial profile reviewed yet\./);
  });

  it('surfaces the manual-entry limitation explicitly when that is the input source', () => {
    expect(src).toMatch(/summary\?\.inputSource === 'manual_entry'/);
    expect(src).toMatch(/Limitation: a manually-entered profile may not reflect your full financial picture\./);
  });

  it('shows coverage (computedFromMonths) when present — the same coverage signal the profile panel itself would show', () => {
    expect(src).toMatch(/summary\?\.computedFromMonths/);
  });
});

describe('Prepare opens the REAL canonical financial-profile panel IN PLACE, not a bridge-local reimplementation and not a navigate-away (2026-09-03 experience-coherence correction)', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('embeds MoneyPennyBridgeEmbed rather than navigating away with window.location.assign', () => {
    expect(src).toMatch(/import \{ MoneyPennyBridgeEmbed \} from '@\/components\/journey\/MoneyPennyBridgeEmbed'/);
    expect(src).not.toMatch(/window\.location\.assign/);
  });

  it('the embed targets the My Money native tab (whose own default panel is financial-profile), threading personaId through', () => {
    expect(src).toMatch(/<MoneyPennyBridgeEmbed tab="my-money" personaId=\{personaId\}/);
  });

  it('opening the embed is a local state toggle, not a page navigation — "Continue to Operate" and a back affordance both stay reachable while it is open', () => {
    expect(src).toMatch(/const \[embedOpen, setEmbedOpen\] = useState\(false\);/);
    expect(src).toMatch(/const openFinancialProfile = \(\) => \{\s*setEmbedOpen\(true\);\s*\};/);
    expect(src).toMatch(/← Back to Prepare summary/);
  });
});

describe('Prepare continues to intermediary Operate — reusing the SAME journey-stage mechanism, no new one invented', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('Continue to Operate calls the existing selectStage(nextStageId) mechanism this file already used for prepare -> cross', () => {
    const fnBody = src.match(/const handleContinueToOperate = \(\) => \{([\s\S]*?)\};/)?.[1] ?? '';
    expect(fnBody).toMatch(/if \(nextStageId\) selectStage\(nextStageId\);/);
  });

  it('nextStageId was ALREADY wired to fs-operate in both journey definitions — no journey-graph change was needed', () => {
    const ciJourney = stripComments(readSource('services/journey/constitutionalInternetBridgeJourney.ts'));
    const knytsJourney = stripComments(readSource('services/journey/knytsBridgeCrossingJourney.ts'));
    // fs-prepare's own nextStageId already pointed at fs-operate before this pass.
    expect(ciJourney).toMatch(/id: 'fs-prepare',[\s\S]{0,900}nextStageId: 'fs-operate',/);
    expect(knytsJourney).toMatch(/nextStageId: 'fs-prepare',/); // fs-explore -> fs-prepare, confirming the segment order is intact
  });

  it('both bridge pages now thread personaId into the prepare surface props, matching the operate surface\'s own convention', () => {
    const ciPage = stripComments(readSource('app/bridge/ci/page.tsx'));
    const knytsPage = stripComments(readSource('app/bridge/knyts/page.tsx'));
    expect(ciPage).toMatch(/mode: 'prepare', accent: 'indigo', sourceJourneyId: 'constitutional-internet-bridge', sourceStageId: 'fs-prepare', nextStageId: 'fs-operate', personaId \};/);
    expect(knytsPage).toMatch(/mode: 'prepare', accent: 'amber', sourceJourneyId: 'knyts-bridge-crossing', sourceStageId: 'fs-prepare', nextStageId: 'fs-operate', personaId \};/);
  });
});

describe('CROSS mode is untouched and gracefully handles the now-always-absent candidate', () => {
  const src = stripComments(readSource(STAGE_SRC));

  it('still reads the session-stored candidate and still has its existing no-candidate copy', () => {
    expect(src).toMatch(/window\.sessionStorage\.getItem\(sessionKey\)/);
    expect(src).toMatch(/You can still cross without a chosen candidate — the Financial Services Bridge will let you pick one there\./);
  });

  it('the Cross handoff still builds with agentCandidateRef: selected ?? undefined — unchanged contract', () => {
    expect(src).toMatch(/agentCandidateRef: selected \?\? undefined,/);
  });
});
