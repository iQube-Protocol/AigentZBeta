/**
 * Fail-fast API fetch wrapper
 * Prevents silent failures when API returns HTML instead of JSON
 */

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON from ${url}, got ${contentType}. Body: ${text.slice(0, 200)}`);
  }

  return await res.json();
}

/**
 * Get API base URL with fail-fast check
 */
export function getApiBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  
  if (!apiBase) {
    console.error("❌ CRITICAL: VITE_API_URL is not set in this build!");
    console.error("This will cause relative /api/* requests that fail on Netlify.");
    console.error("Check netlify.toml has VITE_API_URL in [build.environment]");
  }
  
  return apiBase || '';
}
