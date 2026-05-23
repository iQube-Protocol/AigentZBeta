"use client";

/**
 * ExperienceGoalsEditor — focused modal for adding / removing / reordering
 * the persona's ExperienceGoals (the `blak.experienceGoals` slice of the
 * ExperienceQube).
 *
 * Replaces the placeholder "fire an intent" flow for the
 * `metame.update-experience-goals` NBE — the user can now actually edit
 * the goals that drive every brief, NBE rerank, and strategy inference.
 *
 * Saves via POST /api/assistant/experience-model with `{ blak: { experienceGoals } }`.
 * The route merges into the existing payload, so partial updates are safe.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, X, ArrowUp, ArrowDown, Target } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { MicButton } from "@/components/ui/MicButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  /** Called after a successful save with the new goals list. */
  onSaved?: (goals: string[]) => void;
}

const MAX_GOALS = 8;
const MAX_LEN = 240;

export function ExperienceGoalsEditor({ open, onOpenChange, personaId, onSaved }: Props) {
  const [goals, setGoals] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current goals when the dialog opens.
  useEffect(() => {
    if (!open || !personaId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    personaFetch("/api/assistant/experience-model", { personaIdHint: personaId })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const current = Array.isArray(data?.experienceGoals)
          ? (data.experienceGoals as string[])
          : [];
        setGoals(current);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load current goals");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, personaId]);

  const addGoal = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (goals.length >= MAX_GOALS) {
      setError(`Limit ${MAX_GOALS} goals — remove one first.`);
      return;
    }
    setGoals((prev) => [...prev, trimmed.slice(0, MAX_LEN)]);
    setDraft("");
    setError(null);
  }, [draft, goals]);

  const removeGoal = useCallback((idx: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const moveGoal = useCallback((idx: number, dir: -1 | 1) => {
    setGoals((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!personaId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/experience-model", {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blak: { experienceGoals: goals } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `Save failed (${res.status})`);
      }
      // Invalidate the inferred-strategy cache so the next read recomputes.
      void personaFetch("/api/assistant/inferred-strategy", {
        personaIdHint: personaId,
        method: "POST",
      }).catch(() => undefined);
      onSaved?.(goals);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [goals, onOpenChange, onSaved, personaId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-violet-400" />
            ExperienceGoals
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            The goals aigentMe uses for every brief, next-best action, and strategy inference.
            Add what you want pushed forward; remove what's gone stale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex items-center text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading goals…
            </div>
          ) : (
            <>
              <ul className="space-y-1.5">
                {goals.length === 0 ? (
                  <li className="text-xs text-slate-500 italic">No goals yet — add your first below.</li>
                ) : (
                  goals.map((g, i) => (
                    <li
                      key={`${i}-${g}`}
                      className="flex items-start gap-2 rounded border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-sm text-slate-100 leading-snug">{g}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveGoal(i, -1)}
                          disabled={i === 0}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGoal(i, 1)}
                          disabled={i === goals.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGoal(i)}
                          className="p-1 text-slate-400 hover:text-rose-300"
                          aria-label="Remove goal"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="experience-goal"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGoal();
                    }
                  }}
                  placeholder="Add a goal Aigent Me should keep moving forward…"
                  maxLength={MAX_LEN}
                  className="flex-1 px-3 py-2 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
                />
                <MicButton
                  onTranscript={(text) => setDraft(draft ? `${draft.trimEnd()} ${text}` : text)}
                  size="sm"
                  theme="dark"
                />
                <button
                  type="button"
                  onClick={addGoal}
                  disabled={!draft.trim() || goals.length >= MAX_GOALS}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 text-sm disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                {goals.length}/{MAX_GOALS} goals. Keep them concrete — verbs and nouns, not aspirations.
              </p>
              {error && (
                <p className="text-xs text-amber-300">{error}</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-500/20 border border-violet-500/40 text-violet-100 text-sm hover:bg-violet-500/30 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save goals
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExperienceGoalsEditor;
