/**
 * Guided Journey Runtime — surface adapter registry (PRD-GJR-001 §10).
 *
 * Maps a stage's JourneySurfaceRef.ref (types/journey.ts) to how that real,
 * live platform surface is actually reached. Surface Reuse Principle (§5.2):
 * every entry here composes an EXISTING route/tab/component — nothing is
 * forked. Composable Overlay Principle (§5.9): 'embed' entries reuse the
 * existing cross-cartridge embed route + buildCodexUrl() (utils/codex-nav.ts)
 * exactly as every other inter-cartridge link in this codebase does; the
 * journey viewport composes them via iframe, never a parallel rendering.
 *
 * Confirmed real, 2026-07-31 (§22 Surface Discovery Gate, via Explore-agent
 * research against the live codebase):
 *   - passport-bureau-apply:                    polity-passport-bureau-cartridge (unused by any stage; kept as a candidate)
 *   - venture-participate-apply/-delegation/-standing:
 *     PassportBureauApplyTab / BoundedDelegationTab / ParticipationStandingTab,
 *     rendered bare (kind: 'component', no cartridge nav/tab-group chrome).
 *     Per operator direction 2026-07-31: the journey's Passport/Delegate/
 *     Activate stages compose ONLY these Venture Lab α Participate-group
 *     modules — never the Polity Passport Bureau cartridge shell, never the
 *     standalone Standing cartridge, and never Venture Lab's own Participate
 *     tab-group navigation. Each module is the same instance those cartridges
 *     already mount; nothing is forked.
 *   - founder-office:                    alpha-knyt-codex (tab founder-office)
 *   - aigentme-welcome:                  metame-codex (tab aigent-me)
 *   - agent-card:                        app/api/agents/moneypenny/route.ts (JSON API, not a tab)
 *   - pulse-transparency-toggle:         PulseTransparencyToggle (built GJR-VFY-001 Phase 2, 2026-07-31)
 *   - marketa-eligibility-view:          MarketaEligibilityView (built GJR-MKT-001 Phase 5, 2026-07-31)
 *
 * No 'component-new' entries remain as of Phase 5 — every stage's surface is
 * built (only 'horizen-registry-agent-page', below, stays unresolved).
 *
 * Unresolved, cannot be guessed (CLAUDE.md's no-guessing rule) — 'external-
 * url-unresolved': Horizen's human-browsable registry page. Only Horizen's
 * API base is known (services/horizen/client.ts); the browsable page must
 * come from Horizen or their partner brief.
 */

export type JourneySurfaceDescriptor =
  | {
      kind: 'embed';
      /** Cartridge id in data/codex-configs.ts. */
      codexSlug: string;
      /** Tab slug within that cartridge. */
      tab: string;
      /**
       * Suppress the embedded cartridge's OWN floating copilot for this
       * surface (operator direction, 2026-08-02).
       *
       * MS-1 — one navigation: inside the journey viewport the journey's
       * companion is the operator's single conversational partner. A cartridge
       * that mounts its own floating copilot puts a second one on screen with
       * a different agent, a different context and a different idea of what
       * the operator is doing.
       *
       * Declared per SURFACE rather than in the renderer, because the conflict
       * is a property of what is being composed — a cartridge without its own
       * copilot needs no suppression — and because suppressing it globally
       * would take the copilot away from the cartridge's ordinary standalone
       * use, where it is the only one and entirely correct.
       */
      suppressFloatingCopilot?: true;
      /**
       * Opt-in only (al, 2026-08-04) — this embed surface's URL should carry
       * the Journey's currently-selected agent as `?agentSlug=`. Explicit per
       * descriptor, never a blanket default: `founder-office` and
       * `passport-bureau-apply` are NOT agent-specific and must never receive
       * it, however JourneyRunSurface is called. Only `aigentme-welcome` sets
       * this true.
       */
      agentScoped?: true;
      note: string;
    }
  | {
      kind: 'api';
      route: string;
      note: string;
    }
  | {
      kind: 'component';
      component: string;
      note: string;
    }
  | {
      kind: 'component-new';
      component: string;
      status: 'to-build';
      /** §22 row this gap is tracked against. */
      trackedIn: string;
      note: string;
    }
  | {
      kind: 'external-url-unresolved';
      note: string;
    };

