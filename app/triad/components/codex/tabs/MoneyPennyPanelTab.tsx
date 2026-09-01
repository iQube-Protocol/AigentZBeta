/**
 * MoneyPennyPanelTab — generic codex-tab dispatcher for MoneyPenny's ten
 * panels (SPEC-VLM-001 Phase 2, 2026-07-24 — CFS-050 Sovereignty
 * Navigation's second applied test case, after Venture Lab).
 *
 * MoneyPenny's cartridge previously rendered as a SINGLE auto-generated
 * codex tab (`MoneyPennyTab.tsx`, wrapping the whole `MoneyPennyCartridge`
 * component), which forced her to hand-roll her own flat ten-tab bar
 * instead of using the platform's shared two-level TabGroup navigation
 * (`CodexPanelDynamic.tsx` skips its own chrome whenever a cartridge has
 * ≤1 tab). `MONEYPENNY_CARTRIDGE` (`data/codex-configs.ts`) now
 * hand-authors ten real `CodexTab` entries instead — each one renders
 * through this single dispatcher rather than ten near-identical files, by
 * passing which panel to show as a `panel` prop (`config.props.panel`).
 *
 * The existing panel components are reused unchanged — this file adds no
 * new panel logic, only the mapping from a codex tab to one of them,
 * wrapped in the shared `MoneyPennyShell` header/status chrome.
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
import { MoneyPennyShell } from "@/app/(shell)/moneypenny/components/MoneyPennyShell";

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
  | "financial-profile";

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
};

export interface MoneyPennyPanelTabProps {
  panel: MoneyPennyPanelKey;
}

export function MoneyPennyPanelTab({ panel }: MoneyPennyPanelTabProps) {
  const Panel = PANELS[panel];
  if (!Panel) {
    return (
      <MoneyPennyShell activePanel={panel}>
        <div className="text-sm text-rose-400">Unknown MoneyPenny panel: {panel}</div>
      </MoneyPennyShell>
    );
  }
  return (
    <MoneyPennyShell activePanel={panel}>
      <Panel />
    </MoneyPennyShell>
  );
}

export default MoneyPennyPanelTab;
