/**
 * The Constitutional Internet Bridge — the canonical Ethos Bridge into the
 * Polity (Guided Journey Runtime, PRD-GJR-001).
 *
 * Reconstituted (2026-08-10) onto the shared Guided Journey Runtime runner
 * (components/journey/JourneyRunSurface.tsx) — the SAME Posit Spine grammar
 * KNYTS Bridge, Horizen and the Validation Programme use, projected here in
 * Ethos language rather than KNYTS's Mythos or Horizen's evidentiary
 * language. The Threshold Guide is a product, not a KNYTS feature: KNYTS
 * speaks Mythos through it, CI speaks Ethos through it, and any future
 * bridge speaks its own projection through the same shared substrate.
 *
 * ── Seven spine nodes, three tracked stages ─────────────────────────────────
 *
 * An earlier version of this file reduced the public seven-beat narrative
 * (HOME, VIEW, ORIENT, PASSPORT, PERSONIFY, STAND, CHOOSE — PERSONIFY named
 * ACT before the 2026-08-11 experience evolution pass) to a three-stage
 * JourneyDefinition (passport/personify/stand), reasoning that a JourneyDefinition
 * stage is a unit of TRACKED, EVIDENCED PROGRESS (Journey Guidance
 * Principle, §5.1) and the other four have nothing to gate or complete. That
 * reasoning about EVIDENCE was correct and is preserved below — HOME/VIEW/
 * ORIENT/CHOOSE still carry an empty `completionEvidence` and can never
 * reach COMPLETE. What was wrong was the PRESENTATION consequence drawn from
 * it: rendering the other four as free page sections OUTSIDE the spine
 * entirely produced a bespoke, vertically-stacked landing page instead of
 * the one-Posit-Spine, one-active-surface Threshold Guide every other
 * journey in this codebase uses. KNYTS Bridge made and then corrected
 * exactly this mistake (see knytsBridgeCrossingJourney.ts's own "seven
 * spine nodes, three tracked stages" header) — this file now follows the
 * same correction: a gate-less stage is a real spine node that always
 * resolves READY/open, never a page section adrift from the spine.
 *
 * This is safe under resolveJourneyState.ts's actual resolution order
 * (prerequisites are checked per-stage against ONLY the stages a stage
 * explicitly lists): HOME/VIEW/ORIENT/CHOOSE carry `prerequisites: []` and
 * are never listed as a prerequisite of PASSPORT or anything after it, so
 * their permanent non-completion can never BLOCK the tracked ladder.
 *
 * ORIENT remains a real spine node for direct navigation, but is NOT a
 * prerequisite gate in front of PASSPORT — the frontier framing it shows is
 * also carried in PASSPORT's own `companion.before` text, so a visitor who
 * jumps straight to PASSPORT still sees the same grounding without ORIENT
 * being on their critical path.
 *
 * PASSPORT's completion evidence is `citizenPassportUsable` (an actual,
 * usable Polity Citizen Passport — real constitutional presence), reusing
 * the SAME canonical check KNYTS Bridge and Horizen's own admission ladder
 * use (services/identity/passportPrincipal.ts's
 * `loadUsableCitizenPassportForAuthProfile` / `isPassportUsable`) rather
 * than the weaker `personaAuthenticated` (merely signed in) this file used
 * before reconstitution.
 *
 * ── PERSONIFY (evolved from ACT, 2026-08-11): "Tell your Constitutional
 *    story" — the person is the protagonist ──────────────────────────────
 *
 * Renamed from ACT (public stage id `act` → `personify`) as an experience
 * evolution, not a rebuild: every ACT capability below is preserved, only
 * repositioned. The stage's PRIMARY surface is now a real, functional
 * personal-expression act — writing a Constitutional Article or Story via
 * the canonical myCanvas → Qriptopian Pulse pipeline (the same pipeline
 * KNYTS' own Remix uses, pointed at Qriptopian instead of KNYT) — with the
 * two original ACT paths kept as SUPPORTING tools underneath it, not the
 * stage's main purpose:
 *
 *   (1) Connect an agent you already use — a real, already-working metaMe
 *       Threshold MCP OAuth crossing (services/threshold/gateway.ts,
 *       app/api/threshold/mcp/route.ts, app/threshold/authorize/page.tsx).
 *       A base crossing grants ONLY `CONSTITUTIONAL_ROOT_CAPABILITIES`
 *       (services/threshold/serviceRegistry.ts) — read/query scope over
 *       Passport status, journeys, services; explicitly NO substantive
 *       service action. Delegation requires a SEPARATE, later, explicit
 *       human-authorized step (`propose_delegation` only ever drafts a
 *       proposal; it cannot grant one). Governing principle: "Context may
 *       cross before authority does."
 *   (2) Meet aigentMe — the pre-existing generalized ExperienceQube
 *       disposition ceremony (experienceQubeDispositionService.ts), now
 *       paired with the real, focused aigentMe/metaMe surface (the same
 *       embed pattern KNYTS' own Delegate stage uses) so aigentMe actually
 *       helps shape the story rather than leaving the ceremony floating in
 *       an otherwise-empty viewport. The person remains the author.
 *
 * Both supporting paths are relationship/context facts, not delegation, not
 * Standing, not a mandate. `completionEvidence: ['agentRelationshipStarted']`
 * is UNCHANGED by this evolution — still true when EITHER supporting path is
 * taken (computed as an OR in the state route), still an alternative
 * pairing, never a checklist, and never requiring a published story (the
 * spec is explicit: publishing is the primary invitation, not a completion
 * gate).
 *
 * `CI_BRIDGE_DISPOSITION_CONTEXT` ('constitutional-internet-bridge-act') is
 * DELIBERATELY left unrenamed — it is stamped into real, already-written
 * disposition receipts, and the `act/disposition` and `act/connect-agent`
 * route paths are unchanged internal plumbing (CLAUDE.md's own principle:
 * a public stage label is not the same thing as an internal identifier).
 * Verified before this rename: no persisted table or receipt stores the
 * JourneyDefinition's stage id itself (`platformState.stages` is a fresh
 * per-request object literal in the state route, never written to a
 * database) — so this rename needed no backward-compatible alias.
 *
 * STAND consumes real Passport/disposition receipts and the canonical
 * Standing score — never fabricated from navigation or viewing.
 *
 * CHOOSE is a set of destinations (book reserve, continue reading, meet
 * aigentMe, join the research field, build/partner, share), each of which
 * is its own already-evidenced act (a book_interest campaign event, a share
 * receipt) or a deep link elsewhere entirely — never a single fact this
 * journey itself could gate on, so it carries no completion evidence
 * either, exactly like KNYTS Bridge's own BUY stage.
 */

