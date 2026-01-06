/**
 * API Configuration for Thin Client
 * Centralizes all API URL handling
 */

// Get the API base URL from environment variables
// Supports multiple env var names for backward compatibility
const RAW_API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_AIGENT_API_URL ||
  import.meta.env.VITE_AIGENTIQ_API_URL ||
  '';

const resolveApiBase = () => {
  if (!RAW_API_BASE_URL) return '';
  if (typeof window === 'undefined') return RAW_API_BASE_URL;
  try {
    const resolvedOrigin = new URL(RAW_API_BASE_URL).origin;
    return resolvedOrigin === window.location.origin ? RAW_API_BASE_URL : '';
  } catch {
    return '';
  }
};

export const API_BASE_URL = resolveApiBase();

/**
 * Build a full API URL
 */
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Common content API URLs
 */
export const contentApi = {
  cover: (cid: string) => apiUrl(`/api/content/cover/${cid}`),
  pdf: (cid: string) => apiUrl(`/api/content/pdf/${cid}`),
  video: (cid: string) => apiUrl(`/api/content/video/${cid}`),
};

/**
 * Wallet API URLs
 */
export const walletApi = {
  knytBalance: (personaId: string) => apiUrl(`/api/wallet/knyt/balance?personaId=${personaId}`),
  balances: (params: URLSearchParams) => apiUrl(`/api/wallet/balances?${params.toString()}`),
};

export default API_BASE_URL;
