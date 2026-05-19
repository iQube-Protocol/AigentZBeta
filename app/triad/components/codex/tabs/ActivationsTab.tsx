"use client";

/**
 * ActivationsTab — top-level metaMe surface that controls which active
 * surfaces are switched on in the persona's runtime.
 *
 * Per-row state machine:
 *   - active   → "Open" link + "Deactivate"
 *   - revoked  → "Activate" (open) | "Request access" (gated, non-admin) |
 *                "Activate" (gated, admin self-eligible)
 *   - pending  → "Request submitted — admin will review"
 *
 * Auto-grants on first load: myCanvas + Order of Metayé (catalog-driven).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, ChevronRight, Lock, CheckCircle2, X, Hourglass } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface ActivationSurface {
  id: string;
  label: string;
  description: string;
  longDescription: string;
  gate: "open" | "gated";
  tabSlug: string;
  sourceCartridge: string;
  icon?: string;
  color?: string;
  status: "active" | "pending" | "revoked" | null;
  grantedVia: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  canSelfActivate: boolean;
}

interface Props {
  personaId?: string;
  isAdmin?: boolean;
  /** Optional click handler — parent can navigate to the activated tab. */
  onOpenSurface?: (tabSlug: string) => void;
  theme?: "light" | "dark";
}

export function ActivationsTab({ personaId, isAdmin = false, onOpenSurface, theme = "dark" }: Props) {
  const [surfaces, setSurfaces] = useState<ActivationSurface[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSurfaces = useCallback(async () => {
    if (!personaId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/activations", { personaIdHint: personaId });
      if (!res.ok) throw new Error(`activations fetch failed (${res.status})`);
      const data = (await res.json()) as { activations: ActivationSurface[] };
      setSurfaces(data.activations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void fetchSurfaces(); }, [fetchSurfaces]);

  const mutate = useCallback(
    async (id: string, action: "activate" | "request" | "revoke") => {
      if (!personaId) return;
      setPendingId(id);
      setError(null);

      // Optimistic update — flip the local card immediately so the UI
      // feels responsive. We reconcile against the server when fetchSurfaces
      // returns. If the server rejects we revert below.
      const previousSurfaces = surfaces;
      const optimisticStatus =
        action === 'activate' ? 'active'
        : action === 'request' ? 'pending'
        : 'revoked';
      setSurfaces((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: optimisticStatus,
                grantedAt: action === 'activate' ? new Date().toISOString() : s.grantedAt,
                revokedAt: action === 'revoke' ? new Date().toISOString() : s.revokedAt,
              }
            : s,
        ),
      );

      // Fire the same-window event NOW so CodexPanelDynamic refreshes its
      // tab visibility immediately rather than waiting for the round-trip.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("metame:activations-changed", { detail: { id, action } }));
      }

      try {
        const res = await personaFetch(`/api/assistant/activations/${id}?action=${action}`, {
          personaIdHint: personaId,
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { detail?: string }).detail ?? `activation mutation failed (${res.status})`);
        }
        // Confirm against the server. Re-dispatch in case the read picked
        // up a different state (e.g. admin grant landed in parallel).
        await fetchSurfaces();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("metame:activations-changed", { detail: { id, action } }));
        }
      } catch (err) {
        // Server rejected — revert the optimistic write so the UI stays honest.
        setSurfaces(previousSurfaces);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("metame:activations-changed", { detail: { id, action: 'revert' } }));
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPendingId(null);
      }
    },
    [personaId, fetchSurfaces, surfaces],
  );

  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900";
  const cardBase = isDark
    ? "border-slate-700 bg-slate-800/40"
    : "border-slate-200 bg-white";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={`h-full overflow-y-auto px-4 sm:px-6 py-4 ${panelClass}`}>
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="text-lg font-semibold">Activations</h2>
        </div>
        <p className={`text-xs mt-0.5 ${mutedClass}`}>
          Switch on the surfaces you want active in your metaMe runtime. Open activations
          can be turned on at any time; gated activations require admin grant, invite, or
          cohort assignment.
          {isAdmin && " As admin you can self-activate gated surfaces directly."}
        </p>
      </header>

      {loading ? (
        <div className="flex items-center text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading activations…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {surfaces.map((s) => {
            const isActive = s.status === "active";
            const isPending = s.status === "pending";
            const inFlight = pendingId === s.id;
            const stateRing = isActive
              ? "border-emerald-500/40 bg-emerald-500/5"
              : isPending
                ? "border-amber-500/40 bg-amber-500/5"
                : cardBase;
            return (
              <div key={s.id} className={`rounded-lg border p-4 ${stateRing} space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold leading-tight">{s.label}</h3>
                      {s.gate === "gated" && (
                        <span
                          title="Gated — requires admin grant, invite, or cohort"
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300 bg-amber-500/10 flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" /> Gated
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300 bg-amber-500/10 flex items-center gap-1">
                          <Hourglass className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${mutedClass}`}>{s.description}</p>
                    <p className={`text-[11px] mt-1.5 ${mutedClass}`}>{s.longDescription}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {isActive && (
                    <>
                      {onOpenSurface && (
                        <button
                          type="button"
                          onClick={() => onOpenSurface(s.tabSlug)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs"
                        >
                          Open <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void mutate(s.id, "revoke")}
                        disabled={inFlight}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200 disabled:opacity-50"
                      >
                        {inFlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Deactivate
                      </button>
                    </>
                  )}
                  {!isActive && !isPending && s.canSelfActivate && (
                    <button
                      type="button"
                      onClick={() => void mutate(s.id, "activate")}
                      disabled={inFlight}
                      className="flex items-center gap-1 px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
                    >
                      {inFlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Activate
                    </button>
                  )}
                  {!isActive && !isPending && !s.canSelfActivate && (
                    <button
                      type="button"
                      onClick={() => void mutate(s.id, "request")}
                      disabled={inFlight}
                      className="flex items-center gap-1 px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 text-xs disabled:opacity-50"
                    >
                      {inFlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                      Request access
                    </button>
                  )}
                  {isPending && (
                    <span className="text-xs text-amber-300">Request submitted — admin will review.</span>
                  )}
                  {s.grantedAt && isActive && (
                    <span className={`text-[10px] ${mutedClass} ml-auto`}>
                      via {s.grantedVia} · {new Date(s.grantedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}

export default ActivationsTab;
