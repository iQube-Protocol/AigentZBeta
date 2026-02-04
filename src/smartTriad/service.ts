/**
 * Smart Triad Service
 * Load and save SmartTriadSet configurations
 */

import type { SmartTriadSet } from './model';
import { qriptopianTriadSet, metaKnytsTriadSet, moneyPennyTriadSet } from './fixtures';
import { SmartTriadAdapter } from '@/services/drawer/smartTriadAdapter';
import type { DrawerSetQuery } from '@/services/drawer/drawerService';

// In-memory cache for demo purposes
const cache = new Map<string, SmartTriadSet>();

/**
 * Build a triad set ID from app, tenant, and persona.
 */
export function buildTriadSetId(appId: string, tenantId: string, personaId: string): string {
  return `ds:${appId.toLowerCase()}:${tenantId}:persona-${personaId}`;
}

/**
 * Get a SmartTriadSet by app, tenant, and persona.
 * Fetches from production backend API and converts to console format.
 */
export async function getSmartTriadSet(
  appId: string,
  tenantId: string,
  personaId: string
): Promise<SmartTriadSet | null> {
  const id = buildTriadSetId(appId, tenantId, personaId);
  
  // Check cache first
  if (cache.has(id)) {
    return cache.get(id)!;
  }

  try {
    // Fetch from backend API
    const response = await fetch(`/api/drawer/sets?appId=${appId}&tenantId=${tenantId}&personaId=${personaId}`);
    
    if (!response.ok) {
      console.error('Failed to fetch drawer set:', response.statusText);
      return null;
    }
    
    const drawerSet = await response.json();
    
    // Convert production format to console format
    const triadSet = SmartTriadAdapter.fromDrawerSet(drawerSet);
    cache.set(id, triadSet);
    
    return triadSet;
  } catch (error) {
    console.error('Error fetching drawer set:', error);
    return null;
  }
}

export async function saveSmartTriadSet(set: SmartTriadSet): Promise<void> {
  // Update cache
  cache.set(set.id, set);

  // TODO: Persist to database/API
  console.log('[SmartTriad] Saved:', set.id);
}

export async function listSmartTriadSets(appId?: string): Promise<SmartTriadSet[]> {
  const all = Array.from(cache.values());
  
  if (appId) {
    return all.filter(set => set.appId === appId);
  }
  
  return all;
}
