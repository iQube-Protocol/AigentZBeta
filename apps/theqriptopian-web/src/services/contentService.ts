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

  hasModality(content: Content, type: 'read' | 'watch' | 'listen' | 'link'): boolean {
    const modalities = content.modalities as ContentModalities | null;
    return !!modalities?.[type];
  },

  getModality(content: Content, type: 'read' | 'watch' | 'listen' | 'link') {
    const modalities = content.modalities as ContentModalities | null;
    return modalities?.[type];
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
    const { data, error } = await supabase
      .from('content')
      .insert([content as any])
      .select()
      .single();

    if (error) throw error;
    return data as Content;
  },

  async updateContent(id: string, updates: Partial<Content>) {
    const { data, error } = await supabase
      .from('content')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Content;
  },

  async deleteContent(id: string) {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
