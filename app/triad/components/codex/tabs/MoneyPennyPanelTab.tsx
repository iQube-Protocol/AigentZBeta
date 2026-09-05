/**
 * MoneyPennyPanelTab — the ONE dispatcher every MoneyPenny entry point
 * routes through (SPEC-VLM-001 Phase 2, 2026-07-24 — CFS-050 Sovereignty
 * Navigation's second applied test case, after Venture Lab).
 *
 * Navigation-hierarchy correction (2026-09-03, second pass): the PRIOR
 * experience-coherence correction collapsed `MONEYPENNY_CARTRIDGE` to ONE
 * registered tab and rendered Home/My Money/Plan/Markets/Activity as an
 * internally-styled pill row inside the right pane (`MoneyPennyAreaNav`).
 * That fixed "navigation inside navigation" but left the five areas as "an
 * independently rendered menu inside the right pane," not real cartridge
 * navigation — the operator's own framing for this correction.
 *
 * `MONEYPENNY_CARTRIDGE` now registers Home/My Money/Plan/Markets/Activity
 * as five REAL `CodexTab` entries (group: 'moneypenny'), plus a standalone
 * `adminOnly` Admin tab — restoring `CodexPanelDynamic`'s own native
 * two-tier chrome (a real "MoneyPenny · Admin" top-level bar, a real
 * Home|My Money|Plan|Markets|Activity sub-header), mirroring exactly how
 * Agent Me's OWN `aigentme` tabGroup carries multiple real sibling tabs
 * (`aigent-me`, `strategy`, `experience-matrix`, ... — data/codex-
 * configs.ts) rather than a second, parallel chrome system.
 *
 * This dispatcher now mounts once PER AREA (`area` prop — one of the five
 * native tabs' own `config.props`), so `CodexPanelDynamic` fully unmounts
 * one area's subtree and mounts the next on every native tab switch —
 * including the embedded `SmartTriadCopilotLayer` inside
 * `MoneyPennyCopilotWorkspace`. Two EXISTING mechanisms make that
 * invisible as "losing the conversation" rather than requiring a new,
 * invented cross-remount state system (see `moneyPennyNavigation.tsx`'s
 * own header for the full reasoning):
 *   1. `SmartTriadCopilotLayer` already persists messages to
 *      `sessionStorage` keyed only by `personaId` — every area mount
 *      shares that key, so the conversation rehydrates on the next area.
 *   2. This file resolves its OWN initial panel from a one-shot
 *      `sessionStorage` signal (`readAndClearPendingPanel`) written by
 *      `navigate()` immediately before a cross-area `tryOpenInMountedCartridge`
 *      call — the same cross-cartridge tab-switch seam every other
 *      inter-tab jump in this codebase uses, now genuinely applicable
 *      again because there is more than the one tab the prior pass left.
 *
 * Every pre-existing `buildCodexUrl('moneypenny', {tab})` deep link (14
 * legacy panel-key values, e.g. `tab=risk-envelope`) still opens the exact
 * same panel: `CodexPanelDynamic` won't recognise a legacy panel key as
 * one of the six new native tab slugs, so it lands on the cartridge's
 * first tab (Home) — whose mount effect below detects a legacy `?tab=`
 * value whose area differs from its own and self-heals into the correct
 * native tab via the SAME `navigate()` seam, landing on the originally
 * requested panel. The `metame-codex` Orchestration mirror tab is
 * unaffected — it still pins an explicit `panel` prop with no `area` at
 * all, so none of this area-resolution logic applies to it.
 *
 * The existing panel components are reused unchanged — this file adds no
 * new panel logic, only the mapping from the active panel key to one of
 * them.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FactorPanel } from "@/app/(shell)/moneypenny/components/FactorPanel";
import { AegisPanel } from "@/app/(shell)/moneypenny/components/AegisPanel";
import { MoneyPennyCopilotWorkspace } from "@/app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace";
import {
  MONEYPENNY_CODEX_ID,
  MoneyPennyNavigationProvider,
  readAndClearPendingPanel,
  writePendingPanel,
  writePendingSpecialist,
  writePendingCaseId,
  type MoneyPennyActiveCase,
  type MoneyPennyNavigationTarget,
} from "@/app/(shell)/moneypenny/components/moneyPennyNavigation";
import { tryOpenInMountedCartridge } from "@/services/cartridge/CartridgePresenceRegistry";
import { useCodexHostNavigation } from "@/app/components/codex/CodexHostNavigationContext";
import { areaForPanel, defaultPanelForArea, type MoneyPennyAreaId } from "@/app/(shell)/moneypenny/components/moneypennyCapabilities";

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
  // Aigent Factor / Aegis specialist surfaces (operator directive
  // 2026-09-05, "separate Aigent Factor and Aegis into first-class
  // specialist surfaces"). Two distinct destinations — Factor facilitates
  // candidate intake (never assesses or admits); Aegis independently
  // assesses (never self-assesses, never admits) — replacing the prior
  // combined "candidate-intake" destination which conflated them and made
  // Aegis appear subordinate to intake. Each supports direct consultation
  // with no case/assessment open; Factor's existing case workflow now
  // opens as a mode within "factor" ("Start candidate intake"), and
  // Aegis's assessment workflow opens as a mode within "aegis".
  | "factor"
  | "aegis"
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
  factor: FactorPanel,
  aegis: AegisPanel,
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
   * Explicit, fixed panel — for a caller that wants ONE specific panel with
   * no area-switching concept at all (none of this file's area-resolution/
   * self-heal logic runs for it). Not used by either registered host today
   * (navigation/viewport correction, 2026-09-03): `metame-codex`'s MoneyPenny
   * group now shares MONEYPENNY_AREA_TABS with the standalone cartridge, so
   * every registered mount passes `area` instead — kept as a still-valid
   * escape hatch for a future non-area caller, mutually exclusive with
   * `area` in practice.
   */
  panel?: MoneyPennyPanelKey;
  /**
   * Which of the five native MoneyPenny area tabs this mount represents
   * (`data/codex-configs.ts`'s `MONEYPENNY_AREA_TABS`, shared verbatim by
   * `MONEYPENNY_CARTRIDGE` and `METAME_CODEX`'s own MoneyPenny group).
   * Determines this mount's default landing panel (`defaultPanelForArea`)
   * and scopes `navigate()`'s same-area/cross-area decision (see
   * moneyPennyNavigation.tsx's own header).
   */
  area?: MoneyPennyAreaId;
}

