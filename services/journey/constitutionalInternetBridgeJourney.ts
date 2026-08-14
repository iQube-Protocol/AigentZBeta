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
 * (HOME, VIEW, ORIENT, PASSPORT, ACT, STAND, CHOOSE) to a three-stage
 * JourneyDefinition (passport/act/stand), reasoning that a JourneyDefinition
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
 * ── ACT: "Bring Your Agent Into the Field" — connection is not delegation ──
 *
 * ACT is the first post-Passport human-agent relationship step, and offers
 * TWO sibling paths, neither of which grants constitutional authority:
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
 *       disposition ceremony (experienceQubeDispositionService.ts).
 *
 * Both are relationship/context facts, not delegation, not Standing, not a
 * mandate. `completionEvidence: ['agentRelationshipStarted']` is true when
 * EITHER path is taken (computed as an OR in the state route) — the two
 * paths are alternatives, not a checklist.
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

export const CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY: JourneyDefinition = {
  id: 'constitutional-internet-bridge',
  version: '2.0.0',
  label: 'The Constitutional Internet Bridge',
  partner: 'polity-core',
  destination: 'constitutional-internet',
  subjectRef: 'visitor',
  stages: [
    {
      id: 'home',
      label: 'Home',
      description: 'Enter the Constitutional Internet.',
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
      description: 'Encounter the Ethos.',
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
      description: 'Understand why the person comes first.',
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
        before: 'Where do you most want agents to help? What do you most want to remain yours? Claiming your Passport is your first constitutional act.',
        complete: '',
      },
    },
    {
      id: 'passport',
      label: 'Passport',
      description: 'Claim your constitutional presence.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-passport-room',
          note:
            'State-aware constitutional room (ConstitutionalInternetBridgePassportRoom.tsx): no usable ' +
            'Passport -> the canonical PassportBureauApplyTab claim flow; Passport established -> ' +
            '"You have crossed." + a continuation toward ACT. Never a campaign-specific fork of Passport.',
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
      description: 'Tell your Constitutional story.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-personify',
          note:
            'ConstitutionalInternetBridgePersonifyMyCanvas — embeds canonical myCanvas for telling ' +
            'Constitutional story. Campaign-tagged with constitutional-internet-bridge. Gated by Passport evidence.',
        },
      ],
      prerequisites: [],
      permittedActions: [],
      completionEvidence: [],
      receiptTypes: [],
      companion: {
        before: 'Tell your story. Remix an existing crossing, or start with the Article Zero template.',
        complete: 'Your Constitutional story is published.',
      },
      nextStageId: 'stand',
    },
    {
      id: 'stand',
      label: 'Stand',
      description: 'See and build your Standing.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-stand',
          note: 'Reads real Passport/disposition receipts and the canonical Standing score — never fabricates Standing from navigation or viewing. See services/journey/constitutionalInternetBridgeStand.ts.',
        },
      ],
      prerequisites: [],
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
      description: 'Choose where to go next.',
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
  ],
};
