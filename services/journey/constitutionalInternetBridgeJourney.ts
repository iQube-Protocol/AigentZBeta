/**
 * The Constitutional Internet Bridge — the canonical Ethos Bridge into the
 * Polity (Guided Journey Runtime, PRD-GJR-001).
 *
 * Cloned from the KNYTS Bridge Crossing journey's own shape
 * (knytsBridgeCrossingJourney.ts) per the operator's explicit instruction:
 * "the capabilities already exist; the implementation task is composition,
 * hydration, contextualization and limited generalization." Do not fork the
 * Guided Journey Runtime — this is a sibling JourneyDefinition on the same
 * shared runner (JourneyRunSurface, resolveJourneyState).
 *
 * ── Why this ladder has three stages, not the campaign's seven ─────────────
 *
 * The public narrative has seven beats — HOME, VIEW, ORIENT, PASSPORT, ACT,
 * STAND, CHOOSE — but a JourneyDefinition stage is a unit of TRACKED,
 * EVIDENCED PROGRESS (Journey Guidance Principle, §5.1: button clicked !=
 * stage complete; authoritative state + receipt = stage complete). Four of
 * the seven have no such fact to track, by design — exactly the same
 * reasoning KNYTS Bridge's own header documents, generalized:
 *
 *   HOME and VIEW are deliberately browsable without a session at all — the
 *     Constitutional Internet's proposition and the frontier it names must
 *     be legible to a signed-out visitor. There is nothing to gate or
 *     complete.
 *   ORIENT is not a distinct act either. It produces a demand/intent signal
 *     (persisted as a campaign event, never as constitutional state) but
 *     completing it is never a precondition anything downstream checks — a
 *     visitor who skips it can still claim a Passport. It is this journey's
 *     `passport` stage's own `companion.before` framing.
 *   CHOOSE is a set of destinations (book reserve, continue reading, meet
 *     aigentMe, join the research field, build/partner, share), each of
 *     which is its own already-evidenced act (a book_interest campaign
 *     event, a share receipt) or a deep link elsewhere entirely — never a
 *     single fact this journey itself could gate on.
 *
 * So the tracked ladder is exactly the three acts with real, checkable
 * evidence: cross the Threshold (Passport), bring an agent into the field
 * (Act), and see that a constitutional event has genuinely occurred (Stand).
 * HOME/VIEW/ORIENT/CHOOSE are rendered as free (non-gated) sections of the
 * public front door (app/bridge/constitutional-internet/page.tsx) around
 * this ladder, never as JourneyDefinition stages with nothing to evidence.
 *
 * ── ACT: "Bring Your Agent Into the Field" — connection is not delegation ──
 *
 * Operator refinement (2026-08-10): ACT is not solely an ExperienceQube
 * disposition ceremony. It is the first post-Passport human-agent
 * relationship step, and it offers TWO sibling paths, neither of which
 * grants constitutional authority:
 *
 *   (1) Connect an agent you already use — a real, already-working metaMe
 *       Threshold MCP OAuth crossing (services/threshold/gateway.ts,
 *       app/api/threshold/mcp/route.ts, app/threshold/authorize/page.tsx).
 *       A base crossing grants ONLY `CONSTITUTIONAL_ROOT_CAPABILITIES`
 *       (services/threshold/serviceRegistry.ts) — read/query scope over
 *       Passport status, journeys, services; explicitly NO substantive
 *       service action. Delegation requires a SEPARATE, later, explicit
 *       human-authorized step (`propose_delegation` only ever drafts a
 *       proposal; it cannot grant one). This is the governing principle:
 *       "Context may cross before authority does."
 *   (2) Meet aigentMe — the pre-existing generalized ExperienceQube
 *       disposition ceremony (experienceQubeDispositionService.ts).
 *
 * Both are relationship/context facts, not delegation, not Standing, not a
 * mandate. `completionEvidence: ['agentRelationshipStarted']` is true when
 * EITHER path is taken (computed as an OR in the state route) — the two
 * paths are alternatives, not a checklist.
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
  version: '1.0.0',
  label: 'The Constitutional Internet Bridge',
  partner: 'polity-core',
  destination: 'constitutional-internet',
  subjectRef: 'visitor',
  stages: [
    {
      id: 'passport',
      label: 'Passport',
      description: 'Crossing the Threshold is the actual constitutional act — everything before it was exploring the proposition.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'passport-bureau-apply',
          note: 'The existing Polity Passport application/sign-in surface — never a campaign-specific fork.',
        },
      ],
      prerequisites: [],
      permittedActions: ['claim-passport'],
      completionEvidence: ['personaAuthenticated'],
      receiptTypes: [],
      companion: {
        before:
          'Personhood gives continuity. Identity gives context. Before this, you were exploring the ' +
          'constitutional proposition; claiming your Passport is what makes you constitutionally present ' +
          'in the Polity.',
        complete: 'Your Passport is active. You are constitutionally present in the Polity.',
      },
      nextStageId: 'act',
    },
    {
      id: 'act',
      label: 'Act',
      description:
        'Bring your agent into the field — an orientation and context connection, not delegation. ' +
        'Connect an agent you already use, or begin shaping a constitutional companion with aigentMe. ' +
        'Either is an explicit, principal-chosen act; neither confers constitutional authority.',
      actor: 'operator',
      subjectRef: 'visitor',
      surfaces: [
        {
          mode: 'component',
          ref: 'ci-bridge-act-field-entry',
          note:
            'ConstitutionalAgentFieldEntrySurface — two sibling paths: (1) Connect an agent you already ' +
            'use, via the real metaMe Threshold MCP OAuth crossing (services/threshold/*) — grants only ' +
            'CONSTITUTIONAL_ROOT_CAPABILITIES (read/query scope), never delegation; (2) Meet aigentMe, the ' +
            'same generalized ExperienceQube disposition ceremony the Horizen/MoneyPenny journey uses. ' +
            'Governing rule: "Context may cross before authority does" — connection is never delegation.',
        },
      ],
      prerequisites: ['passport'],
      permittedActions: ['connect-external-agent', 'record-agent-disposition'],
      completionEvidence: ['agentRelationshipStarted'],
      receiptTypes: [],
      companion: {
        before:
          'What role would you like agents to play in your life? Bring an agent you already use into the ' +
          'field, or begin shaping aigentMe as your constitutional companion. Either is a choice you make ' +
          'explicitly — connection is never delegation, and nothing here is inferred or assumed on your behalf.',
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
      prerequisites: ['act'],
      permittedActions: ['view-standing'],
      completionEvidence: ['constitutionalEventRecorded'],
      receiptTypes: [],
      companion: {
        before: 'Personhood → Intent → Action → Proof → Standing → Authority. Your Passport and your disposition are both real constitutional events; what follows from them, over time, is what Standing actually tracks.',
        complete: 'Your crossing is recorded. What you do next is what starts to become consequential.',
      },
    },
  ],
};
