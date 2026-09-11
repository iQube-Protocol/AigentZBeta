export interface ContentDeepLinkTarget {
  id: string;
  title: string;
  slug?: string | null;
}

/** Decode a route/query reference without assuming which layer decoded it first. */
export function decodeContentReference(value: string): string {
  let decoded = value.trim();

  for (let pass = 0; pass < 4; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}

export function normalizeContentReference(value: string): string {
  return decodeContentReference(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolve UUID, canonical slug, encoded title, or exact title to one existing row. */
export function resolveContentDeepLink<T extends ContentDeepLinkTarget>(
  items: T[],
  value: string,
): T | undefined {
  const decoded = decodeContentReference(value);
  const normalized = normalizeContentReference(decoded);

  return items.find((item) =>
    item.id === decoded ||
    item.slug === decoded ||
    item.slug === normalized ||
    item.title.toLowerCase() === decoded.toLowerCase()
  );
}
