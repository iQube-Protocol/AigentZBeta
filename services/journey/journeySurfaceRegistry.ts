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
 *   - passport-bureau-apply / -registry: polity-passport-bureau-cartridge
 *   - constitutional-agreements:         alpha-knyt-codex (tab partner-operate)
 *   - founder-office:                    alpha-knyt-codex (tab founder-office)
 *   - aigentme-welcome:                  metame-codex (tab aigent-me)
 *   - agent-card:                        app/api/agents/moneypenny/route.ts (JSON API, not a tab)
 *
 * Confirmed genuinely absent — 'component-new' entries are the case-by-case
 * exception §5.2/§5.9 require, never a default, each justified in §22:
 *   - pulse-transparency-toggle, marketa-eligibility-view,
 *     aigentme-focus-disposition-prompt
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
  'passport-bureau-registry': {
    kind: 'embed',
    codexSlug: 'polity-passport-bureau-cartridge',
    tab: 'registry',
    note:
      'Leading candidate for the "own passport status" view this stage needs (valid/continuing/' +
      'sponsor-eligible) — not yet deeply verified against that specific content (§22 open item).',
  },
  'constitutional-agreements': {
    kind: 'embed',
    codexSlug: 'alpha-knyt-codex',
    tab: 'partner-operate',
    note:
      'Confirmed real — PartnerProgrammesTab’s "Constitutional Agreements" panel, Venture Lab α, ' +
      'header "Pilot Command Center", exactly as the storyboard suspected.',
  },
  'agent-wallet': {
    kind: 'component',
    component: 'SmartWalletDrawer',
    note: 'Reused via the canonical embedded-mode-inside-the-copilot pattern (CLAUDE.md Wallet-Over-Cartridge Overlay).',
  },
  'aigentme-welcome': {
    kind: 'embed',
    codexSlug: 'metame-codex',
    tab: 'aigent-me',
    note:
      'Confirmed real and live — AigentMeWelcomeSplitTab, the operator’s existing copilot/dashboard ' +
      'shell. NOT itself a threshold-crossing/onboarding-disposition surface; composed as the base, ' +
      'with the disposition prompt layered on top (see aigentme-focus-disposition-prompt below).',
  },
  'aigentme-focus-disposition-prompt': {
    kind: 'component',
    component: 'AigentMeFocusDispositionPrompt',
    note:
      'Built 2026-07-31 (components/journey/AigentMeFocusDispositionPrompt.tsx) — the confirm/' +
      'decline-focus prompt per §5.10 (aigentMe Onboarding Oversight Principle). Writes ' +
      'experienceqube_focus_disposition_recorded (and, on first use, aigentme_activated) via ' +
      '/api/journey/moneypenny-horizen/aigentme/disposition. The principal, never the onboarding ' +
      'agent, decides whether its domain focus shapes their ExperienceQube population.',
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
