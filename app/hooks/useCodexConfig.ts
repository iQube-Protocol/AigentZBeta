/**
 * useCodexConfig Hook
 * 
 * Fetches and caches codex configuration from the registry API.
 * Supports both database-backed and default (hardcoded) configurations.
 */

import { useQuery } from '@tanstack/react-query';
import { CodexConfig, CodexRegistryResponse } from '@/types/codex';

interface UseCodexConfigOptions {
  codexId: string;
  useDefaults?: boolean;  // Use hardcoded defaults instead of database
  allowOverrides?: boolean; // Allow DB/pack overrides on top of defaults
  enabled?: boolean;      // Enable/disable the query
}

export function useCodexConfig({ codexId, useDefaults = true, allowOverrides = false, enabled = true }: UseCodexConfigOptions) {
  return useQuery<CodexConfig, Error>({
    queryKey: ['codex-config', codexId, useDefaults, allowOverrides],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (useDefaults) {
        params.set('defaults', 'true');
      }
      if (allowOverrides) {
        params.set('allowOverrides', 'true');
      }

      const response = await fetch(`/api/codex/registry/${codexId}?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch codex configuration');
      }

      const data: CodexRegistryResponse<CodexConfig> = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Invalid response from codex registry');
      }

      return data.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * useCodexList Hook
 * 
 * Fetches list of all available codexes
 */
export function useCodexList(options?: { enabled?: boolean; owner?: string; useDefaults?: boolean; allowOverrides?: boolean }) {
  const { enabled = true, owner, useDefaults = true, allowOverrides = false } = options || {};

  return useQuery({
    queryKey: ['codex-list', owner, useDefaults, allowOverrides],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('enabled', 'true'); // Only fetch enabled codexes
      if (owner) params.set('owner', owner);
      if (useDefaults) params.set('defaults', 'true');
      if (allowOverrides) params.set('allowOverrides', 'true');

      const response = await fetch(`/api/codex/registry?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch codex list');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Invalid response from codex registry');
      }

      return data.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Helper to check if user has permission to view/edit codex
 */
export function hasCodexPermission(
  codex: CodexConfig | undefined,
  userId: string | undefined,
  permission: 'view' | 'edit' | 'admin'
): boolean {
  if (!codex || !userId) return false;

  const permissions = codex.permissions[permission];
  
  // Check for wildcard (public access)
  if (permissions.includes('*')) return true;
  
  // Check if user ID is in the permission list
  return permissions.includes(userId);
}

/**
 * Helper to get enabled tabs from codex config.
 * Tabs marked adminOnly are excluded unless isAdmin is true.
 */
export function getEnabledTabs(codex: CodexConfig | undefined, isAdmin = false) {
  if (!codex) return [];
  return codex.tabs
    .filter(tab => tab.enabled && (!tab.adminOnly || isAdmin))
    .sort((a, b) => a.order - b.order);
}
