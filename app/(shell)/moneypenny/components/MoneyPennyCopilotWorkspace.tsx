/**
 * MoneyPennyCopilotWorkspace — C1 (2026-09-02, SPEC-MPY-002 shared-shell
 * directive): "persistent copilot left, chips/capsules and working
 * surfaces right," reusing the SAME split-pane pattern DevOn
 * (`DevCommandCenterTab.tsx`) and Agent Me (`AigentMeWelcomeSplitTab.tsx`)
 * already use — `SmartTriadCopilotLayer` (`variant="panel"`) as the LEFT
 * pane, never a fork or a second copilot implementation. (Confirmed by
 * direct investigation: `CodexCopilotLayer.tsx`, referenced by CLAUDE.md's
 * "Wallet-Over-Cartridge Overlay" section, is a SEPARATE, cartridge-wide
 * floating chat bubble — not the component DevOn/Agent Me use for their
 * persistent split-pane. `SmartTriadCopilotLayer` is.)
 *
 * The RIGHT pane is the EXISTING `MoneyPennyShell` (capability rail +
 * whichever of the 14 panels is active) — UNCHANGED, not forked, not
 * rebuilt as a new capsule/layout-registry system. This is what "preserve
 * the existing MoneyPenny capabilities behind that shell, with
 * compatibility routes for current entry points" means concretely: every
 * existing `moneypenny-codex` tab / `buildCodexUrl('moneypenny', {tab})`
 * deep link still resolves to the exact same panel component it always
 * did (see MoneyPennyPanelTab.tsx, the single dispatcher this workspace
 * now wraps) — only the copilot now flanks it on the left.
 *
 * Financial-profile <-> Operate connection: because MoneyPennyPanelTab.tsx
 * is the ONE dispatch point every moneypenny-codex entry point already
 * goes through (including the fs-operate stage's "Open MoneyPenny" link,
 * FinancialSovereigntyOperateStage.tsx's buildCodexUrl('moneypenny', ...)),
 * wrapping it here gives every entry point — Operate included — the same
 * copilot-flanked workspace for free, no per-entry-point change needed.
 *
 * Ground context <-> financial profile: when the active panel is
 * 'financial-profile', this component fetches the persona's current
 * FinancialProfileQube summary (the SAME GET /api/moneypenny/
 * financial-profile route FinancialProfilePanel.tsx itself reads) and
 * forwards a small, T1-safe summary (never raw aggregates/PII beyond what
 * FinancialProfilePanel already renders visibly) as `groundContext` — so a
 * message sent AFTER editing/computing the profile in the right pane
 * carries the fresh state to the copilot. Refetches on mount and whenever
 * the tab regains focus (`visibilitychange`) — a lightweight, real proxy
 * for "the operator just came back to look" without invasive prop
 * plumbing into FinancialProfilePanel.tsx itself (unchanged, per "preserve
 * the existing MoneyPenny capabilities").
 *
 * Standalone `/moneypenny` route (`MoneyPennyCartridge.tsx`, the flat
 * ten-tab interface) is NOT touched — it stays its own separate,
 * deliberately-untouched shell (per MoneyPennyShell.tsx's own header
 * comment), out of scope for this codex-tab-only slice.
 *
 * Copilot-to-capsule loop (C-02, added 2026-09-02 during reconciliation
 * against the authoritative Cartridge spec — MoneyPenny_Cartridge_Spec_v1.md):
 * `quickPrompts` + `onSuggestedLayouts` extend the SAME registered
 * `ChipTargetId`/`SuggestedLayoutHint` system DevOn/Agent Me use
 * (`app/api/codex/chat/route.ts`), with financial layout ids added there —
 * never a parallel suggestion system. A suggestion only lights a banner the
 * operator clicks (Companion Menu invariant MS-5: a deliberate act
 * outranks an ambient observation); the click itself navigates through
 * `tryOpenInMountedCartridge`, the SAME seam `MoneyPennyCapabilityRail.tsx`
 * already uses, so the codex tab framework stays the single owner of which
 * panel is active (MS-2).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { SmartTriadCopilotLayer, type SuggestedLayoutHint } from '@/components/smarttriad/copilot/SmartTriadCopilotLayer';
import { MoneyPennyShell } from './MoneyPennyShell';
import { personaFetch } from '@/utils/personaSpine';
import { tryOpenInMountedCartridge } from '@/services/cartridge/CartridgePresenceRegistry';
import { MONEYPENNY_CAPABILITY_GROUPS } from './moneypennyCapabilities';
import type { MoneyPennyPanelKey } from '@/app/triad/components/codex/tabs/MoneyPennyPanelTab';

const MONEYPENNY_CODEX_ID = 'moneypenny-codex';

/**
 * The subset of MoneyPennyPanelKey values registered as SuggestedLayoutHint
 * ids (see route.ts's ChipTargetId + LAYOUT_TAG_IDS/LAYOUT_KEYWORDS, and
 * SmartTriadCopilotLayer's SuggestedLayoutHint.layoutId). Derived from the
 * SAME capability-group source of truth the rail uses (moneypennyCapabilities.ts)
 * rather than hand-duplicating labels — 'chat' and null-panel items are
 * excluded since they are not registered layout ids.
 */
const SUGGESTABLE_PANEL_LABELS: Partial<Record<MoneyPennyPanelKey, string>> = Object.fromEntries(
  MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items)
    .filter((item): item is typeof item & { panel: MoneyPennyPanelKey } => item.panel !== null && item.panel !== 'chat')
    .map((item) => [item.panel, item.label]),
);

