/**
 * useLiquidUIContent - React hook for consuming Liquid UI Issue Package content
 * 
 * This hook provides content from the Issue Package v1.4 for use in components.
 * It is an ADDITIVE hook - does not modify any existing Codex or SmartWallet code.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  liquidUIService, 
  type ContentSection, 
  type ContentTab, 
  type NormalizedContentItem 
} from '@/services/liquidUIService';

/**
 * Hook to get content for a specific section
 */
export function useLiquidUIContent(section: ContentSection, tab?: ContentTab) {
  const [content, setContent] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For home-hero, fetch live data from API
    if (section === 'home-hero') {
      const fetchLiveContent = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const response = await fetch(`${apiUrl}/api/content/home-hero`);
          if (!response.ok) {
            throw new Error('Failed to fetch home hero content');
          }
          const data = await response.json();
          console.log('[useLiquidUIContent] Fetched live home hero content:', data);
          setContent(data.content || []);
        } catch (err) {
          console.error('[useLiquidUIContent] Error fetching live content:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          // Fallback to static JSON
          setContent(liquidUIService.getContentBySection(section));
        } finally {
          setIsLoading(false);
        }
      };

      fetchLiveContent();
    } else {
      // For other sections, use static JSON
      setContent(tab ? liquidUIService.getContentBySectionWithTabs(section, tab) : liquidUIService.getContentBySection(section));
    }
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
