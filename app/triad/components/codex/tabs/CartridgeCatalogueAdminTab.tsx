"use client";

/**
 * CartridgeCatalogueAdminTab — metaMe-admin surface for reviewing persona-
 * submitted requests to publish their cartridge to the metaMe activations
 * catalogue.
 *
 * Lists pending (default) requests with cartridge slug, title, requester
 * display label + email, and message. Admin clicks Approve or Reject;
 * rejection asks for a one-line reason. Tabs across the top toggle
 * between pending and decided lists.
 *
 * Server gate: persona.cartridgeFlags.isAdmin enforced in the API. The
 * tab is itself adminOnly in the codex config, so non-admins never see
 * this surface at all.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCcw, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface CatalogueRequest {
  id: string;
  cartridgeSlug: string;
  cartridgeTitle: string;
  requesterDisplayLabel: string | null;
  requesterEmail: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

type Filter = "pending" | "approved" | "rejected";

export function CartridgeCatalogueAdminTab() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [list, setList] = useState<CatalogueRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(
        `/api/admin/cartridge-catalogue/requests?status=${encodeURIComponent(filter)}`,
      );
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.detail || body.error || `load failed (${res.status})`);
      }
      setList(body.requests as CatalogueRequest[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (id: string, decision: "approve" | "reject") => {
      const reason =
        decision === "reject"
          ? window.prompt("Optional rejection reason (visible to the requester):") ?? ""
          : "";
      setActingId(id);
      setActionError(null);
      try {
        const res = await personaFetch(
          `/api/admin/cartridge-catalogue/requests/${encodeURIComponent(id)}/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision, reason: reason || undefined }),
          },
        );
        const body = await res.json();
        if (!res.ok || !body.ok) {
          throw new Error(body.detail || body.error || `decision failed (${res.status})`);
        }
        await load();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : String(e));
      } finally {
        setActingId(null);
      }
    },
    [load],
  );

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Cartridge Catalogue Requests</h2>
          <p className="text-xs text-slate-500">
            Approve or reject persona-submitted applications to list a cartridge in the metaMe activations catalogue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-700/40 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {/* Filter chips */}
      <div className="flex gap-1">
        {(["pending", "approved", "rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
              filter === f
                ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {actionError && (
        <div className="px-3 py-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded">
          {actionError}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading && list === null && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}
        {!loading && list && list.length === 0 && (
          <div className="text-sm text-slate-500 px-3 py-6 text-center border border-dashed border-slate-700/40 rounded">
            No {filter} catalogue requests.
          </div>
        )}
        {list && list.map((r) => (
          <article
            key={r.id}
            className="p-4 rounded-lg border border-slate-700/60 bg-slate-800/40 space-y-2"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-100">{r.cartridgeTitle}</h3>
                <div className="text-xs text-slate-500 font-mono">/{r.cartridgeSlug}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">
                  {r.requesterDisplayLabel ?? "(no label)"}
                </div>
                {r.requesterEmail && (
                  <div className="text-[10px] text-slate-500">{r.requesterEmail}</div>
                )}
              </div>
            </header>
            {r.message && (
              <p className="text-xs text-slate-300 bg-slate-900/40 border border-slate-700/40 rounded px-2 py-1.5 whitespace-pre-wrap">
                {r.message}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] text-slate-500">
                requested {new Date(r.requestedAt).toLocaleString()}
                {r.decidedAt && (
                  <>
                    {" · decided "}{new Date(r.decidedAt).toLocaleString()}
                  </>
                )}
                {r.decisionReason && (
                  <span className="ml-2 text-slate-400">reason: {r.decisionReason}</span>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void decide(r.id, "approve")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/60 disabled:opacity-40"
                  >
                    {actingId === r.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void decide(r.id, "reject")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:border-rose-500/60 disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              )}
              {r.status !== "pending" && (
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    r.status === "approved"
                      ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                      : r.status === "rejected"
                        ? "text-rose-300 bg-rose-500/10 border border-rose-500/30"
                        : "text-slate-400 bg-slate-700/40 border border-slate-600/40"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default CartridgeCatalogueAdminTab;
