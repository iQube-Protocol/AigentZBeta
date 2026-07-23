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

import { useState } from "react";
import { Compass, Loader2, ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ArchitectResult {
  ok: boolean;
  error?: string;
  artifactId?: string;
  title?: string;
  body?: string;
  citedInvariantIds?: string[];
}

export function MoneyPennyWalletArchitect({ personaIdHint }: { personaIdHint?: string | null }) {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ArchitectResult | null>(null);

  const draft = async () => {
    if (!intent.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
        personaIdHint: personaIdHint || undefined,
      });
      const data = (await res.json()) as ArchitectResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Draft failed" });
    } finally {
      setBusy(false);
    }
  };

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
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
          <h3 className="text-xs font-semibold text-white/90">{result.title}</h3>
          <p className="text-xs whitespace-pre-wrap text-white/80">{result.body}</p>
          {result.citedInvariantIds && result.citedInvariantIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-2">
              <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
              {result.citedInvariantIds.map((id) => (
                <span
                  key={id}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-300"
                >
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MoneyPennyWalletArchitect;
