"use client";

/**
 * MetaMePulseAdminTab — the metaMe Runtime content controller.
 *
 * This is the single admin surface for everything that surfaces (or awaits
 * promotion to surface) in the metaMe Runtime, drawn from BOTH runtime sources
 * via /api/runtime/admin/content:
 *   • experience — Studio→runtime launches (composer ExperienceQubes). A live
 *     "Runtime Launch" deploy now lands as pending_review instead of minting
 *     unrestricted; the admin promotes it here.
 *   • community  — promoted UGC + cartridge-submitted Pulse rows
 *     (community_generated_content). metame-runtime `shared` rows await
 *     promotion; runtime_promoted rows (any cartridge) are live.
 *
 * Two sections:
 *   1. Pending review  — approve (with be/make/play/earn/share placement),
 *      archive, or delete.
 *   2. Live in runtime — unpublish, archive, or remove/delete. Management of
 *      what's surfacing now (incl. editorial content forwarded from cartridges)
 *      — not a new approval flow. A cartridge→runtime approval gate is a future
 *      follow-up.
 *
 * Admin-gated (UI-side), consistent with the other community-content admin tabs.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  EyeOff,
  Archive,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";

type RuntimeMenu = "be" | "make" | "play" | "earn" | "share";

const MENU_LABELS: Record<RuntimeMenu, string> = {
  be: "Be",
  make: "Make",
  play: "Play",
  earn: "Earn",
  share: "Share",
};

// Submenu options per menu — mirrors the runtime's floating sub-menus.
const MENU_SUBMENUS: Record<RuntimeMenu, string[]> = {
  be: ["persona", "identity", "settings", "memory", "connections"],
  make: ["create", "build", "remix"],
  play: ["watch", "listen", "knyt"],
  earn: ["goal", "task", "wallet", "reward", "offer"],
  share: ["message", "invite", "refer"],
};

type Action = "publish" | "unpublish" | "archive" | "delete";

interface RuntimeAdminItem {
  source: "community" | "experience";
  id: string;
  title: string;
  thumbUrl: string | null;
  cartridge: string;
  originCartridge: string | null;
  status: string;
  lane: "pending" | "live";
  runtimeMenu: string | null;
  runtimeSubmenu: string | null;
  skill: string | null;
  prompt: string | null;
  createdAt: string | null;
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
  const [pending, setPending] = useState<RuntimeAdminItem[]>([]);
  const [live, setLive] = useState<RuntimeAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row placement draft (pending community rows need a menu before publish).
  const [placement, setPlacement] = useState<Record<string, { menu: RuntimeMenu | ""; submenu: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (personaId) params.set("personaId", personaId);
      const res = await fetch(`/api/runtime/admin/content?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      const pendingItems = (json.pending ?? []) as RuntimeAdminItem[];
      const liveItems = (json.live ?? []) as RuntimeAdminItem[];
      setPending(pendingItems);
      setLive(liveItems);
      setPlacement((prev) => {
        const next = { ...prev };
        for (const it of pendingItems) {
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
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setMenu = (id: string, menu: RuntimeMenu | "") =>
    setPlacement((prev) => ({ ...prev, [id]: { menu, submenu: "" } }));
  const setSubmenu = (id: string, submenu: string) =>
    setPlacement((prev) => ({ ...prev, [id]: { menu: prev[id]?.menu ?? "", submenu } }));

  const act = useCallback(
    async (item: RuntimeAdminItem, action: Action) => {
      if (!personaId) return;
      if (action === "delete" && typeof window !== "undefined") {
        const label =
          item.source === "experience"
            ? `Remove "${item.title}" from the runtime? (The ExperienceQube itself is kept — this archives the runtime projection.)`
            : `Delete "${item.title}" permanently? Use Archive to hide without deleting.`;
        if (!window.confirm(label)) return;
      }
      const payload: Record<string, unknown> = {
        source: item.source,
        id: item.id,
        action,
        adminPersonaId: personaId,
      };
      if (action === "publish") {
        if (item.source === "community") {
          const place = placement[item.id];
          if (!place?.menu) {
            setError("Pick a runtime menu before promoting.");
            return;
          }
          payload.runtimeMenu = place.menu;
          payload.runtimeSubmenu = place.submenu || undefined;
        } else {
          // Experience projection carries its own menu_intent from the deploy
          // profile; publish releases the gate as-is.
          payload.runtimeMenu = item.runtimeMenu || undefined;
        }
      }
      setActionPending(item.id);
      setError(null);
      try {
        const res = await fetch(`/api/runtime/admin/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || `${action} failed (${res.status})`);
          return;
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : `${action} failed`);
      } finally {
        setActionPending(null);
      }
    },
    [personaId, placement, load],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {error && (
        <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Pending review */}
      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Pending review ({pending.length})
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-slate-400 hover:text-white transition disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Studio→runtime launches and cartridge-submitted Pulse content land here.
          Assign a runtime menu placement, then promote to surface it on the metaMe Runtime.
        </p>

        {loading && pending.length === 0 && live.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-6 text-center">
            <p className="text-sm text-slate-300">Queue is clear.</p>
            <p className="text-[11px] text-slate-500 mt-1">Runtime-targeted content awaiting promotion will land here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((item) => (
              <Row
                key={`${item.source}-${item.id}`}
                item={item}
                pending={actionPending === item.id}
                menu={placement[item.id]?.menu ?? ""}
                submenu={placement[item.id]?.submenu ?? ""}
                onMenu={(m) => setMenu(item.id, m)}
                onSubmenu={(s) => setSubmenu(item.id, s)}
                onAction={(a) => void act(item, a)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Live in runtime */}
      <section className="p-4 space-y-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
          <Rocket className="h-3.5 w-3.5 text-sky-400" />
          Live in runtime ({live.length})
        </div>
        <p className="text-[11px] text-slate-500">
          Everything surfacing in the runtime now — including editorial content forwarded from cartridges.
          Unpublish to pull it back to review, archive to retain-but-hide, or remove it entirely.
        </p>

        {live.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-6 text-center">
            <p className="text-[11px] text-slate-500">Nothing live in the runtime yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {live.map((item) => (
              <Row
                key={`${item.source}-${item.id}`}
                item={item}
                pending={actionPending === item.id}
                menu=""
                submenu=""
                onMenu={() => {}}
                onSubmenu={() => {}}
                onAction={(a) => void act(item, a)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceBadge({ item }: { item: RuntimeAdminItem }) {
  const label =
    item.source === "experience"
      ? "Studio"
      : item.originCartridge
        ? `${item.originCartridge.toUpperCase()} Pulse`
        : item.cartridge === "metame-runtime"
          ? "metaMe"
          : `${item.cartridge.toUpperCase()} Pulse`;
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">
      {label}
    </span>
  );
}

function Row({
  item, pending, menu, submenu, onMenu, onSubmenu, onAction,
}: {
  item: RuntimeAdminItem;
  pending: boolean;
  menu: RuntimeMenu | "";
  submenu: string;
  onMenu: (m: RuntimeMenu | "") => void;
  onSubmenu: (s: string) => void;
  onAction: (a: Action) => void;
}) {
  const isPending = item.lane === "pending";
  const isCommunityPending = isPending && item.source === "community";
  const submenuOptions = menu ? MENU_SUBMENUS[menu] : [];
  const publishDisabled = pending || (isCommunityPending && !menu);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-3">
      {item.thumbUrl ? (
        <img src={item.thumbUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="h-16 w-16 rounded-lg bg-slate-950 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-slate-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
          <SourceBadge item={item} />
          {!isPending && item.runtimeMenu && (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-200">
              {MENU_LABELS[item.runtimeMenu as RuntimeMenu] ?? item.runtimeMenu}
              {item.runtimeSubmenu ? ` · ${item.runtimeSubmenu}` : ""}
            </span>
          )}
        </div>
        {item.prompt && <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{item.prompt}</p>}

        {isCommunityPending && (
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
        )}
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        {isPending ? (
          <button
            type="button"
            onClick={() => onAction("publish")}
            disabled={publishDisabled}
            title={isCommunityPending && !menu ? "Pick a runtime menu first" : "Promote to the metaMe Runtime"}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-30"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Promote
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction("unpublish")}
            disabled={pending}
            title="Pull back to the review queue"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-30"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <EyeOff className="h-3 w-3" />}
            Unpublish
          </button>
        )}
        <button
          type="button"
          onClick={() => onAction("archive")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-500/20 disabled:opacity-30"
          title="Archive — retained but hidden from the runtime"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
          Archive
        </button>
        <button
          type="button"
          onClick={() => onAction("delete")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/25 disabled:opacity-30"
          title={item.source === "experience" ? "Remove the runtime projection (ExperienceQube kept)" : "Hard delete — removes the row"}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          {item.source === "experience" ? "Remove" : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default MetaMePulseAdminTab;
