/**
 * financialSovereigntyContent — CFS Bridge Content Pack v1 integration
 * (2026-09-03). The static half of the CFS Discover/Learn/Explore/Prepare/
 * Operate/Cross content: topics, understanding-check questions, and the
 * primary-plate asset metadata (alt/caption/title) for all six stages,
 * shared verbatim by both bridges with a CI/KNYTS contextual line layered
 * on top — same division of labour as the View stage (this module is
 * static like CI_BRIDGE_VIEW_CONTENT; the admin-overridable half —
 * headline/shortCopy/infographicUrl — lives in knyts_bridge_editorial_config
 * via fsBridgeSectionKey(), never duplicated here).
 *
 * Source: CFS_Bridge_Content_Pack_v1 (content/bridge-pages.json,
 * content/artwork-manifest.json, content/understanding-checks.json,
 * content/exercises.json) — an editorial handoff, reconciled against real
 * source per CLAUDE_CFS_Content_Wiring_Brief.md before being wired into any
 * component. Card copy is folded into `topics` (one topic per card, per the
 * pack's own "cardRendering" instruction: "Reusable editorial copy; merge
 * into existing matching components... not three mandatory extra cards per
 * page") rather than rendered as a fourth stacked card row.
 *
 * Copy corrections applied per the brief's "Preserve functions, correct
 * misleading copy" section — see the inline notes on `discover`/`learn`
 * below; this module is the ONE place those corrected strings live now,
 * replacing the versions still hardcoded in FinancialSovereigntyIntroStage's
 * own COPY constant (which this module supersedes for eyebrow/paragraph
 * text — the component still owns its own live actions, evidence gates and
 * LEARN_CONCEPTS/service-catalog rendering, none of which move here).
 *
 * Asset URLs are DELIBERATELY absent from this module. The eight plates
 * were uploaded through the authorized Threshold `upload_content_asset`
 * boundary but remain unbound/unpublished (content/artwork-manifest.json:
 * `bound: false`, `resolvedReaderUrl: null`) — publishing one is an admin
 * act (draft -> preview -> publish through native Admin -> Bridges,
 * PlacementAssetsPanel, section = fsBridgeSectionKey(bridge, stage)), never
 * a URL invented here. `FS_STAGE_ASSETS` below carries only the caption/alt/
 * title metadata every stage needs for accessible text regardless of
 * whether an image has been published yet — see
 * `components/journey/FinancialSovereigntyPlate.tsx` for how a stage
 * renders a labeled "not yet published" placeholder instead of a broken
 * image when the admin-bound infographicUrl is still null.
 */

export type FsStageId = 'discover' | 'learn' | 'explore' | 'prepare' | 'operate' | 'cross';
export type FsBridge = 'ci' | 'knyts';

export interface FsTopic {
  id: string;
  title: string;
  body: string;
}

export interface FsStageAsset {
  /** Pack asset ref, e.g. 'D-I01' — also the id upload/placement receipts key on. */
  assetRef: string;
  title: string;
  caption: string;
  alt: string;
}

export interface FsUnderstandingCheckOption {
  id: string;
  text: string;
}

export interface FsUnderstandingCheck {
  id: string;
  title: string;
  prompt: string;
  options: FsUnderstandingCheckOption[];
  correctOption: string;
  feedback: string;
}

export interface FsStageContent {
  eyebrow: string;
  headline: string;
  lead: string;
  topics: FsTopic[];
  /** Primary plate for this stage — Learn additionally carries two more via `learnPlates` below. */
  asset: FsStageAsset;
  checks: FsUnderstandingCheck[];
  exerciseSummary: string;
  contextualLine: Record<FsBridge, string>;
}

/** Learn is the one stage with three plates (one per lesson section) rather
 *  than one — see content/step-composition.json's learn-purposes/value/agents
 *  sub-sections. Kept as a SEPARATE export (not folded into FsStageContent)
 *  so every other stage's shape stays a plain single asset — no stage needs
 *  to special-case an array it will never have more than one element in. */
