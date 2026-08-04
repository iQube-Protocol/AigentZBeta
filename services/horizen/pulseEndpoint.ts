/**
 * Resolve the public HTTPS endpoint Horizen's Pulse monitor should health-
 * check for an agent — from the agent's own canonical Agent Card, never
 * invented (al / Horizen brief, 2026-08-04):
 *
 *   > "Resolve the endpoint from Nakamoto's Agent Card services[], preferably
 *   >  the primary callable service or explicit Pulse health endpoint. ...
 *   >  Do not substitute the Agent Card URL for a monitored service endpoint
 *   >  unless the card explicitly declares it as the service endpoint."
 *
 * No Agent Card in this codebase declares a `services[]` entry yet — so this
 * resolver correctly returns `null` for every agent today, and the caller
 * (the Verify route) refuses locally rather than calling Horizen with a
 * guessed URL. Adding a real monitored-service entry to an agent's card is
 * what makes this resolve to something; this function never substitutes one.
 */

export interface AgentCardService {
  type?: string;
  url?: string;
  [key: string]: unknown;
}

function isPublicHttps(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * `services` is read from either `agentCard.services` (top-level, A2A-style)
 * or `agentCard.metadata.services` (this codebase's convention of keeping
 * platform-specific extensions under `metadata`) — whichever the card
 * declares. Preference order among declared services:
 *   1. an entry whose `type` names Pulse/health explicitly
 *   2. the first entry with a public HTTPS url
 * Returns `null` — never a guess, never the card's own `url` field — when
 * nothing eligible is declared.
 */
export function resolvePulseEndpoint(agentCard: unknown): string | null {
  if (!agentCard || typeof agentCard !== 'object') return null;
  const card = agentCard as Record<string, unknown>;
  const metadata = card.metadata && typeof card.metadata === 'object' ? (card.metadata as Record<string, unknown>) : null;
  const rawServices = Array.isArray(card.services) ? card.services : Array.isArray(metadata?.services) ? metadata!.services : null;
  if (!rawServices) return null;

  const services = rawServices.filter((s): s is AgentCardService => !!s && typeof s === 'object') as AgentCardService[];
  const pulseTagged = services.find((s) => typeof s.type === 'string' && /pulse|health/i.test(s.type) && isPublicHttps(s.url));
  if (pulseTagged) return pulseTagged.url as string;

  const firstEligible = services.find((s) => isPublicHttps(s.url));
  return firstEligible ? (firstEligible.url as string) : null;
}
