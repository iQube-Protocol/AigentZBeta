"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Award, CheckSquare, Square, Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

function formatRailValue(amount: number, asset: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const normalized = asset.replace(/\s/g, "").toUpperCase();
  if (normalized === "KNYT" || normalized === "$KNYT") return `${amount} $KNYT`;
  return `$${(amount / 100).toFixed(2)}`;
}

interface Props {
  experienceId: string;
  rewardLabel?: string;
  costLabel?: string;
  cartridgeSlug?: string;
}

export function RuntimeConsumerTaskRunner({
  experienceId,
  rewardLabel = "",
  costLabel = "",
  cartridgeSlug = "",
}: Props) {
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [rewardLabelResolved, setRewardLabelResolved] = useState(rewardLabel);
  const [costLabelResolved, setCostLabelResolved] = useState(costLabel);

  useEffect(() => {
    if (!experienceId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}/packet`, { cache: "no-store" });
        if (!res.ok || cancelled) { setLoading(false); return; }
        const data = await res.json();
        const composition = data?.packet?.composition;
        const actions: string[] = Array.isArray(composition?.nextActions)
          ? composition.nextActions.filter((x: unknown): x is string => typeof x === "string")
          : [];
        if (!cancelled) setNextActions(actions);

        if (!rewardLabel || !costLabel) {
          const expRes = await fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}`, { cache: "no-store" });
          if (expRes.ok && !cancelled) {
            const expData = await expRes.json();
            const wr = expData?.experience_qube?.configuration?.wallet_rewards;
            if (wr && typeof wr === "object") {
              const ra = Number(wr.reward_amount || 0);
              const rAsset = typeof wr.reward_asset === "string" ? wr.reward_asset : "Q¢";
              const ca = Number(wr.unlock_price || 0);
              const cAsset = typeof wr.unlock_asset === "string" ? wr.unlock_asset : "Q¢";
              if (!rewardLabel) setRewardLabelResolved(formatRailValue(ra, rAsset));
              if (!costLabel) setCostLabelResolved(formatRailValue(ca, cAsset));
            }
          }
        }
      } catch { /* non-fatal */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId, rewardLabel, costLabel]);

  useEffect(() => {
    if (typeof window === "undefined" || !experienceId) return;
    try {
      const raw = window.localStorage.getItem(`exp_tasks_${experienceId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCompletedTasks(new Set(parsed.filter((x): x is string => typeof x === "string")));
        }
      }
    } catch { /* ignore */ }
  }, [experienceId]);

  const fireCompletion = useCallback((tasks: Set<string>) => {
    if (hasSubmitted) return;
    if (nextActions.length === 0 || tasks.size < nextActions.length) return;
    setHasSubmitted(true);
    void personaFetch("/api/experience/complete-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experienceId,
        completedTasks: [...tasks],
        totalTasks: nextActions.length,
        cartridgeSlug,
      }),
    }).then(async (res) => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(`exp_tasks_${experienceId}`);
      }
      if (res.ok || res.status === 409) {
        try {
          const body = await res.json();
          const grantedAmount = body?.reward_amount;
          const grantedAsset = body?.reward_asset;
          if (grantedAmount && grantedAsset) {
            setCompletionNotice(`Completed — earned ${formatRailValue(Number(grantedAmount), String(grantedAsset))}`);
          } else {
            setCompletionNotice("Completed");
          }
        } catch {
          setCompletionNotice("Completed");
        }
      }
    }).catch(() => { setHasSubmitted(false); });
  }, [hasSubmitted, nextActions, experienceId, cartridgeSlug]);

  const toggleTask = useCallback((task: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(task)) next.delete(task); else next.add(task);
      if (typeof window !== "undefined") {
        try { window.localStorage.setItem(`exp_tasks_${experienceId}`, JSON.stringify([...next])); } catch { /* */ }
      }
      if (next.size === nextActions.length && nextActions.length > 0) {
        setTimeout(() => fireCompletion(next), 0);
      }
      return next;
    });
  }, [experienceId, nextActions, fireCompletion]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tasks…
      </div>
    );
  }

  // Never render blank: even when an experience has no consumer tasks yet, the
  // reward/cost furniture and an explicit "no tasks" affordance must remain
  // visible so the consumer can see the experience's economics and knows the
  // task surface exists. This mirrors the canonical CompositionBundleBrief
  // consumer surface (components/composer/ExperienceLiquidRenderer.tsx) — the
  // earlier `return null` on empty tasks was the regression that made the whole
  // task/reward block disappear inline.
  const hasRewardFurniture = Boolean(rewardLabelResolved || costLabelResolved);
  if (nextActions.length === 0 && !hasRewardFurniture && !completionNotice) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-500">
        No tasks for this experience yet.
      </div>
    );
  }

  const completedCount = nextActions.filter((t) => completedTasks.has(t)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Your tasks</div>
        {nextActions.length > 0 ? (
          <div className="text-[11px] text-slate-500">
            {completedCount}/{nextActions.length} complete
          </div>
        ) : null}
      </div>

      {(rewardLabelResolved || costLabelResolved) ? (
        <div className="flex flex-wrap gap-2">
          {rewardLabelResolved ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
              <Award className="h-3.5 w-3.5" /> Earn {rewardLabelResolved}
            </span>
          ) : null}
          {costLabelResolved ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
              Unlock {costLabelResolved}
            </span>
          ) : null}
        </div>
      ) : null}

      {completionNotice ? (
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
          <Award className="h-3.5 w-3.5" /> {completionNotice}
        </div>
      ) : null}

      {nextActions.length > 0 ? (
        <div className="space-y-2">
          {nextActions.map((item) => {
            const done = completedTasks.has(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleTask(item)}
                className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500"
                }`}
              >
                {done ? (
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                )}
                <span className={done ? "line-through opacity-80" : ""}>{item}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-slate-500">No tasks for this experience yet.</div>
      )}
    </div>
  );
}
