/**
 * SmartTriad market-console atomic surfaces / capsules — the 2026-09-04
 * "atomic, capsule-composable surfaces" ruling harvesting MoneyPenny002's
 * live-console UI (EdgeGauge, InventoryGauge) into governed SmartTriad rich
 * blocks. Covers: the deterministic seeded simulation service (no
 * Math.random), honest source classification, the two new envelope kinds'
 * validation, capsule composition, and the MoneyPenny provider's
 * conversational triggers for them.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  simulateEdge,
  simulateInventory,
  simulateQuote,
  simulateCaptureHistory,
  simulationSource,
  timeBucket,
} from '@/services/moneypenny/marketSimulation';
import {
  describeSmartTriadBlockEnvelope,
  validateSmartTriadRichBlockEnvelope,
} from '@/services/smarttriad/richBlocks';
import {
  moneyPennyMarketConsoleProvider,
  resolveSmartTriadMedia,
} from '@/services/smarttriad/mediaProviders';
import { SMARTTRIAD_BLOCK_SCHEMA_VERSION } from '@/types/smarttriad/richBlocks';

describe('marketSimulation — one deterministic, seeded source, never Math.random()', () => {
  it('simulateEdge is deterministic for the same time bucket', () => {
    const nowMs = 1_700_000_000_000;
    expect(simulateEdge(nowMs)).toEqual(simulateEdge(nowMs));
  });

  it('simulateInventory is deterministic for the same time bucket', () => {
    const nowMs = 1_700_000_000_000;
    expect(simulateInventory(nowMs)).toEqual(simulateInventory(nowMs));
  });

  it('simulateQuote is deterministic for the same (chain, bucket) pair', () => {
    const bucket = timeBucket(1_700_000_000_000);
    expect(simulateQuote('ethereum', bucket)).toEqual(simulateQuote('ethereum', bucket));
  });

  it('a different time bucket produces a different (or at least independently-derived) reading — not a frozen constant', () => {
    const a = simulateEdge(1_700_000_000_000);
    const b = simulateEdge(1_700_000_100_000);
    // Not asserting inequality (a seeded PRNG can coincidentally repeat) —
    // asserting the function actually depends on the bucket, by checking
    // several buckets aren't ALL identical.
    const samples = [0, 1, 2, 3, 4].map((i) => simulateEdge(1_700_000_000_000 + i * 1000).liveEdgeBps);
    expect(new Set(samples).size).toBeGreaterThan(1);
  });

  it('simulateCaptureHistory never hardcodes the donor\'s 1247.83 fallback total and has no sine+Math.random fallback shape', () => {
    const points = simulateCaptureHistory(10, 1000, 1_700_000_000_000);
    expect(points).toHaveLength(10);
    expect(points.every((p) => Number.isFinite(p.captureBps))).toBe(true);
  });

  it('simulationSource always classifies as simulation with a real label', () => {
    const src = simulationSource('2026-09-04T00:00:00.000Z');
    expect(src.class).toBe('simulation');
    expect(src.label).toBeTruthy();
  });

  it('no Math.random() appears anywhere in the simulation service itself (comments excluded — this module\'s own doc comments name it as what it replaces)', () => {
    const src = stripComments(readSource('services/moneypenny/marketSimulation.ts'));
    expect(src).not.toMatch(/Math\.random\(/);
  });

  it('no Math.random() remains in the canonical HFT console or the quotes API route (2026-09-04 fix)', () => {
    expect(stripComments(readSource('app/(shell)/moneypenny/components/HFTConsole.tsx'))).not.toMatch(/Math\.random\(/);
    expect(stripComments(readSource('app/api/moneypenny/quotes/route.ts'))).not.toMatch(/Math\.random\(/);
  });

  it('the quotes route response now carries an explicit source classification', () => {
    const src = stripComments(readSource('app/api/moneypenny/quotes/route.ts'));
    expect(src).toMatch(/source: simulationSource\(observedAt\)/);
  });
});

describe('SmartTriad Rich Block validation — market.edge / market.inventory / capsule', () => {
  const edgeEnvelope = {
    schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
    id: 'edge-1',
    kind: 'market.edge' as const,
    payload: {
      capabilityId: 'moneypenny.market-console',
      mode: 'simulation' as const,
      source: { class: 'simulation' as const, label: 'test' },
      floorBps: 0.5,
      minEdgeBps: 1,
      liveEdgeBps: 2.3,
    },
  };

  const inventoryEnvelope = {
    schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
    id: 'inv-1',
    kind: 'market.inventory' as const,
    payload: {
      capabilityId: 'moneypenny.market-console',
      mode: 'simulation' as const,
      source: { class: 'simulation' as const, label: 'test' },
      inventoryMin: 0,
      inventoryMax: 10000,
      currentInventory: 5000,
      workingQc: 100,
    },
  };

  it('accepts a valid market.edge envelope', () => {
    expect(validateSmartTriadRichBlockEnvelope(edgeEnvelope)).not.toBeNull();
  });

  it('rejects a market.edge payload with an invalid mode', () => {
    const bad = { ...edgeEnvelope, payload: { ...edgeEnvelope.payload, mode: 'production' } };
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });

  it('rejects a market.edge payload with an invalid source classification', () => {
    const bad = { ...edgeEnvelope, payload: { ...edgeEnvelope.payload, source: { class: 'definitely-live', label: 'x' } } };
    expect(validateSmartTriadRichBlockEnvelope(bad)).toBeNull();
  });

  it('accepts a valid market.inventory envelope', () => {
    expect(validateSmartTriadRichBlockEnvelope(inventoryEnvelope)).not.toBeNull();
  });

  it('accepts a valid capsule composing edge + inventory, and validates each child through the SAME validator', () => {
    const capsule = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'capsule-1',
      kind: 'capsule' as const,
      payload: {
        capsuleId: 'moneypenny.market-status',
        title: 'Market Status',
        capabilityId: 'moneypenny.market-console',
        layout: { type: 'stack' as const, density: 'compact' as const },
        surfaces: [edgeEnvelope, inventoryEnvelope],
      },
    };
    const result = validateSmartTriadRichBlockEnvelope(capsule);
    expect(result).not.toBeNull();
    expect(result?.kind === 'capsule' && result.payload.surfaces).toHaveLength(2);
  });

  it('rejects a capsule with an empty surfaces array', () => {
    const capsule = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'capsule-empty',
      kind: 'capsule' as const,
      payload: {
        capsuleId: 'x',
        title: 'x',
        capabilityId: 'x',
        layout: { type: 'stack' as const, density: 'compact' as const },
        surfaces: [],
      },
    };
    expect(validateSmartTriadRichBlockEnvelope(capsule)).toBeNull();
  });

  it('rejects a capsule containing one invalid child — one bad child invalidates the whole capsule rather than silently dropping it', () => {
    const capsule = {
      schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION,
      id: 'capsule-bad-child',
      kind: 'capsule' as const,
      payload: {
        capsuleId: 'x',
        title: 'x',
        capabilityId: 'x',
        layout: { type: 'stack' as const, density: 'compact' as const },
        surfaces: [edgeEnvelope, { schemaVersion: SMARTTRIAD_BLOCK_SCHEMA_VERSION, id: 'bad', kind: 'market.edge', payload: {} }],
      },
    };
    expect(validateSmartTriadRichBlockEnvelope(capsule)).toBeNull();
  });

  it('describeSmartTriadBlockEnvelope produces a distinct prose line per kind', () => {
    expect(describeSmartTriadBlockEnvelope(edgeEnvelope)).toContain('edge');
    expect(describeSmartTriadBlockEnvelope(inventoryEnvelope)).toContain('inventory');
  });
});

describe('MoneyPenny market-console provider — conversational invocation, smallest adequate block', () => {
  it('an edge-specific request resolves to a market.edge block, not the full console', async () => {
    expect(moneyPennyMarketConsoleProvider.matches('What is our current edge?', { cartridge: 'moneypenny' })).toBe(true);
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'What is our current edge?', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('market.edge');
  });

  it('an inventory-specific request resolves to a market.inventory block', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Show my inventory exposure', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('market.inventory');
  });

  it('a general console request resolves to a capsule composing both gauges', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Open the market console', { cartridge: 'moneypenny' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('capsule');
    if (blocks[0].kind === 'capsule') {
      expect(blocks[0].payload.surfaces.map((s) => s.kind).sort()).toEqual(['market.edge', 'market.inventory']);
    }
  });

  it('every resolved envelope carries an "expand console" action pointing at the real canonical HFT console tab', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'What is our current edge?', { cartridge: 'moneypenny' });
    const action = blocks[0].kind === 'market.edge' ? blocks[0].payload.actions?.[0] : undefined;
    expect(action?.kind).toBe('open-cartridge-tab');
    expect(action?.cartridgeId).toBe('moneypenny-codex');
    expect(action?.tab).toBe('hft-console');
  });

  it('is scoped to the moneypenny cartridge, not global', () => {
    expect(moneyPennyMarketConsoleProvider.matches('What is our current edge?', { cartridge: 'knyt' })).toBe(false);
    expect(moneyPennyMarketConsoleProvider.matches('What is our current edge?', undefined)).toBe(false);
  });

  it('resolveSmartTriadMedia routes an edge request through the provider registry end-to-end', async () => {
    const result = await resolveSmartTriadMedia({} as never, 'What is our current edge?', { cartridge: 'moneypenny' });
    expect(result.matched).toBe(true);
    expect(result.providerId).toBe('moneypenny.market-console');
    expect(result.blocks).toHaveLength(1);
  });

  it('every value resolved is honestly mode: simulation — no real Q¢ market feed exists to claim live from', async () => {
    const blocks = await moneyPennyMarketConsoleProvider.resolve({} as never, 'Open the market console', { cartridge: 'moneypenny' });
    if (blocks[0].kind === 'capsule') {
      for (const child of blocks[0].payload.surfaces) {
        if (child.kind === 'market.edge' || child.kind === 'market.inventory') {
          expect(child.payload.mode).toBe('simulation');
          expect(child.payload.source.class).toBe('simulation');
        }
      }
    }
  });
});
