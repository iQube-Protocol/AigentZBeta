/**
 * GET /.well-known/iqube-catalog
 *
 * Public discovery surface for iQubes. Returns an IQubeCatalog
 * listing every iQube whose visibility resolves to 'public' or
 * 'public_meta_private_payload'. Private iQubes MUST NOT appear
 * (PRD §8.1 + §10).
 *
 * Catalog order:
 *   1. Live ContentQubes from `content_qubes` (descending updated_at)
 *   2. AigentQubes from `RUNTIME_AGENT_IDS`
 *   3. ToolQubes from the openclawCore registry
 *
 * The well-known route is discovery only — never mutating, never
 * authoritative. Every entry links back to its `card_url` and
 * `registry_url`. The registry remains canonical.
 */

import { NextResponse } from 'next/server';
import { listDiscoverableSources } from '@/services/iqube/legibility/registry';
import {
  IQubeCatalogSchema,
  safeValidate,
} from '@/services/iqube/legibility/schemas';
import { legibilityHost } from '@/services/iqube/legibility/cardBuilder';
import type { IQubeCatalog } from '@/types/iqube/legibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=60');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  const host = legibilityHost();
  const sources = await listDiscoverableSources();

  const candidate: IQubeCatalog = {
    type: 'iQubeCatalog',
    version: '0.1',
    generated_at: new Date().toISOString(),
    registry: {
      name: 'metaMe iQube Registry',
      canonical_url: `${host}/api/registry`,
      description:
        'Canonical registry surface for iQubes, ContentQubes, ToolQubes, '
        + 'AigentQubes, and ModelQubes. The well-known catalog is a '
        + 'discovery index; the registry is the source of truth.',
    },
    supported_profiles: ['iQube Agent Legibility Profile v0.1'],
    iqubes: sources.map((s) => ({
      iqube_id: s.iqube_id,
      name: s.name,
      primitive_type: s.primitive_type,
      lifecycle_state:
        s.raw_lifecycle_state === 'canonized' || s.raw_lifecycle_state === 'chain_minted'
          ? 'canonized'
          : s.raw_lifecycle_state === 'archived'
          ? 'archived'
          : s.raw_lifecycle_state === 'deprecated' || s.raw_lifecycle_state === 'superseded'
          ? 'deprecated'
          : (['semi_minted', 'review_ready', 'canon_pending', 'wip'] as string[])
              .includes(s.raw_lifecycle_state)
          ? 'wip'
          : 'draft',
      visibility_state: s.visibility_state,
      card_url: `${host}/api/iqubes/${s.iqube_id}/card`,
      registry_url: `${host}/api/registry/content-qube/${s.iqube_id}`,
    })),
  };

  const validated = safeValidate(IQubeCatalogSchema, candidate, 'catalog');
  if (!validated) {
    return withCors(NextResponse.json(
      { error: 'Invalid iQubeCatalog response' },
      { status: 500 },
    ));
  }

  return withCors(NextResponse.json(validated, {
    headers: { 'Content-Type': 'application/iqube-catalog+json' },
  }));
}
