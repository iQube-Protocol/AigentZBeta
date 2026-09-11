/**
 * MoneyPennyRoleSelector — an inline Advisor / Architect / Runtime segmented
 * control in the left copilot pane's header (MoneyPenny experience-coherence
 * correction, 2026-09-03, §6; relocated same day, navigation-hierarchy
 * correction, into `SmartTriadCopilotLayer`'s own header, replacing the
 * redundant "Financial Services Runtime" descriptor that used to render
 * there via `agentSubtitle`; collapsed to a one-row inline control, same
 * day, operator directive: "remove Role and just have Advisor, Architect,
 * Runtime so it's just one row tall" — supersedes the earlier "Role:
 * Advisor ▾" dropdown-with-descriptions design below, which took up to four
 * rows once opened).
 *
 * Three small buttons, always visible, no open/close state — deliberately
 * NOT the `AigentMeRoleSelector.tsx` dropdown idiom (button + ChevronDown
 * trigger, absolute floating list, Check mark on the selected row): that
 * shell exists for choices with real per-option descriptions worth reading
 * before picking; MoneyPenny's three modes are common enough, and their
 * labels self-explanatory enough, that a always-visible one-row toggle
 * (each option a click) is faster than an extra open step, and the
 * dropdown's floating panel is no longer needed at all.
 *
 * DISTINCT from AigentMeRoleSelector on purpose (operator directive:
 * "distinguish role selection from agent identity selection"):
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
 * wiring of both, and SmartTriadCopilotLayer.tsx's `moneyPennyRole`/
 * `onMoneyPennyRoleChange` props that carry it into this header.
 */

'use client';

import type { MoneyPennyProviderMode } from '@/types/financialServices';

const ROLE_OPTIONS: Array<{ id: MoneyPennyProviderMode; label: string; description: string }> = [
  { id: 'ADVISOR', label: 'Advisor', description: 'Explain, understand and compare.' },
  { id: 'ARCHITECT', label: 'Architect', description: 'Plan, model and configure.' },
  { id: 'RUNTIME', label: 'Runtime', description: 'Perform and monitor approved tasks within existing limits.' },
];

export interface MoneyPennyRoleSelectorProps {
  role: MoneyPennyProviderMode;
  onChange: (role: MoneyPennyProviderMode) => void;
}

export function MoneyPennyRoleSelector({ role, onChange }: MoneyPennyRoleSelectorProps) {
  return (
    <div
      className="flex items-center gap-0.5"
      title="Choose how MoneyPenny may act right now — Advisor, Architect or Runtime. Selection only: no identity change, no delegation, no live execution."
    >
      {ROLE_OPTIONS.map((option) => {
        const isActive = role === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            title={option.description}
            className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
              isActive
                ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/90'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default MoneyPennyRoleSelector;
