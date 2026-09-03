/**
 * MoneyPennyPanelTab — the ONE dispatcher every MoneyPenny entry point
 * routes through (SPEC-VLM-001 Phase 2, 2026-07-24 — CFS-050 Sovereignty
 * Navigation's second applied test case, after Venture Lab).
 *
 * MoneyPenny experience-coherence correction (2026-09-03): `MONEYPENNY_
 * CARTRIDGE` (`data/codex-configs.ts`) previously hand-authored FOURTEEN
 * real `CodexTab` entries across four groups (HFT/Connect/Service/
 * Administer) — each a legitimate codex tab, so `CodexPanelDynamic.tsx`
 * rendered its OWN top-level group bar and sibling-tab sub-header ABOVE
 * this dispatcher, stacked on top of the five-area nav
 * (`MoneyPennyAreaNav.tsx`) this dispatcher's own workspace already
 * renders below it — navigation inside navigation, the exact defect named
 * in the operator's correction. `MONEYPENNY_CARTRIDGE` now registers
 * exactly ONE tab, so `CodexPanelDynamic`'s own documented behaviour
 * ("When only one tab is available, the tab shell manages its own
 * navigation chrome" — `singleTabMode`) suppresses that outer chrome
 * entirely, using an existing platform mechanism rather than a
 * route-specific CSS override.
 *
 * Collapsing to one tab means this dispatcher can no longer rely on a
 * STATIC `config.props.panel` per tab to know which panel to show, nor can
 * `MoneyPennyAreaNav`/`MoneyPennyOverviewPanel`'s in-app navigation keep
 * working by asking `CodexPanelDynamic` to activate a DIFFERENT tab (there
 * is only one). So `activePanel` is now REAL React state OWNED here —
 * mirroring Agent Me's own pattern (`AigentMeWelcomeSplitTab.tsx`'s
 * `activeCapsuleId`/`activeLayoutId`), the operator's explicit design
 * reference — initialized from an explicit `panel` prop when the caller
 * supplies one (the `metame-codex` Orchestration mirror still does; see
 * `data/codex-configs.ts`'s `metame-moneypenny-orchestration` tab), or
 * otherwise from the raw `?tab=` query param — every pre-existing
 * `buildCodexUrl('moneypenny', {tab})` deep link (14 legacy panel-key
 * values) still opens the exact same panel it always did, resolved
 * client-side rather than via a registered `CodexTab` per value. Unknown/
 * absent values fall back to `overview` (Home), never a blank screen.
 *
 * `MoneyPennyNavigationProvider` (`moneyPennyNavigation.tsx`) exposes this
 * state/setter to descendants (`MoneyPennyAreaNav`, `MoneyPennyOverviewPanel`,
 * `MoneyPennyCopilotWorkspace`'s own suggested-panel handling) — they call
 * `navigate(panel)` directly instead of the cross-cartridge
 * `tryOpenInMountedCartridge` seam, which had nothing left to switch to.
 *
 * The existing panel components are reused unchanged — this file adds no
 * new panel logic, only the mapping from the active panel key to one of
 * them.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HFTConsole } from "@/app/(shell)/moneypenny/components/HFTConsole";
import { PortfolioAnalytics } from "@/app/(shell)/moneypenny/components/PortfolioAnalytics";
import { StrategyBuilder } from "@/app/(shell)/moneypenny/components/StrategyBuilder";
import { X402Dashboard } from "@/app/(shell)/moneypenny/components/X402Dashboard";
import { FIOManager } from "@/app/(shell)/moneypenny/components/FIOManager";
import { MoneyPennySmartTriad } from "@/app/(shell)/moneypenny/components/MoneyPennySmartTriad";
import { CRMIntegration } from "@/app/(shell)/moneypenny/components/CRMIntegration";
import { ArchitectPanel } from "@/app/(shell)/moneypenny/components/ArchitectPanel";
import { RuntimePanel } from "@/app/(shell)/moneypenny/components/RuntimePanel";
import { ServiceOrchestrationPanel } from "@/app/(shell)/moneypenny/components/ServiceOrchestrationPanel";
import { MoneyPennyOverviewPanel } from "@/app/(shell)/moneypenny/components/MoneyPennyOverviewPanel";
import { FinancialProfilePanel } from "@/app/(shell)/moneypenny/components/FinancialProfilePanel";
import { RiskEnvelopePanel } from "@/app/(shell)/moneypenny/components/RiskEnvelopePanel";
import { MoneyPennyLearnPanel } from "@/app/(shell)/moneypenny/components/MoneyPennyLearnPanel";
import { MoneyPennyCopilotWorkspace } from "@/app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace";
import { MoneyPennyNavigationProvider } from "@/app/(shell)/moneypenny/components/moneyPennyNavigation";

export type MoneyPennyPanelKey =
  | "overview"
  | "hft-console"
  | "portfolio"
  | "strategies"
  | "x402"
  | "identity"
  | "smarttriad"
  | "crm"
  | "architect"
  | "runtime"
  | "service-orchestration"
  // SPEC-MPY-002 MPY2-2 (2026-09-01) — Understand / Financial Profile.
  | "financial-profile"
  // SPEC-MPY-002 MPY2-3 (2026-09-01) — Design / Risk & Limits.
  | "risk-envelope"
  // Cartridge C-15/A3 (2026-09-02) — the structured right-pane content a
  // video block's "related chip" opens. Reached via tryOpenInMountedCartridge
  // only; deliberately not added to MoneyPennyAreaNav — a chip-opened
  // capsule, not a persistent nav destination (per the Cartridge spec's own
  // "related chips open a capsule" language, C-15 §11).
  | "learn";
// "chat" is DELIBERATELY absent (experience-coherence correction,
// 2026-09-03, operator directive: "Remove any duplicate assistant/chat
// panel on the right. Preserve its useful actions through the canonical
// copilot."). `MoneyPennyChat.tsx` was a second, fully independent chat UI
// hitting a different backend (`/api/moneypenny/chat` via
// NEXT_PUBLIC_AIGENT_API_URL) than the canonical left-pane copilot
// (`SmartTriadCopilotLayer`, already persistent on every panel) — two
// conversations on screen at once. A legacy `?tab=chat` deep link now
// falls through to `overview`/Home (isMoneyPennyPanelKey('chat') is false
// since 'chat' is no longer a PANELS key), where the SAME canonical
// copilot is right there on the left — nothing useful is lost, only the
// duplicate is gone.

const PANELS: Record<MoneyPennyPanelKey, React.ComponentType> = {
  overview: MoneyPennyOverviewPanel,
  "hft-console": HFTConsole,
  portfolio: PortfolioAnalytics,
  strategies: StrategyBuilder,
  x402: X402Dashboard,
  identity: FIOManager,
  smarttriad: MoneyPennySmartTriad,
  crm: CRMIntegration,
  architect: ArchitectPanel,
  runtime: RuntimePanel,
  "service-orchestration": ServiceOrchestrationPanel,
  "financial-profile": FinancialProfilePanel,
  "risk-envelope": RiskEnvelopePanel,
  learn: MoneyPennyLearnPanel,
};

const DEFAULT_PANEL: MoneyPennyPanelKey = "overview";

function isMoneyPennyPanelKey(value: string | null): value is MoneyPennyPanelKey {
  return value !== null && Object.prototype.hasOwnProperty.call(PANELS, value);
}

export interface MoneyPennyPanelTabProps {
  /**
   * Explicit, fixed panel — set only by callers outside MoneyPenny's own
   * (now single) codex tab, e.g. the `metame-codex` Orchestration mirror.
   * Used only as the INITIAL panel; internal navigation (area nav,
   * overview cards) can still move on from it, same as any other entry
   * point — nothing in this codebase requires the mirror to stay pinned,
   * and letting it navigate is a strict improvement over the mirror's
   * previous silent no-op (its area-nav clicks targeted the separate
   * `moneypenny-codex` cartridge id via `tryOpenInMountedCartridge`, which
   * is never the active cartridge in that context).
   *
   * Omitted for MoneyPenny's own single codex tab — the initial panel
   * there resolves from the `?tab=` query param instead (every legacy
   * `buildCodexUrl('moneypenny', {tab})` deep link).
   */
  panel?: MoneyPennyPanelKey;
}

