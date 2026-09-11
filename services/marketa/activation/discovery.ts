/**
 * Discovery automation parsers (golden path #4).
 *
 * Pure functions that map external discovery payloads — A2A agent cards and
 * MCP-registry-style server listings — onto CandidateAgentInput. Fetching,
 * dedupe, and persistence live in /api/marketa/activation/discover; nothing
 * here touches the network or the DB so the mapping stays unit-testable.
 *
 * Source URLs are always operator-supplied (request body or the
 * MARKETA_DISCOVERY_SOURCES env var) — no third-party endpoints are
 * hardcoded here.
 */

import type { CandidateAgentInput } from './types';

export type DiscoverySourceKind = 'a2a_card' | 'mcp_registry';

export interface DiscoverySource {
  kind: DiscoverySourceKind;
  url: string;
}

export const DISCOVERY_SOURCE_KINDS: DiscoverySourceKind[] = ['a2a_card', 'mcp_registry'];

const asStr = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * A2A agent card (agent-card.json / .well-known/agent.json) → candidate.
 * Mirrors the shape served by /api/marketa/activation/sample-agent-card:
 * { name, description, url, provider: { organization, url }, skills: [{ name, tags }] }
 */
export function parseAgentCard(payload: unknown, cardUrl: string): CandidateAgentInput {
  const card = asRecord(payload);
  const name = asStr(card.name);
  if (!name) throw new Error('agent card has no name');
  const provider = asRecord(card.provider);
  const skills = Array.isArray(card.skills) ? card.skills : [];
  const capabilities = Array.from(
    new Set(
      skills.flatMap((skill) => {
        const s = asRecord(skill);
        const tags = Array.isArray(s.tags) ? s.tags.map(asStr) : [];
        return [asStr(s.name), ...tags];
      }).filter(Boolean),
    ),
  );
  return {
    name,
    description: asStr(card.description),
    sourceType: 'a2a_card',
    sourceUrl: asStr(card.url) || cardUrl,
    agentCardUrl: cardUrl,
    websiteUrl: asStr(provider.url),
    operatorName: asStr(provider.organization),
    capabilities,
    notes: `Discovered via agent card crawl: ${cardUrl}`,
  };
}

/**
 * MCP-registry-style listing → candidates. Tolerant of both a bare array
 * and { servers: [...] }; each entry needs at least a name. Optional fields
 * mapped when present: description, repository.url, url / remotes[0].url.
 */
export function parseMcpRegistryListing(payload: unknown, sourceUrl: string): CandidateAgentInput[] {
  const root = asRecord(payload);
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(root.servers)
      ? root.servers
      : [];
  const inputs: CandidateAgentInput[] = [];
  for (const entry of entries) {
    const server = asRecord(entry);
    const name = asStr(server.name);
    if (!name) continue;
    const repository = asRecord(server.repository);
    const remotes = Array.isArray(server.remotes) ? server.remotes : [];
    const remoteUrl = asStr(asRecord(remotes[0]).url);
    inputs.push({
      name,
      description: asStr(server.description),
      sourceType: 'mcp_registry',
      sourceUrl,
      mcpServerUrl: asStr(server.url) || remoteUrl,
      repositoryUrl: asStr(repository.url),
      notes: `Discovered via MCP registry poll: ${sourceUrl}`,
    });
  }
  return inputs;
}

export function parseDiscoveryPayload(
  kind: DiscoverySourceKind,
  payload: unknown,
  url: string,
): CandidateAgentInput[] {
  if (kind === 'a2a_card') return [parseAgentCard(payload, url)];
  return parseMcpRegistryListing(payload, url);
}

/** Normalized key for URL-based dedupe: lowercase, no trailing slash. */
export function normalizeUrlKey(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Dedupe keys for a candidate: every identifying URL plus the lowercased
 * name. A discovered candidate is skipped when ANY key matches an existing
 * candidate's key set.
 */
export function candidateDedupeKeys(candidate: {
  name?: string;
  sourceUrl?: string;
  agentCardUrl?: string;
  mcpServerUrl?: string;
  repositoryUrl?: string;
}): string[] {
  const keys: string[] = [];
  for (const url of [candidate.sourceUrl, candidate.agentCardUrl, candidate.mcpServerUrl, candidate.repositoryUrl]) {
    if (url && url.trim()) keys.push(`url:${normalizeUrlKey(url)}`);
  }
  if (candidate.name && candidate.name.trim()) keys.push(`name:${candidate.name.trim().toLowerCase()}`);
  return keys;
}

/** Parse the MARKETA_DISCOVERY_SOURCES env var (JSON array of {kind,url}). */
export function parseConfiguredSources(raw: string | undefined): DiscoverySource[] {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => {
      const source = asRecord(entry);
      const kind = asStr(source.kind) as DiscoverySourceKind;
      const url = asStr(source.url);
      return DISCOVERY_SOURCE_KINDS.includes(kind) && url ? { kind, url } : null;
    })
    .filter((source): source is DiscoverySource => source !== null);
}
