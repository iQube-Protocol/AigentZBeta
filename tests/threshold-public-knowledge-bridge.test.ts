/**
 * Threshold MCP Bridge — public knowledge & discovery layer (2026-09-03,
 * operator directive: "Complete the public knowledge and discovery layer for
 * the Threshold MCP Bridge"). Covers: the new tool catalogue entries, their
 * access-control tier (public, never authenticated/handshake-gated), the
 * publicKnowledge adapter's allowlist enforcement (default-deny — no
 * arbitrary path is ever readable), correct field-mapping against the REAL
 * Qriptopian route response shapes, hash/pagination reconstruction, and that
 * this layer never touches the confirmed-hazardous domain-unscoped embedding
 * pipeline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readSource, stripComments } from './_lib/sourceAuthority';

const mocks = vi.hoisted(() => ({
  corpusReadPackFile: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: mocks.corpusReadPackFile,
}));

import { listTools, callTool, HANDSHAKE_TOOLS, listResources, readResource, listPrompts, getPrompt, type GatewayContext } from '../services/threshold/gateway';
import { makePublicKnowledgeAdapter, PUBLIC_CARTRIDGES } from '../services/threshold/publicKnowledge';

const PUBLIC_TOOL_NAMES = ['list_public_cartridges', 'list_public_documents', 'read_public_document', 'search_public_knowledge', 'list_public_capabilities'];

describe('gateway.ts tool catalogue — public knowledge tools are registered and public', () => {
  const tools = listTools();
  const names = tools.map((t) => t.name);

  it('registers all five new tools', () => {
    for (const n of PUBLIC_TOOL_NAMES) expect(names).toContain(n);
  });

  it('none of the five are gated behind HANDSHAKE_TOOLS (they are public, unauthenticated)', () => {
    for (const n of PUBLIC_TOOL_NAMES) expect(HANDSHAKE_TOOLS.has(n)).toBe(false);
  });

  it('list_public_documents / read_public_document / search_public_knowledge constrain `cartridge` to the four real enum values', () => {
    for (const n of ['list_public_documents', 'read_public_document', 'search_public_knowledge']) {
      const tool = tools.find((t) => t.name === n)!;
      const prop = (tool.inputSchema as { properties: Record<string, { enum?: string[] }> }).properties.cartridge;
      expect(prop?.enum).toEqual(['qriptopian', 'irl-os', 'agentiq-os', 'polity-core']);
    }
  });

  it('registers the orientation resource and prompt', () => {
    expect(listResources().map((r) => r.uri)).toContain('metame://public-knowledge');
    expect(listPrompts().map((p) => p.name)).toContain('explore_public_knowledge');
  });
});

describe('gateway.ts dispatch — public knowledge tools require no session and honestly report an unavailable adapter', () => {
  const bareCtx: GatewayContext = { origin: 'http://localhost:3000', gatewayUrl: 'http://localhost:3000/api/threshold/mcp' };

  it('every public knowledge tool call succeeds with no session present (ctx.session absent)', async () => {
    for (const n of PUBLIC_TOOL_NAMES) {
      const result = await callTool(n, n === 'list_public_documents' || n === 'read_public_document' ? { cartridge: 'polity-core', id: 'x' } : n === 'search_public_knowledge' ? { query: 'x' } : {}, bareCtx);
      // Never a "handshake required" refusal — that's the authenticated-tool answer.
      expect(JSON.stringify(result)).not.toMatch(/Constitutional Handshake/);
    }
  });

  it('reports "unavailable" (not a crash) when ctx.publicKnowledge is not injected', async () => {
    const result = await callTool('list_public_cartridges', {}, bareCtx);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toMatch(/unavailable/i);
  });

  it('metame://public-knowledge resolves without ctx.publicKnowledge (static orientation text)', async () => {
    const res = await readResource('metame://public-knowledge', bareCtx);
    expect(res.contents[0].text).toMatch(/Authority may be delegated\. Sovereignty may not be delegated\./);
    expect(res.contents[0].text).toMatch(/list_public_cartridges/);
  });

  it('explore_public_knowledge prompt never claims execution authority', () => {
    const p = getPrompt('explore_public_knowledge', { query: 'standing' });
    const body = p.messages[0].content.text;
    expect(body).toMatch(/never grants execution authority|read-only/);
  });
});

describe('publicKnowledge.ts — cartridge catalogue', () => {
  it('lists exactly the four resolved canonical cartridges with their real ids', () => {
    expect(PUBLIC_CARTRIDGES.map((c) => c.id)).toEqual(['qriptopian', 'irl-os', 'agentiq-os', 'polity-core']);
    expect(PUBLIC_CARTRIDGES.find((c) => c.id === 'agentiq-os')?.canonicalCartridgeId).toBe('agentiq-os-cartridge');
    expect(PUBLIC_CARTRIDGES.find((c) => c.id === 'polity-core')?.canonicalCartridgeId).toBe('polity-core-cartridge');
    expect(PUBLIC_CARTRIDGES.find((c) => c.id === 'irl-os')?.canonicalCartridgeId).toBe('irl-os-cartridge');
    expect(PUBLIC_CARTRIDGES.find((c) => c.id === 'qriptopian')?.canonicalCartridgeId).toBe('qripto-codex');
  });
});

describe('publicKnowledge.ts — AgentiQ OS / Polity Core: default-deny allowlist, no arbitrary path reachable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.corpusReadPackFile.mockResolvedValue('# doc\nbody text');
  });

  const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });

  it('agentiq-os: readDocument refuses an id not on the allowlist without ever calling corpusReadPackFile', async () => {
    const result = await adapter.readDocument('agentiq-os', '../../../etc/passwd');
    expect(result.ok).toBe(false);
    expect(mocks.corpusReadPackFile).not.toHaveBeenCalled();
  });

  it('agentiq-os: readDocument for a real guide id reads the EXACT allowlisted path via corpusReadPackFile, never a caller-supplied path', async () => {
    const result = await adapter.readDocument('agentiq-os', 'start-here');
    expect(result.ok).toBe(true);
    expect(mocks.corpusReadPackFile).toHaveBeenCalledWith('agentiq-os', 'items/start-here.md');
  });

  it('agentiq-os: capability-brief ids read from the agentiq pack (not agentiq-os), matching col_capabilities exactly', async () => {
    const result = await adapter.readDocument('agentiq-os', 'ccb-metame-companion');
    expect(result.ok).toBe(true);
    expect(mocks.corpusReadPackFile).toHaveBeenCalledWith('agentiq', 'updates/2026-07-24_ccb-metame-companion.md');
  });

  it('agentiq-os: listDocuments never includes anything from the 474-file updates/ stream beyond the 7 curated capability briefs', async () => {
    const result = await adapter.listDocuments('agentiq-os');
    expect(result.ok).toBe(true);
    const ids = result.documents!.map((d) => d.id);
    expect(ids.length).toBe(16 + 7); // 16 guides + 7 capability briefs, nothing else
    expect(ids).not.toContain('col_updates');
  });

  it('polity-core: readDocument refuses the admin-gated constitutional-internet manuscript id', async () => {
    const result = await adapter.readDocument('polity-core', 'commentary-constitutional-internet-manuscript');
    expect(result.ok).toBe(false);
    expect(mocks.corpusReadPackFile).not.toHaveBeenCalled();
  });

  it('polity-core: listDocuments excludes every constitutional-internet path', async () => {
    const result = await adapter.listDocuments('polity-core');
    expect(result.ok).toBe(true);
    for (const d of result.documents!) {
      expect(d.canonicalLink).not.toMatch(/constitutional-internet/);
    }
  });

  it('polity-core: the ratified Constitution and the VentureQube draft carry DIFFERENT, self-declared statuses (never flattened to one value)', async () => {
    const result = await adapter.listDocuments('polity-core');
    const constitution = result.documents!.find((d) => d.id === 'constitution');
    const ventureqube = result.documents!.find((d) => d.id === 'ventureqube-spec');
    const commentary = result.documents!.find((d) => d.id === 'commentary-polity-01');
    expect(constitution?.status).toBe('ratified');
    expect(ventureqube?.status).toBe('proposed');
    expect(commentary?.status).toBe('explanatory');
  });

  it('read_public_document pagination reconstructs the full text and its hash across pages', async () => {
    const fullText = 'x'.repeat(50) + 'y'.repeat(50);
    mocks.corpusReadPackFile.mockResolvedValue(fullText);
    const page1 = await adapter.readDocument('polity-core', 'constitution', { offset: 0, limit: 60 });
    const page2 = await adapter.readDocument('polity-core', 'constitution', { offset: 60, limit: 60 });
    expect(page1.ok && page2.ok).toBe(true);
    const reconstructed = page1.page!.text + page2.page!.text;
    expect(reconstructed).toBe(fullText);
    expect(page1.page!.sha256OfFullText).toBe(createHash('sha256').update(fullText, 'utf8').digest('hex'));
    expect(page1.page!.sha256OfFullText).toBe(page2.page!.sha256OfFullText);
    expect(page1.page!.hasMore).toBe(true);
    expect(page2.page!.hasMore).toBe(false);
  });
});

describe('publicKnowledge.ts — Qriptopian: field mapping matches the REAL route response shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/codex/qripto/papers?group=papers')) {
          return new Response(JSON.stringify({ papers: [{ id: 'p1', title: 'Paper One', scope: 'papers/polity', scopeLabel: 'The Polity' }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/api/codex/qripto/papers?group=magazines')) {
          return new Response(JSON.stringify({ papers: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (url.includes('/api/codex/qripto/essays') && !url.includes('machine')) {
          return new Response(JSON.stringify({ essays: [{ id: 'e1', title: 'Trusted Intelligence', slug: 'trusted-intelligence', series: 'Thresholds' }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/machine')) {
          return new Response(
            JSON.stringify({
              title: 'Trusted Intelligence',
              series: 'Thresholds',
              canonicalText: { text: 'full essay text' },
              readingEditions: [],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });

  it('listDocuments reads the `papers` array field (not `items`) and the `scopeLabel` field (not `seriesLabel`)', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.listDocuments('qriptopian');
    expect(result.ok).toBe(true);
    const paper = result.documents!.find((d) => d.id === 'p1');
    expect(paper?.title).toBe('Paper One');
    expect(paper?.series).toBe('The Polity');
  });

  it('listDocuments reads the `essays` array field (not `items`) for Thresholds', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.listDocuments('qriptopian');
    const essay = result.documents!.find((d) => d.id === 'trusted-intelligence');
    expect(essay?.title).toBe('Trusted Intelligence');
    expect(essay?.series).toBe('Thresholds');
  });

  it('readDocument for an essay slug returns the ACTUAL canonical text, not a link/summary', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.readDocument('qriptopian', 'trusted-intelligence');
    expect(result.ok).toBe(true);
    expect(result.page!.text).toBe('full essay text');
  });
});

describe('publicKnowledge.ts — Qriptopian multi-edition default resolution (live-discovered bug, 2026-09-03)', () => {
  // Confirmed live against the hosted machine route for Threshold 006: its
  // `canonicalText.text` (the raw modalities.read.text field) holds the
  // RESEARCH edition's text even though `defaultReadingEdition` correctly
  // says "reading" — so falling back to canonicalText.text when no edition
  // is requested silently returned the WRONG edition's text and hash. This
  // mock reproduces that exact divergence: canonicalText.text === the
  // research text, defaultReadingEdition === "reading".
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/machine')) {
          return new Response(
            JSON.stringify({
              title: 'From Constitutional AI to Trusted Intelligence',
              series: 'Thresholds',
              defaultReadingEdition: 'reading',
              canonicalText: { text: 'RESEARCH edition text (67050 chars in production)' },
              readingEditions: [
                { id: 'reading', label: 'Reading Edition', text: 'READING edition text (22404 chars in production)' },
                { id: 'research', label: 'Research Edition', text: 'RESEARCH edition text (67050 chars in production)' },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });

  it('with no edition requested, resolves defaultReadingEdition ("reading") and returns ITS text — never canonicalText.text when editions exist', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.readDocument('qriptopian', 'from-constitutional-ai-to-trusted-intelligence');
    expect(result.ok).toBe(true);
    expect(result.page!.edition).toBe('reading');
    expect(result.page!.text).toBe('READING edition text (22404 chars in production)');
    expect(result.page!.text).not.toContain('RESEARCH edition text');
  });

  it('with edition:"research" explicitly requested, returns the research text', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.readDocument('qriptopian', 'from-constitutional-ai-to-trusted-intelligence', { edition: 'research' });
    expect(result.ok).toBe(true);
    expect(result.page!.edition).toBe('research');
    expect(result.page!.text).toBe('RESEARCH edition text (67050 chars in production)');
  });

  it('the two editions report DIFFERENT sha256OfFullText — never merged or conflated', async () => {
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const reading = await adapter.readDocument('qriptopian', 'from-constitutional-ai-to-trusted-intelligence', { edition: 'reading' });
    const research = await adapter.readDocument('qriptopian', 'from-constitutional-ai-to-trusted-intelligence', { edition: 'research' });
    expect(reading.page!.sha256OfFullText).not.toBe(research.page!.sha256OfFullText);
  });
});

describe('publicKnowledge.ts — search_public_knowledge is honestly keyword-only', () => {
  it('search() always reports searchMode: "keyword"', async () => {
    mocks.corpusReadPackFile.mockResolvedValue('constitution text');
    const adapter = makePublicKnowledgeAdapter({ origin: 'http://localhost:3000' });
    const result = await adapter.search('constitution', 'polity-core');
    expect(result.searchMode).toBe('keyword');
  });
});

describe('publicKnowledge.ts — never touches the confirmed-hazardous domain-unscoped embedding pipeline', () => {
  const src = stripComments(readSource('services/threshold/publicKnowledge.ts'));

  it('does not import embeddingService or knowledgeBaseService', () => {
    expect(src).not.toMatch(/embeddingService/);
    expect(src).not.toMatch(/knowledgeBaseService/);
  });

  it('does not call processUnembeddedChunks', () => {
    expect(src).not.toMatch(/processUnembeddedChunks/);
  });
});

describe('irlAdapter.ts — resilientFetch extracted, not duplicated', () => {
  const src = stripComments(readSource('services/threshold/irlAdapter.ts'));

  it('imports the shared resilientFetch helper instead of defining its own copy', () => {
    expect(src).toMatch(/import \{ resilientFetch \} from '\.\/resilientFetch';/);
    expect(src).not.toMatch(/const resilientFetch = async/);
  });
});
