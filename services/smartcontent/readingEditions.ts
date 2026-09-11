/** Additive editions of ONE publication. read.text remains the canonical research text. */
export interface ReadingEdition {
  id: string;
  label: string;
  description?: string;
  /** canonical uses read.text and read.pdf_url without copying or modifying either. */
  source: 'canonical' | 'inline';
  text?: string;
  pdf_url?: string;
  duration?: string;
  sourceSha256?: string;
  textSha256?: string;
}

export interface EditionReadSource {
  text?: string;
  pdf_url?: string;
  duration?: string;
  editions?: ReadingEdition[];
  defaultEdition?: string;
}

export interface ResolvedReadingEdition extends ReadingEdition {
  text: string;
}

function safePdfUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : undefined;
  } catch { return undefined; }
}

/** Validate persisted JSON at the boundary; malformed editions never hide legacy text. */
export function getReadingEditions(read?: EditionReadSource | null): ResolvedReadingEdition[] {
  if (!read || !Array.isArray(read.editions)) return [];
  const seen = new Set<string>();
  const result: ResolvedReadingEdition[] = [];
  for (const edition of read.editions) {
    if (!edition || typeof edition.id !== 'string' || !/^[a-z0-9-]+$/.test(edition.id) ||
        seen.has(edition.id) || typeof edition.label !== 'string' || !edition.label.trim() ||
        !['canonical', 'inline'].includes(edition.source)) continue;
    const text = edition.source === 'canonical' ? read.text : edition.text;
    if (typeof text !== 'string' || !text.trim()) continue;
    seen.add(edition.id);
    result.push({
      id: edition.id, label: edition.label, source: edition.source, text,
      description: typeof edition.description === 'string' ? edition.description : undefined,
      pdf_url: safePdfUrl(edition.source === 'canonical' ? read.pdf_url : edition.pdf_url),
      duration: edition.source === 'canonical' ? read.duration : edition.duration,
      sourceSha256: edition.sourceSha256, textSha256: edition.textSha256,
    });
  }
  return result;
}

export function resolveReadingEdition(read?: EditionReadSource | null, selectedId?: string): ResolvedReadingEdition | undefined {
  const editions = getReadingEditions(read);
  return editions.find(e => e.id === selectedId) ||
    editions.find(e => e.id === read?.defaultEdition) || editions[0];
}

export function defaultReadingText(read?: EditionReadSource | null): string {
  return resolveReadingEdition(read)?.text || read?.text || '';
}

/** Edition-specific audio identity prevents replaying a cached script from the other edition. */
export function readingAudioId(contentId: string, edition?: Pick<ReadingEdition, 'id'>): string {
  return edition ? `${contentId}:edition:${edition.id}` : contentId;
}
