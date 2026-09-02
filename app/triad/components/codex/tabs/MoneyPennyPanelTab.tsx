/**
 * MoneyPennyPanelTab — generic codex-tab dispatcher for MoneyPenny's
 * panels (SPEC-VLM-001 Phase 2, 2026-07-24 — CFS-050 Sovereignty
 * Navigation's second applied test case, after Venture Lab).
 *
 * MoneyPenny's cartridge previously rendered as a SINGLE auto-generated
 * codex tab (`MoneyPennyTab.tsx`, wrapping the whole `MoneyPennyCartridge`
 * component), which forced her to hand-roll her own flat ten-tab bar
 * instead of using the platform's shared two-level TabGroup navigation
 * (`CodexPanelDynamic.tsx` skips its own chrome whenever a cartridge has
 * ≤1 tab). `MONEYPENNY_CARTRIDGE` (`data/codex-configs.ts`) now
 * hand-authors real `CodexTab` entries instead — each one renders through
 * this single dispatcher rather than one file per panel, by passing which
 * panel to show as a `panel` prop (`config.props.panel`).
 *
 * The existing panel components are reused unchanged — this file adds no
 * new panel logic, only the mapping from a codex tab to one of them.
 *
 * C1 (2026-09-02): wrapped in `MoneyPennyCopilotWorkspace` (persistent
 * copilot left, `MoneyPennyShell`'s existing rail+panel right — see that
 * file's own header for the full rationale) INSTEAD of bare
 * `MoneyPennyShell` directly. Since this dispatcher is the ONE place every
 * moneypenny-codex entry point already routes through, every existing
 * `buildCodexUrl('moneypenny', {tab})` deep link keeps resolving to the
 * exact same panel it always did — this is the "compatibility route for
 * current entry points": zero broken links, only the outer shell changed.
 */

"use client";

import { HFTConsole } from "@/app/(shell)/moneypenny/components/HFTConsole";
import { MoneyPennyChat } from "@/app/(shell)/moneypenny/components/MoneyPennyChat";
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

export type MoneyPennyPanelKey =
  | "overview"
  | "hft-console"
  | "chat"
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

const PANELS: Record<MoneyPennyPanelKey, React.ComponentType> = {
  overview: MoneyPennyOverviewPanel,
  "hft-console": HFTConsole,
  chat: MoneyPennyChat,
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

export interface MoneyPennyPanelTabProps {
  panel: MoneyPennyPanelKey;
}

export function MoneyPennyPanelTab({ panel }: MoneyPennyPanelTabProps) {
  const Panel = PANELS[panel];
  if (!Panel) {
    return (
      <MoneyPennyCopilotWorkspace activePanel={panel}>
        <div className="text-sm text-rose-400">Unknown MoneyPenny panel: {panel}</div>
      </MoneyPennyCopilotWorkspace>
    );
  }
  return (
    <MoneyPennyCopilotWorkspace activePanel={panel}>
      <Panel />
    </MoneyPennyCopilotWorkspace>
  );
}

export default MoneyPennyPanelTab;
