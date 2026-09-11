/**
 * web-search tool — real provider with stub fallback.
 *
 * Provider chain (first match wins):
 *   1. SERPER_API_KEY set → Serper (Google results, 2500 free/mo)
 *   2. TAVILY_API_KEY set → Tavily (LLM-friendly results)
 *   3. Neither → deterministic stub (Phase 2 placeholder)
 *
 * The stub keeps the affordance live in dev/staging without burning
 * an API quota, so flipping CAPABILITY_GATEWAY_PREFLIGHT=all on a
 * fresh env doesn't require search-provider config first.
 */

import { registerTool } from '../registry';
import type { OpenClawToolResult } from '../types';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchViaSerper(query: string): Promise<SearchResult[]> {
  const response = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!response.ok) throw new Error(`Serper ${response.status}`);
  const data = (await response.json()) as { organic?: Array<{ title?: string; snippet?: string; link?: string }> };
  return (data.organic ?? []).slice(0, 5).map((r) => ({
    title: r.title ?? '(no title)',
    snippet: r.snippet ?? '',
    url: r.link ?? '',
  }));
}

async function searchViaTavily(query: string): Promise<SearchResult[]> {
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: 'basic',
    }),
  });
  if (!response.ok) throw new Error(`Tavily ${response.status}`);
  const data = (await response.json()) as { results?: Array<{ title?: string; content?: string; url?: string }> };
  return (data.results ?? []).slice(0, 5).map((r) => ({
    title: r.title ?? '(no title)',
    snippet: r.content ?? '',
    url: r.url ?? '',
  }));
}

function stubResults(query: string): SearchResult[] {
  return [
    {
      title: `Stubbed result for "${query}"`,
      snippet:
        'web-search has no provider configured. Set SERPER_API_KEY or TAVILY_API_KEY to enable real results.',
      url: 'about:capability-gateway-web-search-stub',
    },
  ];
}

registerTool({
  name: 'web-search',
  description: 'Web search via Serper or Tavily; stub fallback when no provider is configured.',
  needsServerContext: false,
  handler: async (input): Promise<OpenClawToolResult> => {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    if (!query) return { ok: false, reason: 'invalid-input', detail: 'query (string) required' };

    let results: SearchResult[];
    let provider: 'serper' | 'tavily' | 'stub';

    try {
      if (process.env.SERPER_API_KEY) {
        results = await searchViaSerper(query);
        provider = 'serper';
      } else if (process.env.TAVILY_API_KEY) {
        results = await searchViaTavily(query);
        provider = 'tavily';
      } else {
        results = stubResults(query);
        provider = 'stub';
      }
    } catch (err) {
      // Provider blew up — fall through to stub so the surface still
      // gets something to render. Log so ops sees the provider failure.
      console.warn('[web-search] provider failed, returning stub:', err instanceof Error ? err.message : err);
      results = stubResults(query);
      provider = 'stub';
    }

    return {
      ok: true,
      data: { query, provider, results },
      summary:
        provider === 'stub'
          ? `web-search ran (stub) for "${query.slice(0, 60)}"`
          : `web-search via ${provider} returned ${results.length} result(s) for "${query.slice(0, 60)}"`,
    };
  },
});
