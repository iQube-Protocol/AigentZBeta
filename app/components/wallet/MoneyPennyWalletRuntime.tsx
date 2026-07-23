"use client";

/**
 * MoneyPennyWalletRuntime — thin, READ-ONLY wallet-native Runtime
 * status/trace view (PRD-MPY-001 Phase 4), embedded in SmartWalletDrawer's
 * "MoneyPenny" tab.
 *
 * Calls the SAME `/api/moneypenny/runtime` route with the SAME request
 * shape (`{ intent, domain, mode }`) and the SAME `RuntimeResult` response
 * shape as app/(shell)/moneypenny/components/RuntimePanel.tsx (the
 * cartridge reference implementation) — this is a compact re-skin, not a
 * parallel implementation of Runtime's logic.
 *
 * Scoped down for the wallet's narrow side panel, per PRD-MPY-001 wallet
 * task scope:
 *  - Domain is hardcoded to 'intelligence' (Financial Intelligence) — no
 *    domain selector. The route independently re-enforces Domain-3-only
 *    authoritative execution server-side regardless of what any client
 *    sends.
 *  - Mode is ALWAYS 'shadow' — this view has no authoritative toggle and no
 *    Constitutional Agreement lifecycle UI (no Form/Accept/Authorize
 *    buttons anywhere). A human who wants an authoritative run, or who wants
 *    to form/accept/authorize MoneyPenny's agreement, opens the full
 *    MoneyPenny cartridge (`/moneypenny` → Runtime tab), which carries the
 *    complete agreement lifecycle behind a literal human "Authorize" click.
 *
 * This component NEVER imports or calls the agreement-authorization server
 * action (RuntimePanel's `authorize` case), NEVER renders a Form/Accept/
 * Authorize control, and NEVER requests authoritative execution -- the
 * runtime call below is hardcoded to shadow mode. See
 * tests/moneypenny-runtime-authority-boundary.test.ts (extended) for the
 * canary enforcing this structurally.
 *
 * Spine discipline: personaFetch only (this route resolves the caller's
 * persona — a spine endpoint) — CLAUDE.md PARAMOUNT. `personaIdHint` is
 * threaded through from the wallet's already-resolved active persona so
 * this surface never disagrees with the rest of the drawer about whose
 * persona is active.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu, Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface StepTrace {
  step: number;
  name: string;
  status: "ok" | "skipped" | "refused" | "shadow-block" | "observed";
  detail: string;
}

interface RuntimeResult {
  ok: boolean;
  mode: string;
  domain?: string;
  executed: boolean;
  blockedAtStep: number | null;
  agreementId: string | null;
  trace: StepTrace[];
  clamped?: boolean;
  clampReason?: string;
  error?: string;
}

const STATUS_STYLE: Record<StepTrace["status"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  observed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "shadow-block": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  refused: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  skipped: "bg-slate-700/40 text-slate-400 border-slate-700",
};

export function MoneyPennyWalletRuntime({ personaIdHint }: { personaIdHint?: string | null }) {
  const [intent, setIntent] = useState("Which settlement rail best fits a recurring micro-transaction stream?");
  const [result, setResult] = useState<RuntimeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!intent.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Always shadow, always Financial Intelligence — this compact view
        // offers no authoritative toggle and no domain selector (see file
        // header). Never change this to read a client-side toggle without
        // also building the full agreement-lifecycle UI this needs.
        body: JSON.stringify({ intent, domain: "intelligence", mode: "shadow" }),
        personaIdHint: personaIdHint || undefined,
      });
      const data = (await res.json()) as RuntimeResult;
      if (!res.ok) setError(data?.error || `runtime call failed (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "runtime call error");
    } finally {
      setRunning(false);
    }
  }, [intent, running, personaIdHint]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-white/60 mb-1">MoneyPenny Runtime — shadow preview</div>
        <p className="text-[11px] text-white/40">
          Read-only preview of the constitutional service pattern (Financial Intelligence only). Observes every step
          with no side effects — cannot move funds, form, or authorize any agreement.
        </p>
      </div>

      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/90 outline-none focus:border-violet-500/30"
      />

      <button
        onClick={() => void run()}
        disabled={running || !intent.trim()}
        className="flex w-fit items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/25 disabled:opacity-50 transition-colors"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
        {running ? "Running…" : "Run (shadow)"}
      </button>
      {error && <div className="text-xs text-rose-300">{error}</div>}

      {result && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span>
              {result.domain ? `${result.domain} · ` : ""}mode {result.mode}
            </span>
            <span>
              {result.executed ? "executed" : "not executed"}
              {result.blockedAtStep ? ` · blocked@${result.blockedAtStep}` : ""}
            </span>
          </div>
          {result.clamped && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              {result.clampReason}
            </div>
          )}
          <ol className="space-y-1">
            {(result.trace ?? []).map((s) => (
              <li key={s.step} className="flex items-start gap-1.5 text-[11px]">
                <span className="w-4 shrink-0 text-right text-white/40">{s.step}</span>
                <span className={`shrink-0 rounded border px-1 py-0.5 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.skipped}`}>
                  {s.status}
                </span>
                <span className="text-white/80">{s.name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Link
        href="/moneypenny"
        className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors"
      >
        Open full Runtime + Agreement lifecycle in MoneyPenny
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export default MoneyPennyWalletRuntime;
