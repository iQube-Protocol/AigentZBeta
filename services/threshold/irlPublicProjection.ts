import { createHash } from 'crypto';
import type { IrlAdapter } from './irlAdapter';
import type { PublicDocumentPage, PublicDocumentSummary } from './publicKnowledgeLegacy';

const VIRTUAL_IRL_DOCS: PublicDocumentSummary[] = [
  {
    id: 'research-overview',
    cartridge: 'irl-os',
    title: 'IRL Research Overview',
    status: 'published',
    canonicalLink: '/api/public/irl/research-overview',
    sourceKind: 'db-content',
  },
  {
    id: 'canonical-invariant-registry',
    cartridge: 'irl-os',
    title: 'Canonical Public Invariant Registry',
    status: 'published',
    canonicalLink: '/api/public/irl/invariants',
    sourceKind: 'db-content',
  },
  {
    id: 'published-experiment-results',
    cartridge: 'irl-os',
    title: 'Published Experiment Results',
    status: 'published',
    canonicalLink: '/api/public/irl/experiments-results',
    sourceKind: 'db-content',
  },
];

const PARTICIPATION_DOC: PublicDocumentSummary = {
  id: 'foundation/PARTICIPATION_overview.md',
  cartridge: 'irl-os',
  title: 'Participation Overview',
  status: 'published',
  canonicalLink: '/api/public/irl/doc?path=foundation%2FPARTICIPATION_overview.md',
  sourceKind: 'pack-markdown',
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function slicePage(text: string, offset: number, limit: number) {
  const totalLength = text.length;
  const start = Math.max(0, Math.min(offset, totalLength));
  const end = Math.max(start, Math.min(start + limit, totalLength));
  return { text: text.slice(start, end), offset: start, limit, totalLength, hasMore: end < totalLength };
}

function asPage(summary: PublicDocumentSummary, fullText: string, offset: number, limit: number): PublicDocumentPage {
  const page = slicePage(fullText, offset, limit);
  return {
    ...summary,
    text: page.text,
    offset: page.offset,
    limit,
    totalLength: page.totalLength,
    hasMore: page.hasMore,
    sha256OfFullText: sha256(fullText),
  };
}

export function listIrlPublicRootDocuments(): PublicDocumentSummary[] {
  return [...VIRTUAL_IRL_DOCS, PARTICIPATION_DOC];
}

export async function readIrlPublicRootDocument(
  irl: IrlAdapter | undefined,
  id: string,
  offset: number,
  limit: number,
): Promise<{ ok: boolean; page?: PublicDocumentPage; error?: string }> {
  if (!irl) return { ok: false, error: 'The IRL public reader is unavailable on this gateway.' };

  if (id === 'research-overview') {
    const result = await irl.listDocuments() as { ok?: boolean; overview?: unknown; error?: string };
    if (!result?.ok) return { ok: false, error: result?.error ?? 'IRL OS overview unavailable.' };
    return { ok: true, page: asPage(VIRTUAL_IRL_DOCS[0], JSON.stringify(result.overview, null, 2), offset, limit) };
  }

  if (id === 'canonical-invariant-registry') {
    const result = await irl.listInvariants({ offset: 0, limit: 100 });
    const fullText = JSON.stringify(result, null, 2);
    return { ok: true, page: asPage(VIRTUAL_IRL_DOCS[1], fullText, offset, limit) };
  }

  if (id === 'published-experiment-results') {
    const result = await irl.readResults();
    const fullText = JSON.stringify(result, null, 2);
    return { ok: true, page: asPage(VIRTUAL_IRL_DOCS[2], fullText, offset, limit) };
  }

  if (id === PARTICIPATION_DOC.id) {
    const result = await irl.readDocument(id) as { ok?: boolean; content?: unknown; error?: string };
    if (!result?.ok) return { ok: false, error: result?.error ?? `IRL OS document "${id}" was not found.` };
    const fullText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2);
    return { ok: true, page: asPage(PARTICIPATION_DOC, fullText, offset, limit) };
  }

  return { ok: false, error: `Unknown or non-public IRL OS document id: ${id}` };
}
