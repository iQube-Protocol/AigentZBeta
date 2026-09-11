/**
 * marketSimulation — the ONE deterministic, seeded source of MoneyPenny's
 * simulated market-console values (edge, inventory, capture history).
 *
 * 2026-09-04 "atomic, capsule-composable surfaces" ruling (harvesting
 * MoneyPenny002's live-console UI): "A disclosed simulation may generate
 * synthetic values only through one deterministic, seeded simulation
 * service. Do not call Math.random() inside React components or API
 * routes." This module is that one service.
 *
 * It replaces the `Math.random()` calls previously scattered across
 * `app/(shell)/moneypenny/components/HFTConsole.tsx` and
 * `app/api/moneypenny/quotes/route.ts` (both confirmed by direct read,
 * 2026-09-04) — same visual behaviour (values still move, still look
 * "live"), but now reproducible from a seed instead of true randomness, and
 * every value ships with an explicit `SmartTriadSourceDescriptor` of class
 * `'simulation'` rather than being presented with no provenance at all.
 *
 * There is NO real market-data provider for MoneyPenny's cross-chain Q¢
 * arbitrage edge today — confirmed by
 * `codexes/packs/agentiq/updates/2026-09-02_mpy2-0b-moneypenny002-real-source-audit.md`
 * §3: MoneyPenny002's one genuine real market call (CoinGecko BTC/ETH/SOL
 * spot price) prices a DIFFERENT asset than Q¢ and would be a fabricated
 * mapping if substituted in. Simulation therefore remains the honest state
 * until a real Q¢-denominated feed exists (tracked separately as MPY2-4,
 * not started, not claimed done here) — this module only makes today's
 * simulation reproducible and honestly labelled, it does not invent a live
 * provider that does not exist.
 */

import type { SmartTriadSourceDescriptor } from '@/types/smarttriad/richBlocks';

/** mulberry32 — a small, fast, deterministic PRNG. Given the same seed it
 *  produces the same sequence forever; this is what "seeded" means here,
 *  as opposed to `Math.random()`'s non-reproducible entropy source. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable, deterministic hash of a string seed into a 32-bit int — so
 *  callers can seed with a meaningful string (e.g. a chain id + time
 *  bucket) rather than memorizing numeric seeds. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const SIMULATION_SOURCE_LABEL = 'MoneyPenny deterministic simulation adapter';

export function simulationSource(observedAt?: string): SmartTriadSourceDescriptor {
  return { class: 'simulation', label: SIMULATION_SOURCE_LABEL, observedAt };
}

/**
 * Buckets wall-clock time into a fixed window so repeated calls within the
 * same window return the SAME simulated value (a real read is idempotent
 * within its refresh interval) while still advancing over time — this is
 * what lets the surface look "live" (values change) without using
 * non-reproducible randomness. `bucketMs` defaults to 1s, matching the
 * donor's own `setInterval(…, 1000)` cadence.
 */
export function timeBucket(nowMs: number = Date.now(), bucketMs = 1000): number {
  return Math.floor(nowMs / bucketMs);
}

export interface SimulatedQuote {
  chain: string;
  edgeBps: number;
  floorBps: number;
  priceUsdc: number;
  qtyQc: number;
}

const AVAILABLE_CHAINS = ['ethereum', 'arbitrum', 'base', 'polygon', 'optimism'] as const;

/** Deterministic per-chain quote for a given time bucket — same
 *  (chain, bucket) always yields the same quote. */
export function simulateQuote(chain: string, bucket: number): SimulatedQuote {
  const rng = mulberry32(hashSeed(`quote:${chain}:${bucket}`));
  return {
    chain,
    edgeBps: rng() * 50 - 25,
    floorBps: rng() * 10 - 5,
    priceUsdc: 0.01 + rng() * 0.002,
    qtyQc: rng() * 10000,
  };
}

export function simulateQuotesForChains(chains: string[] = [...AVAILABLE_CHAINS], nowMs?: number): SimulatedQuote[] {
  const bucket = timeBucket(nowMs);
  return chains.map((chain) => simulateQuote(chain, bucket));
}

/** The chain rotation `market.quotes`/`market.fills` snapshots and the live
 *  session controller both draw from — one list, not two. */
export function marketSimulationChains(): string[] {
  return [...AVAILABLE_CHAINS];
}

export interface SimulatedFill {
  side: 'BUY' | 'SELL';
  chain: string;
  qtyQc: number;
  priceUsdc: number;
  captureBps: number;
}

/** A fill is derived from its OWN bucket's quote — never a second,
 *  independent random draw — so "did this quote fill" and "what filled" stay
 *  reproducible together. Matches the donor's qualitative behaviour (a
 *  wide-enough edge triggers a fill) without a second RNG call. */
export function simulateFillFromQuote(quote: SimulatedQuote): SimulatedFill {
  return {
    side: quote.edgeBps >= 0 ? 'BUY' : 'SELL',
    chain: quote.chain,
    qtyQc: quote.qtyQc * 0.5,
    priceUsdc: quote.priceUsdc,
    captureBps: quote.edgeBps * 0.4,
  };
}

/** Whether a given quote is wide enough to have "filled" — the one
 *  deterministic threshold both the live controller and any one-shot
 *  snapshot builder must share, so their fill-rate looks the same. */
export function quoteFills(quote: SimulatedQuote): boolean {
  return Math.abs(quote.edgeBps) > 15;
}

