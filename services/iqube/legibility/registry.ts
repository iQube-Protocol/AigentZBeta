/**
 * iQube Legibility — unified source registry.
 *
 * Single resolver that knows how to fetch a `LegibilitySource` for
 * an arbitrary iqube_id by dispatching to the right adapter:
 * - UUID-shaped id → ContentQube source (Supabase)
 * - 'tool_*'        → ToolQube source (openclawCore)
 * - 'aigent-*'      → AigentQube source (orchestra profile map)
 *
 * Adding a new primitive type (e.g. ModelQube, ClusterQube) is two
 * lines here plus a new `sources/<x>Source.ts`. The card builder
 * is primitive-agnostic.
 */

import { getContentQubeSource, listPublicContentQubeSources } from './sources/contentQubeSource';
import { getToolQubeSource, listToolQubeSources } from './sources/toolQubeSource';
import { getAigentQubeSource, listAigentQubeSources } from './sources/aigentQubeSource';
import type { LegibilitySource } from './cardBuilder';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SourceFetchOpts = {
  /**
   * When true, ContentQube source returns rows even if they resolve
   * to `visibility = 'private'` — caller is responsible for not
   * leaking. Used by authenticated routes (fast-follow).
   */
  allowPrivate?: boolean;
};

/**
 * Resolve any iqube_id to a LegibilitySource. Returns null on
 * unknown ids OR on visibility-private rows when `allowPrivate`
 * is false (the route then emits 404 rather than 403, per PRD
 * §8.2 "default for private iQubes should be 404, not 403, to
 * avoid leaking existence").
 */
export async function getLegibilitySource(
  iqubeId: string,
  opts: SourceFetchOpts = {},
): Promise<LegibilitySource | null> {
  if (UUID_RE.test(iqubeId)) {
    return getContentQubeSource(iqubeId, opts);
  }
  if (iqubeId.startsWith('tool_')) {
    return getToolQubeSource(iqubeId);
  }
  if (iqubeId.startsWith('aigent-')) {
    return getAigentQubeSource(iqubeId);
  }
  return null;
}

/**
 * Build the discoverable union for the public catalog. Order:
 * ContentQubes (live, descending updated_at) → AigentQubes →
 * ToolQubes. Agents reading the catalog see fresh content first.
 */
export async function listDiscoverableSources(): Promise<LegibilitySource[]> {
  const [content, aigents, tools] = await Promise.all([
    listPublicContentQubeSources(),
    Promise.resolve(listAigentQubeSources()),
    Promise.resolve(listToolQubeSources()),
  ]);
  return [...content, ...aigents, ...tools];
}
