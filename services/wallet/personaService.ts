/**
 * Persona Service
 * 
 * Core service for managing PersonaQubes - creation, storage, retrieval.
 * Integrates with FIO, key management, and Supabase storage.
 */

import {
  PersonaQube, 
  CreatePersonaInput, 
  CreatePersonaResult,
  FioDomain,
  PersonaStatus,
} from '@/types/persona';
import { ChainAddresses } from '@/types/persona';
import {
  generateEvmKeyPair, 
  importEvmKeyPair, 
  deriveChainAddresses,
  isValidPrivateKey,
  validatePassword,
} from './keyService';
import {
  getPersonaFioService, 
  generateDidFromHandle, 
  buildFioHandle,
  isValidUsername,
} from './personaFioService';

function getAuthProfileIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('authProfileId') ||
    window.localStorage.getItem('agentiq_auth_profile_id') ||
    window.sessionStorage.getItem('authProfileId') ||
    window.sessionStorage.getItem('agentiq_auth_profile_id')
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getOrCreateAuthProfileId(): string | null {
  const existing = getAuthProfileIdFromStorage();
  if (existing && isUuid(existing)) return existing;
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_DEV_AUTH_PROFILE_ID || null;

  try {
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null;
    if (!generated) {
      return process.env.NEXT_PUBLIC_DEV_AUTH_PROFILE_ID || null;
    }
    window.localStorage.setItem('authProfileId', generated);
    window.localStorage.setItem('agentiq_auth_profile_id', generated);
    window.sessionStorage.setItem('authProfileId', generated);
    window.sessionStorage.setItem('agentiq_auth_profile_id', generated);
    return generated;
  } catch {
    return process.env.NEXT_PUBLIC_DEV_AUTH_PROFILE_ID || null;
  }
}

function withAuthHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers || {});
  const devAuthProfileId = getOrCreateAuthProfileId() || '';
  if (devAuthProfileId) headers.set('x-auth-profile-id', devAuthProfileId);
  return { ...init, headers };
}

function withAuthProfileParam(url: string): string {
  const devAuthProfileId = getOrCreateAuthProfileId();
  if (!devAuthProfileId) return url;
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (!u.searchParams.has('authProfileId')) {
    u.searchParams.set('authProfileId', devAuthProfileId);
  }
  return u.pathname + u.search;
}

// =============================================================================
// PERSONA STORAGE (Supabase)
// =============================================================================

/**
 * Store a persona in Supabase
 */
async function storePersona(persona: PersonaQube): Promise<void> {
  try {
    const response = await fetch(
      withAuthProfileParam('/api/wallet/persona'),
      withAuthHeaders({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona),
      })
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.details || error.error || 'Failed to store persona');
    }
  } catch (error) {
    console.error('Failed to store persona:', error);
    throw error;
  }
}

/**
 * Get a persona by ID
 */
export async function getPersonaById(id: string): Promise<PersonaQube | null> {
  try {
    const response = await fetch(
      withAuthProfileParam(`/api/wallet/persona/${id}`),
      withAuthHeaders()
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch persona');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to get persona:', error);
    return null;
  }
}

/**
 * Get all personas for a user (by auth profile ID)
 */
