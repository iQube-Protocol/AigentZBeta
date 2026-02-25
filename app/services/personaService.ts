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
 * Get personas for the current user
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
      .order('created_at', { ascending: false });

    return { personas: personas || [] };
  } catch (error) {
    console.error('[PersonaService] Failed to get personas:', error);
    return { personas: [] };
  }
}

/**
 * Resolve current persona (get from storage or fetch first available)
 */
export async function resolveCurrentPersona(): Promise<string | null> {
  // Try to get from storage first
  const currentPersonaId = getCurrentPersonaId();
  if (currentPersonaId) {
    return currentPersonaId;
  }

  // If not in storage, fetch first available persona
  try {
    const { personas } = await getMyPersonas();
    const firstPersona = personas[0];
    
    if (firstPersona?.id) {
      setCurrentPersonaId(firstPersona.id);
      return firstPersona.id;
    }
  } catch (error) {
    console.warn('[PersonaService] Failed to resolve persona:', error);
  }

  return null;
}