export const FS_LEARN_PLATES: FsStageAsset[] = [
  {
    assetRef: 'L-I01',
    title: 'What are you trying to do with your money?',
    caption: 'Start with the purpose before choosing a product or an agent task.',
    alt: 'Six illustrated cards pair financial purposes with a practical question.',
  },
  {
    assetRef: 'L-I02',
    title: 'Understand the value you actually hold.',
    caption: 'Separate the unit of account, the asset or claim, and its custody and transfer arrangements.',
    alt: 'A bank balance, a fiat-referencing token and a market-priced cryptoasset are shown through three distinct lenses.',
  },
  {
    assetRef: 'L-I03',
    title: 'You, AgentMe and MoneyPenny',
    caption: 'You set the goal; each agent works within its actual mandate.',
    alt: 'A human principal, AgentMe companion and MoneyPenny specialist illustrate direct and coordinated scoped tasks.',
  },
];

export const FS_STAGE_CONTENT: Record<FsStageId, FsStageContent> = {
  discover: {
    eyebrow: 'Discover Financial Services',
    headline: 'Your money. Your choices. A clearer way to begin.',
    // Corrected per the brief: "bounded, evidenced, reversible" implied
    // completed financial actions are reversible — never accurate. Replaced
    // with the qualified, verified-capabilities framing.
    lead:
      'Financial services help you manage money today and prepare for tomorrow. Explore familiar financial tools ' +
      'alongside crypto, and see how constitutional financial services put your goals, permissions and oversight ' +
      'at the centre — bounded authority, inspectable evidence, and clear stop or revoke controls, for the ' +
      'capabilities you have actually verified. You do not need a trading account or a deposit to learn.',
    topics: [
      {
        id: 'D-TOPIC-01',
        title: 'Financial services, with constitutional controls',
        body: 'Whose goal? Which actor? What permission? What limits? What evidence?',
      },
      {
        id: 'D-TOPIC-02',
        title: 'Fiat and crypto',
        body:
          'Fiat and crypto describe different monetary, asset and settlement contexts. A token may reference ' +
          'fiat; reference value, rights and custody still need separate checks.',
      },
      {
        id: 'D-TOPIC-03',
        title: 'Personal and institutional finance',
        body:
          'Personal, household, organisational and client-facing work have different requirements. Experience ' +
          'alone does not establish eligibility.',
      },
    ],
    asset: {
      assetRef: 'D-I01',
      title: 'One financial life. Clearer control.',
      caption: 'Everyday purposes, financial tools and authority belong in the same picture.',
      alt: 'Three illustrated panels connect everyday financial needs, fiat and crypto tools, and questions about authority.',
    },
    checks: [
      {
        id: 'D-Q01',
        title: 'What does CFS add?',
        prompt: 'Which statement best describes constitutional financial services here?',
        options: [
          { id: 'A', text: 'Every financial outcome is guaranteed.' },
          { id: 'B', text: 'Financial work is organised around explicit human authority, bounded delegation and inspectable evidence.' },
          { id: 'C', text: 'All fiat services are replaced by crypto.' },
        ],
        correctOption: 'B',
        feedback: 'CFS describes how financial action is governed. It does not guarantee returns or require every service to use crypto.',
      },
    ],
    exerciseSummary:
      'Explore the financial map: purpose, context and familiarity — a short, optional reflection that produces a ' +
      'learning recommendation, never a risk score or a professional classification.',
    contextualLine: {
      ci: 'Make financial decisions with a clearer view of your goals and the authority you delegate. Example: understand household finances and a future goal.',
      knyts: 'Support your creative life with a clearer plan for what you spend, hold and delegate. Example: plan a creative project budget or a discretionary media purchase.',
    },
  },
  learn: {
    eyebrow: 'Learn the Foundations',
    headline: 'Know what a service does—and what you remain responsible for.',
    // Corrected per the brief: "only a runtime action changes anything"
    // could be misread to imply profile edits or saved plans never change
    // state. Replaced with the precise scope: consequential financial
    // execution, not every kind of state change.
    lead:
      'Start with the purpose of each financial service, then look at its costs, risks and controls. Learn how ' +
      'fiat and crypto fit into the picture, and how an agent can help without receiving unlimited authority. ' +
      'Advisor explains. Architect proposes. Financial execution requires a supported Runtime action and effective ' +
      'authorization.',
    topics: [
      {
        id: 'L-TOPIC-01',
        title: 'Money in everyday life',
        body:
          'Begin with payment recipients, income and spending, access to savings, commitments, debts and goals. ' +
          'Learning about a service does not mean it is available in MoneyPenny.',
      },
      {
        id: 'L-TOPIC-02',
        title: 'Investments and digital assets',
        body:
          'Ask what you hold, how you access it, what it costs and what can change. A target stable value and ' +
          'diversification are not guarantees against loss.',
      },
      {
        id: 'L-TOPIC-03',
        title: 'Working with financial agents',
        body:
          'You set the goal. AgentMe coordinates within its mandate. MoneyPenny explains, designs or acts within ' +
          'effective permission. A role selection is not a grant.',
      },
    ],
    asset: FS_LEARN_PLATES[0],
    checks: [
      {
        id: 'L-Q01',
        title: 'Stable reference, changing risk',
        prompt: 'A token aims to track one US dollar. What does that tell you?',
        options: [
          { id: 'A', text: 'Its target reference value—not a guarantee that it always trades or redeems at that value.' },
          { id: 'B', text: 'It is identical to every dollar bank balance.' },
          { id: 'C', text: 'Its holder cannot lose money.' },
        ],
        correctOption: 'A',
        feedback: 'Learn what the token represents, how redemption works and who controls access. A target value is not a complete risk description.',
      },
      {
        id: 'L-Q02',
        title: 'Whose authority?',
        prompt: 'MoneyPenny is allowed to compare two investments. Can it buy one for you?',
        options: [
          { id: 'A', text: 'Yes, if its confidence is high.' },
          { id: 'B', text: 'Yes, if you selected Runtime.' },
          { id: 'C', text: "Only if the action has the required effective authorization and the service's other requirements are satisfied." },
        ],
        correctOption: 'C',
        feedback: 'Comparison permission does not include spending permission. Role selection and confidence do not create authority.',
      },
      {
        id: 'L-Q03',
        title: 'Learning depth versus eligibility',
        prompt: 'You select the professional-depth lessons. What changes?',
        options: [
          { id: 'A', text: 'You are automatically authorized to operate other people’s accounts.' },
          { id: 'B', text: 'The detail and examples you see; actual eligibility and permissions remain separately checked.' },
          { id: 'C', text: 'Your financial profile becomes public.' },
        ],
        correctOption: 'B',
        feedback: 'A learning preference is not a verified capacity or access grant.',
      },
    ],
    exerciseSummary:
      'Who may do what? Three short scenarios (Explain / Design / Act) — selecting an answer reveals the reason ' +
      'and the exact missing permission; it never opens a live authorization prompt.',
    contextualLine: {
      ci: 'Compare a bank balance, investment and digital asset.',
      knyts: 'Distinguish collecting or access rights from financial characteristics.',
    },
  },
  explore: {
    eyebrow: 'Explore Your Options',
    headline: 'Try the thinking before you commit the money.',
    lead:
      'Pick a sample goal, compare a few approaches and see how a rehearsal changes when assumptions change. Meet ' +
      'MoneyPenny in action without handing over control. Start with an example; you can bring in your own ' +
      'financial picture during Prepare.',
    topics: [
      {
        id: 'E-TOPIC-01',
        title: 'Choose a goal',
        body: 'Choose what this money should help you do and when. Include keeping the current approach as a valid comparison.',
      },
      {
        id: 'E-TOPIC-02',
        title: 'Compare approaches',
        body: 'Compare assumptions, constraints and costs. A favourable illustrative result does not prove future performance.',
      },
      {
        id: 'E-TOPIC-03',
        title: 'Rehearse with MoneyPenny',
        body:
          'The initial exercise uses synthetic arithmetic. Genuine shadow observation needs verified timestamped ' +
          'inputs; simulation is never a submitted order.',
      },
    ],
    asset: {
      assetRef: 'E-I01',
      title: 'Goal. Plan. Rehearsal. Review.',
      caption: 'Try the reasoning, inspect the assumptions, and keep rehearsal separate from execution.',
      alt: 'Four illustrated panels move from a goal to an approach, a labelled rehearsal and a review.',
    },
    checks: [
      {
        id: 'E-Q01',
        title: 'What has the rehearsal proved?',
        prompt: 'A simulation shows a gain. What do you know?',
        options: [
          { id: 'A', text: 'A real trade settled profitably.' },
          { id: 'B', text: 'The same strategy will succeed with real money.' },
          { id: 'C', text: 'The model produced that result under the stated inputs and assumptions.' },
        ],
        correctOption: 'C',
        feedback: 'Inspect the assumptions and costs. Simulation is not execution evidence or a promise.',
      },
      {
        id: 'E-Q02',
        title: 'Check the net result',
        prompt: 'An example shows a $0.30 gross benefit and $0.40 total costs. What is its net result?',
        options: [
          { id: 'A', text: 'A $0.10 loss.' },
          { id: 'B', text: 'A $0.30 gain.' },
          { id: 'C', text: 'A $0.70 gain.' },
        ],
        correctOption: 'A',
        feedback: '$0.30 minus $0.40 is −$0.10. An apparent opportunity can disappear after costs.',
      },
    ],
    exerciseSummary:
      'Does the apparent opportunity survive the costs? A synthetic, deterministic example: a $0.30 gross benefit ' +
      'against $0.20 in modelled costs nets $0.10 — raise costs to $0.40 and the same opportunity nets a $0.10 ' +
      'loss. All values are labeled synthetic; this is a cost-sensitivity exercise, never a trade recommendation, ' +
      'a real quote, or a complete arbitrage model.',
    contextualLine: {
      ci: 'Rehearse the costs of a hypothetical exchange.',
      knyts: 'Rehearse costs for a hypothetical creative purchase; no token conversion assumptions.',
    },
  },
  prepare: {
    eyebrow: 'Prepare Your Financial Workspace',
    headline: 'Build a financial picture you understand and control.',
    lead:
      'Review what comes in, what goes out, what you hold and what you owe. Add a goal, choose a first task and ' +
      'decide what help you want from AgentMe and MoneyPenny. You can begin with estimates. Connecting a wallet ' +
      'or delegating an action is a separate choice.',
    topics: [
      {
        id: 'P-TOPIC-01',
        title: 'My position',
        body: 'Enter estimates or upload a supported statement, then check figures, sources and unknowns. Marking a profile reviewed is an explicit action.',
      },
      {
        id: 'P-TOPIC-02',
        title: 'My priorities',
        body: 'Choose context, goal, horizon, constraints and a first task. A professional-depth preference is not verified investor status.',
      },
      {
        id: 'P-TOPIC-03',
        title: 'My setup',
        body: 'Inspect existing Passport and AgentMe state. Wallet connection and transaction delegation remain separate optional steps. Never provide seed phrases or private keys.',
      },
    ],
    asset: {
      assetRef: 'P-I01',
      title: 'Your financial picture, your permission.',
      caption: 'Adding information supports planning; it does not authorize spending.',
      alt: 'Position, priorities and permissions are separate columns, with a reminder to review actual access before sharing.',
    },
    checks: [
      {
        id: 'P-Q01',
        title: 'Profile data is not permission',
        prompt: 'You add a statement and review your profile. What have you authorized?',
        options: [
          { id: 'A', text: 'Unlimited use of your wallet.' },
          { id: 'B', text: 'Only the data handling you actually consented to; no transaction authority merely from creating a profile.' },
          { id: 'C', text: 'Automatic investment of any remaining balance.' },
        ],
        correctOption: 'B',
        feedback: 'Information can support planning. An effective grant for a financial action is a separate step.',
      },
      {
        id: 'P-Q02',
        title: 'Bounded mandate',
        prompt: 'Which is the clearest draft permission?',
        options: [
          { id: 'A', text: '‘Make me money however you can.’' },
          { id: 'B', text: '‘Do whatever the next agent recommends.’' },
          { id: 'C', text: '‘For this specified task and account, within these limits and expiry, request the approvals shown here.’' },
        ],
        correctOption: 'C',
        feedback: 'A usable mandate identifies the actor, task, scope and controls. It still has to be reviewed and accepted through the actual delegation flow.',
      },
    ],
    exerciseSummary:
      'Review your starting brief: known/unknown profile fields, selected goal, proposed first task and effective ' +
      'permissions — shown as separate status chips (profile present, reviewed, wallet connected, delegated), ' +
      'never a single misleading percentage-complete score.',
    contextualLine: {
      ci: 'Review your personal profile and choose a first task.',
      knyts: 'Use the same profile with an optional creative spending goal.',
    },
  },
  operate: {
    eyebrow: 'Operate with MoneyPenny',
    headline: 'Put understanding into practice—with you in charge.',
    lead:
      'Ask a question, shape a plan, rehearse an action or review an authorized task. MoneyPenny works within the ' +
      'role and permissions you choose. Keep using this workspace for as long as it is useful; moving into ' +
      'advanced automation is optional.',
    topics: [
      {
        id: 'O-TOPIC-01',
        title: 'Understand a question',
        body: 'Advisor helps explain and compare. It does not authorize purchases.',
      },
      {
        id: 'O-TOPIC-02',
        title: 'Shape a plan',
        body: 'Architect helps design a plan or a draft task. A draft does not activate automation.',
      },
      {
        id: 'O-TOPIC-03',
        title: 'Review an action',
        body: 'Runtime presents supported actions. Check current permissions and simulation/live state; review the actual outcome. Delegate is a separate permission workflow, not a fourth role.',
      },
    ],
    asset: {
      assetRef: 'O-I01',
      title: 'Ask. Shape. Authorize. Act. Review.',
      caption: 'Follow the task, distinguish permissions from roles, and inspect the actual outcome.',
      alt: 'Five illustrated task stations separate understanding and design from conditional authorization, action and evidence review.',
    },
    checks: [
      {
        id: 'O-Q01',
        title: 'Request versus result',
        prompt: 'The system says a transaction request was submitted. Does that prove it settled?',
        options: [
          { id: 'A', text: 'No. Inspect the actual execution and settlement evidence available for that service.' },
          { id: 'B', text: 'Yes. Every request is successful.' },
          { id: 'C', text: 'Yes, if a green banner is displayed.' },
        ],
        correctOption: 'A',
        feedback: 'A request is a stage in a process, not proof of its final outcome.',
      },
      {
        id: 'O-Q02',
        title: 'Changing role',
        prompt: 'You change MoneyPenny from Advisor to Runtime. What should happen?',
        options: [
          { id: 'A', text: 'It immediately starts trading.' },
          { id: 'B', text: 'It receives unrestricted spending authority.' },
          { id: 'C', text: 'Its working context changes; real permissions and simulation/live state remain independently controlled.' },
        ],
        correctOption: 'C',
        feedback: 'Select a task, inspect its environment and review the required authorization. Changing role alone does not execute it.',
      },
    ],
    exerciseSummary:
      'Before an initial supported transaction: a concise review of actor, environment, asset/network, amount, ' +
      'fees, recipient, limits and consequences — a concept check, kept separate from the real confirmation. For ' +
      'planning-only work: "What assumption matters most?" instead of transaction questions.',
    contextualLine: {
      ci: 'Review finances, revise a plan or rehearse a task.',
      knyts: 'Manage the same financial life, including creative or community activity.',
    },
  },
  cross: {
    eyebrow: 'Cross into Advanced CFS',
    headline: 'More automation. More explicit responsibility.',
    lead:
      'Advanced operations are for people ready to define sustained agent mandates, coordinate multiple agents, or ' +
      'build financial services for others. Explore the requirements before you cross. Automation changes how ' +
      'work is carried out; it does not remove financial uncertainty or the need for oversight.',
    topics: [
      {
        id: 'C-TOPIC-01',
        title: 'Automate within a mandate',
        body: 'Define task, scope, limits, expiry, approval, monitoring and stop conditions for your own permitted work.',
      },
      {
        id: 'C-TOPIC-02',
        title: 'Deploy a financial-services agent',
        body: 'Agent registration, admission, client mandates and service requirements are distinct. Registration alone is not permission to serve others.',
      },
      {
        id: 'C-TOPIC-03',
        title: 'Coordinate agents',
        body: 'Check the mandate and scope of each participant. Involving another agent does not create unrestricted onward delegation.',
      },
    ],
    asset: {
      assetRef: 'C-I01',
      title: 'Cross the automation threshold.',
      caption: 'Advanced automation is optional and requires more explicit responsibility.',
      alt: 'Two advanced paths—automating permitted work and providing a financial service—share mandate, limits, supervision, evidence and stop controls.',
    },
    checks: [
      {
        id: 'C-Q01',
        title: 'Stop is not undo',
        prompt: 'You stop an automated agent. What should you assume about completed transactions?',
        options: [
          { id: 'A', text: 'They are all reversed.' },
          { id: 'B', text: 'They are not automatically undone; inspect completed and in-flight actions separately.' },
          { id: 'C', text: 'Their records disappear.' },
        ],
        correctOption: 'B',
        feedback: 'Stop and revoke controls govern future authority or operation according to the service. They do not guarantee reversal of completed actions.',
      },
      {
        id: 'C-Q02',
        title: 'Agent registration',
        prompt: 'Your financial-services agent is registered. May it now serve anyone with any strategy?',
        options: [
          { id: 'A', text: 'Not on registration alone; admission, scope, permissions and service requirements still apply.' },
          { id: 'B', text: 'Yes; registration provides all permissions.' },
          { id: 'C', text: 'Yes, provided another agent asks it to.' },
        ],
        correctOption: 'A',
        feedback: 'Identity, admission and authority are distinct.',
      },
      {
        id: 'C-Q03',
        title: 'Multi-agent authority',
        prompt: 'An agent wants to involve a specialist. What must be checked?',
        options: [
          { id: 'A', text: "Only the specialist's confidence score." },
          { id: 'B', text: 'Nothing, because agents may always delegate onward.' },
          { id: 'C', text: 'Whether the arrangement, participant and requested action are permitted within the actual mandate and controls.' },
        ],
        correctOption: 'C',
        feedback: 'Coordination does not erase boundaries. Each participant’s role and authority must be valid.',
      },
    ],
    exerciseSummary:
      'Inspect an automation mandate: a synthetic mandate missing an expiry, a stop condition, or an onward-' +
      'delegation rule — identify what is missing. Completion means advanced concepts reviewed; admission and ' +
      'real grants remain separately evaluated.',
    contextualLine: {
      ci: 'Explore optional automation or service provision via Horizen.',
      knyts: 'Use the same advanced path with established persona and agent state.',
    },
  },
};

