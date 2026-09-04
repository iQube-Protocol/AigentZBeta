/**
 * SmartTriad media capability providers — the cartridge-aware resolution
 * abstraction that replaces the MoneyPenny-specific
 * `isMoneyPennyLearnVideoRequest`/`getMoneyPennyIntroVideoReply` branch that
 * used to live directly inside app/api/codex/chat/route.ts (2026-09-04
 * "first-class, universal SmartTriad Copilot video capability" mandate,
 * Workstream 4).
 *
 * A cartridge/journey registers a provider here instead of editing the
 * central chat route. The route calls `resolveSmartTriadMedia` once, with
 * the SAME `groundContext` it already threads through every request; it
 * never inspects a specific cartridge's trigger phrasing itself again.
 *
 * The model is NEVER trusted to emit a media URL — a provider's `resolve`
 * either returns a server-resolved, already-validated rich block (built via
 * services/smarttriad/richBlocks.ts's validators) or nothing at all.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getMoneyPennyIntroVideoBlock,
  isMoneyPennyLearnVideoRequest,
} from '@/services/journey/moneyPennyEducationalMedia';
import { normalizeLegacyVideoV0, parseSmartTriadBlockCandidate } from '@/services/smarttriad/richBlocks';
import { FS_PLACEHOLDER_VIDEO_URL, FS_PLACEHOLDER_VIDEO_POSTER_URL } from '@/services/journey/fsPlaceholderVideo';
import { simulateEdge, simulateInventory, simulationSource } from '@/services/moneypenny/marketSimulation';
import type { SmartTriadRichBlockEnvelope } from '@/types/smarttriad/richBlocks';

export interface SmartTriadMediaProvider {
  /** Stable id — never reused for a different capability once published. */
  id: string;
  /** Human-readable label for documentation/telemetry only. */
  label: string;
  /** Cheap, synchronous applicability check against the raw request + ground
   *  context — run before the (possibly async) `resolve`. */
  matches: (message: string, groundContext: Record<string, unknown> | undefined) => boolean;
  /** Resolves zero or more validated rich blocks. Never throws for "nothing
   *  published yet" — returns an empty array; a thrown error means a real
   *  infrastructure failure. */
  resolve: (
    supabase: SupabaseClient,
    message: string,
    groundContext: Record<string, unknown> | undefined,
  ) => Promise<SmartTriadRichBlockEnvelope[]>;
}

/**
 * MoneyPenny Cartridge C-15 — the first registered provider, preserving the
 * exact deterministic trigger/lookup behavior that used to live inline in
 * the chat route. `getMoneyPennyIntroVideoBlock` still returns a fenced-JSON
 * string (its own long-standing, tested contract) — decoded once here via
 * the shared parser rather than duplicating field-mapping logic.
 */
export const moneyPennyLearnVideoProvider: SmartTriadMediaProvider = {
  id: 'moneypenny.learn-video',
  label: 'MoneyPenny — Financial Sovereignty basics video',
  matches: (message, groundContext) =>
    groundContext?.cartridge === 'moneypenny' && isMoneyPennyLearnVideoRequest(message),
  resolve: async (supabase) => {
    const fenced = await getMoneyPennyIntroVideoBlock(supabase);
    if (!fenced) return [];
    const jsonMatch = fenced.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      return [];
    }
    const result = parseSmartTriadBlockCandidate(parsed);
    return result?.ok ? [result.envelope] : [];
  },
};

/** MoneyPenny's HFT console tab — the SAME target MoneyPennyPanelTab.tsx
 *  already registers ('hft-console' → HFTConsole.tsx). Reused, never a new
 *  destination invented for this capability. */
const MONEYPENNY_MARKET_CONSOLE_CAPABILITY_ID = 'moneypenny.market-console';
const MONEYPENNY_MARKET_CONSOLE_TAB = { cartridgeId: 'moneypenny-codex', tab: 'hft-console' };

const EDGE_TRIGGER = /(current edge|edge gauge|what is our edge|show.*\bedge\b)/i;
const INVENTORY_TRIGGER = /(inventory exposure|inventory gauge|show.*inventory)/i;
const MARKET_CONSOLE_TRIGGER =
  /(market console|show me the market\b|quotes,?\s*spread,?\s*(and|&)\s*liquidity|open the market console|how (is|are) (the|our) strategy performing)/i;

