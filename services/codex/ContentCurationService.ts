/**
 * Content Curation Service
 * 
 * Server-side content fetching and curation for the Codex.
 * Fetches content from Qriptopian/Codex APIs and transforms it
 * into template-ready format based on user intent.
 */

interface CurationParams {
  intent: string;
  focus?: string;
  realm: string;
  personaId: string;
  device?: string;
}

interface ContentItem {
  id: string;
  type: string;
  title: string;
  metadata?: any;
  media?: any;
  modalities?: any;
}

export class ContentCurationService {
  private apiBase: string;

  constructor(apiBase: string = 'http://localhost:3000') {
    this.apiBase = apiBase;
  }

  /**
   * Fetch and curate content based on intent
   */
  async fetchContent(params: CurationParams): Promise<ContentItem[]> {
    const { intent, focus, realm } = params;

    console.log('[ContentCuration] Fetching content:', { intent, focus, realm });

    try {
      // Fetch based on focus
      if (focus === 'characters') {
        return await this.fetchCharacters(realm);
      }
      
      if (focus === 'episodes') {
        return await this.fetchEpisodes(realm);
      }

      if (focus === 'lore') {
        return await this.fetchLore(realm);
      }

      // Default: fetch mixed content
      return await this.fetchMixed(realm);

    } catch (error) {
      console.error('[ContentCuration] Error fetching content:', error);
      return [];
    }
  }

  /**
   * Fetch characters for the given realm
   */
  private async fetchCharacters(realm: string): Promise<ContentItem[]> {
    try {
      const series = realm === 'digiterra' ? 'metaKnyts' : 'qriptopian';
      
      const response = await fetch(
        `${this.apiBase}/api/admin/codex/import?collection=characters&series=${series}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        return [];
      }

      // Transform to template format
      return result.data.map((char: any) => ({
        id: char.id,
        type: 'character_portrait',
        title: char.digiterra_name || char.terra_name || 'Unknown',
        metadata: {
          realm,
          characterId: char.id,
          description: char.description,
          knytValue: char.knyt_value,
        },
        media: {
          image_cid: char.image_cid,
        },
        modalities: {
          canView: true,
          canRead: !!char.description,
        },
      }));

    } catch (error) {
      console.error('[ContentCuration] Error fetching characters:', error);
      return [];
    }
  }

  /**
   * Fetch episodes for the given realm
   */
  private async fetchEpisodes(realm: string): Promise<ContentItem[]> {
    try {
      const series = realm === 'digiterra' ? 'metaKnyts' : 'qriptopian';
      
      const response = await fetch(
        `${this.apiBase}/api/admin/codex/status?series=${series}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.episodes) {
        return [];
      }

      // Transform episodes to template format
      const items: ContentItem[] = [];

      for (const ep of result.episodes) {
        // Add motion comic if available
        if (ep.hasMotionMaster && ep.motionMasterCid) {
          items.push({
            id: `motion_ep${ep.episodeNumber}`,
            type: 'motion_comic_landscape',
            title: ep.title || `Episode ${ep.displayNumber}`,
            metadata: {
              realm,
              episodeNumber: ep.episodeNumber,
              displayNumber: ep.displayNumber,
            },
            media: {
              video_cid: ep.motionMasterCid,
            },
            modalities: {
              canWatch: true,
            },
          });
        }

        // Add print comic if available
        if (ep.hasStillMaster) {
          items.push({
            id: `print_ep${ep.episodeNumber}`,
            type: 'comic_page_portrait',
            title: ep.title || `Episode ${ep.displayNumber}`,
            metadata: {
              realm,
              episodeNumber: ep.episodeNumber,
              displayNumber: ep.displayNumber,
            },
            media: {
              image_cid: ep.coverImageCid,
            },
            modalities: {
              canRead: true,
            },
          });
        }
      }

      return items;

    } catch (error) {
      console.error('[ContentCuration] Error fetching episodes:', error);
      return [];
    }
  }

  /**
   * Fetch lore content
   */
  private async fetchLore(realm: string): Promise<ContentItem[]> {
    // TODO: Implement lore fetching when lore API is available
    console.log('[ContentCuration] Lore fetching not yet implemented');
    return [];
  }

  /**
   * Fetch mixed content (characters + episodes)
   */
  private async fetchMixed(realm: string): Promise<ContentItem[]> {
    try {
      const [characters, episodes] = await Promise.all([
        this.fetchCharacters(realm),
        this.fetchEpisodes(realm),
      ]);

      // Mix content: some characters, some episodes
      const mixed: ContentItem[] = [];
      
      // Add up to 6 characters
      mixed.push(...characters.slice(0, 6));
      
      // Add up to 4 episodes
      mixed.push(...episodes.slice(0, 4));

      return mixed;
    } catch (error) {
      console.error('[ContentCuration] Error fetching mixed content:', error);
      return [];
    }
  }

  async fetchCharacterEpisodes(characterName: string): Promise<ContentItem[]> {
    const response = await fetch(`${this.apiBase}/api/codex/kb/search?query=${encodeURIComponent(characterName)}`);
    const result = await response.json();
    return result.results || [];
  }
}

// Singleton instance
let service: ContentCurationService | null = null;

export function getContentCurationService(): ContentCurationService {
  if (!service) {
    service = new ContentCurationService();
  }
  return service;
}
