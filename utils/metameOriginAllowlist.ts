/**
 * Shared origin allowlist for metame:* postMessage events.
 *
 * Every metaMe client-side protocol that listens for cross-frame `metame:*`
 * events MUST validate `event.origin` against this allowlist. Inbound events
 * from any other origin are silently dropped.
 *
 * Source of truth: configs/embed/policy.v1.json → authAllowedOrigins
 * Spec: docs/architecture/metame-client-protocols.md §"The cross-frame rules"
 *
 * Patterns supported (matching the existing embed bridge behaviour):
 *   "*"                          → wildcard (allow any origin)
 *   "https://example.com"        → exact match
 *   "https://*.example.com"      → subdomain wildcard
 *   "http://localhost:*"         → port wildcard
 *
 * This helper duplicates only the origin-match logic from
 * app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts (a future
 * follow-up migrates the bridge to import from here too).
 */

import embedPolicy from '@/configs/embed/policy.v1.json';

function normalize(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function matchesSubdomainWildcard(origin: string, pattern: string): boolean {
  const wildcard = pattern.match(/^(https?):\/\/\*\.(.+)$/i);
  if (!wildcard) return false;
  try {
    const originUrl = new URL(origin);
    const protocol = `${wildcard[1].toLowerCase()}:`;
    const suffix = wildcard[2].toLowerCase();
    if (originUrl.protocol.toLowerCase() !== protocol) return false;
    const host = originUrl.hostname.toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

function matchesPortWildcard(origin: string, pattern: string): boolean {
  const wildcard = pattern.match(/^(https?):\/\/([^:/?#]+):\*$/i);
  if (!wildcard) return false;
  try {
    const originUrl = new URL(origin);
    const protocol = `${wildcard[1].toLowerCase()}:`;
    const host = wildcard[2].toLowerCase();
    return (
      originUrl.protocol.toLowerCase() === protocol &&
      originUrl.hostname.toLowerCase() === host
    );
  } catch {
    return false;
  }
}

let _cached: string[] | null = null;
function getAllowlist(): string[] {
  if (_cached) return _cached;
  const envExtras = (
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EMBED_AUTH_ALLOWED_ORIGINS
      ? process.env.NEXT_PUBLIC_EMBED_AUTH_ALLOWED_ORIGINS
      : ''
  )
    .split(',')
    .map(normalize)
    .filter(Boolean);
  const fromConfig = ((embedPolicy as { authAllowedOrigins?: string[] }).authAllowedOrigins || [])
    .map(normalize);
  _cached = Array.from(new Set([...fromConfig, ...envExtras]));
  return _cached;
}

/**
 * Always-allowed origins for same-frame events. Same-origin is implicit; this
 * is the cross-frame allowlist only.
 */
export function isMetameOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return false;

  // Same-origin: always allowed.
  try {
    if (typeof window !== 'undefined' && origin === window.location.origin) return true;
  } catch {
    /* SSR or restricted environment */
  }

  const allowlist = getAllowlist();
  if (allowlist.length === 0) return false;

  const normalized = normalize(origin);
  return allowlist.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern === normalized) return true;
    if (matchesSubdomainWildcard(normalized, pattern)) return true;
    if (matchesPortWildcard(normalized, pattern)) return true;
    return false;
  });
}
