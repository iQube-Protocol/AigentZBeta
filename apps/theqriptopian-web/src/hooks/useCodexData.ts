/**
 * useCodexData - Persistent caching hook for Codex content
 * Uses React Query to cache episodes, characters, and lore across drawer opens/closes
 */

import { useQuery } from '@tanstack/react-query';

interface Episode {
  episodeNumber: number;
  displayNumber: string;
  title?: string;
  coverImageCid?: string;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  hasPrintEpic: boolean;
  hasPrintLegendary: boolean;
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  motionMasterCid?: string;
  coverCount: number;
  characterCount: number;
}

interface Character {
  id: string;
  name: string;
  episode_number: number;
  front_cid?: string;
  back_cid?: string;
  rarity?: string;
}

interface LoreAsset {
  id: string;
  title: string;
  asset_kind: string;
  auto_drive_cid: string;
  episode_number: number | null;
  display_mode: 'pdf' | 'image' | 'video' | 'text_extract' | null;
  extracted_text: string | null;
  created_at: string;
}

async function fetchEpisodes(): Promise<Episode[]> {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch episodes`);
  }
  
  const data = await res.json();
  return data.episodes || [];
}

async function fetchCharacters(): Promise<Character[]> {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${apiBase}/api/codex/knyt-cards`);
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch characters`);
  }
  
  const data = await res.json();
  return data.cards || [];
}

async function fetchLoreAssets(): Promise<LoreAsset[]> {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${apiBase}/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`);
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to fetch lore`);
  }
  
  const data = await res.json();
  return data.assets || [];
}

/**
 * Hook for fetching and caching episodes
 * Cache persists for 10 minutes and survives drawer closes
 */
export function useCodexEpisodes() {
  return useQuery({
    queryKey: ['codex', 'episodes', 'metaKnyts'],
    queryFn: fetchEpisodes,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching and caching characters
 */
export function useCodexCharacters() {
  return useQuery({
    queryKey: ['codex', 'characters', 'metaKnyts'],
    queryFn: fetchCharacters,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching and caching lore assets
 */
export function useCodexLore() {
  return useQuery({
    queryKey: ['codex', 'lore'],
    queryFn: fetchLoreAssets,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
