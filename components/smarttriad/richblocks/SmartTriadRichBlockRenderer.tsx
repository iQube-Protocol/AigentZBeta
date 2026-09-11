/**
 * SmartTriadRichBlockRenderer — the ONE dispatcher every copilot renderer
 * mounts for a message's extracted/transported rich blocks. Discriminates on
 * `kind`. A future rich-block kind extends this switch rather than growing
 * a second, parallel rendering path.
 *
 * A `capsule` composes already-resolved child envelopes and renders them
 * through this SAME list renderer, recursively — one controller, no forked
 * capsule-specific rendering path (2026-09-04 "atomic, capsule-composable
 * surfaces" ruling). A capsule whose `capsuleId` is registered in
 * `LIVE_CAPSULE_COMPONENTS` mounts its LIVE, controller-backed component
 * instead of recursing into its (necessarily static, point-in-time) child
 * envelopes — this is what lets "open the market console" inside a copilot
 * message become a genuinely ticking surface, backed by the SAME
 * `useMoneyPennyMarketSession()` singleton `HFTConsole.tsx` uses, with its
 * own in-place expand/collapse (2026-09-04 tranche, requirements 5-7).
 *
 * Malformed-payload ruling — see services/smarttriad/richBlocks.ts's header:
 * an entry whose schema marker matched but whose payload failed validation
 * renders as this honest notice, never as raw JSON and never silently
 * dropped.
 */

'use client';

import type { ComponentType } from 'react';
import type { SmartTriadMediaAction } from '@/types/smarttriad/richBlocks';
import type { ExtractedSmartTriadBlock } from '@/services/smarttriad/richBlocks';
import { SmartTriadVideoBlockRenderer } from './SmartTriadVideoBlockRenderer';
import { EdgeGaugeSurface } from '@/components/smarttriad/surfaces/EdgeGaugeSurface';
import { InventoryGaugeSurface } from '@/components/smarttriad/surfaces/InventoryGaugeSurface';
import { QuotesSurface } from '@/components/smarttriad/surfaces/QuotesSurface';
import { FillsSurface } from '@/components/smarttriad/surfaces/FillsSurface';
import { PerformanceSurface } from '@/components/smarttriad/surfaces/PerformanceSurface';
import { HistorySurface } from '@/components/smarttriad/surfaces/HistorySurface';
import { MarketConsoleCapsule } from '@/components/smarttriad/surfaces/MarketConsoleCapsule';

/** Registered live-controller-backed capsules — a capsule id here mounts a
 *  ticking component instead of the generic static-child recursion. Never
 *  an arbitrary component name from the payload itself; only a capsuleId
 *  this file itself maps, same closed-registry discipline as action kinds. */
const LIVE_CAPSULE_COMPONENTS: Record<string, ComponentType<{ hideToggle?: boolean }>> = {
  'moneypenny.market-status': MarketConsoleCapsule,
};

export interface SmartTriadRichBlockListRendererProps {
  blocks: ExtractedSmartTriadBlock[];
  onContinuePrompt?: (prompt: string) => void;
  onOpenReference?: (action: SmartTriadMediaAction) => void;
  /** Compact presentation — used for capsule children and inline-message
   *  depth; the same atomic surface component renders either way, only its
   *  spacing changes (2026-09-04 ruling: "presentation depth must be
   *  controlled through variants... not conditional business logic"). */
  compact?: boolean;
}

export function SmartTriadRichBlockListRenderer({
  blocks,
  onContinuePrompt,
  onOpenReference,
  compact = false,
}: SmartTriadRichBlockListRendererProps) {
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => {
        if (block.invalid || !block.envelope) {
          return (
            <div key={index} className="smarttriad-media-video-preview-notice" role="note">
              Unsupported or invalid media content.
            </div>
          );
        }
        const envelope = block.envelope;
        switch (envelope.kind) {
          case 'media.video':
            return (
              <SmartTriadVideoBlockRenderer
                key={envelope.id}
                block={envelope.payload}
                onContinuePrompt={onContinuePrompt}
                onOpenReference={onOpenReference}
              />
            );
          case 'market.edge':
            return <EdgeGaugeSurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'market.inventory':
            return <InventoryGaugeSurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'market.quotes':
            return <QuotesSurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'market.fills':
            return <FillsSurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'market.performance':
            return <PerformanceSurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'market.history':
            return <HistorySurface key={envelope.id} payload={envelope.payload} compact={compact} />;
          case 'capsule': {
            const LiveCapsule = LIVE_CAPSULE_COMPONENTS[envelope.payload.capsuleId];
            if (LiveCapsule) {
              // The live component owns its own controller subscription,
              // title and expand/collapse — the static `surfaces` array on
              // this envelope only ever informed the FIRST-paint fallback
              // before the live component was registered; it is not
              // rendered here to avoid a duplicate/stale display.
              return <LiveCapsule key={envelope.id} />;
            }
            const childBlocks: ExtractedSmartTriadBlock[] = envelope.payload.surfaces.map((child) => ({
              envelope: child,
              invalid: false,
              rawMatch: '',
            }));
            return (
              <div
                key={envelope.id}
                className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2.5"
                role="group"
                aria-label={envelope.payload.title}
              >
                <div className="text-xs font-semibold text-slate-300">{envelope.payload.title}</div>
                <div className={envelope.payload.layout.type === 'grid' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'space-y-2'}>
                  <SmartTriadRichBlockListRenderer
                    blocks={childBlocks}
                    onContinuePrompt={onContinuePrompt}
                    onOpenReference={onOpenReference}
                    compact={envelope.payload.layout.density === 'compact'}
                  />
                </div>
              </div>
            );
          }
          default:
            return (
              <div key={index} className="smarttriad-media-video-preview-notice" role="note">
                Unsupported content type.
              </div>
            );
        }
      })}
    </>
  );
}
