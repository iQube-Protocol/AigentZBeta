/**
 * "aigentMe · <label>" role selector — Homecoming Phase II WP-A Increment 2
 * (codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md,
 * WP-A Amendment three-axis model).
 *
 * Mounted in the aigentMe Copilot header (SmartTriadCopilotLayer), visible
 * only when `agentId === 'aigent-me'` — this is the aigentMe-role control,
 * not a general agent picker.
 *
 * Selection here is ROUTING ONLY:
 *   - reads the eligible roster from the EXISTING registry-driven
 *     `boundAgents` list (GET /api/identity/constitutional-context) — no
 *     new agent list, no hardcoded roster;
 *   - writes the persona's aigentMe ASSIGNMENT via the EXISTING
 *     POST /api/identity/persona-assignments write path (the same one
 *     BoundedDelegationTab already uses) — no new write path, no schema
 *     change;
 *   - never reads or writes `delegation_grants`. Selecting an agent here
 *     grants it nothing — that is a separate, explicit act through the
 *     existing Delegation surface. See services/identity/personaAssignmentStore.ts's
 *     own header comment: "Assigning does NOT grant authority."
 *
 * After a successful write this component only refreshes its own displayed
 * label — it does NOT need to thread the new identity into the chat
 * request. The chat route resolves `currentAigentMe` itself, server-side,
 * on every turn (services/agents/aigentMeRoleResolution.ts), so the very
 * next message already speaks in the newly selected agent's voice.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface EligibleAgent {
  agentId: string;
  displayName: string;
}

interface AigentMeRoleSelectorProps {
  /** The active persona's spine id — same value already threaded to the
   *  chat route's `personaId` field. Falls back to the spine's own
   *  `currentPersonaId` localStorage record (the same fallback `personaFetch`
   *  itself uses) when not supplied, so the control degrades gracefully
   *  rather than silently doing nothing. */
  personaId?: string;
}

export function AigentMeRoleSelector({ personaId }: AigentMeRoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eligible, setEligible] = useState<EligibleAgent[]>([]);
  const [currentAigentMe, setCurrentAigentMe] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState('Default');

  const resolvePersonaId = useCallback((): string | null => {
    if (personaId) return personaId;
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('currentPersonaId');
  }, [personaId]);

  const refresh = useCallback(async () => {
    try {
      const res = await personaFetch('/api/identity/constitutional-context', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok) return;
      const bound: EligibleAgent[] = Array.isArray(data.context?.boundAgents)
        ? data.context.boundAgents.map((a: { agentId: string; displayName: string }) => ({
            agentId: a.agentId,
            displayName: a.displayName,
          }))
        : [];
      setEligible(bound);
      const current: string | null = data.context?.currentAigentMe ?? null;
      setCurrentAigentMe(current);
      const match = bound.find((a) => a.agentId === current);
      setCurrentLabel(match ? match.displayName : 'Default');
    } catch {
      // Best-effort — the header keeps the last-known label on failure.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(
    async (agentId: string | null) => {
      const pid = resolvePersonaId();
      if (!pid) {
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        if (agentId) {
          await personaFetch('/api/identity/persona-assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personaId: pid, agentRootId: agentId, role: 'aigentMe' }),
          });
        } else if (currentAigentMe) {
          // "Default aigentMe" — demote the current assignment back to a
          // plain delegate. Never touches the sponsorship/binding (that is
          // permanent); only the temporary role assignment.
          await personaFetch('/api/identity/persona-assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personaId: pid, agentRootId: currentAigentMe, role: 'delegate' }),
          });
        }
        await refresh();
      } catch {
        // Best-effort — the header keeps its previous label on failure.
      } finally {
        setLoading(false);
        setOpen(false);
      }
    },
    [resolvePersonaId, currentAigentMe, refresh],
  );

  // Nothing to switch to — no sponsored agents yet — so no control renders.
  // This is the "Default aigentMe has no backing agent identity" case: the
  // selector only appears once there is a real, eligible alternative.
  if (eligible.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors leading-none"
        title="Choose which agent fulfils the aigentMe role for you — selection only, grants no authority"
      >
        <span className="truncate max-w-[110px]">{currentLabel}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-slate-800 bg-slate-900/95 backdrop-blur-sm shadow-lg py-1">
          <button
            type="button"
            onClick={() => select(null)}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-white/80 hover:bg-slate-800/60 text-left"
          >
            Default aigentMe
            {!currentAigentMe && <Check className="w-3 h-3 text-emerald-400" />}
          </button>
          {eligible.map((a) => (
            <button
              key={a.agentId}
              type="button"
              onClick={() => select(a.agentId)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-white/80 hover:bg-slate-800/60 text-left"
            >
              <span className="truncate">{a.displayName}</span>
              {currentAigentMe === a.agentId && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
