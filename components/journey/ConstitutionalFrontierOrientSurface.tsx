'use client';

/**
 * ConstitutionalFrontierOrientSurface — the Constitutional Internet Bridge's
 * ORIENT stage.
 *
 * Deterministic, no LLM required. Three single-choice prompts produce a
 * compact "Your Constitutional Frontier" summary entirely from a static
 * template — never inferred, never generated. This is explicitly NOT
 * constitutional state: it never gates Passport, and completing it is not
 * tracked as JourneyDefinition evidence (see
 * services/journey/constitutionalInternetBridgeJourney.ts's header). The
 * three choices are persisted, best-effort, as an intent/demand signal via
 * /api/journey/constitutional-internet-bridge/orient — never presented as
 * Standing or authority.
 */

import React, { useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';

const HELP_OPTIONS = [
  { value: 'work', label: 'Work / business' },
  { value: 'money', label: 'Money' },
  { value: 'creativity', label: 'Creativity' },
  { value: 'research', label: 'Research / learning' },
  { value: 'admin', label: 'Personal administration' },
  { value: 'community', label: 'Community / public life' },
] as const;

const PRESERVE_OPTIONS = [
  { value: 'decisions', label: 'Decisions' },
  { value: 'identity', label: 'Identity' },
  { value: 'data', label: 'Data' },
  { value: 'money', label: 'Money' },
  { value: 'voice', label: 'Voice / representation' },
  { value: 'time', label: 'Time' },
] as const;

const AUTHORITY_OPTIONS = [
  { value: 'advise', label: 'Advise me' },
  { value: 'prepare', label: 'Prepare things for me' },
  { value: 'ask-before-acting', label: 'Act with my approval' },
  { value: 'act-autonomously-within-limits', label: 'Act autonomously within agreed limits' },
] as const;

function labelFor(options: readonly { value: string; label: string }[], value: string | null): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

function buildSummary(help: string, preserve: string, authority: string): string {
  const helpLabel = labelFor(HELP_OPTIONS, help).toLowerCase();
  const preserveLabel = labelFor(PRESERVE_OPTIONS, preserve).toLowerCase();
  const authorityLabel = labelFor(AUTHORITY_OPTIONS, authority).toLowerCase();
  return (
    `You want agents to help most with ${helpLabel}.\n` +
    `You most want to preserve your ${preserveLabel}.\n` +
    `Your preferred relationship is: ${authorityLabel}.\n\n` +
    `The Constitutional Internet is designed around precisely this relationship: preserving you as the ` +
    `constitutional subject while allowing machines to act within authority you can inspect.`
  );
}

export function ConstitutionalFrontierOrientSurface() {
  const [help, setHelp] = useState<string | null>(null);
  const [preserve, setPreserve] = useState<string | null>(null);
  const [authority, setAuthority] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allChosen = Boolean(help && preserve && authority);

  const reveal = () => {
    if (!allChosen) return;
    setSubmitted(true);
    void personaFetch('/api/journey/constitutional-internet-bridge/orient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ help, preserve, authority }),
    }).catch(() => { /* best-effort — the summary already renders regardless */ });
  };

  if (submitted && help && preserve && authority) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Your Constitutional Frontier</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{buildSummary(help, preserve, authority)}</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-3 text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
        >
          Change my answers
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-5">
      <div>
        <p className="text-xs font-medium text-slate-200 mb-2">Where do you most want agents to help?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {HELP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setHelp(o.value)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${help === o.value ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-200 mb-2">What do you most want to remain yours?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESERVE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPreserve(o.value)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${preserve === o.value ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-200 mb-2">How much authority would you currently give an agent?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AUTHORITY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setAuthority(o.value)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${authority === o.value ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!allChosen}
        onClick={reveal}
        className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        See your Constitutional Frontier
      </button>
    </div>
  );
}

export default ConstitutionalFrontierOrientSurface;
