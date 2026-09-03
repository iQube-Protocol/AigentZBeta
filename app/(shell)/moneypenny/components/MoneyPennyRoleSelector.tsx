/**
 * MoneyPennyRoleSelector — "MoneyPenny · Role: Advisor ▾" (MoneyPenny
 * experience-coherence correction, 2026-09-03, §6).
 *
 * Reuses the SAME compact dropdown shell `AigentMeRoleSelector.tsx`
 * established (components/smarttriad/copilot/AigentMeRoleSelector.tsx) —
 * button + ChevronDown trigger, absolute `border-slate-800 bg-slate-900/95
 * backdrop-blur-sm shadow-lg` list, a Check mark on the selected row — the
 * platform's one established dropdown idiom, not a new one.
 *
 * DISTINCT from that selector on purpose (operator directive: "distinguish
 * role selection from agent identity selection"):
 *   - AigentMeRoleSelector picks WHICH AGENT fulfils the aigentMe role —
 *     an identity assignment, written server-side via
 *     POST /api/identity/persona-assignments.
 *   - MoneyPennyRoleSelector picks HOW MoneyPenny may act on the SAME,
 *     unchanged agent identity — Advisor (explain), Architect (propose),
 *     Runtime (act under existing authority) — the exact
 *     `MoneyPennyProviderMode` vocabulary every other MoneyPenny surface
 *     already uses (moneypennyCapabilities.ts's per-item mode badges, the
 *     Architect/Runtime API routes). Purely local, client-side state — no
 *     server write, no identity/delegation call of any kind.
 *
 * Selecting a role deliberately does NOT, and structurally CANNOT:
 *   - change the operator's Agent Me identity (no persona-assignment call
 *     exists in this file at all);
 *   - grant delegation or additional permissions (no delegation/authority
 *     endpoint is called);
 *   - switch simulation to live (the `environment` axis is separate state
 *     in MoneyPennyCopilotWorkspace.tsx, untouched here);
 *   - execute an action (this component only calls `onChange`, which only
 *     ever calls `setRole` in the parent);
 *   - clear the current task or conversation (`activePanel`/copilot
 *     conversation state are untouched — see MoneyPennyCopilotWorkspace.tsx).
 *
 * Wired into real context, not cosmetic: the selected role flows into the
 * copilot's `groundContext.providerMode` (so the conversation is scoped to
 * it) and into SC-04's context-versioning `role` field (a role change is a
 * context-relevant event — a late response captured under the old role is
 * correctly treated as stale). See MoneyPennyCopilotWorkspace.tsx's own
 * wiring of both.
 */

'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { MoneyPennyProviderMode } from '@/types/financialServices';

const ROLE_OPTIONS: Array<{ id: MoneyPennyProviderMode; label: string; description: string }> = [
  { id: 'ADVISOR', label: 'Advisor', description: 'Explain, understand and compare.' },
  { id: 'ARCHITECT', label: 'Architect', description: 'Plan, model and configure.' },
  { id: 'RUNTIME', label: 'Runtime', description: 'Perform and monitor approved tasks within existing limits.' },
];

const ROLE_LABEL: Record<MoneyPennyProviderMode, string> = {
  ADVISOR: 'Advisor',
  ARCHITECT: 'Architect',
  RUNTIME: 'Runtime',
};

export interface MoneyPennyRoleSelectorProps {
  role: MoneyPennyProviderMode;
  onChange: (role: MoneyPennyProviderMode) => void;
}

export function MoneyPennyRoleSelector({ role, onChange }: MoneyPennyRoleSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100"
        title="Choose how MoneyPenny may act right now — Advisor, Architect or Runtime. Selection only: no identity change, no delegation, no live execution."
      >
        <span className="font-semibold text-slate-100">MoneyPenny</span>
        <span className="text-slate-500">·</span>
        <span>Role: {ROLE_LABEL[role]}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          {/* Click-outside dismiss, same convention as other compact dropdowns in this codebase. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-slate-800 bg-slate-900/95 py-1 shadow-lg backdrop-blur-sm">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className="flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-xs text-white/80 hover:bg-slate-800/60"
              >
                <span>
                  <span className="block font-medium text-slate-100">{option.label}</span>
                  <span className="block text-[10px] text-slate-500">{option.description}</span>
                </span>
                {role === option.id && <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MoneyPennyRoleSelector;
