"use client";

/**
 * PriorityPartnersEditor — focused modal for adding / removing / reordering
 * the persona's priority partners (the `blak.priorityPartners` slice of
 * the ExperienceQube).
 *
 * Closes the gap where the Strategy card surfaces the
 * "Marketa cartridge active but no priority partners declared" blocker
 * but the user had no surface to declare them.
 *
 * Saves via POST /api/assistant/experience-model with
 * `{ blak: { priorityPartners } }`. The route merges into the existing
 * payload, so partial updates are safe.
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
import { Loader2, Plus, X, ArrowUp, ArrowDown, Users } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId?: string;
  /** Called after a successful save with the new partners list. */
  onSaved?: (partners: string[]) => void;
}

const MAX_PARTNERS = 12;
const MAX_LEN = 200;

export function PriorityPartnersEditor({ open, onOpenChange, personaId, onSaved }: Props) {
  const [partners, setPartners] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !personaId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    personaFetch("/api/assistant/experience-model", { personaIdHint: personaId })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const current = Array.isArray(data?.priorityPartners)
          ? (data.priorityPartners as string[])
          : [];
        setPartners(current);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load current partners");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, personaId]);

  const addPartner = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (partners.length >= MAX_PARTNERS) {
      setError(`Limit ${MAX_PARTNERS} partners — remove one first.`);
      return;
    }
    setPartners((prev) => [...prev, trimmed.slice(0, MAX_LEN)]);
    setDraft("");
    setError(null);
  }, [draft, partners]);

  const removePartner = useCallback((idx: number) => {
    setPartners((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const movePartner = useCallback((idx: number, dir: -1 | 1) => {
    setPartners((prev) => {
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
        body: JSON.stringify({ blak: { priorityPartners: partners } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `Save failed (${res.status})`);
      }
      void personaFetch("/api/assistant/inferred-strategy", {
        personaIdHint: personaId,
        method: "POST",
      }).catch(() => undefined);
      onSaved?.(partners);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [partners, onOpenChange, onSaved, personaId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-violet-400" />
            Priority partners
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            The people, orgs, or accounts you want Marketa and the venture motion to lean into.
            Order matters — top of the list is highest priority.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex items-center text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading partners…
            </div>
          ) : (
            <>
              <ul className="space-y-1.5">
                {partners.length === 0 ? (
                  <li className="text-xs text-slate-500 italic">
                    No partners yet — add your first below.
                  </li>
                ) : (
                  partners.map((p, i) => (
                    <li
                      key={`${i}-${p}`}
                      className="flex items-start gap-2 rounded border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-sm text-slate-100 leading-snug">{p}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => movePartner(i, -1)}
                          disabled={i === 0}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePartner(i, 1)}
                          disabled={i === partners.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePartner(i)}
                          className="p-1 text-slate-400 hover:text-rose-300"
                          aria-label="Remove partner"
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
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPartner();
                    }
                  }}
                  placeholder="Add a partner (person, org, or account)…"
                  maxLength={MAX_LEN}
                  className="flex-1 px-3 py-2 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addPartner}
                  disabled={!draft.trim() || partners.length >= MAX_PARTNERS}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 text-sm disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                {partners.length}/{MAX_PARTNERS} partners. Specific named targets beat broad categories.
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
            Save partners
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PriorityPartnersEditor;
