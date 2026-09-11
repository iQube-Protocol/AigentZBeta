'use client';

/**
 * DestinationCard — extracted from ConstitutionalInternetBridgeChooseSurface.tsx
 * (2026-09-03, CFS media/action-cards reuse pass) so the CHOOSE stage and any
 * "media + action cards" composition (e.g. the Financial Sovereignty bridge
 * sections) share ONE action-card implementation rather than a second,
 * visually-similar copy. Behavior and markup are unchanged from the original
 * inline definition — ConstitutionalInternetBridgeChooseSurface now imports
 * this file instead of declaring its own.
 */

import React from 'react';
import { ArrowRight, Mail } from 'lucide-react';

export function DestinationCard({
  icon,
  label,
  active,
  onClick,
  mailtoSubject,
  mailtoLabel,
  contactEmail = 'info@metame.com',
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  mailtoSubject?: string;
  mailtoLabel?: string;
  /** Recipient for the optional inline mailto affordance. Defaults to the
   *  CI Bridge's existing contact address so ChooseSurface's own callers are
   *  unaffected; other composers may pass their own. */
  contactEmail?: string;
}) {
  // The main card is always the contextual-left-view trigger, mailto CTA or
  // not — the mailto affordance is an inline extra, never a replacement for
  // the card's own onClick (a card that is entirely a mailto anchor can never
  // set the contextual left view again once clicked).
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition hover:opacity-80 ${
        active ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-slate-900/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {label}</span>
      {mailtoSubject && mailtoLabel && (
        <a
          href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailtoSubject)}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 hover:text-indigo-200"
        >
          <Mail className="h-3 w-3" /> {mailtoLabel}
        </a>
      )}
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

export default DestinationCard;
