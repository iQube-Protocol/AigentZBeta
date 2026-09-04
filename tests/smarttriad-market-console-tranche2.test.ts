/**
 * SmartTriad market-console tranche 2 (2026-09-04) — quotes/fills/
 * performance/history atomic surfaces, the shared market-session
 * controller, and the live-capsule wiring in
 * SmartTriadRichBlockRenderer.tsx.
 *
 * The controller tests are BEHAVIORAL (call the real subscribe/getSnapshot/
 * restart functions with fake timers), not source-text canaries — this is
 * the only way to actually prove "one controller, no duplicate stream,
 * state survives a subscribe/unsubscribe transition" rather than merely
 * asserting the code LOOKS like it should do that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  __resetMarketSessionForTests,
  getMarketSessionSnapshot,
  restartMarketSession,
  subscribeMarketSession,
} from '@/services/moneypenny/marketSessionController';
import {
  simulateFillFromQuote,
  simulatePerformanceSnapshot,
  simulateRecentFills,
  simulateRecentQuotes,
  quoteFills,
} from '@/services/moneypenny/marketSimulation';
import { validateSmartTriadRichBlockEnvelope } from '@/services/smarttriad/richBlocks';
import { moneyPennyMarketConsoleProvider } from '@/services/smarttriad/mediaProviders';
import { SMARTTRIAD_BLOCK_SCHEMA_VERSION } from '@/types/smarttriad/richBlocks';

describe('marketSessionController — one shared session, no duplicate streams, no reset on transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetMarketSessionForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is disconnected with no subscribers, and connects on the first subscribe', () => {
    expect(getMarketSessionSnapshot().connected).toBe(false);
    const unsub = subscribeMarketSession(() => {});
    expect(getMarketSessionSnapshot().connected).toBe(true);
    unsub();
  });

  it('two simultaneous subscribers read the IDENTICAL session object — one controller, not two', () => {
    const unsub1 = subscribeMarketSession(() => {});
    const a = getMarketSessionSnapshot();
    const unsub2 = subscribeMarketSession(() => {});
    const b = getMarketSessionSnapshot();
    expect(a).toBe(b);
    unsub1();
    unsub2();
  });

  it('exactly one tick loop runs regardless of subscriber count — N subscribers get N notifications per tick, not N*N', () => {
    let notifications = 0;
    const unsub1 = subscribeMarketSession(() => notifications++);
    const unsub2 = subscribeMarketSession(() => notifications++);
    const unsub3 = subscribeMarketSession(() => notifications++);
    vi.advanceTimersByTime(1000);
    expect(notifications).toBe(3);
    unsub1();
    unsub2();
    unsub3();
  });

  it('the last unsubscribe stops ticking (closes the stream) but state is preserved, not reset', () => {
    const unsub = subscribeMarketSession(() => {});
    vi.advanceTimersByTime(4000);
    const beforeUnsub = getMarketSessionSnapshot();
    unsub();
    const afterUnsub = getMarketSessionSnapshot();
    expect(afterUnsub.connected).toBe(false);
    expect(afterUnsub.quotes).toEqual(beforeUnsub.quotes);
    expect(afterUnsub.fills).toEqual(beforeUnsub.fills);
    expect(afterUnsub.generation).toBe(beforeUnsub.generation);
  });

  it('a fresh subscribe after a zero-subscriber gap resumes the SAME state — proves compact→expanded→panel transitions never start a second stream or lose state', () => {
    const unsub1 = subscribeMarketSession(() => {});
    vi.advanceTimersByTime(4000);
    const before = getMarketSessionSnapshot();
    unsub1();
    // Simulates e.g. an inline capsule unmounting while an expanded modal
    // mounts in its place — a brief zero-subscriber gap, not a reset.
    const unsub2 = subscribeMarketSession(() => {});
    expect(getMarketSessionSnapshot().quotes).toEqual(before.quotes);
    expect(getMarketSessionSnapshot().accumulatedQc).toBe(before.accumulatedQc);
    expect(getMarketSessionSnapshot().generation).toBe(before.generation);
    unsub2();
  });

  it('restartMarketSession() is the ONLY thing that resets ring buffers and bumps generation', () => {
    const unsub = subscribeMarketSession(() => {});
    vi.advanceTimersByTime(6000);
    const before = getMarketSessionSnapshot();
    restartMarketSession();
    const after = getMarketSessionSnapshot();
    expect(after.generation).toBe(before.generation + 1);
    expect(after.quotes).toEqual([]);
    expect(after.fills).toEqual([]);
    unsub();
  });

  it('restarting while still subscribed keeps the session connected and ticking (no orphaned interval)', () => {
    const unsub = subscribeMarketSession(() => {});
    restartMarketSession();
    expect(getMarketSessionSnapshot().connected).toBe(true);
    let ticked = false;
    const unsub2 = subscribeMarketSession(() => {
      ticked = true;
    });
    vi.advanceTimersByTime(1000);
    expect(ticked).toBe(true);
    unsub();
    unsub2();
  });
});

describe('marketSimulation — fill/quote/performance snapshot helpers, no Math.random()', () => {
  it('simulateFillFromQuote derives every field from the quote — no independent random draw', () => {
    const quote = { chain: 'ethereum', edgeBps: 20, floorBps: 1, priceUsdc: 0.011, qtyQc: 5000 };
    const fill = simulateFillFromQuote(quote);
    expect(fill.side).toBe('BUY');
    expect(fill.chain).toBe(quote.chain);
    expect(fill.priceUsdc).toBe(quote.priceUsdc);
  });

  it('quoteFills is a pure threshold on edgeBps magnitude', () => {
    expect(quoteFills({ chain: 'x', edgeBps: 20, floorBps: 0, priceUsdc: 0, qtyQc: 0 })).toBe(true);
    expect(quoteFills({ chain: 'x', edgeBps: 2, floorBps: 0, priceUsdc: 0, qtyQc: 0 })).toBe(false);
  });

  it('simulateRecentQuotes/simulateRecentFills are deterministic for the same nowMs', () => {
    const nowMs = 1_700_000_000_000;
    expect(simulateRecentQuotes(5, nowMs)).toEqual(simulateRecentQuotes(5, nowMs));
    expect(simulateRecentFills(3, nowMs)).toEqual(simulateRecentFills(3, nowMs));
  });

  it('simulatePerformanceSnapshot never hardcodes the donor 1247.83 fallback and derives from the same capture series it reports', () => {
    const perf = simulatePerformanceSnapshot(1_700_000_000_000);
    expect(perf.accumulatedQc).not.toBeCloseTo(1247.83, 1);
    expect(perf.recentCaptureBps.length).toBeGreaterThan(0);
    expect(perf.lastCaptureBps).toBe(perf.recentCaptureBps[perf.recentCaptureBps.length - 1]);
  });

  it('no Math.random() anywhere in marketSimulation.ts or marketSessionController.ts', () => {
    expect(stripComments(readSource('services/moneypenny/marketSimulation.ts'))).not.toMatch(/Math\.random\(/);
    expect(stripComments(readSource('services/moneypenny/marketSessionController.ts'))).not.toMatch(/Math\.random\(/);
  });
});

function baseGaugePayload() {
  return { capabilityId: 'moneypenny.market-console', mode: 'simulation' as const, source: { class: 'simulation' as const, label: 'x' } };
}

describe('SmartTriad Rich Block validation — market.quotes / market.fills / market.performance / market.history', () => {
  it('accepts a valid market.quotes envelope', () => {
    const envelope = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'q-1',
      kind: 'market.quotes' as const,
      payload: { ...baseGaugePayload(), quotes: [{ chain: 'ethereum', edgeBps: 1, priceUsdc: 0.01, qtyQc: 100, timestamp: '2026-09-04T00:00:00.000Z' }] },
    };
    expect(validateSmartTriadRichBlockEnvelope(envelope)).not.toBeNull();
  });

  it('rejects a market.quotes payload whose quotes array contains a malformed row', () => {
    const envelope = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'q-2',
      kind: 'market.quotes' as const,
      payload: { ...baseGaugePayload(), quotes: [{ chain: 'ethereum' }] },
    };
    expect(validateSmartTriadRichBlockEnvelope(envelope)).toBeNull();
  });

  it('accepts a valid market.fills envelope and rejects an invalid side', () => {
    const good = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'f-1',
      kind: 'market.fills' as const,
      payload: {
        ...baseGaugePayload(),
        fills: [{ side: 'BUY' as const, chain: 'base', qtyQc: 10, priceUsdc: 0.01, captureBps: 2, timestamp: '2026-09-04T00:00:00.000Z' }],
      },
    };
    expect(validateSmartTriadRichBlockEnvelope(good)).not.toBeNull();
    const bad = { ...good, id: 'f-2', payload: { ...good.payload, fills: [{ ...good.payload.fills[0], side: 'HOLD' }] } };
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });

  it('accepts a valid market.performance envelope', () => {
    const envelope = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'p-1',
      kind: 'market.performance' as const,
      payload: { ...baseGaugePayload(), accumulatedQc: 10, lastCaptureBps: 1, avgCaptureBps: 2, recentCaptureBps: [1, 2, 3] },
    };
    expect(validateSmartTriadRichBlockEnvelope(envelope)).not.toBeNull();
  });

  it('accepts a valid market.history envelope and rejects a malformed point', () => {
    const good = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'h-1',
      kind: 'market.history' as const,
      payload: { ...baseGaugePayload(), points: [{ timestamp: '2026-09-04T00:00:00.000Z', captureBps: 1 }] },
    };
    expect(validateSmartTriadRichBlockEnvelope(good)).not.toBeNull();
    const bad = { ...good, id: 'h-2', payload: { ...good.payload, points: [{ timestamp: 1, captureBps: 'x' }] } };
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });
});

describe('MoneyPenny market-console provider — fills/performance/quotes conversational triggers', () => {
  it('"Show recent fills" resolves to a market.fills block, not the full console', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Show recent fills', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('market.fills');
  });

  it('"How is the strategy performing?" resolves to a market.performance block, not the full console', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'How is the strategy performing?', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('market.performance');
  });

  it('"Show me the live quotes" resolves to a market.quotes block', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Show me the live quotes', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('market.quotes');
  });

  it('"Show me quotes, spread and liquidity" still resolves to the full market-status capsule, per the operator\'s own example mapping', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Show me quotes, spread and liquidity', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('capsule');
  });

  it('the market-status capsule now composes 5 surfaces (edge, inventory, performance, quotes, fills)', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Open the market console', { cartridge: 'moneypenny' });
    expect(blocks[0].kind).toBe('capsule');
    if (blocks[0].kind === 'capsule') {
      expect(blocks[0].payload.surfaces.map((s) => s.kind).sort()).toEqual(
        ['market.edge', 'market.fills', 'market.inventory', 'market.performance', 'market.quotes'].sort(),
      );
    }
  });
});

describe('SmartTriadRichBlockRenderer.tsx — the market-status capsule mounts the LIVE, shared-session component', () => {
  const src = stripComments(readSource('components/smarttriad/richblocks/SmartTriadRichBlockRenderer.tsx'));

  it('registers moneypenny.market-status against the live MarketConsoleCapsule component', () => {
    expect(src).toMatch(/'moneypenny\.market-status':\s*MarketConsoleCapsule/);
  });

  it('imports the four new atomic surface components and the live capsule, dispatching each new kind', () => {
    expect(src).toMatch(/import \{ QuotesSurface \}/);
    expect(src).toMatch(/import \{ FillsSurface \}/);
    expect(src).toMatch(/import \{ PerformanceSurface \}/);
    expect(src).toMatch(/import \{ HistorySurface \}/);
    expect(src).toMatch(/case 'market\.quotes':/);
    expect(src).toMatch(/case 'market\.fills':/);
    expect(src).toMatch(/case 'market\.performance':/);
    expect(src).toMatch(/case 'market\.history':/);
  });
});

describe('HFTConsole.tsx — reconstituted around the shared session controller, no local Math.random or duplicate state', () => {
  const src = stripComments(readSource('app/(shell)/moneypenny/components/HFTConsole.tsx'));

  it('mounts MarketConsoleCapsule instead of owning its own quote/execution state', () => {
    expect(src).toMatch(/import \{ MarketConsoleCapsule \} from "@\/components\/smarttriad\/surfaces\/MarketConsoleCapsule"/);
    expect(src).toMatch(/<MarketConsoleCapsule initialPresentation="panel" hideToggle \/>/);
  });

  it('no longer defines its own QuoteData/ExecutionData local simulation state', () => {
    expect(src).not.toMatch(/interface QuoteData/);
    expect(src).not.toMatch(/interface ExecutionData/);
    expect(src).not.toMatch(/setInterval/);
  });

  it('no Math.random() anywhere in this file', () => {
    expect(src).not.toMatch(/Math\.random\(/);
  });
});
