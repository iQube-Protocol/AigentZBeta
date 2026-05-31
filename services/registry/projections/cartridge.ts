/**
 * Cartridge projection — in-app cartridge rendering view.
 *
 * T1-only. Caller-aware: when a persona context is passed, the
 * caller_owns + caller_can_read fields populate by CALLING the spine
 * authorities (userOwnsAsset + evaluateAccess) — NEVER reimplementing
 * them. PRD v1.0 §3 authority matrix.
 *
 * If the spine call fails (network, RLS), caller_owns and
 * caller_can_read remain undefined (fail-closed-without-leaking — UI
 * treats undefined as 'unknown', not 'allowed').
 */

import type {
  CanonicalIQubeInternalRecord,
  RegistryCartridgeView,
} from '@/types/registry-canonical';
import type { ActivePersonaContext } from '@/types/access';

export interface CartridgeProjectionOpts {
  persona?: ActivePersonaContext;
}

/**
 * Pure-shape projection. Caller-aware fields populated by the resolver
 * (which makes the spine calls). This function just shapes the data.
 */
export function projectCartridge(
  rec: CanonicalIQubeInternalRecord,
  callerOwns?: boolean,
  callerCanRead?: boolean,
): RegistryCartridgeView {
  return {
    iqube_id: rec.iqube_id,
    primitive_type: rec.primitive_type,
    tool_subtype: rec.tool?.tool_subtype,
    display_name: rec.aigent?.root_agent_id ?? rec.content_qube_id ?? rec.iqube_id,
    display_description: undefined,
    cover_url: undefined,

    surface_lifecycle: rec.surface_lifecycle,
    mint_status: rec.mint_status,
    visibility_state: rec.visibility_state,
    gating: rec.gating,

    caller_owns: callerOwns,
    caller_can_read: callerCanRead,

    cartridge_bindings: rec.cartridge_bindings,
  };
}