/**
 * FsStructuredContent — the admin-editable shape written by
 * FsStructuredContentPanel (app/triad/components/codex/tabs/QriptopianAdminTab.tsx)
 * into knyts_bridge_editorial_config.structured_content (migration
 * 20260903140000). Same field set as the static defaults above
 * (topics/checks/exerciseSummary/contextualLine/assetCaption/assetAlt/
 * lessonLabel) so an admin edit and the shipped default are always
 * comparable and interchangeable — never two different shapes.
 */
export interface FsStructuredContent {
  topics: FsTopic[];
  checks: FsUnderstandingCheck[];
  exerciseSummary: string;
  contextualLine: string;
  assetCaption: string;
  assetAlt: string;
  lessonLabel?: string;
}

/**
 * resolveFsSectionContent — the ONE merge point between an admin-published
 * structuredContent row and the static FS_STAGE_CONTENT default. An admin
 * row is authoritative field-by-field the moment it carries a non-empty
 * value; an empty/absent field falls back to the shipped pack default —
 * never a blank section. Mirrors headline/shortCopy's own
 * `config?.headline || fallback.headline` pattern already used in
 * FinancialSovereigntyIntroStage's resolveCopy().
 */
export function resolveFsSectionContent(
  stage: FsStageId,
  bridge: FsBridge,
  structuredContent: Partial<FsStructuredContent> | null | undefined,
): { topics: FsTopic[]; checks: FsUnderstandingCheck[]; exerciseSummary: string; contextualLine: string; assetCaption: string; assetAlt: string } {
  const fallback = FS_STAGE_CONTENT[stage];
  return {
    topics: structuredContent?.topics?.length ? structuredContent.topics : fallback.topics,
    checks: structuredContent?.checks?.length ? structuredContent.checks : fallback.checks,
    exerciseSummary: structuredContent?.exerciseSummary || fallback.exerciseSummary,
    contextualLine: structuredContent?.contextualLine || fallback.contextualLine[bridge],
    assetCaption: structuredContent?.assetCaption || fallback.asset.caption,
    assetAlt: structuredContent?.assetAlt || fallback.asset.alt,
  };
}

