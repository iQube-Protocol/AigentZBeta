'use client';

/**
 * KnytsBridgeChooseSurface — the CHOOSE stage's destinations for the KNYTS Bridge.
 *
 * Two-column layout (contextual visual left, destination cards right) mirroring
 * ConstitutionalInternetBridgeChooseSurface's exact pattern.
 *
 * Four sibling paths, each an already-evidenced act or a deep link elsewhere:
 *   1. "Reserve metaKnyt Agentic GN" — reuses existing interest/reservation
 *      mechanism if demonstrably available; otherwise a simple mailto interest
 *      action for launch (no new commerce infrastructure for v1).
 *   2. "Explore the KNYT Store" — deep-link into existing KNYT Store tabs,
 *      same navigation the standalone KNYT cartridge uses.
 *   3. "Learn about the Constitutional Internet" — contextual deep-link to
 *      the Constitutional Internet Bridge; shows CI as a sibling path into
 *      the Polity.
 *   4. "Apply to join the Constitutional Financial Services Pilot" — mailto
 *      interest action for launch (no separate Pilot-specific codex/tab yet).
 *
 * Never a single fact this journey could gate on, so CHOOSE carries no
 * completion evidence — exactly like KNYTS Bridge's own predecessor BUY stage.
 */

import { Mail, Sparkles, ArrowRight, BookMarked, Handshake, Compass, MessageCircle } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

const CONTACT_EMAIL = 'info@metame.com';

interface KnytsBridgeChooseSurfaceProps {
  personaId?: string;
  /** Opens the page-level KNYT CodexCopilotLayer — never a second, surface-local copilot instance. */
  onOpenKnytCopilot?: () => void;
}

export function KnytsBridgeChooseSurface({ personaId, onOpenKnytCopilot }: KnytsBridgeChooseSurfaceProps) {
  const storeUrl = buildCodexUrl('knyt-codex', { tab: 'store-episodes', personaId, shell: 'viewer' });
  const ciUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/bridge/ci`;

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — contextual visual: what comes next (the bridge continues) */}
      <div className="relative flex h-[45vh] max-h-[55vh] min-h-[16rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
          <Compass className="h-16 w-16 text-amber-300" />
          <div>
            <h3 className="text-lg font-semibold text-white">Where next?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Your crossing is published. Choose how to continue in the Polity.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — destination cards */}
      <div className="flex flex-col gap-3">
        {/* Reserve metaKnyt Agentic GN — mailto interest action for launch,
            same no-new-commerce-infrastructure pattern as the CFS Pilot card
            below (no reservation infrastructure exists for v1). */}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('metaKnyt Agentic GN — reservation interest')}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookMarked className="h-4 w-4 text-amber-300" />
            Reserve metaKnyt Agentic GN
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </a>

        {/* Explore the KNYT Store */}
        <a
          href={storeUrl}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-amber-300" />
            Explore the KNYT Store
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>

        {/* Learn about the Constitutional Internet */}
        <a
          href={ciUrl}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Compass className="h-4 w-4 text-amber-300" />
            Learn about the Constitutional Internet
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>

        {/* Apply to join the Constitutional Financial Services Pilot */}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Financial Services Pilot — interest')}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Handshake className="h-4 w-4 text-amber-300" />
            Apply to join the Constitutional Financial Services Pilot
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>

        {/* Ask Kn0w1 — opens the page-level KNYT CodexCopilotLayer (the ONE
            conversational partner for this bridge, MS-1); never mounts a
            second copilot instance here. */}
        <button
          type="button"
          onClick={() => onOpenKnytCopilot?.()}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4 text-amber-300" />
            Ask Kn0w1
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

export default KnytsBridgeChooseSurface;
