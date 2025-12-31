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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLiveContent = async (currentSection?: ContentSection, currentTab?: ContentTab) => {
    const targetSection = currentSection || section;
    const targetTab = currentTab || tab;
    
    setIsLoading(true);
    setError(null);
    
    const apiUrl = import.meta.env.VITE_API_URL || 'https://dev-beta.aigentz.me';
    const tabParam = targetTab ? `&tab=${targetTab}` : '';
    // Add multiple cache-busting parameters
    const cacheBuster = `t=${Date.now()}&r=${Math.random()}`;
    const fullUrl = `${apiUrl}/api/content/section/${targetSection}?${cacheBuster}${tabParam}`;
    
    console.log(`[useLiquidUIContent] Fetching from: ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      console.log(`[useLiquidUIContent] Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${targetSection} content: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[useLiquidUIContent] Response data:`, data);
      console.log(`[useLiquidUIContent] Fetched ${targetSection} content:`, data.count, 'items from', data.source);
      
      if (data.content && data.content.length > 0) {
        setContent(data.content);
        setLastUpdated(new Date());
        console.log(`[useLiquidUIContent] Successfully loaded ${data.content.length} items from database for ${targetSection}`);
        console.log(`[useLiquidUIContent] Sample item:`, data.content[0]);
      } else {
        // No content in database - set empty array to show admin needs to add content
        console.log(`[useLiquidUIContent] No database content for ${targetSection} - showing empty state`);
        console.log(`[useLiquidUIContent] Data structure:`, JSON.stringify(data, null, 2));
        setContent([]);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error(`[useLiquidUIContent] Error fetching ${targetSection}:`, err);
      console.error(`[useLiquidUIContent] Error details:`, {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack',
        url: fullUrl
      });
      setError(err instanceof Error ? err.message : 'Unknown error');
      // On error, set empty content to show the API issue
      setContent([]);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveContent();
  }, [section, tab]);

  // Manual refresh function
  const refresh = () => {
    console.log(`[useLiquidUIContent] Manual refresh triggered for ${section}`);
    fetchLiveContent(section, tab);
  };

  return {
    content,
    isLoading,
    error,
    refresh,
    lastUpdated,
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
