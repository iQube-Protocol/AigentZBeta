"use client";

/**
 * KnytCommunityContentAdminTab — admin queue + Q¢ pricing settings for
 * community-generated content.
 *
 * Admin-gated (UI-side). Two sections:
 *   - Promotion queue: lists status='shared' content; promote → runtime
 *     catalog or reject → hidden.
 *   - Budget settings: editable Q¢ costs + daily caps. All values are
 *     read from / written to community_content_settings.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Coins,
  Loader2,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  X as XIcon,
} from "lucide-react";

// Runtime menu placement — mirrors MetaMePulseAdminTab / MetaMeRuntimeClient.
// A cartridge admin tags forwarded Pulse content with the runtime menu it
// should surface under; the metaMe admin still owns final promotion.
type RuntimeMenu = "be" | "make" | "play" | "earn" | "share";
const RUNTIME_MENU_LABELS: Record<RuntimeMenu, string> = {
  be: "Be",
  make: "Make",
  play: "Play",
  earn: "Earn",
  share: "Share",
};
const RUNTIME_MENU_SUBMENUS: Record<RuntimeMenu, string[]> = {
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
  skill: "article" | "story";
  articleBody: string | null;
  imageUrl: string | null;
  qcCost: number;
  creator: { firstName: string | null; handle: string | null; fioHandle: string | null };
  createdAt: string;
}

interface Settings {
  cost_qc_article: number;
  cost_qc_story: number;
  surcharge_pct: number;
  daily_free_quota: number;
  daily_discard_refund: number;
  discard_window_seconds: number;
}

interface Props {
  isAdmin?: boolean;
  personaId?: string;
  /**
   * Cartridge filter — drives /api/community-content/list?cartridge=
   * so KNYT admin sees only KNYT rows and Qripto admin sees only
   * Qripto rows. Defaults to undefined (no filter) for back-compat
   * with the existing KNYT mount.
   */
  cartridge?: "knyt" | "qripto";
}

export function KnytCommunityContentAdminTab({ isAdmin, personaId, cartridge }: Props) {
  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 m-4 text-xs text-red-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Admin access required.
      </div>
    );
  }
  return <AdminContent personaId={personaId} cartridge={cartridge} />;
}

