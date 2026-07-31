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
 *
 * Confirmed genuinely absent — 'component-new' entries are the case-by-case
 * exception §5.2/§5.9 require, never a default, each justified in §22:
 *   - pulse-transparency-toggle, marketa-eligibility-view
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
      "MoneyPenny's real Agent Card (built 2026-07-31, components/journey/AgentCardSurface.tsx) — a " +
      "faithful display wrapper over the live /api/agents/moneypenny/agent-card.json route. As of " +
      "the SS3.1.1 correction, that route's metadata.horizen block now PROJECTS from her AigentQube " +
      "record (registry_assets 'aigentqube-moneypenny'), not a hand-typed literal. Honestly renders " +
      "tokenId: null as 'not yet registered' rather than fabricating a value.",
  },
  'horizen-registry-agent-page': {
    kind: 'external-url-unresolved',
    note:
      "Horizen's own live agent/registry page for a given tokenId. Only Horizen's API base " +
      '(services/horizen/client.ts HORIZEN_REGISTRY_API) is known in this repo — no confirmed ' +
      'human-browsable URL pattern exists. Must come from Horizen or their partner brief before ' +
      'Stage 1 can compose it, per CLAUDE.md’s no-guessing rule.',
  },
  'pulse-transparency-toggle': {
    kind: 'component-new',
    component: 'PulseTransparencyToggle',
    status: 'to-build',
    trackedIn: '§22 Verify row',
    note:
      'Confirmed absent 2026-07-31: only read-only backend fetchers exist (services/horizen/client.ts). ' +
      'No pnlDisclosure/pulseEnabled/financialTransparency UI exists anywhere in this repo.',
  },
  'marketa-eligibility-view': {
    kind: 'component-new',
    component: 'MarketaEligibilityView',
    status: 'to-build',
    trackedIn: '§22 Claim row',
    note:
      'Confirmed absent for this domain 2026-07-31: MarketaActivationEngineTab is a real but ' +
      'domain-mismatched surface (revenue/marketing-lane recruitment). ' +
      'services/passport/externalAgentAdmission.ts states no Marketa vetting workflow is implemented. ' +
      'Must wrap that service’s real eligibility logic, never the marketing-lane tab.',
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
      'Standing — the deliberately lean Participation v1 surface (lanes, reach, receipts, ' +
      'contribution history). Rendered bare, superseding the embedded SmartWalletDrawer for this stage.',
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
};
