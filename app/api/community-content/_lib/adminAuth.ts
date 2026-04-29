/**
 * Server-side admin gate for community-content admin routes.
 *
 * Resolves an `adminPersonaId` to its `crm_auth_profiles.id` via
 * `personas.auth_profile_id` (canonicalized by the
 * `personas_canonicalize_auth_profile_id` trigger) and checks
 * `crm_admin_roles` for an active, unexpired role — same lookup the
 * `/api/codex/admin-check` route uses for embed-bridge auth.
 *
 * Returns a tagged result so callers can short-circuit with the right
 * HTTP status without further branching.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminCheckResult =
  | { ok: true; authProfileId: string; roleType: string | null }
  | { ok: false; status: number; error: string };

export async function requireCommunityAdmin(
  supabase: SupabaseClient,
  adminPersonaId: string | null | undefined,
): Promise<AdminCheckResult> {
  if (!adminPersonaId) {
    return { ok: false, status: 401, error: 'adminPersonaId required' };
  }

  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('auth_profile_id')
    .eq('id', adminPersonaId)
    .maybeSingle();

  if (personaError) {
    return { ok: false, status: 500, error: personaError.message };
  }

  const authProfileId = (persona as { auth_profile_id?: string | null } | null)?.auth_profile_id ?? null;
  if (!authProfileId) {
    return { ok: false, status: 403, error: 'persona has no auth profile' };
  }

  const nowIso = new Date().toISOString();
  const { data: role, error: roleError } = await supabase
    .from('crm_admin_roles')
    .select('id, role_type')
    .eq('auth_profile_id', authProfileId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (roleError) {
    return { ok: false, status: 500, error: roleError.message };
  }
  if (!role) {
    return { ok: false, status: 403, error: 'admin role required' };
  }

  return {
    ok: true,
    authProfileId,
    roleType: (role as { role_type?: string | null }).role_type ?? null,
  };
}
