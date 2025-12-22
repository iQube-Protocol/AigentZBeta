/**
 * useLiquidUIContent - React hook for consuming Liquid UI Issue Package content
 * 
 * This hook provides content from the Issue Package v1.4 for use in components.
 * It is an ADDITIVE hook - does not modify any existing Codex or SmartWallet code.
 */

import { useMemo } from 'react';
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
  const content = useMemo(() => {
    if (tab) {
      return liquidUIService.getContentBySectionWithTabs(section, tab);
    }
    return liquidUIService.getContentBySection(section);
  }, [section, tab]);

  return {
    content,
    isLoading: false, // Static JSON, no loading state needed
    error: null,
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
