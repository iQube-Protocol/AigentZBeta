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
  Save,
  Sparkles,
  X as XIcon,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  prompt: string;
  skill: "article" | "story";
  articleBody: string | null;
  imageUrl: string | null;
  qcCost: number;
  creator: { firstName: string | null; handle: string | null };
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
}

export function KnytCommunityContentAdminTab({ isAdmin, personaId }: Props) {
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

  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/community-content/list?status=shared&limit=100", { cache: "no-store" });
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
  }, []);

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
  item, pending, onPromote, onReject,
}: {
  item: ContentItem;
  pending: boolean;
  onPromote: () => void;
  onReject: () => void;
}) {
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
          {item.skill} · {item.creator.firstName ?? item.creator.handle ?? "Creator"} · {item.qcCost} Q¢
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
          onClick={onReject}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-30"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XIcon className="h-3 w-3" />}
          Reject
        </button>
      </div>
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
