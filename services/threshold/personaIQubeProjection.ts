/**
 * Persona-scoped iQube projection for Threshold MCP.
 *
 * This is an adapter, never an access authority. It resolves the persona from
 * the session's T2 public reference, revalidates the exact principal + agent
 * Constitutional Agreement, and delegates every resource decision to the
 * canonical Registry/Persona access spine. Cartridge, tab and bridge location
 * are metadata only; the access boundary is the iQube.
 */

import type { ScopedSession } from '@/services/threshold/gatewaySession';
import { createHash } from 'crypto';
import { hasScope } from '@/services/threshold/gatewaySession';
import { getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';
import {
  agreementOwnerCommitment,
  getAgreement,
} from '@/services/constitutional/constitutionalAgreement';
import { listIQubes, resolveIQube } from '@/services/registry/resolver';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveContentQube } from '@/services/content/resolveContentQube';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import { StorageAdapterFactory } from '@/services/content/storageAdapter';
import type {
  CanonicalIQubeInternalRecord,
  RegistryCartridgeView,
} from '@/types/registry-canonical';

const OPEN_AGREEMENT_STATES = new Set(['authorized', 'executed', 'settled', 'reconstitutable']);
const MAX_PAGE = 100;
const MAX_SCAN = 500;
const MAX_TEXT_PAGE = 50_000;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export interface AccessibleIQubeQuery {
  primitiveType?: string;
  cartridge?: string;
  query?: string;
  offset?: number;
  limit?: number;
  /** Registry scan cursor. Continue with nextScanOffset when scanComplete=false. */
  scanOffset?: number;
}

export type PersonaIQubeProjectionResult =
  | { ok: true; persona: import('@/types/access').ActivePersonaContext }
  | { ok: false; error: string };

/** Revalidate both the bearer scope and its live persona+agent agreement. */
export async function resolvePersonaIQubeAuthority(
  session: ScopedSession,
): Promise<PersonaIQubeProjectionResult> {
  if (!hasScope(session, 'iqube.read')) {
    return { ok: false, error: 'The connected agent does not hold the iqube.read projection capability.' };
  }
  const persona = await getActivePersonaByPublicRef(session.principalPublicRef).catch(() => null);
  if (!persona) {
    return { ok: false, error: 'The crossing principal no longer resolves to one active persona.' };
  }
  if (!session.agreementId) {
    return { ok: false, error: 'The crossing has no Constitutional Agreement to revalidate.' };
  }
  const agreement = await getAgreement(session.agreementId);
  if (!agreement || !OPEN_AGREEMENT_STATES.has(agreement.status)) {
    return { ok: false, error: 'The crossing agreement is not currently authorized.' };
  }
  if (agreement.selectedAgentRef !== session.agentAlias) {
    return { ok: false, error: 'The connected agent is not the delegate bound by the crossing agreement.' };
  }
  if (agreement.object.ownership.ownerCommitment !== agreementOwnerCommitment(persona.personaId)) {
    return { ok: false, error: 'The crossing agreement is not owned by the resolved persona.' };
  }
  if (!agreement.object.payload.delegatedAuthority.allowedActions.includes('iqube.read')) {
    return { ok: false, error: 'The live crossing agreement does not delegate iqube.read.' };
  }
  return { ok: true, persona };
}

function safePage(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(value!)));
}

function matchesQuery(view: RegistryCartridgeView, query?: string): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return [view.display_name, view.primitive_type, ...view.cartridge_bindings]
    .some((value) => value.toLowerCase().includes(q));
}

export async function listAccessibleIQubes(
  session: ScopedSession,
  query: AccessibleIQubeQuery = {},
) {
  const authority = await resolvePersonaIQubeAuthority(session);
  if (!authority.ok) return authority;

  // Scan the global map and filter after hydration. Primitive-specific adapter
  // enumeration predates federated sources and may otherwise omit a second
  // source that projects to the same primitive (for example Locker assets as
  // ContentQubes).
  const scanOffset = safePage(query.scanOffset, 0, Number.MAX_SAFE_INTEGER);
  const listed = await listIQubes({ limit: MAX_SCAN, offset: scanOffset });
  const candidates = listed.entries.slice(0, MAX_SCAN);
  const resolved = await Promise.all(candidates.map((entry) =>
    resolveIQube(entry.iqube_id, {
      persona: authority.persona,
      projection: 'cartridge',
      allowPrivate: true,
    }).catch(() => null),
  ));
  const accessible = resolved
    .filter((row): row is RegistryCartridgeView => Boolean(row && 'caller_can_read' in row))
    .filter((row) =>
      row.caller_can_read === true
      && (!query.primitiveType || row.primitive_type === query.primitiveType)
      && (!query.cartridge || row.cartridge_bindings.includes(query.cartridge))
      && matchesQuery(row, query.query),
    );
  const offset = safePage(query.offset, 0, accessible.length);
  const limit = safePage(query.limit, 25, MAX_PAGE) || 25;

  return {
    ok: true as const,
    entries: accessible.slice(offset, offset + limit),
    totalAccessible: accessible.length,
    offset,
    limit,
    hasMore: offset + limit < accessible.length,
    scanned: candidates.length,
    scanOffset,
    nextScanOffset: listed.entries.length < MAX_SCAN ? null : scanOffset + candidates.length,
    scanComplete: listed.entries.length < MAX_SCAN,
  };
}

