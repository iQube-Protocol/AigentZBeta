'use client';

/**
 * IQubeRegistryMintsTab — Mints + Sagas administration.
 *
 * Stage 8 C14. Lifts the existing CanonicalMintPanel (shipped 2026-05-29
 * at commit `89adda9a`, docs `2026-05-29_canonical-mint-panel-registry-
 * integration.md`) into the iqube-registry cartridge per the backlog
 * doc's explicit plan: "Mount the panel in the Registry admin surface —
 * replace the per-cartridge tab integration with a Registry-level
 * 'Canonical Mint' section, scoped by series via the `series` prop."
 *
 * v1 supports the master mint flow (per CanonicalMintPanel v1 scope).
 * Edition mint (ERC-1155) + bulk mint + treasury-wallet selection +
 * mint-saga state surface (PRD v1.0 §7) land in subsequent commits as
 * Stage 5 mint saga work matures.
 *
 * The original mount in KnytCodexAdminTab remains active during the
 * 30-day observation window. Removal scheduled per the backlog doc
 * "remove the mount from KnytCodexAdminTab once Registry is live, to
 * avoid two operator surfaces firing the same on-chain action."
 */

import React, { useState } from 'react';
import { Hammer, Info } from 'lucide-react';
import { CanonicalMintPanel } from '@/components/admin/CanonicalMintPanel';

const SERIES_FILTERS: Array<{ id: string; label: string; defaultFor?: string }> = [
  { id: 'metaKnyts', label: 'metaKnyts (KNYT)' },
  { id: 'qriptopian', label: 'Qriptopian' },
  { id: 'metame', label: 'metaMe activations' },
  { id: 'avl', label: 'Venture Lab (AVL)' },
  { id: 'marketa', label: 'Marketa' },
  { id: 'knyt', label: 'Order of Metayé' },
];

export function IQubeRegistryMintsTab() {
  const [series, setSeries] = useState<string>('metaKnyts');

  return (
    <div className="p-6 space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Hammer className="w-5 h-5 text-violet-400" />
          Mints + Sagas
        </h2>
        <p className="text-sm text-slate-400">
          Canonical mint operations — master-token ERC-721 mints today, edition ERC-1155 and the full mint-saga
          state machine land as Stage 5 wiring matures.
        </p>
      </header>

      {/* Series selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 uppercase tracking-wide mr-1">Series</span>
        {SERIES_FILTERS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeries(s.id)}
            className={
              series === s.id
                ? 'text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/50'
                : 'text-xs px-2.5 py-1 rounded-full bg-slate-800/40 text-slate-400 border border-slate-700 hover:border-slate-600'
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Lifted panel */}
      <CanonicalMintPanel series={series} />

      {/* Provenance note */}
      <div className="text-xs text-slate-500 flex items-start gap-2 pt-2 border-t border-slate-800">
        <Info className="w-3.5 h-3.5 mt-0.5 text-slate-500 flex-shrink-0" />
        <p>
          This panel is the same component that's lived inside the KNYT Codex Admin tab — lifted here per the
          2026-05-29 backlog. Both mounts stay live during the 30-day observation window; the KNYT mount is
          scheduled for removal once this surface is verified in production. Stage 5 mint-saga state (idempotency
          keys, retry counters, *_pending reconciliation) surfaces under this same tab as new sections.
        </p>
      </div>
    </div>
  );
}
