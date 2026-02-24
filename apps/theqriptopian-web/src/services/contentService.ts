import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Content = Tables<'content'>;

export type ContentSection = 
  | 'home-hero'
  | 'latest-news'
  | 'second-hero'
  | 'pennydrops'
  | 'scrolls'
  | '21knowdz'
  | 'staybull';

export interface ContentModalities {
  read?: {
    text: string;
    duration?: string;
  };
  watch?: {
    video_url: string;
    duration?: string;
    thumbnail?: string;
  };
  listen?: {
    audio_url: string;
    duration?: string;
    cover_image?: string;
  };
  link?: {
    url: string;
    allow_embed?: boolean;
  };
  view?: {
    // Image-only content - triggers expand/fullscreen view
    image_url?: string;
  };
}

export const contentService = {
  async getAllContentBySection(section: ContentSection, options?: { tab?: 'dev' | 'creative' | 'exec' | 'metaknyts' | 'synthsims' }) {
    let query = supabase
      .from('content')
      .select('*')
      .contains('placement', { section });

    if (options?.tab) {
      query = query.contains('placement', { tab: options.tab });
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Sort by position if available, otherwise by created_at
    return (data as Content[]).sort((a, b) => {
      const posA = (a.placement as any)?.position || 999;
      const posB = (b.placement as any)?.position || 999;
      return posA - posB;
    });
  },

  async getContentBySection(section: ContentSection, options?: { tab?: 'dev' | 'creative' | 'exec' | 'metaknyts' | 'synthsims' }) {
    let query = supabase
      .from('content')
      .select('*')
      .eq('status', 'published')
      .contains('placement', { section });

    if (options?.tab) {
      query = query.contains('placement', { tab: options.tab });
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Sort by position if available, otherwise by created_at
    return (data as Content[]).sort((a, b) => {
      const posA = (a.placement as any)?.position || 999;
      const posB = (b.placement as any)?.position || 999;
      return posA - posB;
    });
  },

  async getContent(id: string) {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Content;
  },

  hasModality(content: Content, type: 'read' | 'watch' | 'listen' | 'link' | 'view'): boolean {
    const modalities = content.modalities as ContentModalities | null;
    return !!modalities?.[type];
  },

  getModality(content: Content, type: 'read' | 'watch' | 'listen' | 'link' | 'view') {
    const modalities = content.modalities as ContentModalities | null;
    return modalities?.[type];
  },

  /**
   * Get available action buttons based on content modalities
   * Smart Content Protocol: renders buttons only for available modalities
   */
  getAvailableActions(content: Content): Array<'read' | 'watch' | 'listen' | 'link' | 'view' | 'expand' | 'share'> {
    const modalities = content.modalities as ContentModalities | null;
    const actions: Array<'read' | 'watch' | 'listen' | 'link' | 'view' | 'expand' | 'share'> = [];
    
    if (modalities?.read) actions.push('read');
    if (modalities?.watch) actions.push('watch');
    if (modalities?.listen) actions.push('listen');
    if (modalities?.link) actions.push('link');
    if (modalities?.view) actions.push('view');
    
    // Always include expand and share
    actions.push('expand');
    actions.push('share');
    
    return actions;
  },

  async getRelatedContent(id: string) {
    const content = await this.getContent(id);
    const relatedIds = content.related_content || [];

    if (relatedIds.length === 0) return [];

    const { data, error } = await supabase
      .from('content')
      .select('*')
      .in('id', relatedIds)
      .eq('status', 'published');

    if (error) throw error;
    return data as Content[];
  },

  async createContent(content: Omit<Partial<Content>, 'id' | 'created_at' | 'updated_at'> & Pick<Content, 'domain' | 'format' | 'title' | 'type'>) {
    // First do the insert without requiring a return value (RLS workaround)
    const { error: insertError } = await supabase
      .from('content')
      .insert([content as any]);

    if (insertError) throw insertError;
    
    // Try to fetch the created content by title+domain+section
    try {
      const placement = (content as any).placement;
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('title', content.title)
        .eq('domain', content.domain)
        .contains('placement', { section: placement?.section })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.warn('[contentService] Could not fetch created content:', error);
        return { ...content } as Content;
      }
      return data as Content;
    } catch (err) {
      console.warn('[contentService] Fetch failed after create:', err);
      return { ...content } as Content;
    }
  },

  async updateContent(id: string, updates: Partial<Content>) {
    // First do the update without requiring a return value
    const { error: updateError } = await supabase
      .from('content')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;
    
    // Then fetch the updated content (if RLS allows)
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.warn('[contentService] Could not fetch updated content:', error);
        // Return a partial object if we can't fetch
        return { id, ...updates } as Content;
      }
      return data as Content;
    } catch (err) {
      // If fetch fails, still return partial data to indicate success
      console.warn('[contentService] Fetch failed after update, returning partial:', err);
      return { id, ...updates } as Content;
    }
  },

  async deleteContent(id: string) {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