const FS_LEARN_PLATE_LABELS = ['Lesson 1 — What money helps you do', 'Lesson 2 — Fiat, crypto and value', 'Lesson 3 — You, AgentMe and MoneyPenny'];
/** Per-plate fallback slice, matching content/step-composition.json v1.2's
 *  learn-purposes/learn-value/learn-agents contentRefs exactly — see
 *  FS_LOGICAL_SECTION_MAP.learn below. Plate 0 (learn-purposes) intentionally
 *  carries only its topic; the checks live on plates 1/2. */
const FS_LEARN_PLATE_FALLBACK = [
  { topics: FS_STAGE_CONTENT.learn.topics.filter((t) => t.id === 'L-TOPIC-01'), checks: [] as FsUnderstandingCheck[], exerciseSummary: '' },
  { topics: FS_STAGE_CONTENT.learn.topics.filter((t) => t.id === 'L-TOPIC-02'), checks: FS_STAGE_CONTENT.learn.checks.filter((c) => ['L-Q01', 'L-Q03'].includes(c.id)), exerciseSummary: '' },
  { topics: FS_STAGE_CONTENT.learn.topics.filter((t) => t.id === 'L-TOPIC-03'), checks: FS_STAGE_CONTENT.learn.checks.filter((c) => c.id === 'L-Q02'), exerciseSummary: FS_STAGE_CONTENT.learn.exerciseSummary },
];

