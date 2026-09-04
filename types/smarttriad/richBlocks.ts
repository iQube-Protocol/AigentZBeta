/**
 * SmartTriad Rich Block contracts — the ONE schema for structured,
 * interactive content inside a copilot reply (video today; the shape is
 * deliberately discriminated on `kind` so a future block type extends this
 * file rather than growing a second parallel payload family).
 *
 * Promoted from MoneyPenny's Cartridge-C-15-specific `smarttriad.media.video.v0`
 * (services/journey/moneyPennyEducationalMedia.ts) into a platform primitive
 * per the 2026-09-04 "first-class, universal SmartTriad Copilot video
 * capability" mandate. `smarttriad.media.video.v0` is preserved as a
 * compatibility source format only — see services/smarttriad/richBlocks.ts's
 * `normalizeLegacyVideoV0`.
 *
 * A block never carries a raw, client-resolvable URL as its identity —
 * `assetId` is the canonical, provenance-bearing reference; `url`/`posterUrl`
 * are the ALREADY-RESOLVED, server-validated playable locations for THIS
 * delivery (resolved server-side at send time, per the platform's Gated
 * Content rules — CLAUDE.md — never resolved or guessed client-side).
 */

export const SMARTTRIAD_BLOCK_SCHEMA_VERSION = 'smarttriad.block.v1' as const;

export type SmartTriadMediaAccessClass = 'public' | 'authenticated' | 'entitled' | 'admin';

export interface SmartTriadVideoCaption {
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

export interface SmartTriadVideoChapter {
  id: string;
  label: string;
  startAtSeconds: number;
}

/**
 * Typed, registry-validated actions only — a rich block can never carry an
 * arbitrary instruction or navigation target (A-08 constraint, generalized).
 * `open-cartridge-tab` / `open-capsule` resolve through the existing
 * CartridgePresenceRegistry (tryOpenInMountedCartridge) — never a raw URL.
 */
export type SmartTriadMediaActionKind =
  | 'open-cartridge-tab'
  | 'open-capsule'
  | 'seek-chapter'
  | 'open-transcript'
  | 'open-document'
  | 'continue-prompt';

export interface SmartTriadMediaAction {
  id: string;
  kind: SmartTriadMediaActionKind;
  label: string;
  /** open-cartridge-tab / open-capsule */
  cartridgeId?: string;
  tab?: string;
  /** seek-chapter */
  chapterId?: string;
  /** open-document — must already be a validated, non-executable URL
   *  (an http(s) link or a same-origin path); never javascript:/data:. */
  documentUrl?: string;
  /** continue-prompt — a predefined, server-authored prompt string only;
   *  never LLM-authored free text routed back as an "action". */
  prompt?: string;
}

export interface SmartTriadVideoBlock {
  /** Canonical, provenance-bearing identity — stable across re-resolution. */
  assetId: string;
  /** Already-resolved, server-validated playable URL for this delivery. */
  url: string;
  posterUrl?: string | null;
  title: string;
  description?: string;
  playback?: {
    startAtSeconds?: number;
    autoplay?: boolean;
    /** Enforced true whenever autoplay is true — see richBlocks.ts's
     *  validator; never forced autoplay with sound. */
    muted?: boolean;
  };
  captions?: SmartTriadVideoCaption[];
  transcript?: {
    available: boolean;
    source?: string;
  };
  chapters?: SmartTriadVideoChapter[];
  actions?: SmartTriadMediaAction[];
  provenance?: {
    sourceType: string;
    sourceId: string;
    publishedRevision?: number;
  };
  access?: {
    class: SmartTriadMediaAccessClass;
  };
}

/** Discriminated on `kind` — today only 'media.video'; future kinds extend
 *  this union rather than forking a new envelope family. */
export type SmartTriadRichBlockPayload = SmartTriadVideoBlock;

export interface SmartTriadRichBlockEnvelope {
  schemaVersion: typeof SMARTTRIAD_BLOCK_SCHEMA_VERSION;
  id: string;
  kind: 'media.video';
  payload: SmartTriadVideoBlock;
}
