'use client';

/**
 * KnytTasksRewardsAdminTab
 *
 * Admin surface for the KNYT cartridge's tasks + rewards system.
 *
 * Live data — reads + writes via /api/admin/knyt/tasks-rewards:
 *
 *   - Lists every crm_task_templates row (KNYT tenant) with the live
 *     aggregates from crm_rewards: approved, pending_redemption,
 *     redeemed, rejected — counts AND total KNYT amounts.
 *   - Operator can edit reward_knyt amount, title, description, and
 *     toggle is_active per template. Every edit emits an
 *     orchestration_events row with event_type='admin.task-template-edit'
 *     so the audit review can trace any reward-amount changes.
 *
 * Privacy: aggregates only — no per-persona drill-down on this surface.
 * Admin-only via cartridgeFlags.isAdmin (server-side gate in the route).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Edit2, Loader2, Lock, Pause, Play, RefreshCw, Save, X } from 'lucide-react';

interface RewardAggregate {
  approved_count: number;
  approved_amount: number;
  redeemed_count: number;
  redeemed_amount: number;
  pending_count: number;
  pending_amount: number;
  rejected_count: number;
  last_grant_at: string | null;
}

interface TaskTemplate {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty_level: number;
  reward_qct: number;
  reward_qoyn: number;
  reward_knyt: number;
  cohort_id: string | null;
  is_active: boolean;
  schema_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reward_task_types: string[];
  aggregates: RewardAggregate;
  updated_at: string;
}

interface Props {
  isAdmin?: boolean;
  personaId?: string;
  theme?: 'light' | 'dark';
}

interface DraftEdits {
  title?: string;
  description?: string;
  reward_knyt?: string;
}

export function KnytTasksRewardsAdminTab({ isAdmin, theme = 'dark' }: Props) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftEdits>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/knyt/tasks-rewards', { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        setTemplates([]);
      } else {
        setTemplates(Array.isArray(json.templates) ? json.templates : []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const startEdit = useCallback((t: TaskTemplate) => {
    setEditing(t.id);
    setDraft({
      title: t.title,
      description: t.description,
      reward_knyt: String(t.reward_knyt),
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setDraft({});
  }, []);

  const persist = useCallback(async (templateId: string, patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/knyt/tasks-rewards', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTemplateId: templateId, patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return false;
      }
      setSavedFlash(templateId);
      setTimeout(() => setSavedFlash(null), 1800);
      await refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const t = templates.find((x) => x.id === editing);
    if (!t) return;
    const patch: Record<string, unknown> = {};
    if (draft.title !== undefined && draft.title !== t.title) patch.title = draft.title;
    if (draft.description !== undefined && draft.description !== t.description) patch.description = draft.description;
    if (draft.reward_knyt !== undefined) {
      const n = Number(draft.reward_knyt);
      if (Number.isFinite(n) && n >= 0 && n !== t.reward_knyt) patch.reward_knyt = n;
    }
    if (Object.keys(patch).length === 0) { cancelEdit(); return; }
    const ok = await persist(editing, patch);
    if (ok) cancelEdit();
  }, [editing, templates, draft, persist, cancelEdit]);

  const toggleActive = useCallback(async (t: TaskTemplate) => {
    await persist(t.id, { is_active: !t.is_active });
  }, [persist]);

  // ── Render ──────────────────────────────────────────────────────────────
  const isDark = theme === 'dark';
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
          <Lock className="h-4 w-4" />
          <span className="text-sm">Admin access required.</span>
        </div>
      </div>
    );
  }

  const totals = useMemo(() => {
    let approved = 0, redeemed = 0, pending = 0;
    let approvedAmt = 0, redeemedAmt = 0, pendingAmt = 0;
    for (const t of templates) {
      approved += t.aggregates.approved_count;
      redeemed += t.aggregates.redeemed_count;
      pending += t.aggregates.pending_count;
      approvedAmt += t.aggregates.approved_amount;
      redeemedAmt += t.aggregates.redeemed_amount;
      pendingAmt += t.aggregates.pending_amount;
    }
    return { approved, redeemed, pending, approvedAmt, redeemedAmt, pendingAmt };
  }, [templates]);

  return (
    <div className={`p-4 md:p-6 space-y-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Tasks &amp; Rewards Admin</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="text-emerald-300/80">Approved (claimable)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-medium text-emerald-200">{totals.approved}</span>
            <span className="text-emerald-300/70">{totals.approvedAmt.toFixed(2)} KNYT</span>
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
          <div className="text-amber-300/80">Pending redemption</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-medium text-amber-200">{totals.pending}</span>
            <span className="text-amber-300/70">{totals.pendingAmt.toFixed(2)} KNYT</span>
          </div>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5">
          <div className="text-cyan-300/80">Redeemed (paid out)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-medium text-cyan-200">{totals.redeemed}</span>
            <span className="text-cyan-300/70">{totals.redeemedAmt.toFixed(2)} KNYT</span>
          </div>
        </div>
      </div>

      {loading && templates.length === 0 ? (
        <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
          No task templates found for tenant <span className="font-mono">knyt</span>.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const isEditing = editing === t.id;
            const flash = savedFlash === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-3 transition ${
                  t.is_active
                    ? 'border-white/10 bg-white/5'
                    : 'border-white/5 bg-white/[0.02] opacity-60'
                } ${flash ? 'ring-1 ring-emerald-400/60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-500">{t.slug}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'}`}>
                        {t.is_active ? 'active' : 'disabled'}
                      </span>
                      {t.cohort_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                          cohort:{t.cohort_id}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        family:{(t.schema_json?.family as string) || '—'}
                      </span>
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.title ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus:border-teal-500 focus:outline-none"
                        placeholder="Title"
                      />
                    ) : (
                      <div className="text-sm font-medium text-slate-100">{t.title}</div>
                    )}

                    {isEditing ? (
                      <textarea
                        value={draft.description ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                        rows={2}
                        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:border-teal-500 focus:outline-none"
                        placeholder="Description"
                      />
                    ) : (
                      <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
                    )}

                    {t.reward_task_types.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {t.reward_task_types.map((rt) => (
                          <span key={rt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                            {rt}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Aggregates row */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px]">
                      <span className="text-emerald-300">
                        {t.aggregates.approved_count} approved
                        {t.aggregates.approved_amount > 0 && ` (${t.aggregates.approved_amount.toFixed(2)} KNYT)`}
                      </span>
                      <span className="text-amber-300">
                        {t.aggregates.pending_count} pending
                      </span>
                      <span className="text-cyan-300">
                        {t.aggregates.redeemed_count} redeemed
                        {t.aggregates.redeemed_amount > 0 && ` (${t.aggregates.redeemed_amount.toFixed(2)} KNYT)`}
                      </span>
                      {t.aggregates.rejected_count > 0 && (
                        <span className="text-slate-500">{t.aggregates.rejected_count} rejected</span>
                      )}
                      {t.aggregates.last_grant_at && (
                        <span className="text-slate-500">
                          last grant {new Date(t.aggregates.last_grant_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right column: reward amount + actions */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Reward</span>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={draft.reward_knyt ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, reward_knyt: e.target.value }))}
                          className="w-20 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-white focus:border-teal-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-mono text-amber-200">{t.reward_knyt.toFixed(2)}</span>
                      )}
                      <span className="text-[10px] text-slate-500">KNYT</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void commitEdit()}
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" /> Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 rounded bg-slate-500/20 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-500/30"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/30"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(t)}
                            disabled={saving}
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] disabled:opacity-50 ${
                              t.is_active
                                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            }`}
                          >
                            {t.is_active ? <><Pause className="h-3 w-3" /> Disable</> : <><Play className="h-3 w-3" /> Enable</>}
                          </button>
                          {flash && <Check className="h-3 w-3 text-emerald-400" />}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-500 pt-2">
        Edits emit an <span className="font-mono">orchestration_events</span> row with
        <span className="font-mono"> event_type=admin.task-template-edit</span> for the security audit trail.
        Disabled templates stop accruing new rewards but existing approved rewards remain claimable.
      </p>
    </div>
  );
}
