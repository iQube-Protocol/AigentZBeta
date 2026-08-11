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
 *
 * Layout (revised 2026-08-11, final interaction pass): this no longer
 * mounts on the shared BridgeContentCapsule shell — that shell's own
 * internal viewport+rail two-column split was designed for a single card
 * occupying a full-width slot, and would nest a second 3fr/1fr grid inside
 * ORIENT's now-narrow (~40%-width) right column, cramping the question
 * content the operator explicitly asked to keep legible. Instead this
 * renders one bordered capsule (Help/Preserve/Authority as a compact
 * horizontal tab row — never a fourth "Connect Claude" tab, per operator
 * instruction) with one question active at a time, and a persistent footer
 * strip carrying progress + the "See your Constitutional Frontier" action.
 * All state/logic below (options, buildSummary, the best-effort POST) is
 * UNCHANGED from the pre-capsule version — only the render shape changed.
 */

import React, { useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';
import { CI_BRIDGE_ORIENT_COMPANION_COPY } from '@/services/journey/constitutionalInternetBridgeJourney';

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

type QuestionId = 'help' | 'preserve' | 'authority';

const ORIENT_QUESTIONS: { id: QuestionId; label: string }[] = [
  { id: 'help', label: 'Help' },
  { id: 'preserve', label: 'Preserve' },
  { id: 'authority', label: 'Authority' },
];

function OptionGrid({
  title,
  options,
  value,
  onChange,
  columns,
}: {
  title: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  columns: string;
}) {
  return (
    <div className="p-4">
      <p className="text-xs font-medium text-slate-200 mb-3">{title}</p>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${value === o.value ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConstitutionalFrontierOrientSurface() {
  const [help, setHelp] = useState<string | null>(null);
  const [preserve, setPreserve] = useState<string | null>(null);
  const [authority, setAuthority] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<QuestionId>('help');

  const allChosen = Boolean(help && preserve && authority);
  const answeredCount = [help, preserve, authority].filter(Boolean).length;

  const reveal = () => {
    if (!allChosen) return;
    setSubmitted(true);
    void personaFetch('/api/journey/constitutional-internet-bridge/orient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ help, preserve, authority }),
    }).catch(() => { /* best-effort — the summary already renders regardless */ });
  };

  const changeAnswers = () => {
    setSubmitted(false);
    setActiveQuestion('help');
  };

  const answeredFor = (id: QuestionId) =>
    id === 'help' ? Boolean(help) : id === 'preserve' ? Boolean(preserve) : Boolean(authority);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/40 p-4">
      <div className="flex items-center gap-1.5">
        {ORIENT_QUESTIONS.map((q, i) => {
          const isActive = !submitted && activeQuestion === q.id;
          const answered = answeredFor(q.id);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setSubmitted(false);
                setActiveQuestion(q.id);
              }}
              aria-pressed={isActive}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                isActive
                  ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                  : 'border-white/[0.07] bg-slate-950/40 text-slate-400 hover:border-white/20'
              }`}
            >
              {i + 1}. {q.label}
              {answered && ' ✓'}
            </button>
          );
        })}
      </div>

      <div>
        {submitted && help && preserve && authority ? (
          <div className="p-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Your Constitutional Frontier</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {buildSummary(help, preserve, authority)}
            </p>
          </div>
        ) : activeQuestion === 'help' ? (
          <OptionGrid
            title="Where do you most want agents to help?"
            options={HELP_OPTIONS}
            value={help}
            columns="grid-cols-1 sm:grid-cols-2"
            onChange={(v) => {
              setHelp(v);
              setActiveQuestion('preserve');
            }}
          />
        ) : activeQuestion === 'preserve' ? (
          <OptionGrid
            title="What do you most want to remain yours?"
            options={PRESERVE_OPTIONS}
            value={preserve}
            columns="grid-cols-1 sm:grid-cols-2"
            onChange={(v) => {
              setPreserve(v);
              setActiveQuestion('authority');
            }}
          />
        ) : (
          <OptionGrid
            title="How much authority would you currently give an agent?"
            options={AUTHORITY_OPTIONS}
            value={authority}
            columns="grid-cols-1"
            onChange={(v) => setAuthority(v)}
          />
        )}
      </div>

      <div>
        {submitted ? (
          <button
            type="button"
            onClick={changeAnswers}
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            Change my answers
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">{CI_BRIDGE_ORIENT_COMPANION_COPY}</p>
            <button
              type="button"
              disabled={!allChosen}
              onClick={reveal}
              className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {answeredCount}/3 — See your Constitutional Frontier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConstitutionalFrontierOrientSurface;
