"use client";

/**
 * MetaMePulseAdminTab — admin approval queue for the metaMe Runtime content
 * lane (cartridge='metame-runtime').
 *
 * Mirrors KnytCommunityContentAdminTab's draft → shared → runtime_promoted
 * flow, scoped to the metame-runtime cartridge. The extra control here: each
 * queued row carries a Menu + Submenu dropdown. The admin assigns where the
 * content surfaces in the runtime (be/make/play/earn/share + submenu) and that
 * placement is persisted on promote. The runtime maps it into the menus via the
 * existing scoreContent pipeline (see services/community-content/promotedCapsules.ts).
 *
 * Admin-gated (UI-side), consistent with the other community-content admin tabs.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X as XIcon,
} from "lucide-react";

type RuntimeMenu = "be" | "make" | "play" | "earn" | "share";

const MENU_LABELS: Record<RuntimeMenu, string> = {
  be: "Be",
  make: "Make",
  play: "Play",
  earn: "Earn",
  share: "Share",
};

// Submenu options per menu — mirrors the runtime's floating sub-menus
// (MetaMeRuntimeClient runtimeMenu). Values are stored lowercased.
const MENU_SUBMENUS: Record<RuntimeMenu, string[]> = {
  be: ["persona", "identity", "settings", "memory", "connections"],
  make: ["create", "build", "remix"],
  play: ["watch", "listen", "knyt"],
  earn: ["goal", "task", "wallet", "reward", "offer"],
  share: ["message", "invite", "refer"],
};

interface ContentItem {
  id: string;
  title: string;
  prompt: string;
  skill: "article" | "story" | "note";
  imageUrl: string | null;
  qcCost: number;
  creator: { firstName: string | null; handle: string | null; fioHandle: string | null };
  runtimeMenu: string | null;
  runtimeSubmenu: string | null;
  createdAt: string;
}

interface Props {
  isAdmin?: boolean;
  personaId?: string;
}

export function MetaMePulseAdminTab({ isAdmin, personaId }: Props) {
  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 m-4 text-xs text-red-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Admin access required.
      </div>
    );
  }
  return <AdminContent personaId={personaId} />;
}

function AdminContent({ personaId }: { personaId?: string }) {
  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row menu placement draft, keyed by row id.
  const [placement, setPlacement] = useState<Record<string, { menu: RuntimeMenu | ""; submenu: string }>>({});

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const params = new URLSearchParams({ status: "shared", cartridge: "metame-runtime", limit: "100" });
      const res = await fetch(`/api/community-content/list?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Failed to load queue (${res.status})`);
        return;
      }
      const items = (json.items ?? []) as ContentItem[];
      setQueue(items);
      // Seed placement drafts from any previously-assigned values.
      setPlacement((prev) => {
        const next = { ...prev };
        for (const it of items) {
          if (!next[it.id]) {
            next[it.id] = {
              menu: (it.runtimeMenu as RuntimeMenu | null) ?? "",
              submenu: it.runtimeSubmenu ?? "",
            };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const setMenu = (id: string, menu: RuntimeMenu | "") => {
    setPlacement((prev) => ({ ...prev, [id]: { menu, submenu: "" } }));
  };
  const setSubmenu = (id: string, submenu: string) => {
    setPlacement((prev) => ({ ...prev, [id]: { menu: prev[id]?.menu ?? "", submenu } }));
  };

  const promote = async (id: string) => {
    if (!personaId) return;
    const place = placement[id];
    if (!place?.menu) {
      setError("Pick a runtime menu before promoting.");
      return;
    }
    setActionPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/community-content/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPersonaId: personaId,
          runtimeMenu: place.menu,
          runtimeSubmenu: place.submenu || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Promote failed (${res.status})`);
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== id));
    } finally {
      setActionPending(null);
    }
  };

  const reject = async (id: string) => {
    if (!personaId) return;
    setActionPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/community-content/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPersonaId: personaId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Reject failed (${res.status})`);
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== id));
    } finally {
      setActionPending(null);
    }
  };

  const deleteRow = async (id: string, title: string) => {
    if (!personaId) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete "${title}" permanently? Use Reject if you only want to hide it.`,
      );
      if (!ok) return;
    }
    setActionPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/community-content/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPersonaId: personaId }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: "invalid response" }));
      if (!res.ok || !json.ok) {
        setError(json.error || `Delete failed (${res.status})`);
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {error && (
        <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            metaMe Pulse — promotion queue ({queue.length})
          </div>
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loadingQueue}
            className="text-slate-400 hover:text-white transition disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? "animate-spin" : ""}`} />
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Studio→runtime launches land here as <span className="text-slate-300">shared</span> (pending).
          Assign a runtime menu placement, then promote to surface it on the metaMe Runtime.
        </p>

        {loadingQueue && queue.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-8 text-center">
            <p className="text-sm text-slate-300">Queue is clear.</p>
            <p className="text-[11px] text-slate-500 mt-1">Runtime-targeted content awaiting promotion will land here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                pending={actionPending === item.id}
                menu={placement[item.id]?.menu ?? ""}
                submenu={placement[item.id]?.submenu ?? ""}
                onMenu={(m) => setMenu(item.id, m)}
                onSubmenu={(s) => setSubmenu(item.id, s)}
                onPromote={() => void promote(item.id)}
                onReject={() => void reject(item.id)}
                onDelete={() => void deleteRow(item.id, item.title)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QueueRow({
  item, pending, menu, submenu, onMenu, onSubmenu, onPromote, onReject, onDelete,
}: {
  item: ContentItem;
  pending: boolean;
  menu: RuntimeMenu | "";
  submenu: string;
  onMenu: (m: RuntimeMenu | "") => void;
  onSubmenu: (s: string) => void;
  onPromote: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const submenuOptions = menu ? MENU_SUBMENUS[menu] : [];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-3">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="h-16 w-16 rounded-lg bg-slate-950 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-slate-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.title}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {item.skill} · {item.creator.fioHandle ?? item.creator.handle ?? item.creator.firstName ?? "Creator"}
        </p>
        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{item.prompt}</p>

        {/* Runtime menu placement */}
        <div className="mt-2 flex items-center gap-2">
          <select
            value={menu}
            onChange={(e) => onMenu(e.target.value as RuntimeMenu | "")}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-200 focus:border-emerald-400/40 focus:outline-none"
          >
            <option value="">Menu…</option>
            {(Object.keys(MENU_LABELS) as RuntimeMenu[]).map((m) => (
              <option key={m} value={m}>{MENU_LABELS[m]}</option>
            ))}
          </select>
          <select
            value={submenu}
            onChange={(e) => onSubmenu(e.target.value)}
            disabled={!menu}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-200 focus:border-emerald-400/40 focus:outline-none disabled:opacity-30"
          >
            <option value="">Submenu (optional)…</option>
            {submenuOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPromote}
          disabled={pending || !menu}
          title={!menu ? "Pick a runtime menu first" : "Promote to the metaMe Runtime"}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-30"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Promote
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-30"
          title="Soft reject — sets status='rejected', row is preserved for audit"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XIcon className="h-3 w-3" />}
          Reject
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/25 disabled:opacity-30"
          title="Hard delete — removes the row"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Delete
        </button>
      </div>
    </div>
  );
}

export default MetaMePulseAdminTab;
