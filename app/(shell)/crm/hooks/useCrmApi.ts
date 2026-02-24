'use client';

import { useState, useCallback } from 'react';

const API_BASE = '/api/crm';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
  pagination?: {
    limit: number;
    offset: number;
    count: number;
  };
}

interface UseCrmApiOptions {
  onError?: (error: string) => void;
}

export function useCrmApi<T>(options?: UseCrmApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.set(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString());
      const result: ApiResponse<T> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setData(result.data || null);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const postData = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: ApiResponse<T> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setData(result.data || null);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const patchData = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: ApiResponse<T> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setData(result.data || null);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const deleteData = useCallback(async (
    endpoint: string,
    params?: Record<string, string>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      const response = await fetch(url.toString(), { method: 'DELETE' });
      const result: ApiResponse<T> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      options?.onError?.(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  return {
    data,
    loading,
    error,
    fetchData,
    postData,
    patchData,
    deleteData,
    setData,
  };
}

// Typed API hooks for specific endpoints
export function usePersonas(tenantId: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { 
    search?: string; 
    limit?: number; 
    offset?: number;
    source?: 'crm' | 'live';
    includeCount?: boolean;
    countOnly?: boolean;
    stats?: boolean;
  }) => {
    return api.fetchData('/personas', { tenantId, ...options });
  }, [api, tenantId]);

  return { ...api, fetch };
}

export function useContributions(tenantId: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { 
    personaId?: string; 
    periodStart?: string; 
    periodEnd?: string;
    limit?: number; 
    offset?: number 
  }) => {
    return api.fetchData('/contributions', { tenantId, ...options });
  }, [api, tenantId]);

  const record = useCallback((contribution: {
    personaId: string;
    contributionType: string;
    units?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  }) => {
    return api.postData('/contributions', { tenantId, ...contribution });
  }, [api, tenantId]);

  return { ...api, fetch, record };
}

export function useRewards(tenantId: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { 
    personaId?: string; 
    status?: string;
    tokenType?: string;
    source?: 'crm' | 'grants' | 'wallet' | 'combined';
    limit?: number; 
    offset?: number 
  }) => {
    return api.fetchData('/rewards', { tenantId, ...options });
  }, [api, tenantId]);

  const propose = useCallback((input: {
    periodStart: string;
    periodEnd: string;
    qctBudget?: number;
    qoynBudget?: number;
    topN?: number;
  }) => {
    return api.postData('/rewards', { tenantId, ...input });
  }, [api, tenantId]);

  const updateStatus = useCallback((rewardId: string, status: string, txHash?: string) => {
    return api.patchData('/rewards', { tenantId, rewardId, status, txHash });
  }, [api, tenantId]);

  return { ...api, fetch, propose, updateStatus };
}

export function useSegments(tenantId: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { limit?: number; offset?: number }) => {
    return api.fetchData('/segments', { tenantId, ...options });
  }, [api, tenantId]);

  const create = useCallback((segment: {
    name: string;
    description?: string;
    isDynamic?: boolean;
    ruleDefinition?: Record<string, unknown>;
  }) => {
    return api.postData('/segments', { tenantId, ...segment });
  }, [api, tenantId]);

  return { ...api, fetch, create };
}

export function useFranchises() {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { includeTenants?: boolean; activeOnly?: boolean }) => {
    return api.fetchData('/franchises', options);
  }, [api]);

  return { ...api, fetch };
}

export function useTenants(franchiseId?: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback(() => {
    return api.fetchData('/tenants', franchiseId ? { franchiseId } : undefined);
  }, [api, franchiseId]);

  return { ...api, fetch };
}

export function useTopContributors(tenantId: string) {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((options?: { 
    periodStart?: string; 
    periodEnd?: string;
    limit?: number;
  }) => {
    return api.fetchData('/top-contributors', { tenantId, ...options });
  }, [api, tenantId]);

  return { ...api, fetch };
}

export function useAdminRoles() {
  const api = useCrmApi<any>();
  
  const fetchByUser = useCallback((kybeDid: string) => {
    return api.fetchData('/admin/roles', { kybeDid });
  }, [api]);

  const fetchByScope = useCallback((options?: {
    franchiseId?: string;
    tenantId?: string;
    categoryId?: string;
    roleType?: string;
  }) => {
    return api.fetchData('/admin/roles', options);
  }, [api]);

  const fetchUberAdmins = useCallback(() => {
    return api.fetchData('/admin/roles', { uberOnly: true });
  }, [api]);

  const checkAccess = useCallback((kybeDid: string, action: string, scope?: {
    franchiseId?: string;
    tenantId?: string;
    categorySlug?: string;
  }) => {
    return api.fetchData('/admin/access-check', { kybeDid, action, ...scope });
  }, [api]);

  return { ...api, fetchByUser, fetchByScope, fetchUberAdmins, checkAccess };
}

export function useAdminCategories() {
  const api = useCrmApi<any[]>();
  
  const fetch = useCallback((activeOnly = true) => {
    return api.fetchData('/admin/categories', { activeOnly });
  }, [api]);

  return { ...api, fetch };
}