import type { JourneyDefinition } from '@/types/journey';

export const CI_BRIDGE_CAMPAIGN_ID = 'constitutional-internet-bridge';

/**
 * The real, canonical metaMe Threshold MCP endpoint (CLAUDE.md "MCP Servers
 * — Threshold / metaMe Tool Access"). "Connect an agent you already use"
 * deep-links here — never a guessed or invented URL. Auth is a standard
 * OAuth 2.1 + PKCE + Dynamic Client Registration handshake
 * (app/api/threshold/oauth/*); Claude Desktop's / claude.ai's own
 * "add custom connector" flow speaks this directly.
 */
export const CI_BRIDGE_THRESHOLD_MCP_URL = 'https://dev-beta.aigentz.me/api/threshold/mcp';

/**
 * campaign_events eventType for the "Connect an agent you already use" path.
 * This is a SELF-REPORT (the visitor clicks "I've connected" after following
 * the instructions) — the same fidelity as ORIENT's orient_frontier_recorded
 * and CHOOSE's book_interest, never a verified system fact. A future
 * increment could instead verify against the real
 * services/constitutional/constitutionalAgreement.ts record for this
 * persona's one-way ownerCommitment once that schema is fully understood
 * here — this does NOT attempt that today, to avoid guessing at a T2-safe
 * commitment derivation under time pressure.
 */
export const CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE = 'external_agent_connected';

/**
 * The runtime agent id every Constitutional Internet Bridge disposition
 * receipt is scoped under (agentsInvoked). Aigent Z is the platform's real,
 * already-canonical system orchestrator (CLAUDE.md "System Model" section;
 * RUNTIME_AGENT_IDS in services/metame/agentLlmOrchestra.ts) — using it here
 * (rather than inventing a new agent identity, or defaulting to one of the
 * Horizen-demo REGISTRABLE_AGENTS) is what keeps a CI Bridge disposition
 * receipt from ever being read back by the Horizen journey's own
 * MoneyPenny/Nakamoto-scoped queries, and vice versa.
 */
export const CI_BRIDGE_RUNTIME_AGENT_ID = 'aigent-z';

