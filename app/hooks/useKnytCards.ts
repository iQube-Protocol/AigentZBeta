/**
 * useKnytCards Hook
 * 
 * Fetches and manages KNYT card assets from the codex
 */

import { useState, useEffect, useCallback } from 'react';

export interface KnytCardAsset {
  id: string;
  title: string;
  episodeNumber: number | null;
  assetKind: 'character_poster' | 'powers_sheet';
  autoDriveCid: string;
  mimeType: string;
  characterId?: string;
  characterName?: string;
  digiterraName?: string;
  affiliation?: string;
  powers?: string;
  primaryWeapon?: string;
}

export interface EpisodeGroup {
  episodeNumber: number;
  displayNumber: string;
  posters: KnytCardAsset[];
  sheets: KnytCardAsset[];
}

export interface KnytCardsApiResponse {
  success: boolean;
  series: string;
  totalPosters: number;
  totalSheets: number;
  totalCards: number;
  cards: KnytCardAsset[];
  byEpisode: Array<{
    episodeNumber: number;
    displayNumber: string;
    posters: KnytCardAsset[];
    sheets: KnytCardAsset[];
    totalCards: number;
  }>;
}

export interface UseKnytCardsReturn {
  groups: EpisodeGroup[];
  loading: boolean;
  error: string | null;
  refreshCards: () => Promise<void>;
}

interface UseKnytCardsOptions {
  enabled?: boolean;
}

export function useKnytCards(options: UseKnytCardsOptions = {}): UseKnytCardsReturn {
  const { enabled = true } = options;
  const [groups, setGroups] = useState<EpisodeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/codex/knyt-cards');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: KnytCardsApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error('API returned unsuccessful response');
      }
      
      // Convert API response to our EpisodeGroup format
      const episodeGroups: EpisodeGroup[] = data.byEpisode.map(episode => ({
        episodeNumber: episode.episodeNumber,
        displayNumber: episode.displayNumber,
        posters: episode.posters,
        sheets: episode.sheets,
      }));
      
      setGroups(episodeGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KNYT cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshCards();
  }, [enabled, refreshCards]);

  return {
    groups,
    loading,
    error,
    refreshCards,
  };
}
