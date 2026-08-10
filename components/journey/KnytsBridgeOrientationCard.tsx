'use client';

/**
 * KnytsBridgeOrientationCard — the ORIENT stage's surface (reconstitution
 * spec, point 3). A light explanation of the first constitutional choice —
 * deliberately no heavy Bureau UI, no server call, no completion evidence
 * (see knytsBridgeCrossingJourney.ts's own header for why ORIENT carries no
 * gate of its own). The ONE action here hands off to the PASSPORT stage.
 */

import { ShieldCheck, ArrowRight } from 'lucide-react';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export function KnytsBridgeOrientationCard() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/20 bg-slate-900/40 p-6 text-center">
      <ShieldCheck className="mx-auto h-6 w-6 text-amber-300" />
      <h2 className="mt-3 text-lg font-semibold text-slate-100">Before you cross</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Your personhood comes before your identity. Whatever name or persona you use here, it is
        you — a person — the Polity recognises.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Claiming your Passport is your first constitutional act. Everything before it was
        browsing; this is the actual crossing.
      </p>
      <button
        type="button"
        onClick={() => selectStage('passport')}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
      >
        Claim your Passport
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default KnytsBridgeOrientationCard;