export const JOURNEY_SURFACES: Record<string, JourneySurfaceDescriptor> = {
  'agent-card': {
    kind: 'component',
    component: 'AgentCardSurface',
    note:
      "A real Agent Card (built 2026-07-31, components/journey/AgentCardSurface.tsx) — a " +
      "faithful display wrapper over a served /api/agents/<agent>/agent-card.json route. As of " +
      "the SS3.1.1 correction, that route's metadata.horizen block PROJECTS from the agent's AigentQube " +
      "record (registry_assets), not a hand-typed literal. Honestly renders " +
      "tokenId: null as 'not yet registered' rather than fabricating a value. Superseded as the " +
      "Register stage's own surface by 'register-agent-panel' below (which composes this component " +
      "internally) — kept registered here as the bare, agent-parameterizable display primitive.",
  },
  'register-agent-panel': {
    kind: 'component',
    component: 'RegisterAgentPanel',
    note:
      'Agent-selectable Register stage (2026-07-31, components/journey/RegisterAgentPanel.tsx) — lets ' +
      'the operator choose which registrable agent (services/horizen/registrableAgents.ts: MoneyPenny ' +
      'the demo agent, Aigent Nakamoto the dry-run agent) to register in Horizen\'s ERC-8004 registry, ' +
      'then drives the real prepare->review->confirm->broadcast->status pipeline ' +
      '(services/horizen/registrationClient.ts) end to end. Composes AgentCardSurface internally for ' +
      'the selected agent\'s card display — never a second, parallel display.',
  },
  'horizen-registry-agent-page': {
    kind: 'component',
    component: 'HorizenAgentPageSurface',
    note:
      "Horizen's own live agent registry page — URL pattern confirmed by Horizen directly, 2026-07-31 " +
      '(`https://agent-registry.horizenlabs.io/agent/{agentIdentifier}?network={network}`, ' +
      "example `.../agent/0xZkSignalAgent?network=sepolia`). Built server-side from the selected " +
      "agent's own confirmed Horizen binding (services/horizen/agentPageUrl.ts) — never a fixed " +
      'MoneyPenny/Nakamoto constant, never arbitrary client input. Identity-focused framing for ' +
      'Register (mode="register"); the same component reopens with transparency framing for Verify ' +
      '(mode="verify") via the \'horizen-agent-page-verify\' entry below.',
  },
  'horizen-agent-page-verify': {
    kind: 'component',
    component: 'HorizenAgentPageSurface',
    note:
      "Verify stage's reuse of the same Horizen agent page (operator ruling 2026-07-31: \"Verify can " +
      'reopen the same page if Pulse and P&L state are represented there. If Horizen later supplies a ' +
      'dedicated monitoring URL, use that instead.\") — swap this entry\'s component/props if that ' +
      'happens; the allowlist and embed mechanism (services/horizen/agentPageUrl.ts, IframeTab) stay ' +
      'the same either way.',
  },
  'constitutional-agreement-ratify': {
    kind: 'component',
    component: 'AgreementRatifyPanel',
    note:
      'Built 2026-08-06 (components/journey/AgreementRatifyPanel.tsx) — the Ratify stage\'s ONE guided ' +
      'action ("Verify & Sign Agreement") over the EXISTING generic /api/constitutional/agreement route ' +
      '(services/constitutional/constitutionalAgreement.ts: form -> accept -> authorize), with ' +
      'capabilityRef/selectedAgentRef/delegatedAuthority pre-populated from the Journey context ' +
      '(services/journey/ratificationRefs.ts). No parallel agreement store, no new signing subsystem — ' +
      'authorizing here is authorizing the SAME agreement MoneyPenny\'s live Financial Services runtime ' +
      'gate checks (app/api/moneypenny/runtime/route.ts).',
  },
  'pulse-transparency-toggle': {
    kind: 'component',
    component: 'PulseTransparencyToggle',
    note:
      'Built GJR-VFY-001 Phase 2 (2026-07-31, components/journey/PulseTransparencyToggle.tsx) — drives ' +
      'the real prepare->sign->submit->verify pipeline (services/horizen/authorizationClient.ts) via ' +
      'POST /api/journey/moneypenny-horizen/verify/authorize, then enriches the Agent Card ' +
      '(services/horizen/agentCardEnrichment.ts). Honestly blocks on a missing tokenId rather than ' +
      'fabricating a toggle when Register has not completed.',
  },
  'orientation-panel': {
    kind: 'component',
    component: 'OrientationPanel',
    note:
      "Orient stage's ONE guided action (Threshold Journey — Orient + Consequence Fork, 2026-08-09, " +
      'components/journey/OrientationPanel.tsx) — reads the contextually-resolved ritual ' +
      '(services/journey/orientationContext.ts, never agent-name-derived) and records the operator\'s ' +
      'explicit acknowledgment via POST /api/journey/moneypenny-horizen/orient/acknowledge. Mirrors ' +
      "MarketaEligibilityView's observe-then-act shape exactly.",
  },
  'marketa-eligibility-view': {
    kind: 'component',
    component: 'MarketaEligibilityView',
    note:
      'Built GJR-MKT-001 Phase 5 (2026-07-31, components/journey/MarketaEligibilityView.tsx) — ' +
      'wraps the real deterministic engine (services/marketa/admissionAssessmentEngine.ts) via ' +
      'POST /api/journey/moneypenny-horizen/claim/prove-control, never the domain-mismatched ' +
      'marketing-lane MarketaActivationEngineTab. Wallet control is proven and Marketa\'s FINAL ' +
      'assessment runs together, server-side — Control Before Recommendation is structural, not a ' +
      'UI ordering convention.',
  },
  'passport-bureau-apply': {
    kind: 'embed',
    codexSlug: 'polity-passport-bureau-cartridge',
    tab: 'apply',
    note: 'Confirmed real, live — the Polity Citizen Passport application wizard.',
  },
  'venture-participate-apply': {
    kind: 'component',
    component: 'PassportBureauApplyTab',
    note:
      'Citizen application — the same PassportBureauApplyTab module Venture Lab α’s Participate ' +
      'group (and Polity Passport Bureau) mount; not a fork. Rendered bare, no cartridge nav or ' +
      'tab-group chrome — the pure functional surface only.',
  },
  'venture-participate-delegation': {
    kind: 'component',
    component: 'BoundedDelegationTab',
    note:
      'Bounded delegation — the same BoundedDelegationTab module Venture Lab α’s Participate group ' +
      'mounts. Rendered bare, superseding the Partner Pilot Command Center’s Constitutional ' +
      'Agreements iframe for this stage.',
  },
  'ingest-into-factory-action': {
    kind: 'component',
    component: 'IngestIntoFactoryPanel',
    note:
      "The Ingest stage's ONE guided action (Horizen Pilot Closure, part 2, operator decision A, " +
      '2026-08-09, components/journey/IngestIntoFactoryPanel.tsx) — writes the agent-scoped ' +
      "`capability_registered` receipt via POST /api/journey/moneypenny-horizen/ingest. Mirrors " +
      "OrientationPanel's observe-then-act shape exactly. Rendered ABOVE 'venture-participate-standing' " +
      'below, which stays the read-only Ingested Assets evidence catalogue — this panel is the missing ' +
      'consequential act, never a replacement for that evidence surface.',
  },
  'venture-participate-standing': {
    kind: 'component',
    component: 'ParticipationStandingTab',
    note:
      'The Deploy stage surface: the registry Ingestion Factory ALONE. It was previously paired with ' +
      'Standing as two tabs here; operator direction 2026-08-02 separated them, so this mount pins ' +
      "`only: 'registry'` and the tab strip disappears. Standing has its own stage below.",
  },
  'venture-participate-standing-only': {
    kind: 'component',
    component: 'ParticipationStandingTab',
    note:
      'The Standing stage surface: the SAME ParticipationStandingTab pinned to `only: \'standing\'` — ' +
      'never a second, forked Standing component (inv.engineering.036/037). Standing is standalone ' +
      'again, as it was before it was paired with the Ingestion Factory.',
  },
  'aigentme-welcome': {
    kind: 'embed',
    codexSlug: 'metame-codex',
    tab: 'aigent-me',
    // metame-codex mounts its own floating copilot on every tab. Inside the
    // journey that is the second one on screen, arguing with the journey's
    // companion over the same operator.
    suppressFloatingCopilot: true,
    // The ONE embed surface whose recognition ceremony must speak about —
    // and receipt against — the Journey's actually-selected agent, never a
    // hardcoded default. See agentScoped's own doc comment above.
    agentScoped: true,
    note:
      'Confirmed real and live — AigentMeWelcomeSplitTab, the operator’s existing copilot/dashboard ' +
      'shell. The focus-disposition ceremony is a Welcome Capsule inside this shell itself (§24.8 ' +
      'Ceremony Capsule Principle) — never a second journey-level surface stacked alongside it.',
  },
  'founder-office': {
    kind: 'embed',
    codexSlug: 'alpha-knyt-codex',
    tab: 'founder-office',
    note:
      'Confirmed real and substantial 2026-07-31 (corrects the earlier storyboard-era "placeholder" ' +
      'assumption) — FounderOfficeTab, a live Workspace/Discover/Validate/Architect/Blueprint surface.',
  },

  // ── Validation Programme journey (2026-08-01) — every entry below composes
  // PartnerProgrammesTab bare, locked to the autonomi-review-exp-p1 workspace
  // (services/journey/validationProgrammeJourney.ts's own header explains why
  // each is a REUSE, not a new surface).
  'validation-programme-overview': {
    kind: 'component',
    component: 'AgentiqCartridgeTab',
    note:
      "The real IRL OS Laboratory 'Protocols & Articles' surface (data/codex-configs.ts's " +
      "irl-os-protocols tab: packId 'irl', collectionId 'col_experiments') — never a rebuilt " +
      "document viewer. Filtered via pathFilter (validationProgrammeJourney.ts) to EXP-P1's own " +
      'documents only (operator instruction 2026-08-01, point 3: "use the real Protocols & ' +
      'Articles component, filtered to EXP-P1 materials only. Reuse rather than rebuild").',
  },
  'validation-programme-crystal-review': {
    kind: 'component',
    component: 'CrystalObserverReviewPanel',
    note:
      'Post-Freeze Observer Review Closure (2026-08-09), points 2 and 10: the ONE canonical Workspace ' +
      'Review surface for the autonomi-review-exp-p1 workspace. Composes the existing read-only Crystal ' +
      'vP1 projection (IndependentReviewPanel rendered internally in reviewerMode=true — New Review and ' +
      'every governed-resolution control still hidden, and the frozen-artifact summary + observer ' +
      'acceptance status render once frozen) with the NEW self-service Observer Decision submission ' +
      '(/api/research/observer-review/[experimentId]/decision). Replaces the prior direct mount of ' +
      'IndependentReviewPanel here, which duplicated this workspace\'s review surface without an ' +
      'observer-decision mechanism of its own.',
  },
  'validation-programme-reviewer-agreement': {
    kind: 'component',
    component: 'ReviewerAgreementPanel',
    note:
      'The canonical experiment-scoped Independent Reviewer Agreement surface ' +
      '(components/research/ReviewerAgreementPanel.tsx), rendering Submit Review panels 1 and 2 — ' +
      'Review mandate, then agreement.exp-p1.independent-review.v1 with its explicit ' +
      'acknowledgement and conflict declaration. Operator ruling 2026-08-02: the agreement is a ' +
      'reusable experiment-scoped artifact, never a per-collaborator console artifact, and ' +
      'display alone never authorizes it — completion is derived server-side from the durable ' +
      'reviewer_agreement_authorizations row.',
  },
  'validation-programme-locker': {
    kind: 'component',
    component: 'LockerTab',
    note:
      "The real LockerTab (app/triad/components/codex/tabs/LockerTab.tsx), rendered directly with " +
      "visibleSections limited to ['peerExchange', 'uploadToLocker'] — Submit Review panel 3. " +
      'Operator instruction 2026-08-01, point 5 narrowed the Locker to the reviewer mandate; ' +
      'operator ruling 2026-08-02 then REMOVED the Invitation section from this stage entirely: ' +
      'invitation acceptance is an accession act performed before programme entry, on the ' +
      'invitation page, not a panel inside the final stage. The reviewer agreement moved to its ' +
      'own surface above (validation-programme-reviewer-agreement), so no capability here ' +
      'exceeds the reviewer mandate.',
  },
  'validation-programme-pipeline': {
    kind: 'component',
    component: 'PartnerProgrammesTab',
    note: "The Research Workspace's Pipeline view, locked to one workspace and rendered bare.",
  },
  'validation-programme-activity': {
    kind: 'component',
    component: 'PartnerProgrammesTab',
    note: "The Research Workspace's Activity view, locked to one workspace and rendered bare.",
  },

  // ── KNYTS Bridge journey (2026-08-09, reconstituted onto JourneyRunSurface
  // 2026-08-09) — the public front door (app/bridge/knyts/page.tsx) now
  // composes these THROUGH JourneyRunSurface's shared Posit Spine runner,
  // like every other journey in this registry. The prior header here claimed
  // JourneyRunSurface's stateUrl fetch on mount was incompatible with
  // HOME/VIEW being browsable signed-out — that claim does not hold up
  // against the actual route: /api/journey/knyts-bridge/state already
  // resolves `persona = null` for a signed-out caller and answers 200 (never
  // 401), and personaFetch itself never throws on a missing token — it just
  // omits the Authorization header. There is no incompatibility to work
  // around.
  'knyts-bridge-home': {
    kind: 'component',
    component: 'KnytsBridgeHomeSurface',
    note:
      'The ONE net-new visual surface in this journey (components/journey/KnytsBridgeHomeSurface.tsx) — ' +
      'hero/video/poster/CTA/reward copy, admin-editable via /api/journey/knyts-bridge/editorial-config. ' +
      'Every other KNYTS Bridge stage below composes an existing platform surface.',
  },
  'knyts-bridge-view-pulse': {
    kind: 'component',
    component: 'KnytCommunityContentTab',
    note:
      'The existing KNYT Pulse surface (app/triad/components/codex/tabs/KnytCommunityContentTab.tsx), ' +
      "campaign-filtered via the SAME cartridge='knyt', campaignTag=KNYTS_BRIDGE_CAMPAIGN_ID props the " +
      'old bespoke front door already passed — never a second, forked Pulse component.',
  },
  'knyts-bridge-orient': {
    kind: 'component',
    component: 'KnytsBridgeOrientationCard',
    note:
      "ORIENT's light explanation card (components/journey/KnytsBridgeOrientationCard.tsx) — no heavy " +
      'Bureau UI, no server call, no completion evidence of its own (see knytsBridgeCrossingJourney.ts).',
  },
  'knyts-bridge-buy-store': {
    kind: 'embed',
    codexSlug: 'knyt-codex',
    tab: 'store-episodes',
    note: 'The existing KNYT Store — no new commerce code, same tab the old front door deep-linked to.',
  },
  'knyts-bridge-mycanvas-remix': {
    kind: 'component',
    component: 'MyCanvasTab',
    note:
      'The existing myCanvas surface (app/triad/components/codex/tabs/MyCanvasTab.tsx), mounted with ' +
      "surface='canvas' — same Remix/RemixDialog/publish-to-pulse path every other Remix uses. Never a " +
      'forked campaign-specific remix UI.',
  },
  'knyts-bridge-stand': {
    kind: 'component',
    component: 'KnytsBridgeStandPanel',
    note:
      'Thin read-only projection (components/journey/KnytsBridgeStandPanel.tsx) over existing KNYT ' +
      'reaction counts, campaign-tagged share/conversion counts, and remix lineage — never a new ' +
      'reward ledger or scoring system (services/journey/knytsBridgeStand.ts).',
  },
};

/**
 * Build the iframe `src` for an 'embed'-kind surface descriptor. Pulled out
 * of JourneyRunSurface as its own pure function (al, 2026-08-04) so the
 * agentSlug propagation rule — appended ONLY when the descriptor opts in via
 * `agentScoped: true` AND a selected agent was actually supplied — is
 * directly unit-testable without rendering React or mocking Next.js router
 * hooks. `buildCodexUrl` is still the single place that turns options into a
 * URL; this function only decides WHICH options apply to a given surface.
 */
export function buildEmbedSurfaceSrc(
  descriptor: Extract<JourneySurfaceDescriptor, { kind: 'embed' }>,
  input: { personaId?: string; selectedAgentSlug?: string },
  buildUrl: (slug: string, opts: import('@/utils/codex-nav').CodexNavOptions) => string,
): string {
  return buildUrl(descriptor.codexSlug, {
    tab: descriptor.tab,
    personaId: input.personaId,
    shell: 'embed',
    suppressCopilot: descriptor.suppressFloatingCopilot,
    ...(descriptor.agentScoped && input.selectedAgentSlug ? { agentSlug: input.selectedAgentSlug } : {}),
  });
}
