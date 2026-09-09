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
import type {
  CanonicalIQubeInternalRecord,
  RegistryCartridgeView,
} from '@/types/registry-canonical';

const OPEN_AGREEMENT_STATES = new Set(['authorized', 'executed', 'settled', 'reconstitutable']);
const MAX_PAGE = 100;
const MAX_SCAN = 500;
const MAX_TEXT_PAGE = 50_000;

export interface AccessibleIQubeQuery {
  primitiveType?: string;
  cartridge?: string;
  query?: string;
  offset?: number;
  limit?: number;
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

  const listed = await listIQubes({
    primitive_type: query.primitiveType,
    cartridge: query.cartridge,
    limit: MAX_SCAN,
  });
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
    .filter((row) => row.caller_can_read === true && matchesQuery(row, query.query));
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
  if (access.iqube.primitive_type !== 'ContentQube') {
    return { ok: false as const, error: 'No text rendition provider is registered for this iQube primitive.' };
  }

  const internal = await resolveIQube(iqubeId, {
    projection: 'internal',
    allowPrivate: true,
  }).catch(() => null) as CanonicalIQubeInternalRecord | null;
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
