import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export const normalizeEmail = (v: string) => v.trim().toLowerCase();

export async function listEmailAliases(authProfileId: string) {
  const { data, error } = await db
    .from('crm_auth_profile_emails')
    .select('email,email_normalized,is_primary,is_verified,status')
    .eq('auth_profile_id', authProfileId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertEmailAlias(authProfileId: string, email: string, isPrimary = false) {
  const n = normalizeEmail(email);
  if (!n) throw new Error('Invalid email');
  const { error } = await db.from('crm_auth_profile_emails').upsert({ auth_profile_id: authProfileId, email: n, email_normalized: n, is_primary: isPrimary, is_verified: true, status: 'active' }, { onConflict: 'email_normalized' });
  if (error) throw error;
}

export async function getAuthProfileIdByEmail(email: string): Promise<string | null> {
  const n = normalizeEmail(email);
  if (!n) return null;

  const { data: aliasRows, error: aliasError } = await db
    .from('crm_auth_profile_emails')
    .select('auth_profile_id')
    .eq('email_normalized', n)
    .eq('status', 'active')
    .limit(1);
  if (aliasError) throw aliasError;
  if (aliasRows?.[0]?.auth_profile_id) return String(aliasRows[0].auth_profile_id);

  const { data: profile, error: profileError } = await db
    .from('crm_auth_profiles')
    .select('id')
    .eq('email', n)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile?.id ? String(profile.id) : null;
}

export async function getMergedLinkedAuthProfileIds(authProfileId: string): Promise<string[]> {
  // Check both directions: profiles this one owns links TO, and profiles that link TO this one
  const { data, error } = await db
    .from('crm_auth_profile_links')
    .select('owner_auth_profile_id,linked_auth_profile_id')
    .or(`owner_auth_profile_id.eq.${authProfileId},linked_auth_profile_id.eq.${authProfileId}`)
    .eq('active', true)
    .eq('relationship_mode', 'merged');
  if (error) throw error;
  const ids = new Set<string>();
  for (const r of data || []) {
    if (r.owner_auth_profile_id !== authProfileId) ids.add(String(r.owner_auth_profile_id));
    if (r.linked_auth_profile_id !== authProfileId) ids.add(String(r.linked_auth_profile_id));
  }
  return Array.from(ids);
}

export async function getPersonaPrefs(authProfileId: string) {
  const { data, error } = await db
    .from('crm_persona_access_preferences')
    .select('persona_id,access_mode')
    .eq('owner_auth_profile_id', authProfileId);
  if (error) throw error;
  return data || [];
}
