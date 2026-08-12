'use client';

/**
 * BridgePassportGate — bridge-neutral modal that gates access to a
 * personhood-bound stage for visitors who haven't yet claimed a Passport.
 *
 * Extracted 2026-08-12 (KNYTS↔CI parity pass) from
 * ConstitutionalInternetBridgePassportGate — CI's file is now a thin
 * indigo-preset wrapper around this component so its existing import path
 * and visible output are unchanged. KNYTS's page mounts this directly with
 * `accent="amber"` and Remix/Stand-appropriate copy, rather than importing
 * a CI-branded component.
 *
 * Shows when the visitor is unsigned-in OR signed-in but hasn't claimed a
 * Passport (citizenPassportUsable is false). The gate enforces the journey
 * progression rule that a personhood-bound stage requires Passport first;
 * visitors attempting to skip it see this modal.
 */

import React from 'react';
import { Lock } from 'lucide-react';

export type BridgePassportGateAccent = 'indigo' | 'amber';

const ACCENT_CLASSES: Record<BridgePassportGateAccent, { border: string; iconBg: string; iconText: string; dot: string; button: string }> = {
  indigo: {
    border: 'border-indigo-400/20',
    iconBg: 'bg-indigo-500/20',
    iconText: 'text-indigo-300',
    dot: 'bg-indigo-400',
    button: 'bg-indigo-500 hover:bg-indigo-400',
  },
  amber: {
    border: 'border-amber-400/20',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-300',
    dot: 'bg-amber-400',
    button: 'bg-amber-500 hover:bg-amber-400',
  },
};

interface BridgePassportGateProps {
  isOpen: boolean;
  onDismiss: () => void;
  onProceedToPassport: () => void;
  /** Secondary-button label. Defaults to 'Back'. Pass 'Later' for a caller
   *  whose dismiss action must never read as page navigation. */
  dismissLabel?: string;
  accent?: BridgePassportGateAccent;
  headline?: string;
  explanation?: string;
  points?: string[];
}

const DEFAULT_HEADLINE = 'Claim Your Passport First';
const DEFAULT_EXPLANATION =
  'Your Polity Citizen Passport is your constitutional presence. You must establish it before you can enter the inner journey.';
const DEFAULT_POINTS = [
  'Passport proves your constitutional personhood',
  "You'll cross a threshold once claimed",
  'Then personify your story in the polity',
];

export function BridgePassportGate({
  isOpen,
  onDismiss,
  onProceedToPassport,
  dismissLabel = 'Back',
  accent = 'indigo',
  headline = DEFAULT_HEADLINE,
  explanation = DEFAULT_EXPLANATION,
  points = DEFAULT_POINTS,
}: BridgePassportGateProps) {
  if (!isOpen) return null;
  const classes = ACCENT_CLASSES[accent];

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl border ${classes.border} bg-slate-900/95 p-6 shadow-2xl`}>
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${classes.iconBg}`}>
            <Lock className={`h-5 w-5 ${classes.iconText}`} />
          </div>
          <h2 className="text-xl font-bold text-white">{headline}</h2>
        </div>

        {/* Explanation */}
        <p className="text-sm text-slate-300 mb-6">{explanation}</p>

        {/* Key points */}
        <ul className="space-y-2 mb-6">
          {points.map((point) => (
            <li key={point} className="flex gap-2 text-xs text-slate-400">
              <span className={`shrink-0 mt-1 h-1 w-1 rounded-full ${classes.dot}`} />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onProceedToPassport}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 transition ${classes.button}`}
          >
            Go to Passport
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BridgePassportGate;
