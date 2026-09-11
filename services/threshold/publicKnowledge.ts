/**
 * Public cartridge projection for Threshold MCP.
 *
 * The publication boundary is the public cartridge projection, never the raw
 * underlying pack. Polity Core and AgentiQ OS derive their published corpus
 * from pack collections; Constitutional Internet working/editorial material is
 * excluded except for explicitly published agent-orientation artifacts. IRL OS
 * delegates to its audited public API adapter and the canonical public-root
 * projection, so private/internal research material is never inferred public
 * merely because it exists in the `irl` pack.
 */

import { createHash } from 'crypto';
import { corpusReadPackFile } from '../knowledge/packCorpusStore';
import {
  listIrlPublicRootDocuments,
  readIrlPublicRootDocument,
} from './irlPublicProjection';
import {
  makePublicKnowledgeAdapter as makeLegacyPublicKnowledgeAdapter,
  PUBLIC_CARTRIDGES,
  type PublicCapability,
  type PublicCartridgeDescriptor,
  type PublicCartridgeId,
  type PublicDocumentPage,
  type PublicDocumentSummary,
  type PublicKnowledgeAdapter,
  type RatificationStatus,
  type StatusVerification,
} from './publicKnowledgeLegacy';

export { PUBLIC_CARTRIDGES };
export type {
  PublicCapability,
  PublicCartridgeDescriptor,
  PublicCartridgeId,
  PublicDocumentPage,
  PublicDocumentSummary,
  PublicKnowledgeAdapter,
  RatificationStatus,
  StatusVerification,
};

type PackCollection = { id?: string; title?: string; enabled?: boolean; items?: unknown[] };
type PackCollectionsFile = { collections?: PackCollection[] };
type PackDoc = {
  id: string;
  title: string;
  path: string;
  status: RatificationStatus | 'published';
  statusVerification?: StatusVerification;
  series?: string;
  packId: string;
};

const POLITY_CONSTITUTIONAL_INTERNET_COLLECTION = 'col_commentary_constitutional_internet';
const POLITY_PUBLIC_AGENT_ARTIFACTS: PackDoc[] = [
  { id: 'constitutional-internet-for-agents-v0-1', title: 'The Constitutional Internet for Agents', path: 'items/commentary/constitutional-internet/agent-edition/constitutional-internet-for-agents.v0.1.json', status: 'explanatory', statusVerification: 'source-declared-only', series: 'Constitutional Internet for Agents', packId: 'polity-core' },
  { id: 'agent-accession-compact-v0-1', title: 'Constitutional Internet Agent Accession Compact', path: 'items/commentary/constitutional-internet/agent-edition/agent-accession-compact.v0.1.json', status: 'explanatory', statusVerification: 'source-declared-only', series: 'Constitutional Internet for Agents', packId: 'polity-core' },
  { id: 'agent-accession-intent-schema-v0-1', title: 'Agent Accession Intent Schema', path: 'items/commentary/constitutional-internet/agent-edition/agent-accession-intent.schema.v0.1.json', status: 'explanatory', statusVerification: 'source-declared-only', series: 'Constitutional Internet for Agents', packId: 'polity-core' },
];
const POLITY_STATUS_OVERRIDES: Record<string, Pick<PackDoc, 'status' | 'statusVerification' | 'series'>> = {
  'items/PARTICIPATION_MODEL.md': { status: 'ratified', statusVerification: 'source-declared-only', series: 'Polity Core — Trilogy Completion' },
};

function sha256(text: string): string { return createHash('sha256').update(text, 'utf8').digest('hex'); }
function slicePage(text: string, offset: number, limit: number) {
  const totalLength = text.length;
  const start = Math.max(0, Math.min(offset, totalLength));
  const end = Math.max(start, Math.min(start + limit, totalLength));
  return { text: text.slice(start, end), offset: start, limit, totalLength, hasMore: end < totalLength };
}
function pathFromCanonicalLink(link: string): string | null {
  const marker = '?path=';
  const index = link.indexOf(marker);
  if (index < 0) return null;
  try { return decodeURIComponent(link.slice(index + marker.length)); } catch { return null; }
}
function slugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(md|json)$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}
function titleFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(md|json)$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
async function readCollections(packId: string): Promise<PackCollectionsFile | null> {
  const raw = await corpusReadPackFile(packId, 'collections.json').catch(() => null);
  if (!raw) return null;
  try { return JSON.parse(raw) as PackCollectionsFile; } catch { return null; }
}
function summaryFromPackDoc(cartridge: 'polity-core' | 'agentiq-os', doc: PackDoc): PublicDocumentSummary {
  return { id: doc.id, cartridge, title: doc.title, series: doc.series, status: doc.status, statusVerification: doc.statusVerification, canonicalLink: `/api/codex/packs/${doc.packId}/file?path=${encodeURIComponent(doc.path)}`, sourceKind: 'pack-markdown' };
}
async function buildPackCatalogue(cartridge: 'polity-core' | 'agentiq-os', packId: string, legacy: PublicKnowledgeAdapter) {
  const [collections, legacyListing] = await Promise.all([readCollections(packId), legacy.listDocuments(cartridge)]);
  if (!collections?.collections) return { ok: false as const, error: `Public cartridge catalogue for ${cartridge} is unavailable.` };
  const legacyByPath = new Map<string, PublicDocumentSummary>();
  if (legacyListing.ok) for (const doc of legacyListing.documents ?? []) { const path = pathFromCanonicalLink(doc.canonicalLink); if (path) legacyByPath.set(path, doc); }
  const docs: PackDoc[] = [];
  const seen = new Set<string>();
  for (const collection of collections.collections) {
    if (collection.enabled === false) continue;
    if (cartridge === 'polity-core' && collection.id === POLITY_CONSTITUTIONAL_INTERNET_COLLECTION) continue;
    for (const item of collection.items ?? []) {
      if (typeof item !== 'string' || (!item.endsWith('.md') && !item.endsWith('.json')) || seen.has(item)) continue;
      seen.add(item);
      const prior = legacyByPath.get(item);
      const override = cartridge === 'polity-core' ? POLITY_STATUS_OVERRIDES[item] : undefined;
      docs.push({ id: prior?.id ?? slugFromPath(item), title: prior?.title ?? titleFromPath(item), path: item, status: override?.status ?? prior?.status ?? 'explanatory', statusVerification: override?.statusVerification ?? prior?.statusVerification, series: override?.series ?? prior?.series ?? collection.title, packId });
    }
  }
  if (cartridge === 'polity-core') for (const extra of POLITY_PUBLIC_AGENT_ARTIFACTS) if (!seen.has(extra.path)) { seen.add(extra.path); docs.push(extra); }
  if (cartridge === 'agentiq-os' && legacyListing.ok) {
    for (const prior of legacyListing.documents ?? []) {
      const path = pathFromCanonicalLink(prior.canonicalLink);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      docs.push({ id: prior.id, title: prior.title, path, status: prior.status, statusVerification: prior.statusVerification, series: prior.series, packId: prior.canonicalLink.includes('/packs/agentiq/file') ? 'agentiq' : packId });
    }
  }
  return { ok: true as const, docs, summaries: docs.map((doc) => summaryFromPackDoc(cartridge, doc)) };
}

