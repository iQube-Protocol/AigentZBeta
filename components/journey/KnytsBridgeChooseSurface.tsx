'use client';

/**
 * KnytsBridgeChooseSurface — the CHOOSE stage's destinations for the KNYTS Bridge.
 *
 * Four sibling paths, each an already-evidenced act or a deep link elsewhere:
 *   1. "Reserve metaKnyt Agentic GN" — reuses existing interest/reservation
 *      mechanism if demonstrably available; otherwise a simple mailto interest
 *      action for launch (no new commerce infrastructure for v1).
 *   2. "Explore the KNYT Store" — deep-link into existing KNYT Store tabs,
 *      same navigation the standalone KNYT cartridge uses.
 *   3. "Learn about the Constitutional Internet" — contextual deep-link to
 *      the Constitutional Internet Bridge via embedded-left-pane pattern (not
 *      loose external link); shows CI as a sibling path into the Polity.
 *   4. "Apply to join the Constitutional Financial Services Pilot" — mailto
 *      interest action for launch (no separate Pilot-specific codex/tab yet).
 *
 * Never a single fact this journey could gate on, so CHOOSE carries no
 * completion evidence — exactly like KNYTS Bridge's own predecessor BUY stage.
 */

import { Mail, Sparkles, ArrowRight, BookMarked, Handshake } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';

const CONTACT_EMAIL = 'info@metame.com';

interface KnytsBridgeChooseSurfaceProps {
  personaId?: string;
}

export function KnytsBridgeChooseSurface({ personaId }: KnytsBridgeChooseSurfaceProps) {
  const storeUrl = buildCodexUrl('knyt-codex', { tab: 'store-episodes', personaId, shell: 'viewer' });
  const ciUrl = buildCodexUrl('constitutional-internet-bridge', { personaId, shell: 'viewer' });

  return (
    <div className="space-y-3">
      {/* Reserve metaKnyt Agentic GN */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookMarked className="h-4 w-4 text-indigo-300" />
          Reserve metaKnyt Agentic GN
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>

      {/* Explore the KNYT Store */}
      <a
        href={storeUrl}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-indigo-300" />
          Explore the KNYT Store
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      {/* Learn about the Constitutional Internet */}
      <a
        href={ciUrl}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-indigo-300" />
          Learn about the Constitutional Internet
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      {/* Apply to join the Constitutional Financial Services Pilot */}
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Financial Services Pilot — interest')}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Handshake className="h-4 w-4 text-indigo-300" />
          Apply to join the Constitutional Financial Services Pilot
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>
    </div>
  );
}

export default KnytsBridgeChooseSurface;