export async function getPersonasByAuthProfile(authProfileId: string): Promise<PersonaQube[]> {
  try {
    const response = await fetch(
      `/api/wallet/personas?authProfileId=${encodeURIComponent(authProfileId)}`,
      withAuthHeaders()
    );
    if (!response.ok) {
      throw new Error('Failed to fetch personas');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to get personas:', error);
    return [];
  }
}

/**
 * Get persona by FIO handle
 */
export async function getPersonaByHandle(fioHandle: string): Promise<PersonaQube | null> {
  try {
    const response = await fetch(
      withAuthProfileParam(`/api/wallet/persona/by-handle/${encodeURIComponent(fioHandle)}`),
      withAuthHeaders()
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch persona');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to get persona by handle:', error);
    return null;
  }
}

/**
 * Update a persona
 */
export async function updatePersona(id: string, updates: Partial<PersonaQube>): Promise<PersonaQube | null> {
  try {
    const response = await fetch(
      withAuthProfileParam(`/api/wallet/persona/${id}`),
      withAuthHeaders({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    );
    
    if (!response.ok) {
      throw new Error('Failed to update persona');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to update persona:', error);
    return null;
  }
}

// =============================================================================
// PERSONA CREATION
// =============================================================================

/**
 * Create a new persona
 * 
 * This is the main entry point for persona creation. It:
 * 1. Validates input
 * 2. Checks FIO handle availability
 * 3. Generates or imports EVM keys
 * 4. Generates DID from FIO handle
 * 5. Registers FIO handle (optional, can be deferred)
 * 6. Stores persona in Supabase
 */
export async function createPersona(input: CreatePersonaInput): Promise<CreatePersonaResult> {
  try {
    // 1. Validate input
    const validationError = validateCreatePersonaInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }
    
    // 2. Build and check FIO handle
    const fioHandle = buildFioHandle(input.username, input.domain);
    const fioService = getPersonaFioService();
    
    const availability = await fioService.checkHandleAvailability(input.username, input.domain);
    if (!availability.available) {
      return { 
        success: false, 
        error: availability.error || `Handle ${fioHandle} is not available` 
      };
    }
    
    // 3. Generate or import EVM keys
    let evmKey;
    if (input.keySource === 'imported' && input.importedPrivateKey) {
      if (!isValidPrivateKey(input.importedPrivateKey)) {
        return { success: false, error: 'Invalid private key format' };
      }
      evmKey = await importEvmKeyPair(input.importedPrivateKey, input.password);
    } else {
      evmKey = await generateEvmKeyPair(input.password);
    }
    
    // 4. Derive chain addresses
    const chainAddresses = deriveChainAddresses(evmKey.address);
    
    // 5. Generate DID from FIO handle
    const rootDid = await generateDidFromHandle(fioHandle);
    
    // 6. Create persona object
    const now = new Date().toISOString();
    const persona: PersonaQube = {
      id: crypto.randomUUID(),
      type: 'PersonaQube',
      fioHandle,
      fioDomain: input.domain,
      rootDid,
      displayName: input.displayName,
      avatarUri: input.avatarUri,
      evmKey,
      chainAddresses,
      reputationScore: 0,
      reputationBucket: 0,
      badges: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      tenantId: input.tenantId,
    };
    
    // 7. Store persona
    await storePersona(persona);
    
    // 8. Optionally register FIO handle (can be deferred for testnet)
    // For now, we skip actual FIO registration and just store locally
    // In production, uncomment:
    // const fioRegistration = await fioService.registerHandle(input.username, input.domain, evmKey.publicKey);
    
    return {
      success: true,
      persona,
      // fioRegistration,
    };
    
  } catch (error) {
    console.error('Failed to create persona:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to create persona',
    };
  }
}

/**
 * Validate persona creation input
 */
function validateCreatePersonaInput(input: CreatePersonaInput): string | null {
  // Username validation
  if (!input.username || !isValidUsername(input.username)) {
    return 'Invalid username. Use 1-64 alphanumeric characters and hyphens.';
  }
  
  // Domain validation
  if (!['qripto', 'knyt'].includes(input.domain)) {
    return 'Invalid domain. Must be "qripto" or "knyt".';
  }
  
  // Display name validation
  if (!input.displayName || input.displayName.trim().length === 0) {
    return 'Display name is required.';
  }
  
  // Password validation
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    return passwordValidation.errors[0];
  }
  
  // Imported key validation
  if (input.keySource === 'imported') {
    if (!input.importedPrivateKey) {
      return 'Private key is required for import.';
    }
    if (!isValidPrivateKey(input.importedPrivateKey)) {
      return 'Invalid private key format.';
    }
  }
  
  // Tenant ID validation
  if (!input.tenantId) {
    return 'Tenant ID is required.';
  }
  
  return null;
}

// =============================================================================
// PERSONA MANAGEMENT
// =============================================================================

/**
 * Set a persona as active (for switching between personas)
 */
export async function setActivePersona(personaId: string): Promise<boolean> {
  try {
    // Store active persona ID in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_persona_id', personaId);
    }
    return true;
  } catch (error) {
    console.error('Failed to set active persona:', error);
    return false;
  }
}

/**
 * Get the currently active persona ID
 */
export function getActivePersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_persona_id');
}

/**
 * Get the currently active persona
 */
export async function getActivePersona(): Promise<PersonaQube | null> {
  const id = getActivePersonaId();
  if (!id) return null;
  return getPersonaById(id);
}

/**
 * Deactivate a persona
 */
export async function deactivatePersona(personaId: string): Promise<boolean> {
  return updatePersona(personaId, { status: 'inactive' }) !== null;
}

/**
 * Reactivate a persona
 */
export async function reactivatePersona(personaId: string): Promise<boolean> {
  return updatePersona(personaId, { status: 'active' }) !== null;
}

// =============================================================================
// REPUTATION INTEGRATION
// =============================================================================

/**
 * Update persona reputation
 */
export async function updatePersonaReputation(
  personaId: string,
  score: number,
  bucket: 0 | 1 | 2 | 3 | 4 | 5
): Promise<boolean> {
  return updatePersona(personaId, { 
    reputationScore: score, 
    reputationBucket: bucket,
    updatedAt: new Date().toISOString(),
  }) !== null;
}

/**
 * Add a badge to persona
 */
export async function addPersonaBadge(personaId: string, badge: string): Promise<boolean> {
  const persona = await getPersonaById(personaId);
  if (!persona) return false;
  
  // Don't add duplicate badges
  if (persona.badges.includes(badge)) return true;
  
  return updatePersona(personaId, {
    badges: [...persona.badges, badge],
    updatedAt: new Date().toISOString(),
  }) !== null;
}

// All exports are inline with their declarations