function AdminContent({ personaId, cartridge }: { personaId?: string; cartridge?: "knyt" | "qripto" }) {
  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Per-row "send to metaMe runtime" picker state, keyed by row id.
  const [runtimeDraft, setRuntimeDraft] = useState<
    Record<string, { open: boolean; menu: RuntimeMenu | ""; submenu: string; submitted: boolean }>
  >({});
  const [submittingRuntime, setSubmittingRuntime] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const params = new URLSearchParams({ status: "shared", limit: "100" });
      if (cartridge) params.set("cartridge", cartridge);
      const res = await fetch(`/api/community-content/list?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Failed to load queue (${res.status})`);
        return;
      }
      setQueue((json.items ?? []) as ContentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoadingQueue(false);
    }
  }, [cartridge]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/community-content/settings", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setSettings(json.settings as Settings);
        setDraft(json.settings as Settings);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadSettings();
  }, [loadQueue, loadSettings]);

  const promote = async (id: string) => {
    if (!personaId) return;
    setActionPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/community-content/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPersonaId: personaId }),
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

  // Hard delete — admin-only. Confirms before firing so a misclick
  // doesn't nuke a row. Removes the row + its publication-state mirror
  // (route picks the right table based on row.cartridge). Use Reject
  // for soft-rejection (status='rejected'); Delete is for spam / abuse
  // where the row should disappear entirely.
  const deleteRow = async (id: string, title: string) => {
    if (!personaId) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete "${title}" permanently? This removes the row and its publication-state mirror. Use Reject if you only want to hide it.`,
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

  const setRuntimeRow = (id: string, patch: Partial<{ open: boolean; menu: RuntimeMenu | ""; submenu: string; submitted: boolean }>) =>
    setRuntimeDraft((prev) => ({
      ...prev,
      [id]: { open: false, menu: "", submenu: "", submitted: false, ...prev[id], ...patch },
    }));

  // Forward an approved Pulse row into the metaMe Runtime pipeline. Mints a
  // linked metame-runtime submission (status='shared') in the metaMe admin
  // queue; the original Pulse row is untouched.
  const submitToRuntime = async (id: string) => {
    if (!personaId) return;
    const d = runtimeDraft[id];
    if (!d?.menu) {
      setError("Pick a runtime menu first.");
      return;
    }
    setSubmittingRuntime(id);
    setError(null);
    try {
      const res = await fetch(`/api/community-content/${id}/submit-to-runtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPersonaId: personaId,
          runtimeMenu: d.menu,
          runtimeSubmenu: d.submenu || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Submit failed (${res.status})`);
        return;
      }
      setRuntimeRow(id, { open: false, submitted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmittingRuntime(null);
    }
  };

  const saveSettings = async () => {
    if (!draft) return;
    setSavingSettings(true);
    setError(null);
    try {
      const res = await fetch("/api/community-content/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, adminPersonaId: personaId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Save failed (${res.status})`);
        return;
      }
      setSettings(json.settings as Settings);
      setDraft(json.settings as Settings);
    } finally {
      setSavingSettings(false);
    }
  };

  const settingsDirty = !!(settings && draft) && JSON.stringify(settings) !== JSON.stringify(draft);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {error && (
        <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Promotion queue */}
      <section className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Promotion queue ({queue.length})
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

        {loadingQueue && queue.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-8 text-center">
            <p className="text-sm text-slate-300">Queue is clear.</p>
            <p className="text-[11px] text-slate-500 mt-1">Published community content awaiting promotion will land here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                pending={actionPending === item.id}
                onPromote={() => void promote(item.id)}
                onReject={() => void reject(item.id)}
                onDelete={() => void deleteRow(item.id, item.title)}
                runtime={runtimeDraft[item.id]}
                runtimeSubmitting={submittingRuntime === item.id}
                onToggleRuntime={() => setRuntimeRow(item.id, { open: !runtimeDraft[item.id]?.open })}
                onRuntimeMenu={(m) => setRuntimeRow(item.id, { menu: m, submenu: "" })}
                onRuntimeSubmenu={(s) => setRuntimeRow(item.id, { submenu: s })}
                onSubmitRuntime={() => void submitToRuntime(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Budget settings */}
      <section className="p-4 space-y-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          Q¢ pricing & caps
        </div>

        {!draft ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField
              label="Article cost (Q¢)"
              value={draft.cost_qc_article}
              min={0} max={1000}
              onChange={(v) => setDraft({ ...draft, cost_qc_article: v })}
            />
            <NumberField
              label="Story cost (Q¢)"
              value={draft.cost_qc_story}
              min={0} max={1000}
              onChange={(v) => setDraft({ ...draft, cost_qc_story: v })}
            />
            <NumberField
              label="Surcharge after free (%)"
              value={draft.surcharge_pct}
              min={0} max={500}
              onChange={(v) => setDraft({ ...draft, surcharge_pct: v })}
            />
            <NumberField
              label="Free generations / day"
              value={draft.daily_free_quota}
              min={0} max={100}
              onChange={(v) => setDraft({ ...draft, daily_free_quota: v })}
            />
            <NumberField
              label="Discard refunds / day"
              value={draft.daily_discard_refund}
              min={0} max={100}
              onChange={(v) => setDraft({ ...draft, daily_discard_refund: v })}
            />
            <NumberField
              label="Discard window (sec)"
              value={draft.discard_window_seconds}
              min={5} max={600}
              onChange={(v) => setDraft({ ...draft, discard_window_seconds: v })}
            />

            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              {settingsDirty && (
                <button
                  type="button"
                  onClick={() => settings && setDraft(settings)}
                  disabled={savingSettings}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={savingSettings || !settingsDirty}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-30"
              >
                {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function QueueRow({
  item, pending, onPromote, onReject, onDelete,
  runtime, runtimeSubmitting, onToggleRuntime, onRuntimeMenu, onRuntimeSubmenu, onSubmitRuntime,
}: {
  item: ContentItem;
  pending: boolean;
  onPromote: () => void;
  onReject: () => void;
  onDelete: () => void;
  runtime?: { open: boolean; menu: RuntimeMenu | ""; submenu: string; submitted: boolean };
  runtimeSubmitting: boolean;
  onToggleRuntime: () => void;
  onRuntimeMenu: (m: RuntimeMenu | "") => void;
  onRuntimeSubmenu: (s: string) => void;
  onSubmitRuntime: () => void;
}) {
  const menu = runtime?.menu ?? "";
  const submenuOptions = menu ? RUNTIME_MENU_SUBMENUS[menu] : [];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
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
            {item.skill} · {item.creator.fioHandle ?? item.creator.handle ?? item.creator.firstName ?? "Creator"} · {item.qcCost} Q¢
          </p>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{item.prompt}</p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onPromote}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-30"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Promote
          </button>
          <button
            type="button"
            onClick={onToggleRuntime}
            disabled={pending || runtime?.submitted}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20 disabled:opacity-30"
            title="Forward to the metaMe Runtime admin queue (tagged by menu)"
          >
            <Rocket className="h-3 w-3" />
            {runtime?.submitted ? "Sent" : "→ Runtime"}
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
            title="Hard delete — removes the row and its publication-state mirror"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete
          </button>
        </div>
      </div>

      {runtime?.open && !runtime.submitted && (
        <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
          <span className="text-[10px] uppercase tracking-wider text-sky-300/70">metaMe runtime →</span>
          <select
            value={menu}
            onChange={(e) => onRuntimeMenu(e.target.value as RuntimeMenu | "")}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-200 focus:border-sky-400/40 focus:outline-none"
          >
            <option value="">Menu…</option>
            {(Object.keys(RUNTIME_MENU_LABELS) as RuntimeMenu[]).map((m) => (
              <option key={m} value={m}>{RUNTIME_MENU_LABELS[m]}</option>
            ))}
          </select>
          <select
            value={runtime.submenu}
            onChange={(e) => onRuntimeSubmenu(e.target.value)}
            disabled={!menu}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-200 focus:border-sky-400/40 focus:outline-none disabled:opacity-30"
          >
            <option value="">Submenu (optional)…</option>
            {submenuOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onSubmitRuntime}
            disabled={runtimeSubmitting || !menu}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25 disabled:opacity-30"
          >
            {runtimeSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label, value, min, max, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)));
        }}
        className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-amber-400/40 focus:outline-none"
      />
    </label>
  );
}

export default KnytCommunityContentAdminTab;
