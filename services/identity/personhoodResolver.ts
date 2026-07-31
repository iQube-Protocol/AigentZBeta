/**
 * personhoodResolver — resolve the caller's PERSONHOOD set per the DidQube
 * three-class model (operator ratification 2026-07-20).
 *
 * The three DidQube classes, and what each underpins:
 *
 *   1. KYBE DID (`kybe_identity`) — anonymized proof-of-life; World ID serves
 *      as the humanity verification. THE PASSPORT IS KYBE-DRIVEN: it belongs
 *      to the person, a level BENEATH persona.
 *   2. ROOT DID (`root_identity`, `kybe_id` → kybe) — proof of identity
 *      (potentially KYC-grade, identifiable). Linked to the auth session via
 *      `root_identity.auth_user_id`.
 *   3. PERSONA (`did_persona`, `root_id` → root; spine `personas` for the
 *      integration face) — the interaction/integration faces toward legacy
 *      systems and agents. AGENTS ARE BOUNDED AT THE PERSONA LEVEL.
 *
 * This resolver walks the chain from the caller's session:
 *   Bearer → auth user id → root_identity(auth_user_id) → kybe_id →
 *   every root under that kybe → every did_persona under those roots
 * and, in parallel, enumerates the caller's SPINE personas (merged auth
 * profiles → personas), because passport/grant rows minted through the spine
 * path are keyed by spine persona_id while bureau-minted rows carry
 * did_persona_id. Observation surfaces union both keys.
 *
 * Composition only: the ONE canonical token parser (getCallerIdentityContext)
 * and the ONE canonical linked-profile resolver (getMergedLinkedAuthProfileIds)
 * are reused — never re-implemented (CLAUDE.md spine rule).
 *
 * T0 discipline: everything returned here is server-internal. NEVER serialise
 * any of these ids to the browser or into receipts/chain payloads.
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';

export interface PersonhoodSet {
  /** Spine persona ids (personas table) owned by the person across merged auth profiles. */
  spinePersonaIds: string[];
  /** DidQube did_persona ids under the person's kybe-rooted identity chain. */
  didPersonaIds: string[];
  /** True when the kybe/root chain resolved (root_identity row found for the session). */
  kybeResolved: boolean;
}

/**
 * Resolve the caller's personhood set. Fail-DEGRADED, never fail-open: any
 * enumeration error collapses to { [activePersonaId], [], false } so a
 * transient DB fault narrows observation to the active persona rather than
 * widening it or throwing.
 */
export async function resolvePersonhood(
  request: NextRequest,
  admin: SupabaseClient,
  input: { authProfileId: string; activePersonaId: string },
): Promise<PersonhoodSet> {
  const degraded: PersonhoodSet = {
    spinePersonaIds: [input.activePersonaId],
    didPersonaIds: [],
    kybeResolved: false,
  };

  // ── Spine personas (persona class, integration faces) ────────────────────
  let spinePersonaIds: string[] = degraded.spinePersonaIds;
  try {
    const linked = await getMergedLinkedAuthProfileIds(input.authProfileId).catch(() => []);
    const profileIds = Array.from(new Set([input.authProfileId, ...linked]));
    const { data } = await admin
      .from('personas')
      .select('id')
      .in('auth_profile_id', profileIds)
      .eq('status', 'active');
    const ids = (data ?? []).map((r) => String((r as { id: unknown }).id));
    if (ids.length > 0) spinePersonaIds = ids;
  } catch {
    /* keep degraded set */
  }

  // ── Kybe chain (personhood class) ─────────────────────────────────────────
  // Bearer → auth user → root_identity → kybe → sibling roots → did_personas.
  let didPersonaIds: string[] = [];
  let kybeResolved = false;
  try {
    const caller = await getCallerIdentityContext(request);
    const authUserId = caller?.authUserId ?? null;
    if (authUserId) {
      const { data: rootRow } = await admin
        .from('root_identity')
        .select('id, kybe_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (rootRow?.id) {
        kybeResolved = true;
        let rootIds = [String(rootRow.id)];
        if (rootRow.kybe_id) {
          const { data: siblingRoots } = await admin
            .from('root_identity')
            .select('id')
            .eq('kybe_id', rootRow.kybe_id);
          const siblings = (siblingRoots ?? []).map((r) => String((r as { id: unknown }).id));
          if (siblings.length > 0) rootIds = siblings;
        }
        const { data: didRows } = await admin
          .from('did_persona')
          .select('id')
          .in('root_id', rootIds);
        didPersonaIds = (didRows ?? []).map((r) => String((r as { id: unknown }).id));
      }
    }
  } catch {
    /* kybe chain unavailable → observation proceeds on spine personas only */
  }

  return { spinePersonaIds, didPersonaIds, kybeResolved };
}
