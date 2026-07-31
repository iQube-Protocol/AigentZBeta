/**
 * Admin projection — operator console view.
 *
 * Surfaces every internal field EXCEPT raw persona IDs. Persona-bearing
 * fields are projected as { identity_state, alias_commitment } only.
 * This is the projection used by the iqube-registry cartridge admin
 * tabs (Stage 8) and by the canonization approval queue UI.
 *
 * Pure function — no DB calls, no spine calls. Caller passes the
 * internal record (resolver-hydrated) and gets a redacted view back.
 */

import type {
  CanonicalIQubeInternalRecord,
  RegistryAdminView,
  IQubeIdentityState,
} from '@/types/registry-canonical';

export function projectAdmin(rec: CanonicalIQubeInternalRecord): RegistryAdminView {
  return {
    iqube_id: rec.iqube_id,
    primitive_type: rec.primitive_type,
    tool_subtype: rec.tool?.tool_subtype,
    display_name: rec.aigent?.root_agent_id ?? rec.content_qube_id ?? rec.iqube_id, // Resolver overrides via record; this is a fallback
    display_description: undefined,
    cover_url: undefined,

    internal_lifecycle: rec.internal_lifecycle,
    surface_lifecycle: rec.surface_lifecycle,
    mint_status: rec.mint_status,
    visibility_state: rec.visibility_state,
    gating: rec.gating,

    creator: redactPersona(rec.creator_identity_state, rec.creator_alias_commitment),
    steward: rec.steward_persona_id
      ? redactPersona(rec.creator_identity_state, rec.creator_alias_commitment)
      : undefined,

    chain_anchor: rec.chain_anchor,
    mint_saga_id: rec.mint_saga_id,
    edition_supply: rec.edition_supply,
    cartridge_bindings: rec.cartridge_bindings,
    dvn_receipt_index: rec.dvn_receipt_index,
    version: rec.version,
    created_at: rec.created_at,
    updated_at: rec.updated_at,
  };
}

function redactPersona(
  identity_state: IQubeIdentityState,
  alias_commitment?: string,
): { identity_state: IQubeIdentityState; alias_commitment?: string } {
  return { identity_state, alias_commitment };
}
