"use client";

import { CheckCircle2, Circle, Dot } from "lucide-react";
import { cn } from "@/utils/cn";

export type JourneyStep = 1 | 2 | 3 | 4;

interface Props {
  currentStep: JourneyStep;
  dark?: boolean;
}

const STEPS = [
  { n: 1 as JourneyStep, label: "Join a Campaign" },
  { n: 2 as JourneyStep, label: "Propose a Content Pack" },
  { n: 3 as JourneyStep, label: "Submit for Approval" },
  { n: 4 as JourneyStep, label: "Publish" },
];

export function PartnerJourneySteps({ currentStep, dark = true }: Props) {
  return (
    <div className={cn(
      "rounded-xl border p-3 sm:p-4",
      dark ? "border-white/[0.06] bg-white/[0.02]" : "border-black/[0.06] bg-black/[0.02]",
    )}>
      <p className={cn("text-[10px] uppercase tracking-widest font-semibold mb-3", dark ? "text-white/30" : "text-black/30")}>
        Partner Journey
      </p>

      {/* Mobile: vertical */}
      <ol className="sm:hidden space-y-2">
        {STEPS.map((step, i) => {
          const done    = step.n < currentStep;
          const active  = step.n === currentStep;
          const future  = step.n > currentStep;
          return (
            <li key={step.n} className="flex items-center gap-3">
              {/* Icon */}
              <div className={cn(
                "w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all",
                done   ? (dark ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-emerald-500 bg-emerald-50 text-emerald-600") :
                active ? (dark ? "border-pink-400/60 bg-pink-400/20 text-pink-300" : "border-pink-400 bg-pink-50 text-pink-500") :
                         (dark ? "border-white/10 bg-transparent text-white/20" : "border-black/10 bg-transparent text-black/20"),
              )}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.n}
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className={cn("absolute left-[1.1rem] mt-6 w-0.5 h-3 rounded", done ? (dark ? "bg-emerald-500/30" : "bg-emerald-200") : (dark ? "bg-white/[0.06]" : "bg-black/[0.06]"))} />
              )}
              {/* Label */}
              <span className={cn(
                "text-xs font-medium",
                done   ? (dark ? "text-emerald-400/80" : "text-emerald-600") :
                active ? (dark ? "text-white/90"        : "text-black/80")   :
                         (dark ? "text-white/25"        : "text-black/25"),
              )}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Desktop: horizontal */}
      <ol className="hidden sm:flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done   = step.n < currentStep;
          const active = step.n === currentStep;
          return (
            <li key={step.n} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div className={cn(
                  "w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-bold transition-all",
                  done   ? (dark ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-emerald-500 bg-emerald-50 text-emerald-600") :
                  active ? (dark ? "border-pink-400/60 bg-pink-400/20 text-pink-300 ring-2 ring-pink-400/20" : "border-pink-400 bg-pink-50 text-pink-500 ring-2 ring-pink-200") :
                           (dark ? "border-white/[0.08] bg-transparent text-white/20" : "border-black/[0.08] bg-transparent text-black/20"),
                )}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
                </div>
                <span className={cn(
                  "text-[10px] font-medium text-center leading-tight max-w-[72px]",
                  done   ? (dark ? "text-emerald-400/70" : "text-emerald-600") :
                  active ? (dark ? "text-white/80"        : "text-black/70")   :
                           (dark ? "text-white/20"        : "text-black/20"),
                )}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-px mx-2 mb-5 rounded",
                  done ? (dark ? "bg-emerald-500/30" : "bg-emerald-200") : (dark ? "bg-white/[0.06]" : "bg-black/[0.06]"),
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