export function MoneyPennyPanelTab({ panel: explicitPanel, area }: MoneyPennyPanelTabProps) {
  const searchParams = useSearchParams();

  // Lazy initializer — computed exactly ONCE, on first mount. A later,
  // unrelated change to the URL (e.g. a persona param) must never reset
  // in-app navigation the operator has since done. Resolution order:
  // 1. an explicit fixed panel (the metame-codex mirror) always wins;
  // 2. a pending cross-area signal this exact mount was switched TO for
  //    (see moneyPennyNavigation.tsx) — consumed once, then cleared;
  // 3. a legacy `?tab=<panel>` deep link whose area matches THIS mount
  //    (an area mismatch is handled by the self-heal effect below, not
  //    here — this mount still needs a valid initial panel meanwhile);
  // 4. this area's own derived default, or DEFAULT_PANEL when there is no
  //    area at all (shouldn't happen outside the mirror, which already
  //    returned at step 1).
  const [activePanel, setActivePanel] = useState<MoneyPennyPanelKey>(() => {
    if (explicitPanel) return explicitPanel;
    const pending = readAndClearPendingPanel();
    if (isMoneyPennyPanelKey(pending) && (!area || areaForPanel(pending) === area)) return pending;
    const raw = searchParams?.get("tab") ?? null;
    if (isMoneyPennyPanelKey(raw) && (!area || areaForPanel(raw) === area)) return raw;
    return area ? defaultPanelForArea(area) : DEFAULT_PANEL;
  });

  // `area` changing means CodexPanelDynamic switched native tabs — but
  // since every area tab shares the SAME `component: 'MoneyPennyPanelTab'`
  // registry entry at the same tree position, React treats this as a PROP
  // UPDATE on the existing instance, never a remount (confirmed live,
  // 2026-09-03: the copilot conversation survives a native tab switch for
  // exactly this reason — no sessionStorage trick was even needed for
  // THAT). The lazy initializer above therefore only ever resolves the
  // area this component happened to first mount for; without this effect,
  // switching from Home to Activity would silently keep showing Home's
  // panel forever, since `activePanel` state simply never revisits its
  // initializer on a prop-only update. `lastAreaRef` starts equal to the
  // initial `area`, so this does NOT re-run redundantly on first mount —
  // only on a genuine subsequent area change.
  const lastAreaRef = useRef(area);
  useEffect(() => {
    if (explicitPanel) return;
    if (area === lastAreaRef.current) return;
    lastAreaRef.current = area;
    const pending = readAndClearPendingPanel();
    if (isMoneyPennyPanelKey(pending) && (!area || areaForPanel(pending) === area)) {
      setActivePanel(pending);
      return;
    }
    setActivePanel(area ? defaultPanelForArea(area) : DEFAULT_PANEL);
  }, [area, explicitPanel]);

  // The mounted host's OWN tab-switch function (2026-09-05 Home cross-area
  // nav regression fix) — see CodexHostNavigationContext.tsx's own header
  // for the defect this closes. Always present in real usage (MoneyPenny
  // PanelTab is only ever instantiated by TabRenderer, always inside a
  // CodexPanelDynamic tree); null only for a hypothetical mount outside
  // that tree, in which case the tryOpenInMountedCartridge fallback below
  // still applies.
  const hostNav = useCodexHostNavigation();

  // Self-heal a legacy deep link whose area doesn't match this mount — a
  // pre-native-tabs `buildCodexUrl('moneypenny', {tab:'risk-envelope'})`
  // link lands CodexPanelDynamic on the cartridge's first native tab
  // (Home, since 'risk-envelope' matches no real tab slug); this redirects
  // into the correct native tab (Plan) via the exact same seam navigate()
  // uses for an in-app cross-area click. Runs once per mount only — a
  // later, operator-driven navigation on this same mount must never
  // re-trigger it.
  //
  // Live-discovered race (2026-09-03), CLOSED by hostNav (2026-09-05): on a
  // genuinely FRESH page load (not an in-app click), this effect used to
  // run BEFORE the ancestor CodexPanelDynamic's OWN `useCartridgePresence`
  // registration effect (React flushes effects child-before-parent), so
  // `tryOpenInMountedCartridge` silently returned false ("cartridge not
  // mounted yet") and a `setTimeout(0)` was needed to defer past that
  // commit. `hostNav` is provided directly during the ANCESTOR's render
  // (not inside an effect), so it is already correct on this component's
  // OWN first render — no ordering race, no deferral needed on that path.
  // The `tryOpenInMountedCartridge` fallback (mount outside any
  // CodexPanelDynamic tree) keeps the deferred-timer behavior, since only
  // THAT path still depends on registry-registration timing.
  useEffect(() => {
    if (explicitPanel || !area) return;
    const raw = searchParams?.get("tab") ?? null;
    if (!isMoneyPennyPanelKey(raw)) return;
    const targetArea = areaForPanel(raw);
    if (!targetArea || targetArea === area) return;
    writePendingPanel(raw);
    if (hostNav) {
      hostNav.setActiveTab(targetArea);
      return;
    }
    const timer = setTimeout(() => {
      tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: targetArea });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-area navigation failed (neither hostNav nor the registry fallback
  // could switch the host's tab) — never a silent no-op. Cleared on the
  // next successful navigate() or explicitly by the consuming UI.
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const clearNavigationError = useCallback(() => setNavigationError(null), []);

  const navigate = useCallback(
    (target: MoneyPennyNavigationTarget) => {
      const next = typeof target === "string" ? target : target.panel;
      const specialistId = typeof target === "string" ? undefined : target.specialistId;
      const activeCaseId = typeof target === "string" ? undefined : target.activeCaseId;
      const targetArea = areaForPanel(next);
      if (specialistId) writePendingSpecialist(specialistId);
      if (activeCaseId) writePendingCaseId(activeCaseId);
      if (!area || !targetArea || targetArea === area) {
        setActivePanel(next);
        setNavigationError(null);
        return;
      }
      // Cross-area jump (e.g. Home's "Explore investing" card targets
      // 'hft-console', area 'markets') — hand off to the real native tab.
      writePendingPanel(next);
      let switched: boolean;
      if (hostNav) {
        hostNav.setActiveTab(targetArea);
        switched = true;
      } else {
        switched = tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: targetArea });
      }
      if (switched) {
        setNavigationError(null);
      } else {
        setNavigationError(`Could not open ${targetArea} from here — the destination area isn't reachable right now.`);
      }
    },
    [area, hostNav],
  );

  // Shared active-case snapshot (see moneyPennyNavigation.tsx's own header) —
  // written only by CandidateIntakePanel, read by MoneyPennyCopilotWorkspace.
  // Plain component state, not sessionStorage: unlike activePanel this never
  // needs to survive a cross-area native-tab remount (a candidate case is
  // scoped to the Activity area's own candidate-intake panel), so the same
  // "one owner, one source of truth" discipline the rest of this file
  // follows applies without needing a persistence signal.
  const [activeCase, setActiveCase] = useState<MoneyPennyActiveCase | null>(null);

  const navigationValue = useMemo(
    () => ({ activePanel, area: area ?? null, navigate, navigationError, clearNavigationError, activeCase, setActiveCase }),
    [activePanel, area, navigate, navigationError, clearNavigationError, activeCase],
  );

  const Panel = PANELS[activePanel];

  return (
    <MoneyPennyNavigationProvider value={navigationValue}>
      <MoneyPennyCopilotWorkspace activePanel={activePanel} area={area ?? null}>
        {Panel ? <Panel /> : <div className="text-sm text-rose-400">Unknown MoneyPenny panel: {activePanel}</div>}
      </MoneyPennyCopilotWorkspace>
    </MoneyPennyNavigationProvider>
  );
}

export default MoneyPennyPanelTab;
