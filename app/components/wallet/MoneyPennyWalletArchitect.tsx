"use client";

/**
 * MoneyPennyWalletArchitect — thin wallet-native Architect surface
 * (PRD-MPY-001 Phase 3), embedded in SmartWalletDrawer's "MoneyPenny" tab.
 *
 * Calls the SAME `/api/moneypenny/architect` route with the SAME
 * `{ intent }` request body / `ArchitectResult` response shape as
 * app/(shell)/moneypenny/components/ArchitectPanel.tsx (the cartridge
 * reference implementation) — this is a compact re-skin for the wallet's
 * narrow side panel, not a parallel implementation of Architect's logic.
 *
 * PROPOSAL ONLY: this component has no settlement, authorize, or
 * fund-movement affordance anywhere in it — Runtime mode is a separate
 * surface (see MoneyPennyWalletRuntime.tsx).
 *
 * Spine discipline: personaFetch only (this route resolves the caller's
 * persona — a spine endpoint) — CLAUDE.md PARAMOUNT. `personaIdHint` is
 * threaded through from the wallet's already-resolved active persona so
 * this surface never disagrees with the rest of the drawer about whose
 * persona is active.
 */

import { Compass, Loader2, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { useArchitectDraft, type ArchitectDraftState } from "@/hooks/useArchitectDraft";

export function MoneyPennyWalletArchitect({
  personaIdHint,
  sharedState,
}: {
  personaIdHint?: string | null;
  /**
   * A single shared draft/result state, owned by a host that mounts BOTH
   * this compact surface and the full ArchitectPanel at once (SmartWalletDrawer's
   * expand/collapse Architect viewport) — so the compact and expanded views
   * are the SAME conversation. Omit to fall back to this component's own
   * useArchitectDraft instance (unchanged standalone behaviour).
   */
  sharedState?: ArchitectDraftState;
}) {
  const ownState = useArchitectDraft(personaIdHint);
  const { intent, setIntent, busy, result, invariantStatements, draft } = sharedState ?? ownState;

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-white/60 mb-1">MoneyPenny Architect</div>
        <p className="text-[11px] text-white/40">
          Design a constitutional financial structure — pricing model, fee split, settlement-terms design, or
          agreement template. Produces a proposal only — no agreement is formed, authorized, or settled here.
        </p>
      </div>

      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="e.g. design a fee-split model for micro-transaction settlement"
        disabled={busy}
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/90 placeholder:text-white/40 outline-none focus:border-emerald-500/30 focus:bg-white/10"
      />

      <button
        onClick={() => void draft()}
        disabled={!intent.trim() || busy}
        className="flex w-fit items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
        Draft structure
      </button>

      {result && !result.ok && <p className="text-xs text-rose-400">{result.error ?? "Draft failed"}</p>}

      {result?.ok && (
        // resize-y, like ArchitectPanel.tsx's expanded view — the compact
        // wallet viewport is even more cramped, so a fixed short height was
        // the same "inference window too short" complaint in miniature.
        <div className="resize-y overflow-y-auto space-y-2 rounded-lg border border-white/10 bg-black/20 p-3 min-h-[140px] max-h-[60vh] h-[220px]">
          <h3 className="text-xs font-semibold text-white/90">{result.title}</h3>
          {/* Same shared MarkdownLite renderer as ArchitectPanel.tsx and the
              Copilot chat — this compact wallet viewport is a separate DOM
              subtree from the global Copilot, so it does NOT inherit that
              surface's formatting; it must render through the shared
              component directly or the proposal shows raw markup. */}
          <MarkdownLite text={result.body ?? ""} className="space-y-1 text-xs text-white/80" />
          {result.citedInvariantIds && result.citedInvariantIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-2">
              <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
              {result.citedInvariantIds.map((id) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <span className="cursor-default rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-300">
                      {id}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] whitespace-normal text-left">
                    {invariantStatements[id] ?? "Loading…"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MoneyPennyWalletArchitect;
