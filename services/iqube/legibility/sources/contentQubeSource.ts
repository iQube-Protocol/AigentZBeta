/**
 * ContentQube source adapter — wraps the live `content_qubes` table
 * for the legibility layer.
 *
 * What it does:
 * - Reads a row by id (uuid) and translates it into a
 *   `LegibilitySource` blob the card builder can consume.
 * - Enumerates publishable rows for the catalog.
 *
 * What it deliberately does NOT do:
 * - Read T0 fields (master_qube_id and media_asset_id are exposed
 *   as `provenance_receipts` aliases ONLY when policy permits).
 * - Decrypt anything. The card never carries plaintext payload.
 * - Bypass the existing access spine — visibility decisions still
 *   defer to `evaluateAccess` in Phase 2; for v0.1 the source uses
 *   the cartridge_binding visibility field directly.
 *
 * Visibility derivation rule (v0.1):
 * - lifecycle_state in ('canonized','chain_minted') AND policy
 *   `gating_kind = 'free'` AND `is_unlisted IS NOT TRUE` → 'public'
 * - lifecycle_state in ('canonized','chain_minted') AND policy
 *   `gating_kind != 'free'` → 'public_meta_private_payload'
 * - everything else (draft / semi_minted / archived / etc.) →
 *   'private'  (→ card route 404)
 *
 * The catalog query applies the same rule and only returns rows
 * whose visibility resolves to 'public' or
 * 'public_meta_private_payload' OR are explicitly unlisted-with-
 * discoverable.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  IQubeAccessGating,
  IQubeVisibilityState,
} from '@/types/iqube/legibility';
import type { LegibilitySource } from '../cardBuilder';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type ContentQubeRow = {
  id: string;
  series: string;
  content_kind: string;
  content_type: string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: string;
  created_at: string;
  updated_at: string;
};

type AccessPolicyRow = {
  qube_id: string;
  gating_kind: string | null;
  gating_credential: string | null;
};

function mapGatingKind(raw: string | null | undefined): IQubeAccessGating[] {
  if (!raw || raw === 'free' || raw === 'open') return ['open'];
  if (raw === 'token') return ['token'];
  if (raw === 'payment') return ['payment'];
  if (raw === 'persona') return ['persona'];
  if (raw === 'did') return ['did'];
  if (raw === 'allowlist') return ['allowlist'];
  if (raw === 'role') return ['role'];
  return ['custom'];
}

function deriveVisibility(
  lifecycle: string,
  gating: IQubeAccessGating[],
): IQubeVisibilityState {
  const isCanonized = lifecycle === 'canonized' || lifecycle === 'chain_minted';
  if (!isCanonized) return 'private';
  if (gating.length === 1 && gating[0] === 'open') return 'public';
  return 'public_meta_private_payload';
}

/**
 * Load one ContentQube as a LegibilitySource. Returns null when:
 * - the id doesn't exist
 * - the row's derived visibility is 'private' (caller treats as 404)
 */
export async function getContentQubeSource(
  id: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<LegibilitySource | null> {
  const sb = client();
  const { data: row, error } = await sb
    .from('content_qubes')
    .select('id, series, content_kind, content_type, display_number, title, description, lifecycle_state, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) return null;

  const { data: policyRow } = await sb
    .from('content_qube_access_policies')
    .select('qube_id, gating_kind, gating_credential')
    .eq('qube_id', id)
    .maybeSingle();

  const gating = mapGatingKind((policyRow as AccessPolicyRow | null)?.gating_kind);
  const visibility = deriveVisibility((row as ContentQubeRow).lifecycle_state, gating);

  if (visibility === 'private' && !opts.allowPrivate) return null;

  const r = row as ContentQubeRow;
  const isCanonized = r.lifecycle_state === 'canonized' || r.lifecycle_state === 'chain_minted';

  return {
    iqube_id: r.id,
    name: r.title || `${r.content_kind} ${r.id.slice(0, 8)}`,
    description: r.description ?? undefined,
    primitive_type: 'ContentQube',
    raw_lifecycle_state: r.lifecycle_state,
    visibility_state: visibility,
    gating,
    private_payload_available: visibility === 'public_meta_private_payload',
    // Content authorship metadata isn't tracked at T1 today; default
    // to 'pseudonymous' so we never accidentally claim 'identifiable'
    // without an explicit policy decision.
    creator_identity_state: isCanonized ? 'identifiable' : 'pseudonymous',
    owner_identity_state: isCanonized ? 'identifiable' : 'pseudonymous',
    title: r.title ?? undefined,
    summary: r.description ?? undefined,
    tags: [r.series, r.content_kind, r.content_type],
    created_at: r.created_at,
    updated_at: r.updated_at,
    canonicalized_at: isCanonized ? r.updated_at : undefined,
  };
}

/**
 * Enumerate ContentQubes that should appear in the public catalog.
 * Returns only rows whose derived visibility is 'public' or
 * 'public_meta_private_payload'. Capped at 200 rows for v0.1 — the
 * catalog is a discovery surface, not a full index.
 */
export async function listPublicContentQubeSources(): Promise<LegibilitySource[]> {
  const sb = client();
  const { data, error } = await sb
    .from('content_qubes')
    .select('id, series, content_kind, content_type, display_number, title, description, lifecycle_state, created_at, updated_at')
    .in('lifecycle_state', ['canonized', 'chain_minted'])
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];

  // Bulk-load access policies for the candidate set.
  const ids = data.map((r) => r.id);
  const { data: policies } = await sb
    .from('content_qube_access_policies')
    .select('qube_id, gating_kind, gating_credential')
    .in('qube_id', ids);
  const policyByQube = new Map<string, AccessPolicyRow>();
  for (const p of (policies ?? []) as AccessPolicyRow[]) policyByQube.set(p.qube_id, p);

  const sources: LegibilitySource[] = [];
  for (const row of data as ContentQubeRow[]) {
    const policy = policyByQube.get(row.id);
    const gating = mapGatingKind(policy?.gating_kind);
    const visibility = deriveVisibility(row.lifecycle_state, gating);
    if (visibility !== 'public' && visibility !== 'public_meta_private_payload') continue;
    sources.push({
      iqube_id: row.id,
      name: row.title || `${row.content_kind} ${row.id.slice(0, 8)}`,
      description: row.description ?? undefined,
      primitive_type: 'ContentQube',
      raw_lifecycle_state: row.lifecycle_state,
      visibility_state: visibility,
      gating,
      private_payload_available: visibility === 'public_meta_private_payload',
      creator_identity_state: 'identifiable',
      owner_identity_state: 'identifiable',
      title: row.title ?? undefined,
      summary: row.description ?? undefined,
      tags: [row.series, row.content_kind, row.content_type],
      created_at: row.created_at,
      updated_at: row.updated_at,
      canonicalized_at: row.updated_at,
    });
  }
  return sources;
}
