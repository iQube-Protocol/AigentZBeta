'use client';

/**
 * AigentMeFocusDispositionPrompt — PRD-GJR-001 §5.10 (aigentMe Onboarding
 * Oversight Principle) made real.
 *
 * aigentMe identifies the incoming agent's (MoneyPenny's) declared domain
 * focus and asks the principal explicitly whether it should shape their
 * ExperienceQube population. The principal — never the agent — decides. This
 * is the ONE sovereign act the aigentMe stage requires; the component itself
 * only ever offers the choice and reports what was chosen (Guided
 * Sovereignty Principle, §5.4) — it never infers or defaults a disposition.
 *
 * Spine endpoint (/api/journey/moneypenny-horizen/aigentme/disposition
 * resolves the caller's own active persona) — MUST use personaFetch, per
 * CLAUDE.md's Identity & Access Spine rule. Never raw fetch here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

const DISPOSITIONS = [
  { value: 'central', label: 'Central to my ExperienceQube', description: 'This focus should shape what I build.' },
  { value: 'secondary', label: 'Relevant, but secondary', description: 'Worth carrying forward, not the centerpiece.' },
  { value: 'temporary', label: 'Just for this journey', description: 'Useful now; do not carry it forward.' },
  { value: 'not-carried-forward', label: 'Not part of my experience', description: 'This focus does not belong in my ExperienceQube.' },
] as const;

interface AigentMeFocusDispositionPromptProps {
  domainFocus?: string;
  agentLabel?: string;
  /**
   * Which agent this recognition act concerns (resolveRegistrableAgent slug,
   * e.g. 'nakamoto'). Threaded straight through to the server — parameter
   * propagation only, never inferred or defaulted here. Omitted keeps the
   * server's own MoneyPenny default (al, 2026-08-04).
   */
  agentSlug?: string;
  /**
   * Fired once a disposition is successfully recorded (Guided Journey
   * Runtime §24.9 Ephemeral Interface, Durable Consequence) — lets a
   * hosting capsule close itself immediately ("the closing ceremony").
   * Never fired for the read-only "already answered" state on load.
   *
   * Carries WHICH disposition was recorded: the host closes the capsule
   * either way, but a companion responding to the decision needs to know
   * what was decided. Passing nothing would force the host to re-read the
   * value it was just told, and re-reading is where the two can disagree.
   */
  onResolved?: (disposition: string) => void;
}

export function AigentMeFocusDispositionPrompt({
  domainFocus = 'Financial Services',
  agentLabel = 'MoneyPenny',
  agentSlug,
  onResolved,
}: AigentMeFocusDispositionPromptProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [disposition, setDisposition] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = agentSlug ? `?agentSlug=${encodeURIComponent(agentSlug)}` : '';
      const res = await personaFetch(`/api/journey/moneypenny-horizen/aigentme/disposition${qs}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'aigentme/focus');
        setDisposition(json.disposition ?? null);
      }
    } catch {
      // Soft-fail — the prompt still renders and lets the principal choose.
    } finally {
      setLoading(false);
    }
  }, [agentSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const choose = useCallback(
    async (value: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await personaFetch('/api/journey/moneypenny-horizen/aigentme/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disposition: value,
            domainFocus: domainFocus.toLowerCase().replace(/\s+/g, '-'),
            agentSlug,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          // The SERVER's explanation, when it gave one. "Request failed (500)"
          // is true and useless: it names a transport code beside a sovereign
          // choice the principal just made, and offers nothing to act on. The
          // route now says which write failed and why (operator report,
          // 2026-08-02) — relaying that verbatim is the whole point of it
          // having been said.
          throw new Error(
            typeof json?.error === 'string' ? json.error : `Your choice could not be recorded (${res.status}).`,
          );
        }
        const recorded = typeof json?.disposition === 'string' ? json.disposition : value;
        setDisposition(recorded);
        // The SERVER's value, not the button's — if the two ever differ, the
        // durable record is what the companion must speak about.
        onResolved?.(recorded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record your choice');
      } finally {
        setSubmitting(false);
      }
    },
    [domainFocus, agentSlug, onResolved],
  );

  const chosen = DISPOSITIONS.find((d) => d.value === disposition);

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs text-slate-300">
        <span className="font-medium text-slate-100">{agentLabel}</span> appears to represent a focus in{' '}
        <span className="text-slate-100">{domainFocus}</span>. Is this an important part of the experience
        you want to build?
      </p>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for a prior decision…
        </div>
      ) : chosen ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">{chosen.label}</p>
            <p className="mt-0.5 text-emerald-200/80">{chosen.description}</p>
            <button
              onClick={() => setDisposition(null)}
              className="mt-1.5 text-emerald-300/70 underline underline-offset-2 hover:text-emerald-200"
            >
              Change my answer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DISPOSITIONS.map((d) => (
            <button
              key={d.value}
              disabled={submitting}
              onClick={() => void choose(d.value)}
              className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5 text-left text-xs text-slate-300 transition-colors hover:border-purple-700/60 hover:bg-purple-950/20 disabled:opacity-50"
            >
              <p className="font-medium text-slate-100">{d.label}</p>
              <p className="mt-0.5 text-slate-500">{d.description}</p>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export default AigentMeFocusDispositionPrompt;