export async function getAccessibleIQube(session: ScopedSession, iqubeId: string) {
  const authority = await resolvePersonaIQubeAuthority(session);
  if (!authority.ok) return authority;
  const view = await resolveIQube(iqubeId, {
    persona: authority.persona,
    projection: 'cartridge',
    allowPrivate: true,
  }).catch(() => null) as RegistryCartridgeView | null;
  if (!view || view.caller_can_read !== true) {
    // Deliberately do not distinguish missing from unauthorized.
    return { ok: false as const, error: 'iQube not found or not authorized for this persona.' };
  }
  return { ok: true as const, iqube: view };
}

/**
 * Read a bounded text rendition when the native ContentQube source already has
 * one. Binary/decryption delivery remains at the canonical content proxy; this
 * function never exposes storage URLs, ciphertext or keys.
 */
export async function readAccessibleIQubeText(
  session: ScopedSession,
  iqubeId: string,
  opts: { offset?: number; limit?: number } = {},
) {
  const access = await getAccessibleIQube(session, iqubeId);
  if (!access.ok) return access;

  const internal = await resolveIQube(iqubeId, {
    projection: 'internal',
    allowPrivate: true,
  }).catch(() => null) as CanonicalIQubeInternalRecord | null;
  if (internal?.source_system === 'research_document' && internal.source_resource_id) {
    const { pathForResearchDocumentSource } = await import('@/services/research/experimentIQubeSources');
    const { corpusReadPackFile } = await import('@/services/knowledge/packCorpusStore');
    const sourcePath = pathForResearchDocumentSource(internal.source_resource_id);
    const fullText = sourcePath ? await corpusReadPackFile('irl', sourcePath) : null;
    if (fullText === null) return { ok: false as const, error: 'The authorized research artifact could not be retrieved.' };
    return pageText(access.iqube, fullText, opts);
  }
  if (
    (internal?.source_system === 'research_object' || internal?.source_system === 'experiment_result')
    && internal.source_resource_id
  ) {
    return readResearchDataQubeText(access.iqube, internal.source_system, internal.source_resource_id, opts);
  }
  if (access.iqube.primitive_type !== 'ContentQube') {
    return { ok: false as const, error: 'No text rendition provider is registered for this iQube primitive.' };
  }
  if (internal?.source_system === 'locker_asset' && internal.source_resource_id) {
    const authority = await resolvePersonaIQubeAuthority(session);
    if (!authority.ok) return authority;
    const decision = await evaluateAccess(authority.persona, {
      assetId: internal.source_resource_id,
      contentClass: 'other',
      state: 'D_gated_canonical_pool',
      gating: internal.gating.includes('open')
        ? { kind: 'free', reason: 'locker-public' }
        : { kind: 'ownership', reason: 'persona-ownership-or-room-membership' },
      receiptEligible: !internal.gating.includes('open'),
    }, 'read');
    if (!decision.allow) {
      return { ok: false as const, error: 'iQube not found or not authorized for this persona.' };
    }
    return readLockerAssetText(access.iqube, internal.source_resource_id, opts);
  }
  if (!internal?.content_qube_id) {
    return { ok: false as const, error: 'The ContentQube has no native content binding.' };
  }
  const authority = await resolvePersonaIQubeAuthority(session);
  if (!authority.ok) return authority;
  const delivered = await resolveContentQube(internal.content_qube_id, authority.persona).catch(() => null);
  if (!delivered?.decision?.allow) {
    return { ok: false as const, error: 'iQube not found or not authorized for this persona.' };
  }
  const admin = getSupabaseServer();
  if (!admin) return { ok: false as const, error: 'The content store is unavailable.' };
  const { data: qube } = await admin
    .from('content_qubes')
    .select('media_asset_id')
    .eq('id', internal.content_qube_id)
    .maybeSingle();
  if (!qube?.media_asset_id) {
    return { ok: false as const, error: 'This iQube currently has no agent-readable text rendition.' };
  }
  const { data: media } = await admin
    .from('codex_media_assets')
    .select('extracted_text')
    .eq('id', qube.media_asset_id)
    .maybeSingle();
  const fullText = typeof media?.extracted_text === 'string' ? media.extracted_text : '';
  if (!fullText) {
    return { ok: false as const, error: 'This iQube currently has no agent-readable text rendition.' };
  }
  const offset = safePage(opts.offset, 0, fullText.length);
  const limit = safePage(opts.limit, 8_000, MAX_TEXT_PAGE) || 8_000;
  return {
    ok: true as const,
    iqube: access.iqube,
    text: fullText.slice(offset, offset + limit),
    offset,
    totalLength: fullText.length,
    hasMore: offset + limit < fullText.length,
    sha256OfFullText: createHash('sha256').update(fullText).digest('hex'),
  };
}