export function makePublicKnowledgeAdapter(opts: { origin: string; irl?: import('./irlAdapter').IrlAdapter }): PublicKnowledgeAdapter {
  const legacy = makeLegacyPublicKnowledgeAdapter(opts);
  const adapter: PublicKnowledgeAdapter = {
    listCartridges() { return PUBLIC_CARTRIDGES; },
    async listDocuments(cartridge) {
      if (cartridge === 'irl-os') return { ok: true, documents: listIrlPublicRootDocuments() };
      if (cartridge === 'polity-core' || cartridge === 'agentiq-os') {
        const built = await buildPackCatalogue(cartridge, cartridge === 'polity-core' ? 'polity-core' : 'agentiq-os', legacy);
        return built.ok ? { ok: true, documents: built.summaries } : built;
      }
      return legacy.listDocuments(cartridge);
    },
    async readDocument(cartridge, id, readOpts = {}) {
      const offset = Math.max(0, readOpts.offset ?? 0);
      const limit = Math.max(1, Math.min(readOpts.limit ?? 8000, 50000));
      if (cartridge === 'irl-os') return readIrlPublicRootDocument(opts.irl, id, offset, limit);
      if (cartridge !== 'polity-core' && cartridge !== 'agentiq-os') return legacy.readDocument(cartridge, id, readOpts);
      const built = await buildPackCatalogue(cartridge, cartridge === 'polity-core' ? 'polity-core' : 'agentiq-os', legacy);
      if (!built.ok) return built;
      const doc = built.docs.find((candidate) => candidate.id === id);
      if (!doc) return { ok: false, error: `Unknown or non-public document id for ${cartridge}.` };
      const raw = await corpusReadPackFile(doc.packId, doc.path).catch(() => null);
      if (raw === null) return { ok: false, error: `Document "${doc.id}" could not be read from the pack corpus.` };
      const page = slicePage(raw, offset, limit);
      return { ok: true, page: { ...summaryFromPackDoc(cartridge, doc), text: page.text, offset: page.offset, limit: page.limit, totalLength: page.totalLength, hasMore: page.hasMore, sha256OfFullText: sha256(raw) } };
    },
    async search(query, cartridge) {
      const q = query.trim().toLowerCase();
      if (!q) return { ok: false, searchMode: 'keyword', error: 'A search query is required.' };
      const cartridges = cartridge ? [cartridge] : (['qriptopian', 'irl-os', 'agentiq-os', 'polity-core'] as PublicCartridgeId[]);
      const results: Array<{ cartridge: PublicCartridgeId; id: string; title: string; excerpt: string }> = [];
      for (const current of cartridges) {
        const listing = await adapter.listDocuments(current);
        if (!listing.ok || !listing.documents) continue;
        for (const doc of listing.documents) {
          if (results.filter((result) => result.cartridge === current).length >= 5) break;
          if (doc.title.toLowerCase().includes(q)) { results.push({ cartridge: current, id: doc.id, title: doc.title, excerpt: doc.title }); continue; }
          const page = await adapter.readDocument(current, doc.id, { limit: 20000 });
          if (!page.ok || !page.page) continue;
          const lower = page.page.text.toLowerCase();
          const index = lower.indexOf(q);
          if (index < 0) continue;
          const start = Math.max(0, index - 80);
          results.push({ cartridge: current, id: doc.id, title: doc.title, excerpt: (start > 0 ? '…' : '') + page.page.text.slice(start, index + q.length + 80) + '…' });
        }
      }
      return { ok: true, searchMode: 'keyword', results };
    },
    listCapabilities(cartridge) { return legacy.listCapabilities(cartridge); },
  };
  return adapter;
}
