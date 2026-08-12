'use client';

/**
 * ConstitutionalInternetBridgePassportGate — modal that gates access to
 * REMIX and PERSONIFY stages for visitors who haven't yet claimed a passport.
 *
 * Shows when:
 *   - Visitor is unsigned-in (personaId missing), OR
 *   - Visitor is signed-in but hasn't claimed a passport (citizenPassportUsable is false)
 *
 * The gate enforces the journey progression rule: PASSPORT is a mandatory
 * spine stage before PERSONIFY and CHOOSE. Visitors attempting to skip it see
 * this modal, which explains the requirement and offers a back button.
 */

import React from 'react';
import { X, Lock } from 'lucide-react';

interface ConstitutionalInternetBridgePassportGateProps {
  isOpen: boolean;
  onDismiss: () => void;
  onProceedToPassport: () => void;
  /**
   * Secondary-button label (2026-08-12, gating polish pass). Defaults to
   * 'Back' — the page-level mount (app/bridge/ci/page.tsx) keeps that
   * wording unchanged. Personify's own mount passes 'Later': there,
   * dismissing the gate must NEVER read as "navigate back" — it stays on
   * Personify and simply reveals the public metaMe surface already
   * mounted behind the gate. The label is the only thing this prop
   * changes; `onDismiss`'s actual behavior is entirely the caller's.
   */
  dismissLabel?: string;
}

export function ConstitutionalInternetBridgePassportGate({
  isOpen,
  onDismiss,
  onProceedToPassport,
  dismissLabel = 'Back',
}: ConstitutionalInternetBridgePassportGateProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-indigo-400/20 bg-slate-900/95 p-6 shadow-2xl">
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-500/20">
            <Lock className="h-5 w-5 text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold text-white">Claim Your Passport First</h2>
        </div>

        {/* Explanation */}
        <p className="text-sm text-slate-300 mb-6">
          Your Polity Citizen Passport is your constitutional presence. You must establish it before you can enter the inner journey.
        </p>

        {/* Key points */}
        <ul className="space-y-2 mb-6">
          <li className="flex gap-2 text-xs text-slate-400">
            <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-indigo-400" />
            <span>Passport proves your constitutional personhood</span>
          </li>
          <li className="flex gap-2 text-xs text-slate-400">
            <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-indigo-400" />
            <span>You'll cross a threshold once claimed</span>
          </li>
          <li className="flex gap-2 text-xs text-slate-400">
            <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-indigo-400" />
            <span>Then personify your story in the polity</span>
          </li>
        </ul>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onProceedToPassport}
            className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-indigo-400"
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

export default ConstitutionalInternetBridgePassportGate;
