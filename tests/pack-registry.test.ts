import path from "path";
import { promises as fs } from "fs";
import { loadPackCodexes, getPackCodexById } from "@/app/api/codex/registry/_lib/packRegistry";

interface CollectionEntry {
  id: string;
  title: string;
  items: string[];
}

interface CollectionsFile {
  collections: CollectionEntry[];
}

interface RetrievalIndexEntry {
  id: string;
  path: string;
  type: string;
  title: string;
  summary?: string;
  tags: string[];
  components?: string[];
  endpoints?: string[];
  owners?: string[];
  last_updated: string;
  related?: string[];
}

interface RetrievalIndex {
  version: string;
  generated_at: string;
  repo: string;
  entries: RetrievalIndexEntry[];
}

interface RetrievalSchema {
  required?: string[];
  properties?: Record<string, unknown>;
  $defs?: {
    entry?: {
      required?: string[];
      properties?: Record<string, unknown>;
    };
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function isIsoDate(value: string): boolean {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  return !Number.isNaN(Date.parse(value));
}

function assertUniqueStrings(values: string[] | undefined, label: string) {
  if (!values) return;
  expect(Array.isArray(values)).toBe(true);
  values.forEach((value) => expect(typeof value).toBe("string"));
  expect(new Set(values).size).toBe(values.length);
}

describe("pack registry", () => {
  it("maps Agentiq collections into tabs", async () => {
    const packRoot = path.join(process.cwd(), "codexes", "packs", "aigency");
    const collections = await readJson<CollectionsFile>(path.join(packRoot, "collections.json"));

    const codexes = await loadPackCodexes();
    const agentiq = codexes.find((codex) => codex.id === "agentiq-codex");

    expect(agentiq).toBeTruthy();
    expect(agentiq?.slug).toBe("agentiq");
    expect(agentiq?.tabs.length).toBe(collections.collections.length);

    collections.collections.forEach((collection) => {
      expect(agentiq?.tabs.some((tab) => tab.label === collection.title)).toBe(true);
    });
  });

  it("loads pack metadata for a specific codex id", async () => {
    const codex = await getPackCodexById("agentiq-codex");
    expect(codex).toBeTruthy();
    expect(codex?.metadata.tags?.length).toBeGreaterThan(0);
    expect(codex?.permissions.view).toContain("*");
  });
});

describe("retrieval index schema validation", () => {
  it("validates the Agentiq retrieval index against schema requirements", async () => {
    const schemaPath = path.join(process.cwd(), "codexes", "packs", "agentiq", "contracts", "index.schema.json");
    const indexPath = path.join(process.cwd(), "codexes", "packs", "agentiq", "index.json");

    const schema = await readJson<RetrievalSchema>(schemaPath);
    const index = await readJson<RetrievalIndex>(indexPath);

    const required = schema.required ?? [];
    required.forEach((key) => {
      expect(Object.hasOwn(index, key)).toBe(true);
    });

    expect(typeof index.version).toBe("string");
    expect(index.version.length).toBeGreaterThan(0);
    expect(typeof index.repo).toBe("string");
    expect(index.repo.length).toBeGreaterThan(0);
    expect(isIsoDate(index.generated_at)).toBe(true);
    expect(Array.isArray(index.entries)).toBe(true);
    expect(index.entries.length).toBeGreaterThan(0);

    const entryRequired = schema.$defs?.entry?.required ?? [];
    for (const entry of index.entries) {
      entryRequired.forEach((key) => {
        expect(Object.hasOwn(entry, key)).toBe(true);
      });
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.path).toBe("string");
      expect(entry.path.length).toBeGreaterThan(0);
      expect(typeof entry.type).toBe("string");
      expect(entry.type.length).toBeGreaterThan(0);
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(isIsoDate(entry.last_updated)).toBe(true);

      assertUniqueStrings(entry.tags, "tags");
      assertUniqueStrings(entry.components, "components");
      assertUniqueStrings(entry.endpoints, "endpoints");
      assertUniqueStrings(entry.owners, "owners");
      assertUniqueStrings(entry.related, "related");

      const absolutePath = path.join(process.cwd(), entry.path);
      await expect(fs.stat(absolutePath)).resolves.toBeDefined();
    }
  });
});
