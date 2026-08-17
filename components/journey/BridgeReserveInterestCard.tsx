'use client';

/**
 * BridgeReserveInterestCard — the reserve/notify-me demand-signal form,
 * extracted (KNYTS Choose Reserve-form patch, three-item closure) from
 * ConstitutionalInternetBridgeChooseSurface's own `BookReserveOption` so CI
 * and KNYTS render byte-identical UX for this pattern instead of drifting
 * visually. Presentational only: caller supplies the copy and the POST
 * endpoint (`{ email }` in, `{ ok: boolean }` out) — this component owns
 * nothing about what campaign or persistence sits behind that endpoint.
 *
 * Never a payment or preorder: this is an interest/demand signal only, and
 * every caller's copy must say so explicitly (see CI's and KNYTS's own
 * strings at their call sites).
 *
 * Theming (KNYTS CHOOSE bug-fix pass, 2026-08-16) — this card originally
 * hardcoded CI's indigo/lilac accent, which then rendered inside KNYTS's
 * amber-themed CHOOSE surface as a jarring, off-brand color. Rather than
 * fork the component, the smallest fix is one `accent` prop with two
 * values, defaulting to CI's existing look so CI is byte-identical to
 * before this change; KNYTS passes `accent="amber"` at its own call site.
 * No new palette — both values reuse color tokens already used elsewhere
 * on each surface (indigo-300/400/500 on CI, amber-300/400/500 on KNYTS).
 */

import React, { useState } from 'react';
import { BookMarked } from 'lucide-react';

interface BridgeReserveInterestCardProps {
  title: string;
  description: string;
  /** POST endpoint accepting `{ email }`; must resolve `{ ok: boolean }`. */
  submitUrl: string;
  successTitle: string;
  successDescription: string;
  /** Visual accent — 'indigo' (default, CI's existing look) or 'amber' (KNYTS). */
  accent?: 'indigo' | 'amber';
}

const ACCENT_CLASSES = {
  indigo: {
    icon: 'text-indigo-300',
    inputFocus: 'focus:border-indigo-400/50',
    button: 'bg-indigo-500 hover:bg-indigo-400',
  },
  amber: {
    icon: 'text-amber-300',
    inputFocus: 'focus:border-amber-400/50',
    button: 'bg-amber-500 hover:bg-amber-400',
  },
} as const;

export function BridgeReserveInterestCard({
  title,
  description,
  submitUrl,
  successTitle,
  successDescription,
  accent = 'indigo',
}: BridgeReserveInterestCardProps) {
  const accentClasses = ACCENT_CLASSES[accent];
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const submit = async () => {
    if (!email.includes('@')) return;
    setStatus('submitting');
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => null);
      setStatus(json?.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookMarked className={`h-4 w-4 ${accentClasses.icon}`} /> {successTitle}
        </p>
        <p className="mt-1 text-xs text-slate-400">{successDescription}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <BookMarked className={`h-4 w-4 ${accentClasses.icon}`} /> {title}
      </p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none ${accentClasses.inputFocus}`}
        />
        <button
          type="button"
          disabled={status === 'submitting' || !email.includes('@')}
          onClick={submit}
          className={`rounded-lg px-4 py-2 text-xs font-semibold text-slate-950 transition disabled:opacity-40 ${accentClasses.button}`}
        >
          Reserve
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-xs text-rose-400">Could not record your interest — please try again.</p>}
    </div>
  );
}

export default BridgeReserveInterestCard;
