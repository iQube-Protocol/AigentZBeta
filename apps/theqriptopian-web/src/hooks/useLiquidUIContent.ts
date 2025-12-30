/**
 * useLiquidUIContent - React hook for consuming Liquid UI content
 * 
 * This hook fetches content from the Supabase database via API.
 * Falls back to static JSON if the API is unavailable.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  liquidUIService, 
  type ContentSection, 
  type ContentTab, 
  type NormalizedContentItem 
} from '@/services/liquidUIService';

/**
 * Hook to get content for a specific section from the database
 */
export function useLiquidUIContent(section: ContentSection, tab?: ContentTab) {
  const [content, setContent] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiveContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://dev-beta.aigentz.me';
        const tabParam = tab ? `?tab=${tab}` : '';
        const response = await fetch(`${apiUrl}/api/content/section/${section}${tabParam}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${section} content: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[useLiquidUIContent] Fetched ${section} content:`, data.count, 'items from', data.source);
        
        if (data.content && data.content.length > 0) {
          setContent(data.content);
        } else {
          // No content in database, fall back to static JSON
          console.log(`[useLiquidUIContent] No database content for ${section}, using static JSON`);
          const staticContent = tab 
            ? liquidUIService.getContentBySectionWithTabs(section, tab) 
            : liquidUIService.getContentBySection(section);
          setContent(staticContent);
        }
      } catch (err) {
        console.error(`[useLiquidUIContent] Error fetching ${section}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to static JSON on error
        const staticContent = tab 
          ? liquidUIService.getContentBySectionWithTabs(section, tab) 
          : liquidUIService.getContentBySection(section);
        setContent(staticContent);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveContent();
  }, [section, tab]);

  return {
    content,
    isLoading,
    error,
  };
}

/**
 * Hook to get all content for a section regardless of tab
 */
export function useLiquidUIAllContent(section: ContentSection) {
  const content = useMemo(() => {
    return liquidUIService.getAllContentForSection(section);
  }, [section]);

  return {
    content,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook to get content by ID
 */
export function useLiquidUIContentById(contentId: string) {
  const content = useMemo(() => {
    return liquidUIService.getContentById(contentId);
  }, [contentId]);

  return {
    content,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook to get issue metadata
 */
export function useLiquidUIIssue() {
  const metadata = useMemo(() => {
    return liquidUIService.getIssueMetadata();
  }, []);

  const stats = useMemo(() => {
    return liquidUIService.getStats();
  }, []);

  return {
    metadata,
    stats,
  };
}

// Re-export types for convenience
export type { ContentSection, ContentTab, NormalizedContentItem };