/**
 * A recent-quotes snapshot for a point-in-time chat reply (e.g. "show me
 * the market"). Walks backward from the current bucket across the chain
 * rotation — reproducible for a given `nowMs`, distinct from
 * `simulateQuotesForChains` (one quote per chain, same bucket) which the
 * live gauges use.
 */
export function simulateRecentQuotes(count = 8, nowMs: number = Date.now()): SimulatedQuote[] {
  const bucket = timeBucket(nowMs);
  const chains = marketSimulationChains();
  const out: SimulatedQuote[] = [];
  for (let i = 0; i < count; i++) {
    const b = bucket - i;
    out.push(simulateQuote(chains[b % chains.length] ?? chains[0], b));
  }
  return out;
}

/** A recent-fills snapshot — every returned entry is a genuine fill (per
 *  `quoteFills`) drawn from consecutive buckets, walking back until `count`
 *  fills are found or a bucket budget is exhausted (avoids an unbounded
 *  loop when the deterministic sequence happens to produce a long dry
 *  spell). */
export function simulateRecentFills(count = 6, nowMs: number = Date.now()): SimulatedFill[] {
  const bucket = timeBucket(nowMs);
  const chains = marketSimulationChains();
  const out: SimulatedFill[] = [];
  const maxLookback = count * 20;
  for (let i = 0; i < maxLookback && out.length < count; i++) {
    const b = bucket - i;
    const q = simulateQuote(chains[b % chains.length] ?? chains[0], b);
    if (quoteFills(q)) out.push(simulateFillFromQuote(q));
  }
  return out;
}

export interface SimulatedPerformance {
  accumulatedQc: number;
  lastCaptureBps: number;
  avgCaptureBps: number;
  recentCaptureBps: number[];
}

/** A performance snapshot derived from the SAME deterministic capture
 *  history every history surface reads — one number set, not two competing
 *  "accumulated Q¢" figures. */
export function simulatePerformanceSnapshot(nowMs: number = Date.now()): SimulatedPerformance {
  const points = simulateCaptureHistory(30, 20 * 60 * 1000, nowMs);
  const captures = points.map((p) => p.captureBps);
  const avgCaptureBps = captures.reduce((sum, c) => sum + c, 0) / captures.length;
  const lastCaptureBps = captures[captures.length - 1] ?? 0;
  // A deterministic Q¢ accrual figure derived from the same series — never
  // a hardcoded fallback constant (the donor's `1247.83`).
  const accumulatedQc = captures.reduce((sum, c) => sum + Math.max(0, c) * 4.17, 0);
  return { accumulatedQc, lastCaptureBps, avgCaptureBps, recentCaptureBps: captures };
}

export interface SimulatedEdge {
  floorBps: number;
  minEdgeBps: number;
  liveEdgeBps: number;
}

/** Deterministic edge-gauge reading for one time bucket. `floorBps`/
 *  `minEdgeBps` are stable policy-style markers (not re-randomized every
 *  tick, matching the donor's own EdgeGauge usage where these are operator
 *  thresholds, not live-varying numbers); only the observed edge moves. */
export function simulateEdge(nowMs?: number): SimulatedEdge {
  const bucket = timeBucket(nowMs);
  const rng = mulberry32(hashSeed(`edge:${bucket}`));
  return {
    floorBps: 0.5,
    minEdgeBps: 1.0,
    liveEdgeBps: Math.max(0, rng() * 4),
  };
}

export interface SimulatedInventory {
  inventoryMin: number;
  inventoryMax: number;
  currentInventory: number;
  workingQc: number;
}

/** Deterministic inventory-gauge reading. Walks a stable band rather than
 *  jumping fully randomly each tick, mirroring the donor's fill-accumulation
 *  behaviour (inventory drifts, it doesn't teleport). */
export function simulateInventory(nowMs?: number): SimulatedInventory {
  const bucket = timeBucket(nowMs);
  const rng = mulberry32(hashSeed(`inventory:${bucket}`));
  const inventoryMin = 0;
  const inventoryMax = 10000;
  const midpoint = (inventoryMin + inventoryMax) / 2;
  const drift = (rng() - 0.5) * (inventoryMax - inventoryMin) * 0.3;
  const currentInventory = Math.min(inventoryMax, Math.max(inventoryMin, midpoint + drift));
  const workingQc = Math.min(inventoryMax, Math.max(inventoryMin, currentInventory + (rng() - 0.5) * 500));
  return { inventoryMin, inventoryMax, currentInventory, workingQc };
}

export interface SimulatedCapturePoint {
  timestamp: string;
  captureBps: number;
}

/** Deterministic capture-history series for the last `points` buckets —
 *  replaces the donor CaptureSparkline's sine+Math.random fallback AND its
 *  hardcoded `1247.83` total; this module has no equivalent fallback
 *  constant. A caller with no real execution history gets this honestly
 *  simulation-labelled series, never a fabricated "looks real" number. */
export function simulateCaptureHistory(points = 30, bucketMs = 20 * 60 * 1000, nowMs: number = Date.now()): SimulatedCapturePoint[] {
  const out: SimulatedCapturePoint[] = [];
  for (let i = 0; i < points; i++) {
    const bucketTime = nowMs - (points - 1 - i) * bucketMs;
    const rng = mulberry32(hashSeed(`capture:${Math.floor(bucketTime / bucketMs)}`));
    const captureBps = Math.max(-5, Math.min(20, 12 + (rng() - 0.5) * 16));
    out.push({ timestamp: new Date(bucketTime).toISOString(), captureBps });
  }
  return out;
}
