/**
 * useCodexConfig Hook
 * 
 * Fetches and caches codex configuration from the registry API.
 * Supports both database-backed and default (hardcoded) configurations.
 */

import { useQuery } from '@tanstack/react-query';
import { CodexConfig, CodexRegistryResponse } from '@/types/codex';
import { getCodexById, getCodexBySlug } from '@/data/codex-configs';

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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let response: Response;
      try {
        response = await fetch(`/api/codex/registry/${codexId}?${params.toString()}`, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
    // Static config as immediate fallback — lets the codex render at once even if
    // the registry fetch is slow or blocked (e.g. Brave Shields in strict mode).
    // React Query will still fetch in the background and update when it resolves.
    initialData: () => getCodexById(codexId) ?? getCodexBySlug(codexId) ?? undefined,
    initialDataUpdatedAt: 0, // treat as stale so the background fetch always runs
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
 * - adminOnly tabs: hidden unless isAdmin
 * - partnerOnly tabs: hidden unless isPartner or isAdmin
 * - investorOnly tabs: hidden unless isInvestor or isAdmin
 * - activationId tabs: hidden unless that id is in `activeActivations`.
 *   Admins are NOT bypassed — activation is per-persona regardless of
 *   role (so admins can keep their own runtime tidy).
 *
 * `activeActivations` is the set of catalog ids that this persona has
 * an `active` row for in `persona_activations`. Pass an empty Set (the
 * default) to disable activation gating entirely.
 */
export function getEnabledTabs(
  codex: CodexConfig | undefined,
  isAdmin = false,
  isPartner = false,
  isInvestor = false,
  activeActivations: Set<string> = new Set(),
) {
  if (!codex) return [];
  return codex.tabs
    .filter(tab => {
      if (!tab.enabled) return false;
      if (tab.adminOnly && !isAdmin) return false;
      if (tab.partnerOnly && !isPartner && !isAdmin) return false;
      if (tab.investorOnly && !isInvestor && !isAdmin) return false;
      // Activation gate — tab-level
      if (tab.activationId && !activeActivations.has(tab.activationId)) return false;
      // Activation gate — inherited from group when not explicitly set on the tab
      if (!tab.activationId && tab.group) {
        const group = (codex.tabGroups ?? []).find((g) => g.id === tab.group);
        if (group?.activationId && !activeActivations.has(group.activationId)) return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
}
