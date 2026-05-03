'use client';

import { useEffect, useState } from 'react';

export interface CoverThumb {
  episodeNumber: number;
  thumbUrl: string;
  rarityTier: string | null;
}

export interface CharacterThumb {
  episodeNumber: number;
  thumbUrl: string;
  title: string;
}

interface ThumbnailData {
  covers: CoverThumb[];
  characters: CharacterThumb[];
}

const cache: { data: ThumbnailData | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function useKnytThumbnails() {
  const [data, setData] = useState<ThumbnailData>({ covers: [], characters: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
      setData(cache.data);
      setLoading(false);
      return;
    }
    fetch('/api/knyt/thumbnails?series=metaKnyts')
      .then((r) => r.json())
      .then((raw: unknown) => {
        // System-boundary validation: the API normally returns
        // { covers: [...], characters: [...] } but a Lambda timeout, a 5xx
        // returning HTML, or a partial body can give us a non-conforming
        // payload. Without this guard, downstream getCoverThumb crashes the
        // surface with "undefined is not an object (evaluating 'e.covers.find')".
        const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<ThumbnailData>;
        const safe: ThumbnailData = {
          covers: Array.isArray(obj.covers) ? obj.covers : [],
          characters: Array.isArray(obj.characters) ? obj.characters : [],
        };
        cache.data = safe;
        cache.fetchedAt = Date.now();
        setData(safe);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Primary cover thumb for an episode (first cover_image found, fallback cover_pdf) */
  function getCoverThumb(episodeNumber: number): string | undefined {
    return data.covers.find((c) => c.episodeNumber === episodeNumber)?.thumbUrl;
  }

  /** All cover variants for an episode (multiple rarities) */
  function getEpisodeCovers(episodeNumber: number): CoverThumb[] {
    return data.covers.filter((c) => c.episodeNumber === episodeNumber);
  }

  /** Character poster thumb for an episode's card */
  function getCharacterThumb(episodeNumber: number): string | undefined {
    return data.characters.find((c) => c.episodeNumber === episodeNumber)?.thumbUrl;
  }

  return {
    loading,
    covers: data.covers,
    characters: data.characters,
    getCoverThumb,
    getEpisodeCovers,
    getCharacterThumb,
  };
}
