/**
 * Persona Service - agentiQ persona management
 * Provides persona resolution and management functions
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

/**
 * Get current persona ID from storage
 */
export function getCurrentPersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  
  return (
    localStorage.getItem('currentPersonaId') ||
    sessionStorage.getItem('currentPersonaId') ||
    null
  );
}

/**
 * Set current persona ID in storage
 */
export function setCurrentPersonaId(personaId: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('currentPersonaId', personaId);
  sessionStorage.setItem('currentPersonaId', personaId);
}

/**
 * Get personas for the current user.
 *
 * Order: oldest first (created_at ASC). The first-created persona is
 * typically the user's primary / admin persona (the one created at
 * sign-up), whereas more recent personas tend to be cartridge-specific
 * (e.g. anonym@knyt created via KNYT onboarding). Auto-resolution
 * (resolveCurrentPersona below) defaults to personas[0], so this order
 * biases the auto-pick toward the persona the user is most likely to
 * have intended as their main one.
 *
 * Surfaces that need most-recently-created order should sort the
 * returned array themselves; the canonical order here is auto-pick-
 * friendly.
 */
export async function getMyPersonas(): Promise<{ personas: any[] }> {
  try {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { personas: [] };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { personas: [] };
    }

    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .eq('auth_profile_id', user.id)
      .order('created_at', { ascending: true }); // oldest first → admin/primary wins auto-pick

    return { personas: personas || [] };
  } catch (error) {
    console.error('[PersonaService] Failed to get personas:', error);
    return { personas: [] };
  }
}

/**
 * Resolve current persona.
 *
 *   1. If localStorage has a value, return it (user choice preserved)
 *   2. Else fetch user's personas (oldest first per getMyPersonas)
 *   3. RACE GUARD: re-check localStorage right before writing. The
 *      fetch is async; in the meantime PersonaContext or another
 *      surface may have written the user's explicit choice. Honour
 *      that choice instead of overwriting with the auto-pick.
 *   4. Otherwise seed localStorage with personas[0] (oldest = primary).
 */
export async function resolveCurrentPersona(): Promise<string | null> {
  const initial = getCurrentPersonaId();
  if (initial) return initial;

  try {
    const { personas } = await getMyPersonas();
    const firstPersona = personas[0];

    if (firstPersona?.id) {
      // Race guard — see header comment.
      const setBySomeoneElse = getCurrentPersonaId();
      if (setBySomeoneElse) return setBySomeoneElse;

      setCurrentPersonaId(firstPersona.id);
      return firstPersona.id;
    }
  } catch (error) {
    console.warn('[PersonaService] Failed to resolve persona:', error);
  }

  return null;
}
