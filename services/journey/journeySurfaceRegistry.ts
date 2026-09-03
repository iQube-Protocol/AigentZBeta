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
       * Suppress the JOURNEY's OWN outer copilot host (`JourneyCopilotHost`,
       * mounted once by `JourneyRunSurface` independent of active stage)
       * while THIS surface is the active stage's embed (MoneyPenny
       * experience-coherence correction, 2026-09-03).
       *
       * The opposite direction from `suppressFloatingCopilot` above:
       * `suppressFloatingCopilot` kills a SECOND copilot the embedded
       * cartridge mounts for itself (e.g. metame-codex's floating
       * `CodexCopilotLayer`) so the journey's host copilot remains the one
       * conversation. This flag is for the reverse case — an embedded
       * surface (MoneyPenny's `MoneyPennyCopilotWorkspace`) already IS a
       * complete, persistent, task-scoped copilot experience in its own
       * right (not a bolt-on floating widget); keeping the journey's own
       * host copilot mounted alongside it puts two different agents, two
       * different conversations, on screen for the same action (SC-09:
       * "the host and embedded cartridge coordinate copilot ownership so
       * one active conversation is presented"). `moneypenny-orchestration-
       * focused` below is the confirmed live instance of this — before this
       * flag, Horizen's Operate stage showed the outer `JourneyCopilotHost`
       * AND MoneyPenny's own inline `SmartTriadCopilotLayer` at once.
       *
       * Declared per surface, same reasoning as `suppressFloatingCopilot`:
       * only a surface that supplies its own adequate persistent copilot
       * should suppress the host's — suppressing it globally would silence
       * the journey's companion for every other stage, where it is correct
       * and necessary.
       */
      suppressHostCopilot?: true;
      /**
       * Opt-in only (al, 2026-08-04) — this embed surface's URL should carry
       * the Journey's currently-selected agent as `?agentSlug=`. Explicit per
       * descriptor, never a blanket default: `founder-office` and
       * `passport-bureau-apply` are NOT agent-specific and must never receive
       * it, however JourneyRunSurface is called. Only `aigentme-welcome` sets
       * this true.
       */
      agentScoped?: true;
      /**
       * Focused presentation (operator direction, 2026-08-10 — "canonical
       * content, contextual chrome"): suppresses the destination cartridge's
       * PRIMARY chrome (its top-level brand/tab-group header and the group
       * sub-header strip that lets the operator jump to sibling tabs) via
       * CodexNavOptions.focused -> ?chrome=focused -> CodexPanelDynamic's
       * `suppressPrimaryChrome`. The active tab's own local content —
       * whatever toolbar, filters or sub-navigation it renders itself —
       * is untouched, since TabRenderer mounts it unconditionally either
       * way. A reusable journey behaviour, not KNYTS-specific: any stage
       * composing a canonical multi-tab cartridge inside the Guided Journey
       * viewport can opt a surface into it.
       */
      focused?: true;
      /**
       * Label for the "open the full canonical application" affordance
       * JourneyRunSurface renders above a focused embed (e.g. "Open KNYT
       * World ↗", "Explore metaMe ↗"). Only meaningful when `focused` is
       * true; defaults to a generic "Open full view ↗" when omitted.
       */
      openLabel?: string;
      /**
       * Static left-hand context label rendered on the SAME toolbar row as
       * `openLabel` (FS Operate viewport parity, 2026-08-25) — e.g.
       * "Financial Services — Operate → MoneyPenny Orchestration". Only
       * meaningful when `focused` is true and `rootTab` is not set (the two
       * occupy the same left slot; no current descriptor needs both). Static
       * because this field belongs to a per-journey FOREGROUND override — a
       * stage-scoped destination substitution, never a general-purpose
       * per-surface breadcrumb — so it is only ever set on descriptors a
       * `foregroundSurfaceRefByStage` override points at.
       */
      breadcrumb?: string;
      /**
       * Focused navigation depth (operator direction, 2026-08-10) — defines
       * how many navigation tiers above the content to reveal when focused:
       *   0 (default) — content surface only; no cartridge or domain nav
       *   1 — content + immediate parent/domain nav (e.g., Store tabs, metaMe views)
       *   2+ — content + multiple nav tiers (uncommon; future extensible)
       *
       * Only meaningful when `focused: true`. Examples:
       *   Pulse (View) — depth 0 (publication feed, self-contained)
       *   Store (Buy) — depth 1 (needs Episodes|KNYT Cards|Bundles|Investor KNYT tabs)
       *   myCanvas (Remix) — depth 0 (self-contained composer)
       *   aigentMe surfaces — depth 1 (needs metaMe/aigentMe nav context)
       *
       * May be dynamic (resolved per-call via resolveSurfaceProps) when
       * runtime state determines the required depth (e.g., Passport: depth 0
       * before established, depth 1 after).
       */
      focusedNavDepth?: number;
      /**
       * Embedded-return mechanism (2026-08-12, KNYTS↔CI parity pass) —
       * services/journey/bridgeEmbedNav.ts. Declares that this focused
       * embed's content can navigate itself to a sibling tab in the SAME
       * cartridge (e.g. a Quests card opening Living Canon via
       * CartridgePresenceRegistry's same-window tab switch) with no chrome
       * left to click back with. When set, JourneyRunSurface renders a
       * "← {returnLabel}" toolbar button that posts a return command into
       * the embed asking it to reset back to `rootTab` — WITHOUT switching
       * to expanded/full-chrome presentation (that remains the separate
       * `openLabel` affordance). Only meaningful alongside `focused: true`.
       */
      rootTab?: string;
      /** Label for the embedded-return toolbar button, e.g. "Back to Quests". */
      returnLabel?: string;
      /**
       * Expanded-projection cartridge (FS Bridge Explore-metaMe parity,
       * 2026-08-26). Every other `focused: true` descriptor today already
       * points `codexSlug` at the destination's OWN canonical cartridge
       * (KNYT Pulse/Quests/Store all point at `knyt-codex` itself), so
       * clearing `focused` on `openLabel` click just lifts that same
       * cartridge's chrome suppression — `codexSlug`/`tab` never need to
       * change. `moneypenny-orchestration-focused` is different: its
       * `codexSlug`/`tab` point at a MIRROR of MoneyPenny's Orchestration
       * panel living inside `metame-codex`, not at MoneyPenny's own
       * cartridge (`moneypenny-codex`, `data/codex-configs.ts`'s
       * `MONEYPENNY_CARTRIDGE` — the one with the real Operate/Connect/
       * Service/Administer nav). Expanding that mirror can only ever
       * reveal `metame-codex`'s OWN top-level chrome, never MoneyPenny's.
       * `expandedCodexSlug` lets a descriptor opt into swapping the
       * destination cartridge itself on expand, instead of just lifting
       * chrome suppression on the one it already has. Kept as a general,
       * reusable field on the shared type — not a MoneyPenny-only branch
       * in JourneyRunSurface — for the next descriptor that mirrors a
       * foreign cartridge's tab the same way. Only meaningful alongside
       * `focused: true`; falls back to `codexSlug` when unset.
       */
      expandedCodexSlug?: string;
      /**
       * Default tab to land on inside `expandedCodexSlug` (FS Bridge
       * Explore-metaMe parity, 2026-08-26) — e.g. MoneyPenny's expanded
       * view still opens on Orchestration (`service-orchestration`,
       * `MONEYPENNY_CARTRIDGE`'s own tab of that name) rather than falling
       * through to the cartridge's natural first tab (HFT Console), while
       * now exposing the REAL Operate/Connect/Service/Administer nav to
       * navigate away from it. Only meaningful alongside
       * `expandedCodexSlug`; falls back to `tab` when unset.
       */
      expandedTab?: string;
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
      "Re-homed onto the Activate stage (Activate Consolidation, 2026-08-11) — formerly the Ingest/" +
      "deploy stage's ONE guided action (Horizen Pilot Closure, part 2, operator decision A, " +
      '2026-08-09, components/journey/IngestIntoFactoryPanel.tsx) — writes the agent-scoped ' +
      "`capability_registered` receipt via POST /api/journey/moneypenny-horizen/ingest. No longer " +
      "gated on Operate. Mirrors OrientationPanel's observe-then-act shape exactly. Rendered ABOVE " +
      "'venture-participate-standing' below, which stays the read-only iQube Registry evidence " +
      'catalogue — this panel is the guided act, never a replacement for that evidence surface.',
  },
  'venture-participate-standing': {
    kind: 'component',
    component: 'ParticipationStandingTab',
    note:
      'Re-homed onto the Activate stage (Activate Consolidation, 2026-08-11): the registry Ingestion Factory' +
      ' ALONE. It was previously paired with Standing as two tabs here; operator direction ' +
      '2026-08-02 separated them, so this mount pins ' +
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
  'moneypenny-orchestration-focused': {
    kind: 'embed',
    codexSlug: 'metame-codex',
    // 'home' (navigation/viewport correction, 2026-09-03) — metame-codex's
    // MoneyPenny group no longer has a single fixed 'moneypenny-orchestration'
    // tab; it now carries the real Home/My Money/Plan/Markets/Activity/Admin
    // submenu (MONEYPENNY_AREA_TABS, data/codex-configs.ts), and 'home' is
    // its own default landing tab. The retired slug still resolves via
    // LEGACY_TAB_SLUGS for any stored link, but this registry entry (the
    // primary source) targets the real tab directly.
    tab: 'home',
    // The Journey Runtime copilot (mounted once by JourneyCopilotHost) is the
    // one persistent MoneyPenny copilot on screen — the embedded tab must not
    // mount a second one (MS-1), same rule as aigentme-welcome above.
    suppressFloatingCopilot: true,
    // MoneyPenny experience-coherence correction (2026-09-03) — corrects the
    // OTHER half of the dual-copilot defect this descriptor's own
    // `suppressFloatingCopilot` above only partly addressed: that flag kills
    // metame-codex's floating `CodexCopilotLayer`, but `MoneyPennyPanelTab`
    // wraps every panel (including this one) in `MoneyPennyCopilotWorkspace`,
    // which mounts its OWN persistent `SmartTriadCopilotLayer` pane
    // unconditionally — a second, different, live conversation alongside the
    // Journey's own `JourneyCopilotHost`. MoneyPenny's inline copilot is a
    // complete replacement for the host's, not an addition to it, so the
    // host suppresses itself instead (see `suppressHostCopilot`'s own doc
    // comment on the type above).
    suppressHostCopilot: true,
    // focusedNavDepth: 1 (navigation/viewport correction, 2026-09-03,
    // supersedes the 2026-08-25 depth-0 pinning below). Depth 0 hides BOTH
    // metaMe's top-level nav AND the MoneyPenny group's own tier-2
    // sub-header — harmless when the group had exactly one tab (there was
    // no sub-header to show either way), but now that the group carries the
    // real Home/My Money/Plan/Markets/Activity/Admin submenu
    // (MONEYPENNY_AREA_TABS), depth 0 would hide that submenu along with
    // metaMe's own chrome. Depth 1 hides only the outer metaMe nav while
    // keeping the submenu navigable — the SAME depth
    // `MoneyPennyBridgeEmbed.tsx` already uses for the standalone
    // moneypenny-codex cartridge, so CI/Knightsbridge/Horizen now share one
    // focused/expanded contract (Operate principle §1) rather than each
    // picking its own depth.
    focused: true,
    focusedNavDepth: 1,
    openLabel: 'Explore metaMe ↗',
    breadcrumb: 'Financial Services — Operate → MoneyPenny',
    // Expanded Operate correction (2026-09-03, operator directive: "Reveal
    // the metaMe runtime shell inside the existing bridge frame. Select
    // MoneyPenny in metaMe's primary navigation... Do not expand into the
    // standalone Aigent MoneyPenny shell") — REVERSES the 2026-08-26
    // decision below to swap the expand destination to the standalone
    // `moneypenny-codex` cartridge. That swap was itself a correction for a
    // real defect (expanding used to just lift metame-codex's own chrome
    // off a lone, submenu-less mirror tab, revealing nothing useful) — but
    // its fix over-corrected past metaMe entirely. Now that metame-codex's
    // MoneyPenny group carries the real submenu (MONEYPENNY_AREA_TABS), the
    // ORIGINAL problem (expand reveals nothing) no longer exists: lifting
    // metame-codex's own chrome via `focused: undefined` (JourneyRunSurface's
    // toggle, buildEmbedSurfaceSrc's `isExpandedProjection` check) now shows
    // metaMe's real top-level nav with MoneyPenny selected AND its submenu
    // beneath — exactly the "reveal the metaMe runtime shell" contract. No
    // `expandedCodexSlug`/`expandedTab` needed: omitting both is what makes
    // `isExpandedProjection` false, falling back to this descriptor's own
    // `codexSlug`/`tab` (metame-codex/home) in both focused and expanded
    // states, differing only in which chrome tiers are suppressed.
    note:
      'FS Operate viewport + Focus/Full parity correction (2026-08-25, revised 2026-09-03) — the ' +
      'SAME MoneyPenny tab (metame-codex/home, formerly metame-codex/moneypenny-orchestration) ' +
      '`resolveJourneyOperatorDestination` already resolves for Horizen\'s Operate stage, composed ' +
      "through the canonical `kind: 'embed'` + `focused: true` presentation primitive (the same one " +
      'KNYT Pulse/Quests/Store and CI/KNYTS myCanvas already use) instead of a raw, unsized iframe ' +
      'built by hand in FinancialServicesBridgeFrontDoor. Fixes the Amplify-visible defect where the ' +
      "hand-built iframe collapsed to its intrinsic browser height (no resolved h-full/flex-1 " +
      "ancestor) and carried no Focus/Full toggle. `resolveJourneyOperatorDestination` still owns " +
      'WHETHER this is the correct Operate destination for the current threshold state — this entry ' +
      'only owns HOW that destination is presented once chosen. codexSlug/tab intentionally mirror ' +
      "ACTIVATION_CATALOG's 'moneypenny' entry (cartridgeRef/tabSlug) — kept in parity by a canary in " +
      'tests/fs-operate-embed-viewport-parity.test.ts rather than derived at runtime, matching every ' +
      "other static registry entry's convention. Expand now stays inside metame-codex — see this " +
      "entry's own comments above for why the earlier expandedCodexSlug/expandedTab swap to the " +
      'standalone moneypenny-codex cartridge was reversed.',
  },
  'founder-office': {
    kind: 'embed',
    codexSlug: 'alpha-knyt-codex',
    tab: 'founder-office',
    note:
      'Confirmed real and substantial 2026-07-31 (corrects the earlier storyboard-era "placeholder" ' +
      'assumption) — FounderOfficeTab, a live Workspace/Discover/Validate/Architect/Blueprint surface.',
  },

  // ── Ian Boundary Research journey (2026-08-24 surgical pass) — every
  // entry below composes an EXISTING real capability; nothing here forks a
  // second implementation of Passport, Delegation, or Reciprocal Artifact
  // Exchange. See services/journey/ianBoundaryResearchJourney.ts's header.
  'ian-orientation-panel': {
    kind: 'component',
    component: 'IanOrientationPanel',
    note:
      'Orient stage — components/journey/IanOrientationPanel.tsx. A genuinely new, minimal panel ' +
      '(no existing generic "explain this collaboration" surface to reuse) — deliberately NOT the ' +
      'Horizen OrientationPanel, whose ritual is scoped to external-AGENT admission, a different ' +
      'capability instance. Posts to /api/journey/ian/orient/acknowledge.',
  },
  'irl-exchange-workspace': {
    kind: 'embed',
    codexSlug: 'irl-cartridge',
    tab: 'irl-exchange',
    focused: true,
    openLabel: 'Explore IRL OS ↗',
    // Access-boundary correction (2026-08-26): External IRL participation is
    // always mediated through IRL OS; metaMe IRL is the internal comprehensive
    // laboratory and is strictly admin-gated (see IRL_CARTRIDGE's tabs in
    // data/codex-configs.ts). Before this fix, expanding this focused embed's
    // "Open full view" affordance (`buildEmbedSurfaceSrc`'s `isExpandedProjection`
    // path — the SAME mechanism `moneypenny-orchestration-focused` established
    // the same day) lifted metame-irl-cartridge's OWN chrome — dropping an
    // external OCSGA participant (e.g. Ian) into the internal lab shell. The
    // focused embed itself is UNCHANGED (codexSlug/tab still point at
    // irl-cartridge's irl-exchange tab, which is deliberately NOT admin-gated —
    // see that tab's own comment in data/codex-configs.ts): only the EXPANDED
    // destination now differs, landing on IRL OS.
    //
    // CONTAINED 2026-08-27, RESTORED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
    // irl-os-workspace was `enabled: false` during containment — it shared
    // PartnerProgrammesTab/DeepLinkCard rendering with metaMe IRL's own
    // Workspace tab, which constructed live irl-cartridge deep links
    // directly in the public cartridge, so this affordance was repointed at
    // the always-enabled Welcome tab. irl-os-workspace is now restored with
    // a render-boundary guard (`forbiddenCodexSlugs` — data/codex-configs.ts's
    // `buildResearchWorkspaceTab`) that drops any irl-cartridge DeepLinkCard
    // for THIS mount, so it is safe to point back at the real Workspace
    // destination.
    expandedCodexSlug: 'irl-os-cartridge',
    expandedTab: 'irl-os-workspace',
    note:
      'The REAL Reciprocal Artifact Exchange workspace (IRLExchangeTab, PRD-IRL-AX-001) — reused ' +
      'verbatim across create-deposit, freeze-attestation-ready, freeze-attestation, exchange-ready ' +
      'and exchange-complete. One real component; Journey Spine only labels which point in its own ' +
      'internal deposit -> freeze -> sign -> cross flow the participant is at. Never forked. Full-view ' +
      'expansion targets IRL OS, never metaMe IRL — see expandedCodexSlug/expandedTab above.',
  },
  'boundary-research-progress': {
    kind: 'component',
    component: 'BoundaryResearchProgressPanel',
    note:
      'research-active\'s persistent destination (item 7, semantic repair 2026-08-25) — the active ' +
      'persona\'s own assigned experiment(s): lifecycle/progress + evidence, reusing PartnerProgrammesTab ' +
      'exactly as the Validation Programme\'s "Experiment Progress" stage does (lockedWorkspaceId). ' +
      'Replaces the prior generic IRL Welcome + IRL Dashboard embed, which showed platform-wide content ' +
      'with no relation to what this persona is actually assigned to. "Explore IRL OS" remains reachable ' +
      'from inside the new component.',
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

  // ── KNYTS Bridge journey (built 2026-08-09, reconstituted onto
  // JourneyRunSurface same day, surface-reconciled 2026-08-09 third pass) —
  // the public front door (app/bridge/knyts/page.tsx) composes these
  // THROUGH JourneyRunSurface's shared Posit Spine runner, like every other
  // journey in this registry. Operator correction (surface reconciliation):
  // "treat KNYTS Bridge as a surface-level constitutional guide into two
  // deeper worlds: the KNYT cartridge and metaMe/aigentMe... each node
  // should open a real existing destination surface, not a thin imitation
  // of one." VIEW/STAND/BUY are now embeds of the actual KNYT cartridge tabs
  // (never a second renderer); PASSPORT and REMIX stay bare `component`
  // surfaces because they need per-visit state/dynamic params a plain embed
  // descriptor can't carry (see each note below).
  'knyts-bridge-home': {
    kind: 'component',
    component: 'KnytsBridgeMediaStage',
    note:
      'KNYTS↔CI parity pass (2026-08-12): HOME-only now (ORIENT split into ' +
      "KnytsBridgeOrientIntro) — a thin amber-preset wrapper over the SAME generic " +
      'BridgeMediaStage (layout="cinematic") CI\'s own ConstitutionalInternetBridgeMediaStage ' +
      'uses, including its overlay fade behavior. Hero/video/poster/CTA/reward copy stay ' +
      'admin-editable via /api/journey/knyts-bridge/editorial-config.',
  },
  'knyts-bridge-view-pulse': {
    kind: 'embed',
    codexSlug: 'knyt-codex',
    tab: 'pulse',
    suppressFloatingCopilot: true,
    focused: true,
    focusedNavDepth: 0,
    openLabel: 'Open KNYT World ↗',
    note:
      'The canonical KNYT Pulse tab itself, full and unfiltered — never a Bridge-scoped slice of it. ' +
      "The Crossing-of-the-Week banner and the self-service 'Crossings' filter chip now live natively " +
      'on KnytCommunityContentTab (app/triad/components/codex/tabs/KnytCommunityContentTab.tsx), so they ' +
      'appear identically whether Pulse is reached through the Bridge or through the KNYT cartridge. ' +
      "Focused surface-polish pass (2026-08-10): `focused: true` hides the KNYT cartridge's own top-level " +
      "header/tab-group nav (Codex/Store/Order/Admin/Docs and the Order-group sibling strip) so a first-" +
      "time Threshold visitor sees Pulse itself, not the whole cartridge — Pulse's own toolbar is unaffected. " +
      'Depth 0 means content only (publication feed).',
  },
  'knyts-bridge-orient': {
    kind: 'component',
    component: 'KnytsBridgeOrientIntro',
    note:
      'KNYTS↔CI parity pass (2026-08-12): ORIENT is now a thin amber-preset wrapper ' +
      '(components/journey/KnytsBridgeOrientIntro.tsx) over the bridge-neutral ' +
      'BridgeOrientSurface — the SAME two-column layout and shared ' +
      'ConstitutionalFrontierOrientSurface questionnaire CI composes, never a second ' +
      'questionnaire implementation. No heavy Bureau UI, no server call, no completion ' +
      'evidence of its own (see knytsBridgeCrossingJourney.ts).',
  },
  'knyts-bridge-passport-room': {
    kind: 'component',
    component: 'KnytsBridgePassportRoom',
    note:
      'KNYTS↔CI parity pass (2026-08-12): reconstituted onto the CI Passport framework — no usable ' +
      'Passport → the canonical PassportBureauApplyTab claim flow; Passport established → a dismissible ' +
      '"you have crossed" banner, a parchment-matte plate pane, and the SAME shared ' +
      'BridgeActionModeQuestion (Create/Build/Develop/Research/Safeguard) CI composes, never a second ' +
      'questionnaire. The prior auto-embedded aigentMe iframe is retired — meeting/delegating to aigentMe ' +
      'is a PERSONIFY/Remix-time decision, not forced on every visitor at Passport establishment. A bare ' +
      "`component` because it needs the Passport stage's OWN resolved evidence (citizenPassportUsable, " +
      'threaded in by the page via resolveSurfaceProps) to decide which half to render.',
  },
  'knyts-bridge-mycanvas-remix': {
    kind: 'component',
    component: 'KnytsBridgeRemixSurface',
    note:
      'Embeds the canonical myCanvas tab (metame-codex/mycanvas) inside the metaMe/aigentMe environment ' +
      '(components/journey/KnytsBridgeRemixSurface.tsx) — never the bare, cartridge-less MyCanvasTab ' +
      "mount this used before. A bare `component` (not a plain embed) only because it must append a " +
      "per-visit `remix=` payload when resuming an interrupted Remix intent, which a static embed " +
      'descriptor cannot carry. Also carries `campaignTag=knyts-bridge-crossing` so MyCanvasTab offers ' +
      'the Crossing the Threshold starter template instead of the generic Qriptopian one.',
  },
  'knyts-bridge-stand': {
    kind: 'embed',
    codexSlug: 'knyt-codex',
    tab: 'quests',
    suppressFloatingCopilot: true,
    focused: true,
    focusedNavDepth: 0,
    openLabel: 'Open KNYT World ↗',
    rootTab: 'quests',
    returnLabel: 'Back to Quests',
    note:
      'The canonical KNYT Quests tab (app/triad/components/codex/tabs/KnytQuestsTab.tsx) — "Standing is ' +
      'the constitutional outcome; Quest is the KNYT mechanic through which you earn it." The spine ' +
      'label stays Stand; the surface underneath is the real, KNYT-native Quests experience, never a ' +
      'thin bespoke Standing projection. `focused: true` (2026-08-10) hides the cartridge primary chrome; ' +
      "Quests's own filters/controls are untouched. Depth 0 means content only (quests feed). " +
      'rootTab/returnLabel (2026-08-12, parity pass): Quests cards can navigate this SAME cartridge to ' +
      'Living Canon (a same-window CartridgePresenceRegistry tab switch); the "Back to Quests" toolbar ' +
      '(services/journey/bridgeEmbedNav.ts) returns here without leaving focused presentation.',
  },
  'knyts-bridge-buy-store': {
    kind: 'embed',
    codexSlug: 'knyt-codex',
    tab: 'store-episodes',
    suppressFloatingCopilot: true,
    focused: true,
    focusedNavDepth: 1,
    openLabel: 'Open KNYT World ↗',
    note:
      'The existing KNYT Store — no new commerce code, same tab the old front door deep-linked to. ' +
      "`focused: true` (2026-08-10) gives a clean focused Store viewport: cartridge chrome suppressed, " +
      "the Store tab's own category/local controls untouched, with an \"Open KNYT World ↗\" affordance " +
      "to leave the guide. Depth 1 retains the Store's own navigation strip (Episodes|KNYT Cards|Bundles|" +
      'Investor KNYT) which is required for the destination to remain functionally navigable.',
  },
  // ── Financial Sovereignty segment (AEE-XP-001 §4.2) — reuses the SAME
  // bridge-neutral FinancialSovereigntyIntroStage/FinancialSovereigntyPrepareCrossStage
  // components the CI Bridge section below uses, amber preset here.
  'knyts-bridge-fs-discover': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="discover", accent="amber") — reuses BridgeMediaStage; props threaded by the page resolveSurfaceProps keyed on this ref.',
  },
  'knyts-bridge-fs-learn': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="learn", accent="amber") — reuses BridgeMediaStage.',
  },
  'knyts-bridge-fs-explore': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="explore", accent="amber") — projects the real serviceCatalog.',
  },
  'knyts-bridge-fs-prepare': {
    kind: 'component',
    component: 'FinancialSovereigntyPrepareCrossStage',
    note: 'FinancialSovereigntyPrepareCrossStage(mode="prepare", accent="amber") — B2 (2026-09-02): financial-profile review via fetchFinancialProfileSummary + a deep link into MoneyPenny\'s financial-profile panel, then Continue to Operate; props threaded by the page resolveSurfaceProps keyed on this ref.',
  },
  'knyts-bridge-fs-operate': {
    kind: 'component',
    component: 'FinancialSovereigntyOperateStage',
    note: 'FinancialSovereigntyOperateStage(accent="amber") — B1 (2026-09-02): the intermediary "Operate with MoneyPenny" workspace, a distinct stage identity from the advanced Horizen aigentme stage (also labeled "Operate").',
  },
  'knyts-bridge-fs-cross': {
    kind: 'component',
    component: 'FinancialSovereigntyPrepareCrossStage',
    note: 'FinancialSovereigntyPrepareCrossStage(mode="cross", accent="amber") — builds the ExperienceHandoff and navigates to /bridge/fs.',
  },
  'knyts-bridge-choose': {
    kind: 'component',
    component: 'KnytsBridgeChooseSurface',
    note:
      'CHOOSE stage — six destination options for continuing the journey: Reserve metaKnyt Agentic Graphic ' +
      'Novel, Explore the KNYT Store, Learn about the Constitutional Internet, Apply to join the ' +
      'Constitutional Financial Services Pilot, Ask Kn0w1, Share the Bridge & Earn $KNYT. A bare ' +
      '`component` surface using the same contextual-left-pane interaction model as the CI Bridge CHOOSE ' +
      'pattern (ConstitutionalInternetBridgeChooseSurface) — Store/CI switch an embedded left pane rather ' +
      'than navigating away.',
  },

  // ── Constitutional Internet Bridge journey (built 2026-08-10, reconstituted
  // onto JourneyRunSurface same day) — the canonical Ethos Bridge, sibling of
  // the KNYTS Bridge Threshold Guide on the SAME shared runner. The public
  // front door (app/bridge/ci/page.tsx) composes these THROUGH
  // JourneyRunSurface's shared Posit Spine runner, like every other journey
  // in this registry — never stacked manually beneath it. HOME/VIEW/ORIENT/
  // CHOOSE are `component` surfaces (no canonical external cartridge tab
  // equivalent exists for this bespoke CI content, unlike KNYTS's
  // Pulse/Quests/Store embeds); PASSPORT stays a bare `component` because it
  // needs the stage's own resolved evidence (citizenPassportUsable) to decide
  // which half to render, exactly like knyts-bridge-passport-room.
  'ci-bridge-home': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgeMediaStage',
    note:
      'components/journey/ConstitutionalInternetBridgeMediaStage.tsx (evolved 2026-08-11 from a bare ' +
      'BridgeMediaStage mount to a self-fetching wrapper around it) — the CI proposition ("The Internet ' +
      'recognizes accounts. The Constitutional Internet recognizes persons."), now admin-configurable ' +
      '(headline/copy/video/poster/primary-CTA-label) via the SAME knyts_bridge_editorial_config table ' +
      'KNYTS uses (section=ci-home). The two CTA callbacks (advance to View / Choose) are still threaded ' +
      'in via the page\'s resolveSurfaceProps, dispatching the shared journey:select-stage event.',
  },
  'ci-bridge-view': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgeViewSequence',
    note:
      'components/journey/ConstitutionalInternetBridgeViewSequence.tsx — evolved 2026-08-11 into ' +
      'Ethos | Crossings, then rebuilt the same day onto the shared BridgeContentCapsule shell ' +
      '(components/journey/BridgeContentCapsule.tsx). Ethos: one capsule per vignette (block), whose rail ' +
      'offers whichever media genuinely exists — Video (admin-overridable via section=ci-view-<blockId>), ' +
      'Plate (always, real CANONICAL_PLATES_V1), Paper (only once a real paperRef exists) — with a constant ' +
      '"Book Insert" strip (verbatim excerpt, cited by line, + ListenButton) regardless of the active rail ' +
      'card. Moving between vignettes is real swipe/paging via components/ui/carousel.tsx, replacing the ' +
      'earlier hand-rolled translateX carousel. Crossings: unchanged — a thin projection over the EXISTING ' +
      'Qriptopian Pulse (KnytCommunityContentTab, cartridge=\'qripto\', campaignTag=CI_BRIDGE_CAMPAIGN_ID) — ' +
      'never a new feed/table/moderation system. A bare `component`, not an `embed`, because it needs ' +
      'personaId for Crossings\' Mine filter (threaded via resolveSurfaceProps).',
  },
  'ci-bridge-orient': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgeOrientIntro',
    note:
      'components/journey/ConstitutionalInternetBridgeOrientIntro.tsx (evolved 2026-08-11) — an ' +
      'admin-configurable media/context header (section=ci-orient, same editorial-config table as HOME) ' +
      'framing "personhood precedes identity," composed above ConstitutionalFrontierOrientSurface (a ' +
      'deterministic, non-gating questionnaire, no LLM; persists choices as a best-effort intent/demand ' +
      'signal via the generic campaign_events log, never as constitutional state — completing it is not ' +
      'tracked evidence). That questionnaire itself now renders on the shared BridgeContentCapsule shell ' +
      '(exactly 3 rail cards — Help / Preserve / Authority, never a 4th "Connect Claude" card — one question ' +
      'active at a time, persistent strip carrying progress + the reveal action), so this wrapper composes ' +
      'the header directly above it rather than nesting it in a second bordered card.',
  },
  'ci-bridge-passport-room': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgePassportRoom',
    note:
      'State-aware constitutional room (components/journey/ConstitutionalInternetBridgePassportRoom.tsx), ' +
      'mirroring knyts-bridge-passport-room\'s exact pattern: no usable Passport -> the canonical ' +
      'PassportBureauApplyTab claim flow; Passport established -> "You have crossed." + a continuation ' +
      'toward PERSONIFY (renamed from ACT, 2026-08-11; never an inline aigentMe embed here, since ' +
      'PERSONIFY itself already offers the real aigentMe embed as a supporting tool). A bare `component` ' +
      'because it needs the Passport stage\'s OWN resolved evidence (citizenPassportUsable, threaded in ' +
      'by the page via resolveSurfaceProps) to decide which half to render — a plain embed cannot branch.',
  },
  'ci-bridge-personify-mycanvas': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgePersonifyMyCanvas',
    note:
      'components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx — PERSONIFY\'s ONLY surface ' +
      '(consolidated 2026-08-11, targeted correction pass — previously paired with a second registered ' +
      'surface, ci-bridge-personify-field-entry/ConstitutionalAgentFieldEntrySurface, now removed: it ' +
      'embedded a SECOND metame-codex/aigent-me iframe whose own internal AigentMeWelcomeSplitTab shell ' +
      'brought along an unrelated Horizen "Focus Check-in" ceremony, producing four visually stacked ' +
      'agent-relationship representations on one page instead of one). "Tell your Constitutional story," ' +
      'mirroring KnytsBridgeRemixSurface\'s exact pattern — the SAME myCanvas tab (metame-codex/mycanvas), ' +
      'campaignTag=CI_BRIDGE_CAMPAIGN_ID selecting MyCanvasTab\'s starter template (with its own "Connect ' +
      'Claude" rail chip, also campaign-scoped) and, via its own campaignTag->cartridge lock map, forcing ' +
      'published output to Qriptopian Pulse — never a second, CI-specific editor or publishing endpoint. ' +
      'A bare `component` (not `embed`) because it builds its own iframe src directly via buildCodexUrl, ' +
      'same as KnytsBridgeRemixSurface. Now composes TWO panes side by side: the myCanvas iframe (left) ' +
      'and an aigentMe pane (right) rendering ConstitutionalAgentDispositionSurface\'s "Shape your story" ' +
      'role/authority question directly as a React component wrapped in LayoutShell — no second iframe, ' +
      'no incidental Horizen ceremony. Either the story itself or the disposition question alone still ' +
      'completes PERSONIFY\'s agentRelationshipStarted evidence.',
  },
  'ci-bridge-stand': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgeStandPanel',
    note:
      'components/journey/ConstitutionalInternetBridgeStandPanel.tsx — reads the real Passport/' +
      'disposition receipts and the canonical Standing score (services/standing/standingScore.ts). ' +
      'Deliberately does NOT repeat the KNYTS Bridge STAND panel\'s mislabeling of engagement counters ' +
      'as "Standing" — see services/journey/constitutionalInternetBridgeStand.ts\'s header.',
  },
  // ── Financial Sovereignty segment (AEE-XP-001 §4.2) — reuses the SAME
  // bridge-neutral components the KNYTS Bridge section above uses, indigo preset here.
  'ci-bridge-fs-discover': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="discover", accent="indigo") — reuses BridgeMediaStage.',
  },
  'ci-bridge-fs-learn': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="learn", accent="indigo") — reuses BridgeMediaStage.',
  },
  'ci-bridge-fs-explore': {
    kind: 'component',
    component: 'FinancialSovereigntyIntroStage',
    note: 'FinancialSovereigntyIntroStage(stageKey="explore", accent="indigo") — projects the real serviceCatalog.',
  },
  'ci-bridge-fs-prepare': {
    kind: 'component',
    component: 'FinancialSovereigntyPrepareCrossStage',
    note: 'FinancialSovereigntyPrepareCrossStage(mode="prepare", accent="indigo") — B2 (2026-09-02): financial-profile review, then Continue to Operate.',
  },
  'ci-bridge-fs-operate': {
    kind: 'component',
    component: 'FinancialSovereigntyOperateStage',
    note: 'FinancialSovereigntyOperateStage(accent="indigo") — B1 (2026-09-02): the intermediary "Operate with MoneyPenny" workspace, a distinct stage identity from the advanced Horizen aigentme stage (also labeled "Operate").',
  },
  'ci-bridge-fs-cross': {
    kind: 'component',
    component: 'FinancialSovereigntyPrepareCrossStage',
    note: 'FinancialSovereigntyPrepareCrossStage(mode="cross", accent="indigo") — builds the ExperienceHandoff and navigates to /bridge/fs.',
  },
  'ci-bridge-choose': {
    kind: 'component',
    component: 'ConstitutionalInternetBridgeChooseSurface',
    note:
      'components/journey/ConstitutionalInternetBridgeChooseSurface.tsx — reserve the book, continue ' +
      'reading, meet aigentMe, join the research field, build/partner, share the Bridge. A bare ' +
      '`component`, like knyts-bridge-buy-store\'s destination is an `embed` only because a canonical ' +
      'KNYT Store tab exists to embed — no CI-equivalent commerce surface exists yet (see the CI Bridge ' +
      'build history: the KNYT commerce engine has no wired preorder SKU for a new book product today).',
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
  input: { personaId?: string; selectedAgentSlug?: string; focus?: string },
  buildUrl: (slug: string, opts: import('@/utils/codex-nav').CodexNavOptions) => string,
): string {
  // Expanded-cartridge projection (FS Bridge Explore-metaMe parity,
  // 2026-08-26) — `descriptor.focused` arriving here is ALREADY the
  // caller's post-toggle value (JourneyRunSurface spreads
  // `{ ...descriptor, focused: shouldFocus ? true : undefined }` before
  // calling this function, exactly like the `focusedNavDepth` gating just
  // below reads it). That is the ONE signal distinguishing Focus view from
  // an Explore-metaMe-style expand — reused here rather than adding a
  // second flag. A descriptor with no `expandedCodexSlug` (every focused
  // descriptor except moneypenny-orchestration-focused, today) is
  // untouched: `codexSlug`/`tab` resolve exactly as before in both states.
  const isExpandedProjection = !descriptor.focused && !!descriptor.expandedCodexSlug;
  const codexSlug = (isExpandedProjection && descriptor.expandedCodexSlug) || descriptor.codexSlug;
  const tab = isExpandedProjection ? (descriptor.expandedTab ?? descriptor.tab) : descriptor.tab;
  return buildUrl(codexSlug, {
    tab,
    personaId: input.personaId,
    shell: 'embed',
    suppressCopilot: descriptor.suppressFloatingCopilot,
    focused: descriptor.focused,
    // Only meaningful when actually focused — a caller that has overridden
    // `focused` to undefined (JourneyRunSurface's "Full view" expansion
    // toggle) must render full canonical chrome, not the depth the REGISTRY
    // still carries statically. Gating here, at the shared embed/chrome
    // boundary, means neither caller has to remember to clear depth too.
    focusedNavDepth: descriptor.focused ? descriptor.focusedNavDepth : undefined,
    ...(descriptor.agentScoped && input.selectedAgentSlug ? { agentSlug: input.selectedAgentSlug } : {}),
    // Per-stage presentation-only section focus (Reciprocal Artifact
    // Exchange focus contract, 2026-08-25) — sourced from the calling
    // stage's own JourneySurfaceRef.props.focus, never a registry-level
    // field, since the SAME registry entry is shared across multiple
    // stages that each need a different focus value.
    focus: input.focus,
  });
}