/** Merge for one of Learn's three plates (fs-learn / fs-learn-2 / fs-learn-3)
 *  — each carries its OWN topic/check slice (never the whole stage's set
 *  duplicated three times) plus its own caption/alt/lesson label. */
export function resolveFsLearnPlateContent(
  plateIndex: 0 | 1 | 2,
  structuredContent: Partial<FsStructuredContent> | null | undefined,
): { topics: FsTopic[]; checks: FsUnderstandingCheck[]; exerciseSummary: string; assetCaption: string; assetAlt: string; lessonLabel: string } {
  const fallbackPlate = FS_LEARN_PLATES[plateIndex];
  const fallbackSlice = FS_LEARN_PLATE_FALLBACK[plateIndex];
  return {
    topics: structuredContent?.topics?.length ? structuredContent.topics : fallbackSlice.topics,
    checks: structuredContent?.checks?.length ? structuredContent.checks : fallbackSlice.checks,
    exerciseSummary: structuredContent?.exerciseSummary || fallbackSlice.exerciseSummary,
    assetCaption: structuredContent?.assetCaption || fallbackPlate.caption,
    assetAlt: structuredContent?.assetAlt || fallbackPlate.alt,
    lessonLabel: structuredContent?.lessonLabel || FS_LEARN_PLATE_LABELS[plateIndex],
  };
}

