import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  corpusReadPackFile: vi.fn(),
  getActivePersona: vi.fn(),
}));

vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: mocks.corpusReadPackFile,
}));

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: mocks.getActivePersona,
}));

import { GET as readPackFile } from '../app/api/codex/packs/[packId]/file/route';
import { AGENTIQ_OS_CARTRIDGE } from '../data/codex-configs';

const WHITEPAPER_PATH = 'items/constitutional-financial-services.md';
const DOCS_COLLECTION_ID = 'col_docs_kb';

describe('AgentiQ OS Constitutional Financial Services corpus registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves the whitepaper from the existing public Docs / KB corpus without adding navigation', () => {
    const registry = JSON.parse(
      readFileSync(
        join(process.cwd(), 'codexes/packs/agentiq-os/collections.json'),
        'utf8',
      ),
    ) as {
      collections: Array<{ id: string; title: string; items: string[] }>;
    };

    const docs = registry.collections.find(
      (collection) => collection.id === DOCS_COLLECTION_ID,
    );

    expect(docs).toBeTruthy();
    expect(docs?.title).toBe('Docs / KB');
    expect(docs?.items).toContain(WHITEPAPER_PATH);
    expect(
      registry.collections.flatMap((collection) => collection.items)
        .filter((item) => item === WHITEPAPER_PATH),
    ).toHaveLength(1);

    const docsTabs = AGENTIQ_OS_CARTRIDGE.tabs.filter(
      (tab) =>
        tab.config.component === 'AgentiqCartridgeTab' &&
        tab.config.props?.packId === 'agentiq-os' &&
        tab.config.props?.collectionId === DOCS_COLLECTION_ID,
    );

    expect(docsTabs).toHaveLength(1);
    expect(docsTabs[0]).toMatchObject({
      id: 'agentiq-os-docs-kb',
      label: 'Docs / KB',
      enabled: true,
      group: 'memory',
    });
    expect(docsTabs[0]?.adminOnly).toBeFalsy();
    expect(docsTabs[0]?.participationDomain).toBeUndefined();
    expect(docsTabs[0]?.participationRoles).toBeUndefined();
    expect(
      AGENTIQ_OS_CARTRIDGE.tabs.some(
        (tab) => tab.label === 'Constitutional Financial Services',
      ),
    ).toBe(false);
  });

  it('allows an anonymous reader to load both the corpus index and whitepaper', async () => {
    mocks.corpusReadPackFile.mockImplementation(
      async (_packId: string, path: string) => {
        if (path === 'collections.json') {
          return JSON.stringify({
            collections: [{
              id: DOCS_COLLECTION_ID,
              title: 'Docs / KB',
              items: [WHITEPAPER_PATH],
            }],
          });
        }
        if (path === WHITEPAPER_PATH) {
          return '# Constitutional Financial Services';
        }
        return null;
      },
    );
    mocks.getActivePersona.mockResolvedValue(null);

    const context = {
      params: Promise.resolve({ packId: 'agentiq-os' }),
    };

    const collectionResponse = await readPackFile(
      new NextRequest(
        'http://localhost/api/codex/packs/agentiq-os/file?path=collections.json',
      ),
      context,
    );
    const whitepaperResponse = await readPackFile(
      new NextRequest(
        `http://localhost/api/codex/packs/agentiq-os/file?path=${WHITEPAPER_PATH}`,
      ),
      context,
    );

    expect(collectionResponse.status).toBe(200);
    expect(await collectionResponse.json()).toMatchObject({
      ok: true,
      format: 'json',
    });
    expect(whitepaperResponse.status).toBe(200);
    expect(await whitepaperResponse.json()).toMatchObject({
      ok: true,
      format: 'markdown',
      path: WHITEPAPER_PATH,
      content: '# Constitutional Financial Services',
    });
    expect(mocks.getActivePersona).not.toHaveBeenCalled();
  });
});