function edgeGaugeEnvelope(): SmartTriadRichBlockEnvelope {
  const sim = simulateEdge();
  return {
    schemaVersion: 'smarttriad.block.v1',
    id: `moneypenny-edge-${Date.now()}`,
    kind: 'market.edge',
    payload: {
      capabilityId: MONEYPENNY_MARKET_CONSOLE_CAPABILITY_ID,
      mode: 'simulation',
      source: simulationSource(new Date().toISOString()),
      floorBps: sim.floorBps,
      minEdgeBps: sim.minEdgeBps,
      liveEdgeBps: sim.liveEdgeBps,
      actions: [
        { id: 'expand-console', kind: 'open-cartridge-tab', label: 'Expand console', ...MONEYPENNY_MARKET_CONSOLE_TAB },
      ],
    },
  };
}

function inventoryGaugeEnvelope(): SmartTriadRichBlockEnvelope {
  const sim = simulateInventory();
  return {
    schemaVersion: 'smarttriad.block.v1',
    id: `moneypenny-inventory-${Date.now()}`,
    kind: 'market.inventory',
    payload: {
      capabilityId: MONEYPENNY_MARKET_CONSOLE_CAPABILITY_ID,
      mode: 'simulation',
      source: simulationSource(new Date().toISOString()),
      inventoryMin: sim.inventoryMin,
      inventoryMax: sim.inventoryMax,
      currentInventory: sim.currentInventory,
      workingQc: sim.workingQc,
      actions: [
        { id: 'expand-console', kind: 'open-cartridge-tab', label: 'Expand console', ...MONEYPENNY_MARKET_CONSOLE_TAB },
      ],
    },
  };
}

/**
 * Compact "Market Status" capsule — composes the Edge and Inventory atomic
 * surfaces (2026-09-04 "atomic, capsule-composable surfaces" ruling). Does
 * NOT include quotes/fills/performance sub-surfaces yet — those are not
 * built this pass (see this capability's harvest-matrix doc for the
 * sequenced remainder); this capsule is the honest subset that exists.
 */
function marketStatusCapsuleEnvelope(): SmartTriadRichBlockEnvelope {
  return {
    schemaVersion: 'smarttriad.block.v1',
    id: `moneypenny-market-console-${Date.now()}`,
    kind: 'capsule',
    payload: {
      capsuleId: 'moneypenny.market-status',
      title: 'Market Status',
      capabilityId: MONEYPENNY_MARKET_CONSOLE_CAPABILITY_ID,
      layout: { type: 'stack', density: 'compact' },
      surfaces: [edgeGaugeEnvelope(), inventoryGaugeEnvelope()],
      actions: [
        { id: 'expand-console', kind: 'open-cartridge-tab', label: 'Expand console', ...MONEYPENNY_MARKET_CONSOLE_TAB },
      ],
    },
  };
}

/**
 * MoneyPenny's live-runtime market surfaces — the reference exemplar for the
 * 2026-09-04 "atomic, capsule-composable surfaces" ruling harvesting
 * MoneyPenny002's LiveMarketFeed. Renders the smallest adequate block for a
 * specific-metric request (edge, inventory) and the composed capsule for a
 * general "show me the market" request — never always the full console for
 * a narrow question. Quotes/fills/performance/history atomic surfaces are
 * NOT implemented this pass (see the harvest-matrix doc); a request for one
 * of those still matches this provider's broader console trigger and falls
 * back to the Market Status capsule rather than silently doing nothing.
 *
 * Every value is `mode: 'simulation'` — there is no real Q¢ market-data feed
 * in this codebase today (confirmed by the 2026-09-02 mpy2-0b real-source
 * audit); values are deterministic (services/moneypenny/marketSimulation.ts)
 * rather than Math.random(), and honestly labelled, never presented as live.
 */