/**
 * FS_LOGICAL_SECTION_MAP — the explicit logical-section -> component ->
 * editorial-record mapping requested for CFS composition verification
 * (operator directive, 2026-09-03). One entry per content/step-
 * composition.json v1.2 logicalSectionId. `editorialSource` names where the
 * section's content actually comes from at render time:
 *   - 'structuredContent'          -> admin-editable via FsStructuredContentPanel,
 *                                      merged through resolveFsSectionContent()
 *   - 'existing-functional-component' -> untouched pre-existing code (never
 *                                      admin-editable — evidence/handlers live here)
 *   - 'admin-headline-shortcopy'   -> the plain headline/shortCopy fields
 *                                      every Bridge section already has
 */
export interface FsLogicalSectionMapping {
  logicalSectionId: string;
  label: string;
  component: string;
  editorialSource: 'structuredContent' | 'existing-functional-component' | 'admin-headline-shortcopy';
}

export const FS_LOGICAL_SECTION_MAP: Record<FsStageId, FsLogicalSectionMapping[]> = {
  discover: [
    { logicalSectionId: 'discover-landscape', label: 'The financial landscape', component: 'FinancialSovereigntyStageExtras (plate + topics + D-Q01 check)', editorialSource: 'structuredContent' },
    { logicalSectionId: 'discover-agency', label: 'Your agency and starting point', component: 'BridgeMediaStage headline/paragraphs/Continue — existing DCIR-observed CTA, evidence: discoverExperienceObserved', editorialSource: 'admin-headline-shortcopy' },
  ],
  learn: [
    { logicalSectionId: 'learn-purposes', label: 'What money helps you do', component: 'FinancialSovereigntyStageExtras — plate 1 (fs-learn) + L-TOPIC-01', editorialSource: 'structuredContent' },
    { logicalSectionId: 'learn-value', label: 'Fiat, crypto and value', component: 'FinancialSovereigntyStageExtras — plate 2 (fs-learn-2) + L-TOPIC-02 + L-Q01/L-Q03', editorialSource: 'structuredContent' },
    { logicalSectionId: 'learn-agents', label: 'You, AgentMe and MoneyPenny', component: 'FinancialSovereigntyStageExtras plate 3 (fs-learn-3) + L-TOPIC-03, PLUS the existing LEARN_CONCEPTS Advisor/Architect/Runtime picker (code-owned, gates learnExperienceQualified)', editorialSource: 'existing-functional-component' },
  ],
  explore: [
    { logicalSectionId: 'explore-rehearsal', label: 'Choose and rehearse', component: 'FinancialSovereigntyStageExtras (plate + topics + deterministic FinancialSovereigntyCostExample, E-Q01/E-Q02)', editorialSource: 'structuredContent' },
    { logicalSectionId: 'explore-capabilities', label: 'Available capabilities', component: 'existing serviceCatalog capability cards (Advisor/Architect/Runtime Confidential/Runtime Constitutional) — code-owned', editorialSource: 'existing-functional-component' },
    { logicalSectionId: 'explore-profile-task', label: 'Try a real preparation task', component: 'existing "Try it — Compute your Financial Profile" live action, gates exploreCapabilityInteracted', editorialSource: 'existing-functional-component' },
  ],
  prepare: [
    { logicalSectionId: 'prepare-summary', label: 'Your starting picture', component: 'existing profile summary read (fetchFinancialProfileSummary) — code-owned', editorialSource: 'existing-functional-component' },
    { logicalSectionId: 'prepare-profile', label: 'Review your profile', component: 'existing MoneyPennyBridgeEmbed (tab="my-money") capsule — code-owned, requiresPrivateContext', editorialSource: 'existing-functional-component' },
    { logicalSectionId: 'prepare-setup', label: 'Priorities and optional setup', component: 'FinancialSovereigntyStageExtras (P-TOPIC-02/03 + P-Q01/P-Q02)', editorialSource: 'structuredContent' },
  ],
  operate: [
    { logicalSectionId: 'operate-workspace', label: 'Workspace', component: 'existing MoneyPennyBridgeEmbed (tab="home", expandable) — persistent default, code-owned', editorialSource: 'existing-functional-component' },
    { logicalSectionId: 'operate-help', label: 'How it works', component: 'FinancialSovereigntyStageExtras (plate + topics + O-Q01/O-Q02), optional/on-demand — never gates the workspace', editorialSource: 'structuredContent' },
  ],
  cross: [
    { logicalSectionId: 'cross-automation', label: 'What changes with automation', component: 'FinancialSovereigntyStageExtras (plate + topics + C-Q01/02/03)', editorialSource: 'structuredContent' },
    { logicalSectionId: 'cross-readiness', label: 'Review the advanced path', component: 'existing "Cross to Financial Services" ExperienceHandoff button — code-owned, never replaced with an assessment', editorialSource: 'existing-functional-component' },
  ],
};
