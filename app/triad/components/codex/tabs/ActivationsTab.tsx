"use client";

/**
 * ActivationsTab — top-level metaMe surface that controls which active
 * surfaces are switched on in the persona's runtime.
 *
 * Reads + mutates via the canonical `useActivations()` hook so this panel
 * and `CodexPanelDynamic`'s top menu share a single store. No window
 * events, no per-component fetches.
 */

import React, { useCallback, useState } from "react";
import { Loader2, Sparkles, ChevronRight, Lock, CheckCircle2, X, Hourglass, ExternalLink, Check } from "lucide-react";
import { useActivations } from "@/services/activations/ActivationsContext";

interface Props {
  personaId?: string;
  isAdmin?: boolean;
  /** Optional click handler — parent can navigate to the activated tab. */
  onOpenSurface?: (tabSlug: string) => void;
  theme?: "light" | "dark";
}

const SOURCE_TO_EMBED_SLUG: Record<string, string> = {
  metame: 'metame',
  knyt: 'knyt',
  qriptopian: 'qripto',
  marketa: 'marketa',
  mvl: 'alpha-knyt',
};

function buildEmbedUrl(sourceCartridge: string, tabSlug: string): string {
  const slug = SOURCE_TO_EMBED_SLUG[sourceCartridge] ?? sourceCartridge;
  return `/triad/embed/codex/${slug}?tab=${encodeURIComponent(tabSlug)}`;
}

export function ActivationsTab({ isAdmin = false, onOpenSurface, theme = "dark" }: Props) {
  const {
    surfaces,
    loading,
    error,
    isMutating,
    activate,
    requestAccess,
    revoke,
    clearError,
  } = useActivations();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleClick = useCallback(
    (id: string, action: "activate" | "request" | "revoke") => {
      if (action === "activate") return void activate(id);
      if (action === "request") return void requestAccess(id);
      if (action === "revoke") return void revoke(id);
    },
    [activate, requestAccess, revoke],
  );

  const handleCopyEmbed = useCallback((id: string, sourceCartridge: string, tabSlug: string) => {
    const path = buildEmbedUrl(sourceCartridge, tabSlug);
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    });
  }, []);

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

      {error && (
        <div className="mb-3 px-3 py-2 rounded border border-rose-500/50 bg-rose-500/10 text-sm text-rose-200 flex items-start gap-2">
          <span className="font-semibold">Activation failed:</span>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-rose-300 hover:text-rose-100 text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {loading && surfaces.length === 0 ? (
        <div className="flex items-center text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading activations…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {surfaces.map((s) => {
            const isActive = s.status === "active";
            const isPending = s.status === "pending";
            const inFlight = isMutating(s.id);
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
                        onClick={() => handleClick(s.id, "revoke")}
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
                      onClick={() => handleClick(s.id, "activate")}
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
                      onClick={() => handleClick(s.id, "request")}
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
                    <span className={`text-[10px] ${mutedClass}`}>
                      via {s.grantedVia} · {new Date(s.grantedAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    title="Copy embed link"
                    onClick={() => handleCopyEmbed(s.id, s.sourceCartridge, s.tabSlug)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-slate-600 hover:border-sky-500/50 text-xs text-slate-400 hover:text-sky-300 ml-auto"
                  >
                    {copiedId === s.id ? <Check className="w-3 h-3 text-emerald-400" /> : <ExternalLink className="w-3 h-3" />}
                    {copiedId === s.id ? 'Copied' : 'Embed'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivationsTab;