/** Freeform context tag stamped into every CI Bridge disposition receipt's
 *  actionInput — belt-and-suspenders disambiguation alongside the distinct
 *  agentsInvoked scope above. */
export const CI_BRIDGE_DISPOSITION_CONTEXT = 'constitutional-internet-bridge-act';

/** Single source for Orient's companion framing — also reused verbatim as
 *  the ORIENT capsule's persistent strip copy (ConstitutionalFrontierOrientSurface),
 *  so the two never drift apart into two descriptions of the same stage. */
export const CI_BRIDGE_ORIENT_COMPANION_COPY =
  'Where do you most want agents to help? What do you most want to remain yours? Claiming your Passport is your first constitutional act.';

export const CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY: JourneyDefinition = {
  id: 'constitutional-internet-bridge',
  version: '2.0.0',
  label: 'The Constitutional Internet Bridge',
  partner: 'polity-core',
  destination: 'constitutional-internet',
  subjectRef: 'visitor',
  // Journey Runtime copilot invariant (item 1, 2026-08-25) — the SAME
  // agent/accentColor `/bridge/ci` already mounted by hand
  // (data/codex-configs.ts's METAME_CODEX.copilot: aigent-me / "aigentMe" /
  // emerald — aigentMe is the correct existing constitutional guide; there
  // is no dedicated CI-specific copilot), now resolved canonically instead
  // of hand-copied.
  copilot: { cartridgeSlug: 'metame' },
  stages: [
    {
      id: 'home',
      label: 'Home',
      description: 'The Internet recognizes accounts. The Constitutional Internet recognizes persons.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-home',
          note: 'The shared Bridge hero surface (components/journey/BridgeMediaStage.tsx), themed indigo — the CI proposition, not KNYTS Mythos.',
          props: {
            eyebrow: 'The Constitutional Internet Bridge',
            headline: 'The Internet recognizes accounts. The Constitutional Internet recognizes persons.',
            paragraphs: [
              'This is one path into the Polity — a constitutional home for people and their agents in the emerging Constitutional Internet.',
            ],
            primaryCtaLabel: 'Enter',
            secondaryCtaLabel: 'Explore the book',
            accent: 'indigo',
          },
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'This is one path into the Polity — a constitutional home for people and their agents in the emerging Constitutional Internet.',
        complete: '',
      },
    },
    {
      id: 'view',
      label: 'View',
      description: 'See the constitutional frontier.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-view',
          note: 'ConstitutionalInternetBridgeViewSequence — real Canonical Plates + verbatim manuscript excerpts, cited by line.',
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Personhood precedes identity. Control is not authority. Infrastructure must not become sovereignty.',
        complete: '',
      },
    },
    {
      id: 'orient',
      label: 'Orient',
      description: 'Understand your constitutional frontier and the role you want agents to play.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-orient',
          note: 'ConstitutionalFrontierOrientSurface — a deterministic, non-gating questionnaire. Not constitutional state.',
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: CI_BRIDGE_ORIENT_COMPANION_COPY,
        complete: '',
      },
    },
    {
      id: 'passport',
      label: 'Passport',
      description: 'Crossing the Threshold is the actual constitutional act — everything before it was exploring the proposition.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-passport-room',
          note:
            'State-aware constitutional room (ConstitutionalInternetBridgePassportRoom.tsx): no usable ' +
            'Passport -> the canonical PassportBureauApplyTab claim flow; Passport established -> ' +
            '"You have crossed." + a continuation toward PERSONIFY. Never a campaign-specific fork of Passport.',
        },
      ],
      prerequisites: [],
      permittedActions: ['claim-passport'],
      completionEvidence: ['citizenPassportUsable'],
      receiptTypes: [],
      companion: {
        before:
          'Personhood gives continuity. Identity gives context. Before this, you were exploring the ' +
          'constitutional proposition; claiming your Passport is what makes you constitutionally present ' +
          'in the Polity.',
        complete: 'Your Passport is active. You are constitutionally present in the Polity.',
      },
      nextStageId: 'personify',
    },
    {
      id: 'personify',
      label: 'Personify',
      description:
        'Tell your Constitutional story. Write an Article — your real constitutional perspective — or a ' +
        'Story — an imagined constitutional life — published to the real Qriptopian Pulse. Connecting an ' +
        'agent you already use, or shaping aigentMe as a companion, are supporting tools, not the point: ' +
        'the person is the protagonist.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-personify-mycanvas',
          note:
            'ConstitutionalInternetBridgePersonifyMyCanvas — PERSONIFY\'s ONLY surface (consolidated ' +
            '2026-08-11, targeted correction pass — a second registered surface previously sat below ' +
            'this one; its own embedded metame-codex/aigent-me iframe brought an unrelated Horizen ' +
            '"Focus Check-in" ceremony along with it, producing four stacked agent-relationship ' +
            'representations on one page). The canonical myCanvas Article/Story editor, embedded exactly ' +
            'like KNYTS\' own Remix surface, publishing through the SAME existing ' +
            '/api/community-content/generate -> /api/mycanvas/entries/[id]/publish-to-pulse pipeline, ' +
            'destination locked to Qriptopian Pulse (cartridge=\'qripto\') via MyCanvasTab\'s ' +
            'campaignTag->cartridge lock map — never a second, CI-specific publishing endpoint. Composes ' +
            'a second, non-iframe pane alongside the editor: the "Shape your story" role/authority ' +
            'question (ConstitutionalAgentDispositionSurface), which alone or together with the story ' +
            'itself satisfies agentRelationshipStarted below. "Connect an agent you already use" now ' +
            'lives inside MyCanvasTab\'s own rail (campaign-scoped chip), not a separate surface.',
        },
      ],
      prerequisites: ['passport'],
      permittedActions: ['publish-constitutional-story', 'connect-external-agent', 'record-agent-disposition'],
      completionEvidence: ['agentRelationshipStarted'],
      receiptTypes: [],
      companion: {
        before:
          'Tell your Constitutional story — an Article on your real perspective, or a Story imagining a ' +
          'constitutional life. Connecting an agent you already use, or shaping aigentMe as a companion, ' +
          'are optional supporting tools — connection is never delegation, and nothing here is inferred or ' +
          'assumed on your behalf.',
        complete: 'An agent has entered the field with you. Bounded delegation, if you ever want it, is a separate, later choice.',
      },
      nextStageId: 'stand',
    },
    {
      id: 'stand',
      label: 'Stand',
      description: 'See yourself enter the loop — the real constitutional events recorded so far, honestly framed.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-stand',
          note: 'Reads real Passport/disposition receipts and the canonical Standing score — never fabricates Standing from navigation or viewing. See services/journey/constitutionalInternetBridgeStand.ts.',
        },
      ],
      // Passport determines ELIGIBILITY to enter Stand (2026-08-12, CFS-055
      // coherence pass — mirrors knytsBridgeCrossingJourney.ts's identical
      // fix). Personify is a separate, independently-available post-
      // Passport constitutional contribution, not a prerequisite of Stand:
      // the operator may visit either first. Whether Stand becomes
      // COMPLETE is still governed entirely by completionEvidence below —
      // Passport establishes access, it does not award Standing.
      prerequisites: ['passport'],
      permittedActions: ['view-standing'],
      completionEvidence: ['constitutionalEventRecorded'],
      receiptTypes: [],
      companion: {
        before: 'Personhood → Intent → Action → Proof → Standing → Authority. Your Passport and your disposition are both real constitutional events; what follows from them, over time, is what Standing actually tracks.',
        complete: 'Your crossing is recorded. What you do next is what starts to become consequential.',
      },
      nextStageId: 'choose',
    },
    {
      id: 'choose',
      label: 'Choose',
      description: 'Where next?',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-choose',
          note: 'ConstitutionalInternetBridgeChooseSurface — reserve the book, continue reading, meet aigentMe, join the research field, build/partner, share the Bridge.',
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Where next? Reserve the book, keep reading, meet aigentMe, join the research field, build or partner, or share the Bridge.',
        complete: '',
      },
    },
    // ── Financial Sovereignty branch (AEE-XP-001 §4.2, Main Spine — 2026-09-01
    //    correction). A CONDITIONAL branch off CHOOSE (canonical order:
    //    CHOOSE → DISCOVER → LEARN → EXPLORE → PREPARE → CROSS), same grammar
    //    as knytsBridgeCrossingJourney.ts's segment (indigo preset instead of
    //    amber) — every stage below carries
    //    `activationBranch: 'financial-services'` (types/journey.ts), so
    //    JourneyRunSurface draws none of them until Choose's Financial
    //    Services card calls `activateJourneyBranch(...)` (services/journey/
    //    journeyBranchActivation.ts). Stable stage ids; gate-less like
    //    HOME/VIEW/ORIENT/CHOOSE.
    //
    //    EXCEPTION (AEE-XP-001 §10/XP-6, 2026-09-01): `fs-discover` is the
    //    first live proof of the generic experience-evidence loop — its
    //    `completionEvidence` is real, sourced from an actual observed
    //    interaction (services/journey/experienceObservationPromotion.ts),
    //    read into AuthoritativePlatformState by
    //    app/api/journey/constitutional-internet-bridge/state/route.ts.
    //    LEARN/EXPLORE now also carry real `completionEvidence` (2026-09-01
    //    follow-up), but a STRONGER, kind-discriminated bar than DISCOVER's
    //    plain presence check — see `hasQualifyingExperienceInteraction`
    //    and FinancialSovereigntyIntroStage.tsx's header comment: LEARN
    //    requires all three FS concept cards acknowledged, EXPLORE requires
    //    at least one real MoneyPenny capability interacted with.
    {
      id: 'fs-discover',
      label: 'Discover',
      description: 'Progressive Financial Sovereignty and financial agency.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-discover', note: 'FinancialSovereigntyIntroStage (discover) — indigo preset.' }],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: ['discoverExperienceObserved'],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'Your agents can act with your authority — bounded, evidenced, reversible.', complete: '' },
      activationBranch: 'financial-services',
      nextStageId: 'fs-learn',
    },
    {
      id: 'fs-learn',
      label: 'Learn',
      description: 'Adaptive Financial Services learning materials.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-learn', note: 'FinancialSovereigntyIntroStage (learn) — indigo preset.' }],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: ['learnExperienceQualified'],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'What a Financial Services agent actually does — and what it never does without you.', complete: '' },
      activationBranch: 'financial-services',
      nextStageId: 'fs-explore',
    },
    {
      id: 'fs-explore',
      label: 'Explore',
      description: 'Canonical Financial Services capabilities, projected at suitable altitude.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-explore', note: 'FinancialSovereigntyIntroStage (explore) — indigo preset; projects the real serviceCatalog.' }],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: ['exploreCapabilityInteracted'],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'The Financial Services you can reach once your agent is registered.', complete: '' },
      activationBranch: 'financial-services',
      nextStageId: 'fs-prepare',
    },
    {
      id: 'fs-prepare',
      label: 'Prepare',
      description: 'Review or establish a financial profile, and understand its limitations, before continuing to Operate.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-prepare', note: 'FinancialSovereigntyPrepareCrossStage (prepare) — indigo preset.' }],
      prerequisites: [],
      permittedActions: ['select-agent-candidate'],
      // B1 (2026-09-02, operator directive) — see knytsBridgeCrossingJourney.ts's
      // identical comment. Same generic evidence, same discipline.
      completionEvidence: ['financialProfileReviewed'],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'Prepare your financial profile — statements reviewed, position understood.', complete: '' },
      activationBranch: 'financial-services',
      nextStageId: 'fs-operate',
    },
    {
      id: 'fs-operate',
      label: 'Operate',
      description: 'An enduring workspace for financial work with MoneyPenny — never forced toward advanced operations.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-operate', note: 'FinancialSovereigntyOperateStage — indigo preset. Distinct stage identity from the advanced Horizen aigentme stage (also labeled "Operate") — never the same id, never reused/loosened evidence.' }],
      prerequisites: [],
      permittedActions: ['continue-to-cross'],
      // Deliberately empty — see knytsBridgeCrossingJourney.ts's identical comment.
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'Work with MoneyPenny — plan, learn, and review a bounded live task when a route is verified.', complete: '' },
      activationBranch: 'financial-services',
      nextStageId: 'fs-cross',
    },
    {
      id: 'fs-cross',
      label: 'Cross',
      description: 'Resumable handoff to the Financial Services Bridge.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [{ mode: 'component', ref: 'ci-bridge-fs-cross', note: 'FinancialSovereigntyPrepareCrossStage (cross) — creates the ExperienceHandoff and navigates to /bridge/fs.' }],
      prerequisites: [],
      permittedActions: ['cross-to-financial-services'],
      completionEvidence: [],
      receiptTypes: [],
      receiptsSurfacedNatively: true,
      companion: { before: 'Ready for the Financial Services Bridge.', complete: '' },
      activationBranch: 'financial-services',
    },
  ],
};