function pageText(
  iqube: RegistryCartridgeView,
  fullText: string,
  opts: { offset?: number; limit?: number },
) {
  const offset = safePage(opts.offset, 0, fullText.length);
  const limit = safePage(opts.limit, 8_000, MAX_TEXT_PAGE) || 8_000;
  return {
    ok: true as const,
    iqube,
    text: fullText.slice(offset, offset + limit),
    offset,
    totalLength: fullText.length,
    hasMore: offset + limit < fullText.length,
    sha256OfFullText: createHash('sha256').update(fullText).digest('hex'),
  };
}

async function readResearchDataQubeText(
  iqube: RegistryCartridgeView,
  sourceSystem: 'research_object' | 'experiment_result',
  sourceId: string,
  opts: { offset?: number; limit?: number },
) {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false as const, error: 'The research store is unavailable.' };
  const query = sourceSystem === 'research_object'
    ? admin.from('research_objects').select('object_kind, object_id, payload, lifecycle_state, receipt_id, created_at, updated_at').eq('id', sourceId)
    : admin.from('experiment_results').select('experiment, provider, model, aggregates, results_json, content_hash, receipt_id, created_at, visibility').eq('id', sourceId);
  const { data } = await query.maybeSingle();
  if (!data) return { ok: false as const, error: 'The authorized research evidence could not be retrieved.' };
  return pageText(iqube, JSON.stringify(data, null, 2), opts);
}

async function readLockerAssetText(
  iqube: RegistryCartridgeView,
  assetId: string,
  opts: { offset?: number; limit?: number },
) {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false as const, error: 'The content store is unavailable.' };
  const { data } = await admin
    .from('asset_renditions')
    .select('storage_provider, storage_uri, mime_type, size_bytes, content_hash, is_primary, created_at')
    .eq('asset_id', assetId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: false as const, error: 'This iQube currently has no agent-readable rendition.' };
  const rendition = data as {
    storage_provider: string;
    storage_uri: string;
    mime_type: string | null;
    size_bytes: number | null;
    content_hash: string | null;
  };
  if (rendition.storage_provider !== 'supabase') {
    return { ok: false as const, error: `No secure text provider is registered for ${rendition.storage_provider} renditions.` };
  }
  if (rendition.size_bytes !== null && rendition.size_bytes > MAX_SOURCE_BYTES) {
    return { ok: false as const, error: 'The source rendition exceeds the bounded extraction size.' };
  }

  let downloaded;
  try {
    downloaded = await StorageAdapterFactory.getAdapter('supabase')
      .download('locker-assets', rendition.storage_uri);
  } catch {
    return { ok: false as const, error: 'The authorized rendition could not be retrieved.' };
  }
  if (downloaded.sizeBytes > MAX_SOURCE_BYTES) {
    return { ok: false as const, error: 'The source rendition exceeds the bounded extraction size.' };
  }
  const bytes = downloaded.data instanceof Blob
    ? Buffer.from(await downloaded.data.arrayBuffer())
    : Buffer.from(downloaded.data);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (rendition.content_hash && rendition.content_hash !== sha256) {
    return { ok: false as const, error: 'The rendition failed its content-integrity check.' };
  }

  const mime = (rendition.mime_type || downloaded.contentType || '').toLowerCase();
  let fullText = '';
  try {
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
      fullText = bytes.toString('utf8');
    } else if (mime === 'application/pdf') {
      // pdf-parse is already the repository's canonical server-side PDF
      // extraction dependency (uploads/uploadIndexer + VSP upload).
      const pdfParse = (await import('pdf-parse')).default as (input: Buffer) => Promise<{ text: string }>;
      fullText = (await pdfParse(bytes)).text;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const mammoth = await import('mammoth');
      fullText = (await mammoth.extractRawText({ buffer: bytes })).value;
    } else {
      return { ok: false as const, error: 'This rendition type has no agent-readable text provider.' };
    }
  } catch {
    return { ok: false as const, error: 'The authorized rendition could not be converted to text.' };
  }
  if (!fullText.trim()) {
    return { ok: false as const, error: 'This rendition contains no extractable text.' };
  }
  const offset = safePage(opts.offset, 0, fullText.length);
  const limit = safePage(opts.limit, 8_000, MAX_TEXT_PAGE) || 8_000;
  return {
    ok: true as const,
    iqube,
    text: fullText.slice(offset, offset + limit),
    offset,
    totalLength: fullText.length,
    hasMore: offset + limit < fullText.length,
    sha256OfFullText: createHash('sha256').update(fullText).digest('hex'),
    sourceIntegritySha256: sha256,
  };
}
