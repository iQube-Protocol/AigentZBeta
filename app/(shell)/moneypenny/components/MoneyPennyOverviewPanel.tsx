/**
 * MoneyPennyOverviewPanel — MoneyPenny's Home area (Cartridge spec C-03:
 * "Home | Financial brief, current journey, pending decisions, next
 * actions, specialist access | Where am I? What needs attention?").
 *
 * Rebuilt 2026-09-03 (experience-coherence correction, operator directive:
 * "Do not expose the whole capability registry as cards or pills... Use
 * Agent Me's restrained hierarchy: 1. Compact contextual header or
 * summary. 2. A few useful primary action cards. 3. Expandable sections
 * for additional capabilities. 4. The active capsule when an action is
 * selected... Home should help a newcomer start with actions such as:
 * Understand my money. Make a plan. Explore investing."). Previously
 * rendered ALL 14 items across ALL 5 `MONEYPENNY_CAPABILITY_GROUPS` as an
 * unconditional card grid — the exact defect this rebuild closes, and one
 * that duplicated `MoneyPennyAreaNav`'s own contextual chip row on the
 * same screen.
 *
 * The three primary actions map to real, existing capabilities (never an
 * invented service) via the SAME `MONEYPENNY_CAPABILITY_GROUPS` source of
 * truth every other MoneyPenny surface reads — no hand-duplicated
 * label/description/mode.
 */

"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useMoneyPennyNavigation } from "./moneyPennyNavigation";
import { MONEYPENNY_CAPABILITY_GROUPS, MONEYPENNY_SPECIALIST_CARDS, type MoneyPennyCapabilityItem, type MoneyPennySpecialistCard } from "./moneypennyCapabilities";
import { SpecialistConsultModal } from "./specialistWorkspace/SpecialistConsultModal";
import type { SpecialistPromptSuggestion } from "./specialistWorkspace/SpecialistWorkspace";
import { getFactorCapability } from "@/services/factor/factorCapabilityManifest";
import type { MoneyPennyPanelKey } from "@/app/triad/components/codex/tabs/MoneyPennyPanelTab";

// Factor's entry is DERIVED from the capability manifest (never a
// hand-duplicated copy — capability-runtime contract closure, 2026-09-05:
// this Home-modal prompt previously still read the pre-redesign
// candidate-intake-first copy, so the SAME question classified differently
// here than in FactorPanel's own default, breaking cross-entry-point
// consistency). Carries the explicit capabilityId so the Home modal's
// default click sends 'general_orientation' verbatim, exactly like
// FactorPanel's own empty state.
const SPECIALIST_EMPTY_PROMPTS: Record<MoneyPennySpecialistCard["id"], SpecialistPromptSuggestion> = {
  factor: { label: getFactorCapability("general_orientation").examples[0], capabilityId: "general_orientation" },
  aegis: { label: "Ask Aegis about trusted intelligence, constitutional risk, agents, models, providers, harnesses, or independent assessment." },
  nakamoto: { label: "Ask Aigent Nakamoto about Bitcoin, decentralisation, or this agent's own consumption of a MoneyPenny Financial Service." },
  kn0w1: { label: "Ask Aigent Know1 about its own consumption of a MoneyPenny Financial Service." },
};

const MODE_BADGE_STYLE: Record<string, string> = {
  ADVISOR: "bg-sky-500/10 text-sky-300 border border-sky-800/60",
  ARCHITECT: "bg-amber-500/10 text-amber-300 border border-amber-800/60",
  RUNTIME: "bg-emerald-500/10 text-emerald-300 border border-emerald-800/60",
};

function findItem(id: string): MoneyPennyCapabilityItem {
  const item = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items).find((i) => i.id === id);
  if (!item) throw new Error(`MoneyPennyOverviewPanel: capability item '${id}' not found`);
  return item;
}

// Three primary actions, matching the operator's own newcomer framing —
// "Understand my money", "Make a plan", "Explore investing" — each backed
// by a real, already-built capability (never a fake destination).
const PRIMARY_ACTION_ITEM_IDS = ["financial-profile", "risk-envelope", "market-console"] as const;
const PRIMARY_ACTION_LABELS: Record<(typeof PRIMARY_ACTION_ITEM_IDS)[number], string> = {
  "financial-profile": "Understand my money",
  "risk-envelope": "Make a plan",
  "market-console": "Explore investing",
};

