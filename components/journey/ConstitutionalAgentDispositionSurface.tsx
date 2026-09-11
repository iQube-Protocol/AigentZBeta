'use client';

/**
 * ConstitutionalAgentDispositionSurface — the Constitutional Internet
 * Bridge's ACT stage.
 *
 * Mirrors AigentMeFocusDispositionPrompt's interaction pattern (read prior
 * decision, offer an explicit choice, report what was chosen, never infer or
 * default) but asks a genuinely different question: not "is this domain
 * focus part of your ExperienceQube" but "what role should an agent play in
 * shaping your experience, and how much authority would you give it." Two
 * sovereign choices, both required, written together via
 * /api/journey/constitutional-internet-bridge/act/disposition (which shares
 * its receipt taxonomy with the Horizen route through
 * services/journey/experienceQubeDispositionService.ts).
 *
 * Spine endpoint — MUST use personaFetch (CLAUDE.md Identity & Access
 * Spine), never raw fetch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

const ROLE_OPTIONS = [
  { value: 'guide', label: 'Guide', description: 'Helps me understand and navigate.' },
  { value: 'researcher', label: 'Researcher', description: 'Finds, checks and synthesizes for me.' },
  { value: 'operator', label: 'Operator', description: 'Runs recurring work on my behalf.' },
  { value: 'creative-collaborator', label: 'Creative collaborator', description: 'Co-creates with me.' },
  { value: 'financial-assistant', label: 'Financial assistant', description: 'Helps me manage money and value.' },
  { value: 'advocate-safeguard', label: 'Advocate / safeguard', description: 'Watches for and protects my interests.' },
  { value: 'other', label: 'Other', description: 'None of the above quite fits yet.' },
] as const;

const ACTION_MODE_OPTIONS = [
  { value: 'advise', label: 'Advise me', description: 'Tell me what it sees; I decide and do.' },
  { value: 'prepare', label: 'Prepare things for me', description: 'Draft or stage work for my review.' },
  { value: 'ask-before-acting', label: 'Act with my approval', description: 'Ask before taking action, every time.' },
  { value: 'act-autonomously-within-limits', label: 'Act autonomously within agreed limits', description: 'Act on its own inside limits I set.' },
] as const;

interface ConstitutionalAgentDispositionSurfaceProps {
  /** Fired once a disposition is successfully recorded — never for the read-only "already answered" state on load. */
  onResolved?: (disposition: { role: string; actionMode: string }) => void;
}

export function ConstitutionalAgentDispositionSurface({ onResolved }: ConstitutionalAgentDispositionSurfaceProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch('/api/journey/constitutional-internet-bridge/act/disposition', {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setRole(json.role ?? null);
        setActionMode(json.actionMode ?? null);
      }
    } catch {
      // Soft-fail — the prompt still renders and lets the principal choose.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (chosenRole: string, chosenActionMode: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await personaFetch('/api/journey/constitutional-internet-bridge/act/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: chosenRole, actionMode: chosenActionMode }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(
            typeof json?.error === 'string' ? json.error : `Your choice could not be recorded (${res.status}).`,
          );
        }
        setRole(json.role);
        setActionMode(json.actionMode);
        setPendingRole(null);
        onResolved?.({ role: json.role, actionMode: json.actionMode });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record your choice');
      } finally {
        setSubmitting(false);
      }
    },
    [onResolved],
  );

  const chosenRole = ROLE_OPTIONS.find((r) => r.value === role);
  const chosenMode = ACTION_MODE_OPTIONS.find((m) => m.value === actionMode);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for a prior decision…
      </div>
    );
  }

  if (chosenRole && chosenMode) {
    return (
      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">{chosenRole.label} — {chosenMode.label}</p>
            <p className="mt-0.5 text-emerald-200/80">{chosenRole.description} {chosenMode.description}</p>
            <button
              onClick={() => { setRole(null); setActionMode(null); }}
              className="mt-1.5 text-emerald-300/70 underline underline-offset-2 hover:text-emerald-200"
            >
              Change my answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: role. Step 2: action mode. Neither is inferred or defaulted.
  if (!pendingRole) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <p className="text-xs text-slate-300">What role would you like an agent to play in shaping your experience?</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              disabled={submitting}
              onClick={() => setPendingRole(r.value)}
              className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5 text-left text-xs text-slate-300 transition-colors hover:border-purple-700/60 hover:bg-purple-950/20 disabled:opacity-50"
            >
              <p className="font-medium text-slate-100">{r.label}</p>
              <p className="mt-0.5 text-slate-500">{r.description}</p>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">How much authority would you currently give an agent acting as your {ROLE_OPTIONS.find((r) => r.value === pendingRole)?.label}?</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTION_MODE_OPTIONS.map((m) => (
          <button
            key={m.value}
            disabled={submitting}
            onClick={() => void submit(pendingRole, m.value)}
            className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5 text-left text-xs text-slate-300 transition-colors hover:border-purple-700/60 hover:bg-purple-950/20 disabled:opacity-50"
          >
            <p className="font-medium text-slate-100">{m.label}</p>
            <p className="mt-0.5 text-slate-500">{m.description}</p>
          </button>
        ))}
      </div>
      <button
        onClick={() => setPendingRole(null)}
        className="mt-2 text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
      >
        Back
      </button>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default ConstitutionalAgentDispositionSurface;
