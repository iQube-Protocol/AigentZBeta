import { describe, expect, it, vi } from 'vitest';
import { callTool, HANDSHAKE_TOOLS, listTools, type GatewayContext } from '../services/threshold/gateway';
import { makeIrlAdapter } from '../services/threshold/irlAdapter';
import { agentDiscoveryManifest } from '../services/threshold/agentManifest';
import { makePublicKnowledgeAdapter } from '../services/threshold/publicKnowledge';

const TOOL_NAMES = [
  'list_invariants',
  'get_invariant',
  'search_invariants',
  'list_invariants_for_experiment',
  'get_invariant_lineage',
];

describe('Threshold invariant registry discovery', () => {
  it('advertises all registry reads as public tools', () => {
    const names = listTools().map((tool) => tool.name);
    for (const name of TOOL_NAMES) {
      expect(names).toContain(name);
      expect(HANDSHAKE_TOOLS.has(name)).toBe(false);
    }
  });

  it('reports the canonical registry as available in both root and capability discovery', () => {
    const irlComponent = agentDiscoveryManifest().components.find((component) => component.id === 'irl-os');
    expect(irlComponent?.mcpExposure).toBe('available-now');
    expect(irlComponent?.mcpRoutes).toEqual(expect.arrayContaining(TOOL_NAMES));
    const capabilities = makePublicKnowledgeAdapter({ origin: 'https://example.test' }).listCapabilities('irl-os')[0].capabilities;
    expect(capabilities).toContainEqual(expect.objectContaining({ name: 'Canonical invariant registry', status: 'live' }));
  });

  it('dispatches through the existing IRL adapter without a crossing', async () => {
    const irl = {
      listInvariants: vi.fn().mockResolvedValue({ ok: true, total: 1 }),
      getInvariant: vi.fn().mockResolvedValue({ ok: true, invariant: { seedId: 'inv.constitutional.018' } }),
      searchInvariants: vi.fn().mockResolvedValue({ ok: true, searchMode: 'keyword' }),
      listInvariantsForExperiment: vi.fn().mockResolvedValue({ ok: true, experimentId: 'EXP-P1' }),
      getInvariantLineage: vi.fn().mockResolvedValue({ ok: true, lineageScope: 'bounded' }),
    } as unknown as NonNullable<GatewayContext['irl']>;
    const ctx: GatewayContext = { origin: 'https://example.test', gatewayUrl: 'https://example.test/api/threshold/mcp', irl };

    await callTool('list_invariants', { offset: 25, limit: 10 }, ctx);
    await callTool('get_invariant', { id: 'inv.constitutional.018' }, ctx);
    await callTool('search_invariants', { query: 'standing' }, ctx);
    await callTool('list_invariants_for_experiment', { experimentId: 'EXP-P1' }, ctx);
    await callTool('get_invariant_lineage', { id: 'inv.constitutional.018' }, ctx);

    expect(irl.listInvariants).toHaveBeenCalledWith(expect.objectContaining({ offset: 25, limit: 10 }));
    expect(irl.getInvariant).toHaveBeenCalledWith('inv.constitutional.018');
    expect(irl.searchInvariants).toHaveBeenCalledWith('standing', expect.any(Object));
    expect(irl.listInvariantsForExperiment).toHaveBeenCalledWith('EXP-P1');
    expect(irl.getInvariantLineage).toHaveBeenCalledWith('inv.constitutional.018');
  });

  it('paginates the bounded canonical snapshot and labels keyword search honestly', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/public/irl/invariants')) {
        return new Response(JSON.stringify({ ok: true, invariants: [
          { id: 'db-1', seedId: 'inv.test.001', statement: 'one' },
          { id: 'db-2', seedId: 'inv.test.002', statement: 'two' },
          { id: 'db-3', seedId: 'inv.test.003', statement: 'three' },
        ] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = makeIrlAdapter('https://example.test');

    const listed = await adapter.listInvariants({ offset: 1, limit: 1 }) as Record<string, unknown>;
    const searched = await adapter.searchInvariants('standing', { limit: 2 }) as Record<string, unknown>;
    const exact = await adapter.getInvariant('inv.test.002') as { ok: boolean; invariant?: { id?: string } };

    expect(listed).toMatchObject({ ok: true, total: 3, offset: 1, limit: 1, hasMore: true, nextOffset: 2, snapshotCap: 500 });
    expect(searched).toMatchObject({ ok: true, searchMode: 'keyword', query: 'standing' });
    expect(exact.invariant?.id).toBe('db-2');
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('limit=500'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('resolves experiment governance and labels lineage as intentionally bounded', async () => {
    const rows = [
      { id: 'db-18', seedId: 'inv.constitutional.018', statement: 'Standing definition', supersedesId: null },
      { id: 'db-61', seedId: 'inv.constitutional.061', statement: 'Confidence definition', supersedesId: 'db-old' },
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/public/irl/research-overview')) {
        return new Response(JSON.stringify({ experiments: [{ experiment: { id: 'EXP-P1', governingInvariants: rows.map((row) => row.seedId) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/public/irl/invariant-field')) {
        return new Response(JSON.stringify({ ok: true, mode: 'neighbourhood', edges: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/public/irl/invariants')) {
        return new Response(JSON.stringify({ ok: true, invariants: rows }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`unexpected URL ${url}`);
    }));
    const adapter = makeIrlAdapter('https://example.test');

    const experiment = await adapter.listInvariantsForExperiment('exp-p1') as Record<string, unknown>;
    const lineage = await adapter.getInvariantLineage('inv.constitutional.061') as Record<string, unknown>;

    expect(experiment).toMatchObject({ ok: true, experimentId: 'EXP-P1', governingInvariantIds: rows.map((row) => row.seedId), unresolvedIds: [] });
    expect(experiment.invariants).toHaveLength(2);
    expect(lineage).toMatchObject({ ok: true, supersedesId: 'db-old' });
    expect(lineage.lineageScope).toMatch(/not a complete provenance graph/);
    vi.unstubAllGlobals();
  });
});