export function MoneyPennyOverviewPanel() {
  const { navigate: navigateToPanel } = useMoneyPennyNavigation();
  const navigate = (panel: MoneyPennyPanelKey | null) => {
    if (!panel) return;
    navigateToPanel(panel);
  };
  const [modalCard, setModalCard] = useState<MoneyPennySpecialistCard | null>(null);

  const expandModalToPanel = () => {
    if (!modalCard) return;
    navigateToPanel({ panel: modalCard.panel, specialistId: modalCard.id });
    setModalCard(null);
  };

  const primaryItems = PRIMARY_ACTION_ITEM_IDS.map(findItem);
  const primaryIds = new Set(PRIMARY_ACTION_ITEM_IDS as readonly string[]);

  return (
    <div className="space-y-6">
      {/* 1. Compact contextual header/summary — no capability registry, no
       *    implementation/spec jargon. */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-sm font-medium text-slate-100">Where would you like to start?</p>
        <p className="mt-1 text-xs text-slate-500">
          MoneyPenny can explain your finances, help you plan, or walk through the markets — pick a place to
          begin below, or ask in the conversation.
        </p>
      </div>

      {/* 2. A few useful primary action cards. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {primaryItems.map((item) => {
          const label = PRIMARY_ACTION_LABELS[item.id as (typeof PRIMARY_ACTION_ITEM_IDS)[number]];
          const available = item.panel !== null;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!available}
              onClick={() => navigate(item.panel)}
              className={`group flex flex-col rounded-lg border p-4 text-left transition-colors ${
                available
                  ? "border-slate-800 bg-slate-900/40 hover:border-emerald-700/60 hover:bg-slate-900/60"
                  : "cursor-not-allowed border-slate-800/60 bg-slate-900/20 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-emerald-400" />
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>

      {/* 3. Expandable sections for additional capabilities — closed by
       *    default, so a newcomer isn't shown the whole registry up front,
       *    while everything remains one click away. */}
      <div className="space-y-2">
        {MONEYPENNY_CAPABILITY_GROUPS.map((group) => {
          const remaining = group.items.filter((item) => !primaryIds.has(item.id));
          if (remaining.length === 0) return null;
          return (
            <details key={group.id} className="group/section rounded-lg border border-slate-800 bg-slate-900/20">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/section:rotate-180" />
                {group.label}
              </summary>
              <div className="grid grid-cols-1 gap-3 border-t border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {remaining.map((item) => {
                  const available = item.panel !== null;
                  // "Ask MoneyPenny" items (moneypennyCapabilities.ts: panel
                  // === "overview" for market-research/learn) have no
                  // dedicated right-pane destination by design — Home IS the
                  // overview panel, so `navigate("overview")` while already
                  // on it was a silent no-op that looked like a broken
                  // button (arrow + hover affordance, click did nothing).
                  // Render these as an honest hint instead of a fake
                  // navigation control (Companion Menu invariant MS-9: "a
                  // control that cannot act must not render" as one) — the
                  // real, working entry point is the matching quick-prompt
                  // chip in the conversation pane (MoneyPennyCopilotWorkspace.tsx's
                  // MONEYPENNY_QUICK_PROMPTS).
                  const isAskOnly = available && item.panel === "overview";
                  if (isAskOnly) {
                    return (
                      <div key={item.id} className="flex flex-col rounded-lg border border-slate-800/60 bg-slate-900/20 p-3 text-left">
                        <span className="text-sm font-medium text-slate-100">{item.label}</span>
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                        <span className="mt-2 text-[11px] text-emerald-400/80">
                          Ask MoneyPenny in the conversation, or use the matching quick prompt below it.
                        </span>
                        {item.mode && (
                          <span className={`mt-2 inline-block w-fit rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ""}`}>
                            {item.mode}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!available}
                      onClick={() => navigate(item.panel)}
                      className={`group flex flex-col rounded-lg border p-3 text-left transition-colors ${
                        available
                          ? "border-slate-800 bg-slate-900/40 hover:border-emerald-700/60 hover:bg-slate-900/60"
                          : "cursor-not-allowed border-slate-800/60 bg-slate-900/20 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-100">{item.label}</span>
                        {available ? (
                          <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-emerald-400" />
                        ) : (
                          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-600">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      {item.mode && (
                        <span className={`mt-2 inline-block w-fit rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${MODE_BADGE_STYLE[item.mode] ?? ""}`}>
                          {item.mode}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {/* Specialist access (Cartridge spec C-03: "Home | ... specialist
          access") — one collapsed section, closed by default like the
          capability groups above, so specialist consultation is one click
          away without adding a fourth always-visible row to the newcomer
          hierarchy. */}
      <details className="group/section rounded-lg border border-slate-800 bg-slate-900/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/section:rotate-180" />
          Specialists
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {MONEYPENNY_SPECIALIST_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              data-testid={`specialist-card-${card.id}`}
              onClick={() => setModalCard(card)}
              className="group flex flex-col rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left transition-colors hover:border-emerald-700/60 hover:bg-slate-900/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">{card.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-emerald-400" />
              </div>
              <p className="mt-1 text-xs text-slate-500">{card.description}</p>
            </button>
          ))}
        </div>
      </details>

      {/* Each specialist card opens a working direct-conversation modal —
          the operator can ask a question immediately, with no prior
          navigation to Activity or case/assessment creation (requirement
          4). "Expand to full panel" hands off to the SAME navigate() the
          full Factor/Aegis/Service-Orchestration panels use, and the
          conversation itself survives the expansion (SpecialistWorkspace
          persists it by personaId+specialistId+scope — identical on both
          sides, never a second, disconnected conversation). */}
      {modalCard && (
        <SpecialistConsultModal
          open
          onClose={() => setModalCard(null)}
          onExpand={expandModalToPanel}
          title={modalCard.label}
          description={modalCard.description}
          workspaceProps={{
            specialistId: modalCard.id,
            specialistLabel: modalCard.label,
            emptyStatePrompt: SPECIALIST_EMPTY_PROMPTS[modalCard.id],
            placeholder: `Ask ${modalCard.label}…`,
            scopeId: null,
          }}
        />
      )}
    </div>
  );
}

export default MoneyPennyOverviewPanel;
