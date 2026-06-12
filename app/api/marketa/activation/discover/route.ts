/**
 * POST /api/marketa/activation/discover
 *
 * Discovery automation (golden path #4): fetch operator-supplied discovery
 * sources (A2A agent cards, MCP-registry-style listings), map them onto
 * candidate agents, dedupe against existing candidates by URL/name, insert
 * the new ones, and log candidate_discovered activation events.
 *
 * Body: { sources?: [{ kind: 'a2a_card' | 'mcp_registry', url }], actorId? }
 * When no sources are supplied, falls back to the MARKETA_DISCOVERY_SOURCES
 * env var (JSON array of the same shape) so a scheduled caller can run with
 * an operator-configured source list. No third-party URLs are hardcoded.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  DISCOVERY_SOURCE_KINDS,
  candidateDedupeKeys,
  parseConfiguredSources,
  parseDiscoveryPayload,
  type DiscoverySource,
  type DiscoverySourceKind,
} from '@/services/marketa/activation/discovery';
import { candidateInputToDb, dbToCandidate, normalizeCandidateInput } from '@/services/marketa/activation/normalizers';

export const dynamic = 'force-dynamic';

const MAX_SOURCES = 10;
const MAX_CANDIDATES_PER_SOURCE = 50;
const FETCH_TIMEOUT_MS = 10_000;

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseBodySources(raw: unknown): DiscoverySource[] {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!Array.isArray(body.sources)) return [];
  return body.sources
    .map((entry) => {
      const source = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const kind = typeof source.kind === 'string' ? source.kind.trim() as DiscoverySourceKind : '' as DiscoverySourceKind;
      const url = typeof source.url === 'string' ? source.url.trim() : '';
      return DISCOVERY_SOURCE_KINDS.includes(kind) && url ? { kind, url } : null;
    })
    .filter((source): source is DiscoverySource => source !== null);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // empty body is fine — fall back to configured sources
  }
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const actorId = typeof body.actorId === 'string' && body.actorId.trim() ? body.actorId.trim() : 'marketa';

  let sources = parseBodySources(raw);
  if (sources.length === 0) sources = parseConfiguredSources(process.env.MARKETA_DISCOVERY_SOURCES);
  if (sources.length === 0) {
    return jsonError('no-discovery-sources', 400, 'Provide { sources: [{ kind, url }] } or set MARKETA_DISCOVERY_SOURCES.');
  }
  sources = sources.slice(0, MAX_SOURCES);

  // Existing candidates' identifying keys, for dedupe.
  const { data: existingRows, error: existingError } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .select('name, source_url, agent_card_url, mcp_server_url, repository_url');
  if (existingError) return jsonError('candidate-load-failed', 500, existingError.message);
  const existingKeys = new Set<string>();
  for (const row of existingRows ?? []) {
    const r = row as Record<string, unknown>;
    for (const key of candidateDedupeKeys({
      name: typeof r.name === 'string' ? r.name : '',
      sourceUrl: typeof r.source_url === 'string' ? r.source_url : '',
      agentCardUrl: typeof r.agent_card_url === 'string' ? r.agent_card_url : '',
      mcpServerUrl: typeof r.mcp_server_url === 'string' ? r.mcp_server_url : '',
      repositoryUrl: typeof r.repository_url === 'string' ? r.repository_url : '',
    })) existingKeys.add(key);
  }

  const inserts: Record<string, unknown>[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  let skippedExisting = 0;

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const parsed = parseDiscoveryPayload(source.kind, payload, source.url).slice(0, MAX_CANDIDATES_PER_SOURCE);
      for (const input of parsed) {
        const keys = candidateDedupeKeys(input);
        if (keys.some((key) => existingKeys.has(key))) {
          skippedExisting += 1;
          continue;
        }
        keys.forEach((key) => existingKeys.add(key)); // also dedupe within this run
        inserts.push(candidateInputToDb(normalizeCandidateInput(input)));
      }
    } catch (err) {
      errors.push({ url: source.url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      { ok: true, discovered: 0, skippedExisting, errors, candidates: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .insert(inserts)
    .select('*');
  if (error) return jsonError('candidate-discovery-insert-failed', 500, error.message);

  const candidates = (data ?? []).map((row) => dbToCandidate(row as Record<string, unknown>));
  if (candidates.length > 0) {
    await supabase
      .schema('marketa')
      .from('marketa_activation_events')
      .insert(candidates.map((candidate) => ({
        candidate_agent_id: candidate.id,
        event_type: 'candidate_discovered',
        summary: `Candidate discovered: ${candidate.name} (${candidate.sourceType})`,
        actor: actorId,
        metadata: { sourceType: candidate.sourceType, sourceUrl: candidate.sourceUrl },
      })));
  }

  return NextResponse.json(
    { ok: true, discovered: candidates.length, skippedExisting, errors, candidates },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
