import { agentDiscoveryManifest } from './agentManifest';
import { buildIQubeCard } from '@/services/iqube/legibility/cardBuilder';
import { getLegibilitySource, listDiscoverableSources } from '@/services/iqube/legibility/registry';
import { IQubeCardSchema, safeValidate } from '@/services/iqube/legibility/schemas';
import type { IQubePrimitiveType } from '@/types/iqube/legibility';

export const PUBLIC_DISCOVERY_TOOLS = [
  {
    name: 'get_agent_manifest',
    description: 'Return the canonical metaMe Agent Discovery Manifest. Tool alias for metame://agent-manifest for MCP clients that do not reliably inspect resources. Public + read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_public_iqube_cards',
    description: 'List public iQube Cards from the canonical iQube legibility registry. Public registry metadata does not imply private payload entitlement. Public + read-only.',
    inputSchema: { type: 'object', properties: { primitiveType: { type: 'string', enum: ['DataQube', 'ContentQube', 'ToolQube', 'ModelQube', 'AigentQube', 'ClusterQube'] }, query: { type: 'string' }, offset: { type: 'number', minimum: 0 }, limit: { type: 'number', minimum: 1, maximum: 100 } }, additionalProperties: false },
  },
  {
    name: 'get_public_iqube_card',
    description: 'Resolve one public or public-metadata iQube Card by canonical iQube identifier using the same legibility builder as /api/iqubes/:id/card. Private and unknown iQubes remain indistinguishable. Public + read-only.',
    inputSchema: { type: 'object', properties: { iqubeId: { type: 'string' } }, required: ['iqubeId'], additionalProperties: false },
  },
] as const;

function matchesQuery(card: ReturnType<typeof buildIQubeCard>, query?: string): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  const values = [card.iqube_id, card.name, card.description, card.primitive_type, card.lifecycle_state, ...(card.metaqube.tags ?? []), card.metaqube.title, card.metaqube.summary];
  return values.some((value) => typeof value === 'string' && value.toLowerCase().includes(q));
}

export async function callPublicDiscoveryTool(name: string, args: Record<string, unknown>) {
  if (name === 'get_agent_manifest') return { ok: true, manifest: agentDiscoveryManifest(), canonicalResource: 'metame://agent-manifest' };

  if (name === 'get_public_iqube_card') {
    const iqubeId = typeof args.iqubeId === 'string' ? args.iqubeId.trim() : '';
    if (!iqubeId) return { ok: false, error: 'iqubeId is required.' };
    const source = await getLegibilitySource(iqubeId);
    if (!source) return { ok: false, error: 'iQube not found or not public.' };
    const candidate = buildIQubeCard(source);
    if (candidate.visibility_state === 'private') return { ok: false, error: 'iQube not found or not public.' };
    const card = safeValidate(IQubeCardSchema, candidate, `mcp-card[${iqubeId}]`);
    return card ? { ok: true, card } : { ok: false, error: 'Invalid public iQube Card projection.' };
  }

  if (name === 'list_public_iqube_cards') {
    const primitiveType = typeof args.primitiveType === 'string' ? args.primitiveType as IQubePrimitiveType : undefined;
    const query = typeof args.query === 'string' ? args.query : undefined;
    const offset = Math.max(0, typeof args.offset === 'number' ? Math.floor(args.offset) : 0);
    const limit = Math.max(1, Math.min(typeof args.limit === 'number' ? Math.floor(args.limit) : 25, 100));
    const sources = await listDiscoverableSources();
    const cards = sources.map(buildIQubeCard)
      .filter((card) => card.visibility_state === 'public' || card.visibility_state === 'public_meta_private_payload')
      .filter((card) => !primitiveType || card.primitive_type === primitiveType)
      .filter((card) => matchesQuery(card, query))
      .map((candidate) => safeValidate(IQubeCardSchema, candidate, `mcp-card[${candidate.iqube_id}]`))
      .filter((card): card is NonNullable<typeof card> => Boolean(card));
    return { ok: true, registrySemantics: 'Public iQube Card visibility is registry metadata only; payload access is a separate authorization decision.', offset, limit, total: cards.length, hasMore: offset + limit < cards.length, cards: cards.slice(offset, offset + limit) };
  }
  return null;
}

export function isPublicDiscoveryTool(name: string): boolean {
  return PUBLIC_DISCOVERY_TOOLS.some((tool) => tool.name === name);
}
