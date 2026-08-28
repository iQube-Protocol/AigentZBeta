import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AGENTIQ_OS_CARTRIDGE } from '../data/codex-configs';

const WHITEPAPER_PATH = 'items/constitutional-financial-services.md';
const DOCS_COLLECTION_ID = 'col_docs_kb';

describe('AgentiQ OS Constitutional Financial Services corpus registration', () => {
  it('serves the whitepaper from the existing Docs / KB corpus without adding navigation', () => {
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
    expect(
      AGENTIQ_OS_CARTRIDGE.tabs.some(
        (tab) => tab.label === 'Constitutional Financial Services',
      ),
    ).toBe(false);
  });
});
