"use client";

/**
 * AccessionProgressBar — the IRL onboarding stepper (operator direction,
 * 2026-07-19), the peer of the aigentZ / aigentMe stage strips. Shows the
 * participant where they are and pulls them along:
 *
 *   Welcome → Passport → Delegate → Access → Experiments
 *
 * Self-scoping: renders only in the IRL cartridges (irl-os / irl-cartridge)
 * and only on the onboarding tabs (the five step slugs). It OBSERVES the
 * caller's real state — passport issued? delegation active? research-lab
 * access granted? — from existing endpoints, marks steps done/current/
 * upcoming, and each node navigates to its tab. Mounted once at the shell
 * (CodexPanelDynamic) so it's visible across every step tab without editing
 * each tab component.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { authedFetchHeaders } from "@/utils/supabaseBrowser";

interface Props {
  codexId: string;
  activeSlug: string;
  personaId?: string;
}

type StepKey = "welcome" | "passport" | "delegation" | "access" | "experiments";

function goToTab(slug: string) {
  try {
    window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: slug } }));
  } catch {
    /* non-fatal */
  }
}

export function AccessionProgressBar({ codexId, activeSlug, personaId }: Props) {
  const prefix = codexId.includes("irl-os") ? "irl-os" : codexId === "irl-cartridge" ? "irl" : null;

  const steps = useMemo(() => {
    if (!prefix) return [] as { key: StepKey; label: string; slug: string; optional?: boolean }[];
    // Access (claim the invitation → research-lab grant) comes right after
    // Passport, so an invited citizen can reach + run their assigned experiment
    // WITHOUT delegating an agent. Delegation is OPTIONAL — a convenience for
    // having an agent run the experiment on your behalf, never a gate (operator
    // direction 2026-07-19).
    return [
      { key: "welcome" as const, label: "Welcome", slug: `${prefix}-welcome` },
      { key: "passport" as const, label: "Passport", slug: `${prefix}-passport-apply` },
      { key: "access" as const, label: "Access", slug: `${prefix}-passport-locker` },
      { key: "delegation" as const, label: "Delegate (optional)", slug: `${prefix}-passport-delegation`, optional: true },
      { key: "experiments" as const, label: "Experiments", slug: `${prefix}-experiment-lab` },
    ];
  }, [prefix]);

  const [done, setDone] = useState<Record<StepKey, boolean>>({
    welcome: false, passport: false, delegation: false, access: false, experiments: false,
  });
  const [loading, setLoading] = useState(true);

  const onStepTab = steps.some((s) => s.slug === activeSlug);

  useEffect(() => {
    if (!prefix || !onStepTab) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await authedFetchHeaders({ Accept: "application/json" });
        const init: RequestInit = { cache: "no-store", headers: headers ?? undefined };
        const [accessRes, walletRes, delegationRes] = await Promise.allSettled([
          fetch("/api/participation/my-access", init),
          fetch("/api/polity-passport/wallet", init),
          personaId
            ? fetch(`/api/codex/chat/agentiq-os/delegation?persona_id=${encodeURIComponent(personaId)}`, init)
            : Promise.reject(),
        ]);

        let authed = false;
        let accessDone = false;
        if (accessRes.status === "fulfilled" && accessRes.value.ok) {
          const d = await accessRes.value.json();
          authed = Boolean(d?.authenticated);
          accessDone = Array.isArray(d?.grants) && d.grants.some((g: { accessDomain?: string }) => g.accessDomain === "research-lab");
        }
        let passportDone = false;
        if (walletRes.status === "fulfilled" && walletRes.value.ok) {
          const d = await walletRes.value.json();
          // /api/polity-passport/wallet returns issued passports under
          // `passportQubes`. Having an issued passport record clears the
          // "Passport" (apply) step — claiming the credential happens later at
          // the Access/Locker step.
          const passports = (d?.passportQubes ?? d?.passports ?? d?.items ?? []) as Array<{ passportId?: string; claimedAt?: string | null }>;
          passportDone = passports.some((p) => p.passportId);
        }
        let delegationDone = false;
        if (delegationRes.status === "fulfilled" && delegationRes.value.ok) {
          const d = await delegationRes.value.json();
          delegationDone = Boolean(d?.active);
        }

        if (!cancelled) {
          setDone({
            welcome: authed || passportDone || accessDone,
            passport: passportDone,
            delegation: delegationDone,
            access: accessDone,
            // "Experiments" completes only once results start flowing; keep it
            // as the destination (available when access is granted).
            experiments: false,
          });
        }
      } catch {
        /* leave defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prefix, onStepTab, personaId]);

  if (!prefix || !onStepTab) return null;

  const activeIdx = steps.findIndex((s) => s.slug === activeSlug);
  // Auto-advance: the first still-incomplete REQUIRED step is where the
  // participant is pulled next. Optional steps (Delegate) are never a gate, so
  // the pull goes Passport → Access → Experiments; delegation can be done any
  // time but is never required to reach or run experiments.
  const nextStep = steps.find((s) => !s.optional && !done[s.key]);
  const showContinue = !loading && nextStep && nextStep.slug !== activeSlug;

  return (
    <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-2.5">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex flex-1 items-center">
        {steps.map((step, i) => {
          const isDone = done[step.key];
          const isCurrent = i === activeIdx;
          // Reachable once every PRIOR REQUIRED step is done — optional steps
          // (Delegate) never block a later step. So Experiments unlocks on
          // Access alone, without delegating.
          const priorRequiredDone = steps.slice(0, i).filter((s) => !s.optional).every((s) => done[s.key]);
          const reachable = isDone || i <= activeIdx || priorRequiredDone;
          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <div className={`h-px flex-1 ${done[steps[i - 1].key] ? "bg-emerald-500/50" : "bg-slate-700"}`} />
              )}
              <button
                onClick={() => goToTab(step.slug)}
                className="flex items-center gap-1.5 shrink-0"
                title={`Go to ${step.label}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                    isDone
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : isCurrent
                        ? "border-violet-400 bg-violet-500/20 text-violet-200"
                        : reachable
                          ? "border-slate-600 text-slate-400"
                          : "border-slate-700 text-slate-600"
                  }`}
                >
                  {loading && isCurrent ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isDone ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-[11px] ${
                    isCurrent ? "font-semibold text-violet-200" : isDone ? "text-emerald-300/80" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
        </div>
        {showContinue && nextStep && (
          <button
            onClick={() => goToTab(nextStep.slug)}
            className="flex shrink-0 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/25"
            title={`Continue to ${nextStep.label}`}
          >
            {done[steps[activeIdx]?.key] ? "Continue" : "Next"} <span className="hidden sm:inline">→ {nextStep.label}</span>
            <ArrowRight className="h-3 w-3 sm:hidden" />
          </button>
        )}
      </div>
    </div>
  );
}

export default AccessionProgressBar;
