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

/**
 * Data-provenance classification (2026-09-04 "atomic, capsule-composable
 * surfaces" ruling). Every rendered number in a runtime/market surface must
 * carry one of these — never asserted as 'live' merely because a value came
 * from a database row or a realtime subscription; 'live' requires an
 * actually-identified live provider or a receipt-backed execution source.
 */
export type SmartTriadDataSourceClass =
  | 'live-market-data'
  | 'cached-market-data'
  | 'delayed-market-data'
  | 'paper-execution'
  | 'simulation'
  | 'historical'
  | 'unavailable';

export interface SmartTriadSourceDescriptor {
  class: SmartTriadDataSourceClass;
  /** Human-readable provider/service name, e.g. "MoneyPenny deterministic
   *  simulation adapter" or "CoinGecko spot price". Never a raw hostname. */
  label: string;
  /** ISO timestamp the value was computed/observed, when known. */
  observedAt?: string;
}

/** Fields every governed market/runtime gauge surface carries — the
 *  SIM/PAPER/LIVE distinction and its source classification travel with the
 *  data, never inferred by the renderer from the mere presence of a value. */
export interface SmartTriadMarketGaugeBasePayload {
  capabilityId: string;
  mode: 'simulation' | 'paper' | 'live';
  source: SmartTriadSourceDescriptor;
  actions?: SmartTriadMediaAction[];
}

/** Harvested from MoneyPenny002's `EdgeGauge.tsx` (donor UI/interaction
 *  pattern only — see services/moneypenny/marketSimulation.ts for why the
 *  VALUES here are always simulation-sourced today, never donor logic). */
export interface SmartTriadEdgeGaugePayload extends SmartTriadMarketGaugeBasePayload {
  floorBps: number;
  minEdgeBps: number;
  liveEdgeBps: number;
}

/** Harvested from MoneyPenny002's `InventoryGauge.tsx` — same provenance
 *  note as SmartTriadEdgeGaugePayload. */
export interface SmartTriadInventoryGaugePayload extends SmartTriadMarketGaugeBasePayload {
  inventoryMin: number;
  inventoryMax: number;
  currentInventory: number;
  workingQc: number;
}

/**
 * A capsule composes already-resolved child envelopes (atomic surfaces or
 * further capsules) into one declarative unit — deliberately NOT a lazy
 * `dataRef` indirection layer (that is future work, see this capability's
 * own doc); every child ships fully resolved, so a capsule never needs a
 * second round-trip to render. The SAME dispatcher that renders a top-level
 * block renders each child — one controller, no forked capsule renderer.
 */
export interface SmartTriadCapsulePayload {
  capsuleId: string;
  title: string;
  capabilityId: string;
  layout: {
    type: 'stack' | 'grid';
    density: 'compact' | 'panel';
  };
  surfaces: SmartTriadRichBlockEnvelope[];
  actions?: SmartTriadMediaAction[];
}

/** Discriminated on `kind` — a future block type adds a member to this union
 *  (payload + a case in services/smarttriad/richBlocks.ts's validator and
 *  components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx's
 *  dispatcher) rather than forking a new envelope family. */
export type SmartTriadBlockVariant =
  | { kind: 'media.video'; payload: SmartTriadVideoBlock }
  | { kind: 'market.edge'; payload: SmartTriadEdgeGaugePayload }
  | { kind: 'market.inventory'; payload: SmartTriadInventoryGaugePayload }
  | { kind: 'capsule'; payload: SmartTriadCapsulePayload };

export type SmartTriadBlockKind = SmartTriadBlockVariant['kind'];

export type SmartTriadRichBlockEnvelope = {
  schemaVersion: typeof SMARTTRIAD_BLOCK_SCHEMA_VERSION;
  id: string;
} & SmartTriadBlockVariant;
