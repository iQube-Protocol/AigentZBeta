/**
 * SmartTriadVideoBlockRenderer — the ONE inline video player every SmartTriad
 * copilot surface uses to render a `media.video` rich block. Extracted from
 * MoneyPenny's Cartridge-C-15-only `MediaVideoPreview`
 * (components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx) per the
 * 2026-09-04 "first-class, universal SmartTriad Copilot video capability"
 * mandate — both renderer families (SmartTriadInferenceRenderer.tsx,
 * CopilotInferenceBodyRenderer.tsx) mount THIS component; neither forks its
 * own player.
 *
 * Public/non-gated content only renders through the plain native <video>
 * here (CLAUDE.md Gated Content rules — the canonical entitled `VideoPlayer`
 * component remains the required path for purchased/entitled content; a
 * block whose `access.class` is 'entitled' or 'admin' is refused by this
 * renderer rather than silently playing it through the public path — see
 * `isPubliclyPlayable` below).
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { tryOpenInMountedCartridge } from '@/services/cartridge/CartridgePresenceRegistry';
import type { SmartTriadMediaAction, SmartTriadVideoBlock } from '@/types/smarttriad/richBlocks';

export interface SmartTriadVideoBlockRendererProps {
  block: SmartTriadVideoBlock;
  /** Fires for a 'continue-prompt' action — the host owns actually sending
   *  it (each copilot shell has its own send-message plumbing). Actions with
   *  no handler wired render disabled rather than silently doing nothing. */
  onContinuePrompt?: (prompt: string) => void;
  /** Fires for an 'open-transcript' / 'open-document' action. */
  onOpenReference?: (action: SmartTriadMediaAction) => void;
}

/** Only 'public' content plays through this shared, unauthenticated
 *  <video> element. 'authenticated' | 'entitled' | 'admin' access classes
 *  must route through the platform's existing gated VideoPlayer/entitlement
 *  path instead — this renderer fails closed rather than guessing. */
function isPubliclyPlayable(block: SmartTriadVideoBlock): boolean {
  const accessClass = block.access?.class ?? 'public';
  return accessClass === 'public';
}

export function SmartTriadVideoBlockRenderer({ block, onContinuePrompt, onOpenReference }: SmartTriadVideoBlockRendererProps) {
  const [showControls, setShowControls] = useState(false);
  const [errored, setErrored] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleAction = useCallback(
    (action: SmartTriadMediaAction) => {
      switch (action.kind) {
        case 'open-cartridge-tab':
        case 'open-capsule':
          if (action.cartridgeId) {
            tryOpenInMountedCartridge({ cartridgeId: action.cartridgeId, tab: action.tab });
          }
          return;
        case 'seek-chapter': {
          const chapter = block.chapters?.find((c) => c.id === action.chapterId);
          if (chapter && videoRef.current) {
            videoRef.current.currentTime = chapter.startAtSeconds;
            void videoRef.current.play().catch(() => undefined);
          }
          return;
        }
        case 'open-transcript':
        case 'open-document':
          onOpenReference?.(action);
          return;
        case 'continue-prompt':
          if (action.prompt) onContinuePrompt?.(action.prompt);
          return;
      }
    },
    [block.chapters, onContinuePrompt, onOpenReference],
  );

  if (!isPubliclyPlayable(block)) {
    return (
      <div className="smarttriad-media-video-preview smarttriad-media-video-preview-blocked">
        <div className="smarttriad-media-video-preview-title">{block.title}</div>
        <div className="smarttriad-media-video-preview-notice">
          This video requires entitled access and cannot be played through the inline copilot preview.
        </div>
      </div>
    );
  }

  return (
    <div className="smarttriad-media-video-preview">
      {errored ? (
        <div className="smarttriad-media-video-preview-error">
          <span>This video couldn&apos;t be played.</span>
          <button
            type="button"
            className="smarttriad-media-video-preview-chip"
            onClick={() => {
              setErrored(false);
              setRetryKey((k) => k + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <video
          key={retryKey}
          ref={videoRef}
          controls={showControls}
          poster={block.posterUrl ?? undefined}
          src={block.url}
          muted={block.playback?.muted}
          autoPlay={block.playback?.autoplay}
          title={block.title}
          aria-label={block.title}
          className="smarttriad-media-video-preview-player"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onFocus={() => setShowControls(true)}
          onBlur={() => setShowControls(false)}
          onError={() => setErrored(true)}
          onLoadedMetadata={(e) => {
            const startAt = block.playback?.startAtSeconds;
            if (startAt) e.currentTarget.currentTime = startAt;
          }}
        >
          {block.captions?.map((caption) => (
            <track
              key={caption.src}
              kind="captions"
              label={caption.label}
              srcLang={caption.language}
              src={caption.src}
              default={caption.default}
            />
          ))}
        </video>
      )}
      <div className="smarttriad-media-video-preview-title">{block.title}</div>
      {block.description ? <div className="smarttriad-media-video-preview-description">{block.description}</div> : null}
      {block.chapters && block.chapters.length > 0 ? (
        <div className="smarttriad-media-video-preview-chapters" role="group" aria-label="Chapters">
          {block.chapters.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              className="smarttriad-media-video-preview-chip"
              onClick={() => handleAction({ id: `seek-${chapter.id}`, kind: 'seek-chapter', label: chapter.label, chapterId: chapter.id })}
            >
              {chapter.label}
            </button>
          ))}
        </div>
      ) : null}
      {block.transcript?.available ? (
        <button
          type="button"
          className="smarttriad-media-video-preview-chip"
          onClick={() => onOpenReference?.({ id: 'transcript', kind: 'open-transcript', label: 'View transcript' })}
        >
          View transcript
        </button>
      ) : null}
      {block.actions && block.actions.length > 0 ? (
        <div className="smarttriad-media-video-preview-actions">
          {block.actions.map((action) => (
            <button key={action.id} type="button" className="smarttriad-media-video-preview-chip" onClick={() => handleAction(action)}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
