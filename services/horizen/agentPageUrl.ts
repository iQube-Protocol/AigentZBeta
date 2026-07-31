/**
 * Horizen's human-readable agent registry page — URL construction, ONE
 * canonical implementation (inv.engineering.036/037 — never a second,
 * hand-typed copy of this pattern anywhere else in the codebase).
 *
 * Confirmed live by Horizen directly, 2026-07-31 (operator relay):
 *   https://agent-registry.horizenlabs.io/agent/{agentIdentifier}?network={network}
 *   Example: https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=sepolia
 *
 * This is the ONLY place that constructs a Horizen agent-page URL. Callers
 * NEVER accept a URL from client input and NEVER hand-build this string —
 * they always call buildHorizenAgentPageUrl() with the two validated
 * fields, or read a URL this module already computed and stored
 * server-side (types/registry-canonical.ts's ExternalAgentRegistryBinding
 * .human_readable_url). isHorizenAgentPageUrl() is the allowlist check any
 * surface (e.g. an <iframe src>) MUST pass a URL through before rendering
 * it — origin exactly agent-registry.horizenlabs.io, path under /agent/,
 * https only.
 *
 * `agentIdentifier` is DELIBERATELY not typed or assumed to be a tokenId —
 * operator ruling 2026-07-31: "Do not assume agentIdentifier === tokenId
 * without confirming that from the real Horizen response schema." Horizen's
 * own example (`0xZkSignalAgent`) is not a plausible numeric ERC-8004
 * tokenId or a standard checksummed address — callers must resolve this
 * from whatever field Horizen's real registration/status response actually
 * names, never default it from token_id.
 */

const HORIZEN_AGENT_PAGE_ORIGIN = 'https://agent-registry.horizenlabs.io';
const HORIZEN_AGENT_PAGE_PATH_PREFIX = '/agent/';

/**
 * Builds the human-readable Horizen agent page URL. `encodeURIComponent` on
 * both segments — this is the only path that ever assembles this URL, so it
 * is also the only place that needs to guard against an identifier/network
 * value that isn't already URL-safe.
 */
export function buildHorizenAgentPageUrl(agentIdentifier: string, network: string): string {
  const path = `${HORIZEN_AGENT_PAGE_PATH_PREFIX}${encodeURIComponent(agentIdentifier)}`;
  const query = new URLSearchParams({ network }).toString();
  return `${HORIZEN_AGENT_PAGE_ORIGIN}${path}?${query}`;
}

/**
 * The allowlist gate: origin must be EXACTLY the Horizen agent-registry
 * host, path must begin with /agent/, and a non-empty `network` query
 * parameter must be present. Any surface that renders a Horizen agent-page
 * URL in an iframe (or link) MUST pass it through this check first —
 * defence in depth even though buildHorizenAgentPageUrl() above can only
 * ever produce a URL that already satisfies it. Rejects arbitrary
 * client-supplied URLs outright (returns false, never throws) rather than
 * attempting to "fix" or partially trust them.
 */
export function isHorizenAgentPageUrl(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.origin !== HORIZEN_AGENT_PAGE_ORIGIN) return false;
  if (!url.pathname.startsWith(HORIZEN_AGENT_PAGE_PATH_PREFIX)) return false;
  if (url.pathname.length <= HORIZEN_AGENT_PAGE_PATH_PREFIX.length) return false; // no identifier segment
  const network = url.searchParams.get('network');
  if (!network || network.trim().length === 0) return false;
  return true;
}
