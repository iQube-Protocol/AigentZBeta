/**
 * Public projection — public catalog view.
 *
 * T2-only. Only records whose visibility_state ∈ {public,
 * public_meta_private_payload} project to this shape. Caller MUST
 * filter by visibility before calling; this function will throw on a
 * private / unlisted record to fail loudly rather than leak.
 *
 * Pure function. No T0 / T1 caller-specific fields. The legibility
 * card surface (/.well-known/iqube-catalog + /api/iqubes/[id]/card) is
 * an entirely separate projection (services/iqube/legibility/cardBuilder)
 * — both are 'public' but the card carries more agent-facing structure
 * (policy/actions/links). This RegistryPublicView is the registry-side
 * minimal catalog row.
 */

import type {
  CanonicalIQubeInternalRecord,
  RegistryPublicView,
} from '@/types/registry-canonical';

export function projectPublic(rec: CanonicalIQubeInternalRecord): RegistryPublicView {
  if (rec.visibility_state !== 'public' && rec.visibility_state !== 'public_meta_private_payload') {
    throw new Error(
      `projectPublic refusing to project visibility_state='${rec.visibility_state}' for iqube_id=${rec.iqube_id} — caller filter bug`,
    );
  }

  return {
    iqube_id: rec.iqube_id,
    primitive_type: rec.primitive_type,
    tool_subtype: rec.tool?.tool_subtype,
    display_name: rec.aigent?.root_agent_id ?? rec.content_qube_id ?? rec.iqube_id,
    display_description: undefined,
    cover_url: undefined,
    visibility_state: rec.visibility_state as 'public' | 'public_meta_private_payload',
    gating: rec.gating,
    required_credentials: rec.required_credentials,
  };
}
