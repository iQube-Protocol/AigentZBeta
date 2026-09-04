/**
 * SmartTriadRichBlockRenderer — the ONE dispatcher every copilot renderer
 * mounts for a message's extracted/transported rich blocks. Discriminates on
 * `kind`; today only 'media.video' is implemented. A future rich-block kind
 * extends this switch rather than growing a second, parallel rendering path.
 *
 * Malformed-payload ruling — see services/smarttriad/richBlocks.ts's header:
 * an entry whose schema marker matched but whose payload failed validation
 * renders as this honest notice, never as raw JSON and never silently
 * dropped.
 */

'use client';

import type { SmartTriadMediaAction } from '@/types/smarttriad/richBlocks';
import type { ExtractedSmartTriadBlock } from '@/services/smarttriad/richBlocks';
import { SmartTriadVideoBlockRenderer } from './SmartTriadVideoBlockRenderer';

export interface SmartTriadRichBlockListRendererProps {
  blocks: ExtractedSmartTriadBlock[];
  onContinuePrompt?: (prompt: string) => void;
  onOpenReference?: (action: SmartTriadMediaAction) => void;
}

export function SmartTriadRichBlockListRenderer({ blocks, onContinuePrompt, onOpenReference }: SmartTriadRichBlockListRendererProps) {
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
        switch (block.envelope.kind) {
          case 'media.video':
            return (
              <SmartTriadVideoBlockRenderer
                key={block.envelope.id}
                block={block.envelope.payload}
                onContinuePrompt={onContinuePrompt}
                onOpenReference={onOpenReference}
              />
            );
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
