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
  'venture-participate-standing': {
    kind: 'component',
    component: 'ParticipationStandingTab',
    note:
      'Standing — the deliberately lean Participation v1 surface (lanes, reach, receipts). Paired ' +
      '(2026-08-01) with the registry Ingestion Factory: the Ingestion Factory renders full width and ' +
      'untouched (default view), with Standing as one additional tab beside it — never a 4-way split ' +
      'of Standing itself. Rendered bare, superseding the embedded SmartWalletDrawer for this stage.',
  },
  'aigentme-welcome': {
    kind: 'embed',
    codexSlug: 'metame-codex',
    tab: 'aigent-me',
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
    component: 'IndependentReviewPanel',
    note:
      'The real IndependentReviewPanel (components/composer/IndependentReviewPanel.tsx) rendered ' +
      'directly with reviewerMode=true, not the Laboratory\'s embed shell around it — operator ' +
      'instruction 2026-08-01, point 4: "the exact same page... only addition: Download JSON for ' +
      'Agent." reviewerMode hides New Review and every governed-resolution control (freeze preview, ' +
      'accept/revise/defer/reject); Review Queue/Result/Crystal vP1 render unchanged, scoped server-' +
      'side to the caller\'s reviewer grant (requireReviewReadAccess).',
  },
  'validation-programme-locker': {
    kind: 'component',
    component: 'LockerTab',
    note:
      "The real LockerTab (app/triad/components/codex/tabs/LockerTab.tsx), rendered directly with " +
      "visibleSections limited to ['peerExchange', 'uploadToLocker', 'invitation'] — operator " +
      'instruction 2026-08-01, point 5: "reuse LockerTab, limited to: Peer Exchange / QubeTalk, ' +
      'Upload to Locker, Invitation and agreement artifacts. Hide credentials, agent channels, ' +
      'general locker inventory, location tracking." The Invitation section already carries the ' +
      'x409/access-invitation claim mechanics the reviewer uses to sign the collaboration/review ' +
      'agreement — no second signing UI.',
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
};