export const moneyPennyMarketConsoleProvider: SmartTriadMediaProvider = {
  id: 'moneypenny.market-console',
  label: 'MoneyPenny — market console atomic surfaces (edge, inventory, market status capsule)',
  matches: (message, groundContext) =>
    groundContext?.cartridge === 'moneypenny' &&
    (EDGE_TRIGGER.test(message) || INVENTORY_TRIGGER.test(message) || MARKET_CONSOLE_TRIGGER.test(message)),
  resolve: async (_supabase, message) => {
    if (EDGE_TRIGGER.test(message)) return [edgeGaugeEnvelope()];
    if (INVENTORY_TRIGGER.test(message)) return [inventoryGaugeEnvelope()];
    return [marketStatusCapsuleEnvelope()];
  },
};

const FS_LESSON_VIDEO_TRIGGER = /(financial sovereignty|discover) (lesson |intro )?video/i;
const FS_LESSON_REQUEST = /(show|watch|play|see|view|open)/i;

/**
 * A genuinely SEPARATE, non-MoneyPenny provider — proves the abstraction is
 * cartridge/journey-scoped, not a MoneyPenny-only mechanism wearing a new
 * interface. Scoped to the journey-runtime surface (groundContext.surface,
 * set by components/journey/JourneyCopilotHost.tsx for every journey
 * mount) rather than a `cartridge` id, since Financial Sovereignty is a
 * bridge/journey experience, not a codex cartridge — a real, distinct
 * scoping dimension the groundContext contract already carries.
 *
 * Reuses `FS_PLACEHOLDER_VIDEO_URL` — a genuine, already-published, verified
 * Studio asset already serving production traffic across the Financial
 * Sovereignty bridge lesson stages (services/journey/fsPlaceholderVideo.ts).
 * Never a fabricated or test-only URL, per this capability's own
 * non-fabrication rule.
 */
export const financialSovereigntyLessonVideoProvider: SmartTriadMediaProvider = {
  id: 'financial-sovereignty.lesson-video',
  label: 'Financial Sovereignty — bridge lesson video',
  matches: (message, groundContext) =>
    groundContext?.surface === 'journey-runtime' && FS_LESSON_VIDEO_TRIGGER.test(message) && FS_LESSON_REQUEST.test(message),
  resolve: async () => {
    const envelope = normalizeLegacyVideoV0({
      schema_version: 'smarttriad.media.video.v0',
      url: FS_PLACEHOLDER_VIDEO_URL,
      posterUrl: FS_PLACEHOLDER_VIDEO_POSTER_URL,
      title: 'Financial Sovereignty — lesson video (placeholder, verified Studio asset)',
      relatedChip: { label: 'Open Financial Sovereignty', cartridgeId: 'metame-codex', tab: 'aigent-me' },
    });
    return envelope ? [envelope] : [];
  },
};

/** Registered providers, checked in order — first match wins, mirroring the
 *  single-short-circuit behavior the prior inline branch had. A cartridge
 *  adds its own provider here (or via a future dynamic-registration seam,
 *  not built speculatively here) rather than editing the central route. */
export const SMARTTRIAD_MEDIA_PROVIDERS: SmartTriadMediaProvider[] = [
  moneyPennyLearnVideoProvider,
  moneyPennyMarketConsoleProvider,
  financialSovereigntyLessonVideoProvider,
];

export interface SmartTriadMediaResolution {
  /** Whether a provider's trigger matched at all — distinguishes "nothing
   *  registered wants this request" (route falls through to the ordinary
   *  LLM pipeline) from "a provider owns this request but has nothing
   *  published yet" (route still short-circuits with an honest, deterministic
   *  message — never lets the LLM guess/fabricate media it can't verify). */
  matched: boolean;
  providerId?: string;
  blocks: SmartTriadRichBlockEnvelope[];
}

/**
 * The ONE call app/api/codex/chat/route.ts makes — no cartridge-specific
 * branch remains in the central route.
 */
export async function resolveSmartTriadMedia(
  supabase: SupabaseClient,
  message: string,
  groundContext: Record<string, unknown> | undefined,
): Promise<SmartTriadMediaResolution> {
  const provider = SMARTTRIAD_MEDIA_PROVIDERS.find((p) => p.matches(message, groundContext));
  if (!provider) return { matched: false, blocks: [] };
  const blocks = await provider.resolve(supabase, message, groundContext);
  return { matched: true, providerId: provider.id, blocks };
}
