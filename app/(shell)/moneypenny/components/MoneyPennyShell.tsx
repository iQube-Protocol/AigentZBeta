/**
 * MoneyPennyShell — the right-pane content wrapper shared across every
 * MoneyPenny native area tab (SPEC-VLM-001 Phase 2, 2026-07-24; revised
 * 2026-09-03 navigation-hierarchy correction).
 *
 * A NEW file, not an edit to `MoneyPennyCartridge.tsx` — that component
 * remains the untouched, standalone `/moneypenny` route's own flat
 * ten-tab interface (`app/(shell)/moneypenny/page.tsx`).
 *
 * This pass removes two things that used to live here and moves a third:
 *   - The Advisor/Architect/Runtime role selector moved into the LEFT
 *     copilot header (`SmartTriadCopilotLayer`, via `MoneyPennyCopilot
 *     Workspace.tsx`'s new `moneyPennyRole`/`onMoneyPennyRoleChange`
 *     props) — this pane no longer renders it at all.
 *   - The standalone "Connection diagnostics" `<details>` accordion is
 *     retired; its content now renders inside `MoneyPennyCapabilityCarousel`
 *     as that carousel's own final button + expandable detail region, so
 *     only ONE compact row occupies default screen space here, not two.
 *   - The old `MoneyPennyAreaNav` (area-selector row + chip row) is gone;
 *     Home/My Money/Plan/Markets/Activity are real native CodexTabs now
 *     (data/codex-configs.ts), so only the per-area capability carousel
 *     remains as this pane's own content.
 *
 * The health-check fetch itself is UNCHANGED (still the same honestly-
 * derived systemStatus this file has always computed) — only WHERE its
 * result renders moved, down into the carousel component.
 */

"use client";

import { useEffect, useState } from "react";

import { useMoneyPennyClient } from "../hooks/useMoneyPennyClient";
import { MoneyPennyCapabilityCarousel } from "./MoneyPennyCapabilityCarousel";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";
import type { MoneyPennyAreaId } from "./moneypennyCapabilities";

export interface MoneyPennyShellProps {
  children: React.ReactNode;
  /** The panel currently dispatched by MoneyPennyPanelTab — threaded down so
   *  the capability carousel can highlight the active destination. */
  activePanel?: MoneyPennyPanelKey;
  /** The native area tab this mount represents — null for the metame-codex
   *  orchestration mirror (no area-scoped carousel in that context). */
  area: MoneyPennyAreaId | null;
}

export function MoneyPennyShell({ children, activePanel, area }: MoneyPennyShellProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    quotes: "offline",
    execution: "offline",
    settlements: "offline",
    fio: "offline",
  });

  const moneyPennyClient = useMoneyPennyClient();

  useEffect(() => {
    const initializeClient = async () => {
      try {
        if (moneyPennyClient) {
          const healthCheck = await moneyPennyClient.healthCheck();
          // Every field here — including `redis`/`core` — is itself a
          // stubbed value inside `MoneyPennyClient.healthCheck()` today
          // ("simplified for now" / "Will be implemented" per its own
          // comments), not a live monitoring signal. Derive ALL four rows
          // from that same (currently fake) source rather than hardcoding
          // two of them to "online" unconditionally, which claimed X402/FIO
          // were live even when core/quotes reported degraded — the
          // SPEC-MPY-002 §7 truthfulness rule applies to status chrome too,
          // not only trading data.
          setSystemStatus({
            quotes: healthCheck.services.quotes ? "online" : "offline",
            execution: healthCheck.services.core ? "online" : "offline",
            settlements: healthCheck.services.x402 ? "online" : "offline",
            fio: healthCheck.services.fio ? "online" : "offline",
          });
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to initialize MoneyPenny:", error);
        setIsConnected(false);
      }
    };

    initializeClient();
  }, [moneyPennyClient]);

  return (
    <div className="h-full w-full p-6 space-y-4 bg-slate-950">
      <div className="min-w-0 flex-1 space-y-4">
        <MoneyPennyCapabilityCarousel
          activePanel={activePanel}
          area={area}
          isConnected={isConnected}
          systemStatus={systemStatus}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default MoneyPennyShell;