const MONEYPENNY_QUICK_PROMPTS = [
  { id: 'mpy-financial-profile', label: 'Review my financial profile', prompt: 'Can you help me review my financial profile — what statements or manual entry do I need?' },
  { id: 'mpy-risk-envelope', label: 'Check my risk envelope', prompt: 'What does my current risk envelope and trading limits look like?' },
  { id: 'mpy-portfolio', label: 'Show my portfolio', prompt: 'Give me an overview of my portfolio and recent performance.' },
  { id: 'mpy-market-console', label: 'Open the market console', prompt: 'Show me quotes, spread and liquidity in the market console.' },
];

interface FinancialProfileGroundSnapshot {
  hasProfile: boolean;
  inputSource: 'uploaded_statements' | 'manual_entry' | null;
  incomeMonthly: number | null;
  expenditureMonthly: number | null;
  availableSurplusMonthly: number | null;
}

function readStoredPersonaId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('currentPersonaId') ?? undefined;
  } catch {
    return undefined;
  }
}

export interface MoneyPennyCopilotWorkspaceProps {
  activePanel: MoneyPennyPanelKey;
  children: React.ReactNode;
}

export function MoneyPennyCopilotWorkspace({ activePanel, children }: MoneyPennyCopilotWorkspaceProps) {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [financialProfileGround, setFinancialProfileGround] = useState<FinancialProfileGroundSnapshot | null>(null);
  const groundContextRef = useRef<Record<string, unknown> | null>(null);
  // C-02 copilot-to-capsule loop: a suggested panel from the copilot's
  // [layout:<id>|<substance>] tag or keyword sweep. Deliberately NOT
  // auto-navigated — per this codebase's own Companion Menu invariant MS-5
  // ("a deliberate act outranks an ambient observation"), a suggestion only
  // lights an affordance the operator clicks; navigation itself goes
  // through the SAME tryOpenInMountedCartridge seam the capability rail
  // already uses, so the codex tab framework stays the single owner of
  // "which panel is active" (MS-2 — no second, parallel state authority).
  const [suggestedPanel, setSuggestedPanel] = useState<MoneyPennyPanelKey | null>(null);

  useEffect(() => {
    setPersonaId(readStoredPersonaId());
  }, []);

  // The operator already navigated (via the rail, a deep link, or this
  // suggestion itself) — clear any stale suggestion for the panel just left.
  useEffect(() => {
    setSuggestedPanel((prev) => (prev === activePanel ? null : prev));
  }, [activePanel]);

  const handleSuggestedLayouts = useCallback((hints: SuggestedLayoutHint[]) => {
    const hit = hints.find(
      (h) => h.layoutId in SUGGESTABLE_PANEL_LABELS && h.layoutId !== activePanel,
    );
    setSuggestedPanel(hit ? (hit.layoutId as MoneyPennyPanelKey) : null);
  }, [activePanel]);

  const navigateToSuggestedPanel = useCallback(() => {
    if (!suggestedPanel) return;
    tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: suggestedPanel });
    setSuggestedPanel(null);
  }, [suggestedPanel]);

  const refetchFinancialProfileGround = useCallback(async () => {
    try {
      const res = await personaFetch('/api/moneypenny/financial-profile', { cache: 'no-store' });
      const json = await res.json().catch(() => null) as
        | { ok?: boolean; meta?: { hasProfile?: boolean }; aggregates?: { incomeMonthly?: number; expenditureMonthly?: number; availableSurplusMonthly?: number } | null; inputSource?: string | null }
        | null;
      if (!res.ok || !json?.ok) return;
      setFinancialProfileGround({
        hasProfile: json.meta?.hasProfile === true,
        inputSource: (json.inputSource as FinancialProfileGroundSnapshot['inputSource']) ?? null,
        incomeMonthly: json.aggregates?.incomeMonthly ?? null,
        expenditureMonthly: json.aggregates?.expenditureMonthly ?? null,
        availableSurplusMonthly: json.aggregates?.availableSurplusMonthly ?? null,
      });
    } catch {
      /* non-fatal — groundContext simply omits the financial-profile snapshot */
    }
  }, []);

  useEffect(() => {
    if (activePanel !== 'financial-profile') return;
    void refetchFinancialProfileGround();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetchFinancialProfileGround();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [activePanel, refetchFinancialProfileGround]);

  const groundContext: Record<string, unknown> = {
    cartridge: 'moneypenny',
    activePanel,
    ...(activePanel === 'financial-profile' && financialProfileGround ? { financialProfile: financialProfileGround } : {}),
  };
  groundContextRef.current = groundContext;

  return (
    <div className="h-[calc(100vh-96px)] flex flex-col lg:flex-row gap-2 overflow-hidden bg-slate-950">
      <div className="lg:w-1/2 w-full h-full min-h-0 flex flex-col">
        <SmartTriadCopilotLayer
          isOpen
          variant="panel"
          promptPlaceholder="Ask MoneyPenny — spending, a goal, your risk envelope…"
          agent={{ id: 'aigent-moneypenny', name: 'MoneyPenny' }}
          agentSubtitle="Financial Services Runtime"
          personaId={personaId}
          groundContext={groundContext}
          quickPrompts={MONEYPENNY_QUICK_PROMPTS}
          onSuggestedLayouts={handleSuggestedLayouts}
          onClose={() => undefined}
        />
      </div>
      <div className="lg:w-1/2 w-full h-full min-h-0 overflow-y-auto">
        {suggestedPanel && (
          <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-800/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <span>MoneyPenny suggests: open {SUGGESTABLE_PANEL_LABELS[suggestedPanel]}</span>
            <button
              type="button"
              onClick={navigateToSuggestedPanel}
              className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
            >
              Open <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
        <MoneyPennyShell activePanel={activePanel}>{children}</MoneyPennyShell>
      </div>
    </div>
  );
}

export default MoneyPennyCopilotWorkspace;