export function MoneyPennyPanelTab({ panel: explicitPanel }: MoneyPennyPanelTabProps) {
  const searchParams = useSearchParams();

  // Lazy initializer — computed exactly ONCE, on first mount. A later,
  // unrelated change to the URL (e.g. a persona param) must never reset
  // in-app navigation the operator has since done.
  const [activePanel, setActivePanel] = useState<MoneyPennyPanelKey>(() => {
    if (explicitPanel) return explicitPanel;
    const raw = searchParams?.get("tab") ?? null;
    return isMoneyPennyPanelKey(raw) ? raw : DEFAULT_PANEL;
  });

  const navigate = useCallback((next: MoneyPennyPanelKey) => {
    setActivePanel(next);
  }, []);

  const navigationValue = useMemo(() => ({ activePanel, navigate }), [activePanel, navigate]);

  const Panel = PANELS[activePanel];

  return (
    <MoneyPennyNavigationProvider value={navigationValue}>
      <MoneyPennyCopilotWorkspace activePanel={activePanel}>
        {Panel ? <Panel /> : <div className="text-sm text-rose-400">Unknown MoneyPenny panel: {activePanel}</div>}
      </MoneyPennyCopilotWorkspace>
    </MoneyPennyNavigationProvider>
  );
}

export default MoneyPennyPanelTab;
