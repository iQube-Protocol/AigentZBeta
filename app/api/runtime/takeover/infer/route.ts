/**
 * POST /api/runtime/takeover/infer
 *
 * Proactive inference endpoint for the Runtime Takeover system.
 *
 * Given a cartridge slug + optional personaId + entry point, this route:
 *   1. Looks up the cartridge's RuntimeTakeoverConfig
 *   2. Pre-fetches a content catalog from the eligible cartridge capsule pool
 *   3. Fetches the user's live KNYT/cartridge state from Supabase
 *   4. Builds a structured LLM prompt (agent persona + matrix + state + catalog)
 *   5. Calls the configured LLM with provider fallback (Anthropic → OpenAI → Venice)
 *   6. Parses and validates the JSON manifest response
 *   7. Returns a RuntimeTakeoverManifest
 *
 * Unauthenticated visitors (no personaId) receive a Tier 1 manifest driven by
 * anonymousSeedCapsules + a generic world-intro prompt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPublishedRuntimeCapsuleRecords } from '@/services/composer/runtimeProjectionService';
import { listPromotedCommunityCatalogEntries } from '@/services/community-content/promotedCapsules';
import { CODEX_DEFINITIONS } from '@/data/codex-configs';
import { personas } from '@/app/data/personas';
import type {
  RuntimeTakeoverConfig,
  RuntimeTakeoverManifest,
  TakeoverCapsuleRef,
  TakeoverInferRequest,
  TakeoverInferResponse,
  TakeoverEntryPoint,
} from '@/types/runtimeTakeover';
import type { RuntimeCapsuleRecord } from '@/types/runtimeCapsules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ─── LLM config ───────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet';
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const OPENAI_MODEL      = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const VENICE_API_KEY    = process.env.VENICE_API_KEY;
const VENICE_MODEL      = process.env.VENICE_MODEL || 'venice-uncensored';

function mapAnthropicModel(id?: string | null): string {
  const n = id?.trim().toLowerCase();
  if (!n) return 'claude-sonnet-4-6';
  if (n === 'claude-3-5-sonnet') return 'claude-sonnet-4-6';
  if (n === 'claude-3-5-haiku')  return 'claude-haiku-4-5-20251001';
  if (n === 'claude-3-opus')     return 'claude-opus-4-6';
  return n;
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ─── Live state fetch ─────────────────────────────────────────────────────────

interface KnytLiveState {
  journey_stage: string;
  patronage_stage: string;
  pcs_stage: string;
  experience_depth: string;
  signal_counts: { like: number; spark: number; curate: number; total: number };
  knyt_balance: number;
  nbe: Record<string, unknown> | null;
  recent_participation: Array<{ signal_type: string; created_at: string; provisional?: boolean }>;
  active_elections: Array<{ id: string; title: string; closes_at: string }>;
}

const PATRONAGE_STAGES = ['Outside Order','Apprentice','Knight','Esquire','Sennight','Satoshi'] as const;
const PCS_STAGES       = ['Participant','Community','Correspondent','Operator','Creator','Upstream'] as const;

function patronageFromStage(stage: string): string {
  const map: Record<string,string> = {
    prospect: PATRONAGE_STAGES[0], acolyte: PATRONAGE_STAGES[1],
    keta: PATRONAGE_STAGES[2],     keji: PATRONAGE_STAGES[3],
    first: PATRONAGE_STAGES[4],    zero: PATRONAGE_STAGES[5],
  };
  return map[stage] ?? PATRONAGE_STAGES[0];
}

function pcsFromTotal(total: number): string {
  if (total >= 100) return PCS_STAGES[5];
  if (total >= 50)  return PCS_STAGES[4];
  if (total >= 20)  return PCS_STAGES[3];
  if (total >= 10)  return PCS_STAGES[2];
  if (total >= 3)   return PCS_STAGES[1];
  return PCS_STAGES[0];
}

async function fetchLiveState(personaId: string): Promise<KnytLiveState | null> {
  try {
    const db  = getDb();
    const now = new Date().toISOString();

    const [journeyRes, signalRes, balanceRes, nbeRes, electionsRes, recentRes] =
      await Promise.allSettled([
        db.from('journey_states')
          .select('stage, depth')
          .eq('persona_id', personaId)
          .order('active_at', { ascending: false })
          .limit(1).maybeSingle(),

        db.from('knyt_signals')
          .select('signal_type')
          .eq('persona_id', personaId),

        db.from('knyt_reward_grants')
          .select('amount_knyt')
          .eq('persona_id', personaId),

        db.from('nbe_plans')
          .select('id, disposition, next_experience_depth, rationale, expires_at')
          .eq('persona_id', personaId)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle(),

        db.from('knyt_living_canon_elections')
          .select('id, title, closes_at')
          .gt('closes_at', now)
          .limit(3),

        db.from('knyt_signals')
          .select('signal_type, created_at, provisional')
          .eq('persona_id', personaId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

    const journey  = journeyRes.status  === 'fulfilled' ? journeyRes.value.data    : null;
    const signals  = signalRes.status   === 'fulfilled' ? (signalRes.value.data ?? [])  : [];
    const grants   = balanceRes.status  === 'fulfilled' ? (balanceRes.value.data ?? []) : [];
    const nbe      = nbeRes.status      === 'fulfilled' ? nbeRes.value.data         : null;
    const elections = electionsRes.status === 'fulfilled' ? (electionsRes.value.data ?? []) : [];
    const recent   = recentRes.status   === 'fulfilled' ? (recentRes.value.data ?? [])  : [];

    const stage  = journey?.stage ?? 'prospect';
    const depth  = journey?.depth ?? 'pill';
    const likes  = signals.filter((s) => s.signal_type === 'like').length;
    const sparks = signals.filter((s) => s.signal_type === 'spark').length;
    const curates = signals.filter((s) => s.signal_type === 'curate').length;
    const total  = likes + sparks + curates;
    const balance = grants.reduce((sum: number, g) => sum + parseFloat(String(g.amount_knyt ?? 0)), 0);

    return {
      journey_stage:    stage,
      patronage_stage:  patronageFromStage(stage),
      pcs_stage:        pcsFromTotal(total),
      experience_depth: depth,
      signal_counts:    { like: likes, spark: sparks, curate: curates, total },
      knyt_balance:     parseFloat(balance.toFixed(8)),
      nbe:              nbe ?? null,
      recent_participation: recent as Array<{ signal_type: string; created_at: string; provisional?: boolean }>,
      active_elections: elections as Array<{ id: string; title: string; closes_at: string }>,
    };
  } catch {
    return null;
  }
}

// ─── Content catalog fetch ────────────────────────────────────────────────────

interface CatalogEntry {
  id:          string;
  type:        'experience' | 'smart-content' | 'codex';
  title:       string;
  description: string;
  cartridge?:  string;
  slug?:       string;
  tab?:        string;
}

async function fetchContentCatalog(config: RuntimeTakeoverConfig): Promise<CatalogEntry[]> {
  const catalog: CatalogEntry[] = [];

  // Experience + smart-content capsules from runtimeProjectionService
  if (config.contentScope.types.some((t) => t === 'experience' || t === 'smart-content')) {
    try {
      const records: RuntimeCapsuleRecord[] = await listPublishedRuntimeCapsuleRecords({
        limit: 30,
      });
      for (const r of records) {
        if (!config.contentScope.types.includes(r.sourceType)) continue;
        catalog.push({
          id:          r.id,
          type:        r.sourceType as 'experience' | 'smart-content',
          title:       r.title,
          description: r.description,
          cartridge:   r.metadata.runtimeCartridge ?? undefined,
        });
      }
    } catch { /* non-fatal */ }
  }

  // Promoted community-generated content — surfaced as smart-content so any
  // cartridge that accepts smart-content (KNYT) gets these items in its catalog.
  // listPromotedCommunityCatalogEntries never throws (returns [] on error).
  if (
    config.contentScope.types.includes('smart-content') &&
    config.contentScope.cartridgeSlugs.includes('knyt-codex')
  ) {
    try {
      const promoted = await listPromotedCommunityCatalogEntries({ limit: 12 });
      for (const entry of promoted) {
        catalog.push({
          id:          entry.id,
          type:        'smart-content',
          title:       entry.title,
          description: entry.description,
          cartridge:   entry.cartridgeSlug,
        });
      }
    } catch { /* non-fatal */ }
  }

  // Codex entries — one entry per eligible cartridge slug
  if (config.contentScope.types.includes('codex')) {
    for (const slug of config.contentScope.cartridgeSlugs) {
      const codex = CODEX_DEFINITIONS.find((c) => c.slug === slug || c.id === slug);
      if (!codex) continue;
      // Add one codex entry per enabled tab that makes sense as a capsule
      for (const tab of codex.tabs.filter((t) => t.enabled && !t.adminOnly).slice(0, 3)) {
        catalog.push({
          id:          `${slug}::${tab.slug}`,
          type:        'codex',
          title:       `${codex.name} — ${tab.label}`,
          description: tab.metadata?.description ?? `${tab.label} tab of ${codex.name}`,
          cartridge:   slug,
          slug,
          tab:         tab.slug,
        });
      }
    }
  }

  return catalog;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  config: RuntimeTakeoverConfig,
  catalog: CatalogEntry[],
  state: KnytLiveState | null,
  entryPoint: TakeoverEntryPoint,
): { system: string; user: string } {
  const agentKey = config.inference.agentPersona;
  const personaDef = (personas as Record<string, { systemPrompt: string }>)[agentKey];
  const personaIntro = personaDef?.systemPrompt?.split('\n')[0] ?? `You are ${agentKey}.`;

  const welcomePrefix = (
    entryPoint === 'toggle'  ? config.inference.welcomeVariants?.onToggle  :
    entryPoint === 'return'  ? config.inference.welcomeVariants?.onReturn  :
    config.inference.welcomeVariants?.onArrival
  ) ?? '';

  // Matrix orientation
  const matrixLines = config.experienceMatrix.axes.map((axis) => {
    const idx = state ? axis.stages.indexOf((state as Record<string, unknown>)[axis.stateField] as string) : 0;
    const current = idx >= 0 ? axis.stages[idx] : axis.stages[0];
    const next    = idx >= 0 && idx < axis.stages.length - 1 ? axis.stages[idx + 1] : null;
    return `  ${axis.label}: current="${current}"${next ? `, next="${next}"` : ' (sovereign)'}`;
  }).join('\n');

  // User state block
  const stateBlock = state ? `
USER STATE:
- Journey stage: ${state.journey_stage}
- Patronage stage: ${state.patronage_stage}
- PCS stage: ${state.pcs_stage}
- Experience depth: ${state.experience_depth}
- Signals: ${state.signal_counts.like} likes, ${state.signal_counts.spark} sparks, ${state.signal_counts.curate} curations (total ${state.signal_counts.total})
- $KNYT balance: ${state.knyt_balance}
- Active NBE: ${state.nbe ? JSON.stringify(state.nbe) : 'none'}
- Recent actions: ${state.recent_participation.map((p) => p.signal_type).join(', ') || 'none'}
- Open elections: ${state.active_elections.length > 0 ? state.active_elections.map((e) => e.title).join(', ') : 'none'}
` : `
USER STATE: Not authenticated — provide a world-introduction experience.
`;

  // Condensed catalog (keep prompt lean — title + description only)
  const catalogBlock = catalog.slice(0, 20).map((c) =>
    `  { "id": "${c.id}", "type": "${c.type}", "title": "${c.title.replace(/"/g, "'")}", "description": "${c.description.slice(0, 80).replace(/"/g, "'")}..." }`
  ).join(',\n');

  const system = `${personaIntro}

You are personalising the metaMe Runtime welcome screen for a user visiting the ${config.displayName} world.

EXPERIENCE MATRIX:
${matrixLines}

${stateBlock}
CONTENT SCOPE:
- Content types: ${config.contentScope.types.join(', ')}
- Cartridges: ${config.contentScope.cartridgeSlugs.join(', ')}
- Max capsules: ${config.contentScope.maxCapsules}
- Pin a hero capsule: ${config.contentScope.pinHero}

${config.inference.promptConstraints ?? ''}

You MUST return ONLY a valid JSON object — no markdown, no explanation, no surrounding text.
The JSON must match this exact schema:
{
  "welcomeNarrative": "string (max 40 words, personalised to the user's current stage)",
  "capsules": [
    { "type": "experience|smart-content|codex", "id": "string (exact id from catalog)", "pin": true|false, "slug": "string (codex only)", "tab": "string (codex only)" }
  ],
  "theme": "string (one of: patronage, discovery, contributor, stewardship, collector, sovereign)",
  "nextBestAction": { "label": "string", "target": "string", "targetType": "codex|route|action", "tab": "string (optional, codex only — tab slug inside the cartridge)" },
  "refreshAfterActions": ["like", "spark", "curate", "vote", "contribute"]
}

NEXT-BEST-ACTION RULES (strict — invalid actions are dropped):
- Only emit "nextBestAction" if you are confident it is the most useful next step. Omit otherwise.
- PREFER targetType="action" for most cases. Actions are short natural-language instructions the chat agent executes (e.g. "Show me episode one", "Tell me about the Order of Metaiye", "What's in the KNYT Cartridge for me?"). Actions surface specific content and feel conversational — they are the right answer for most NBA suggestions.
- Use targetType="route" only when there is a precise, short same-origin path the user clearly wants. Path must start with "/" and be under 1500 chars. Never pack JSON, article drafts, or experience context into the query string — if you would need to, use targetType="action" instead.
- Use targetType="codex" ONLY when the most useful next step is to open the cartridge UI. Target MUST be a cartridge slug from this allowlist: knyt-codex, metame-codex, qripto-codex, agentiq-os, alpha-knyt-codex. Do NOT use tab names, capsule ids, or display labels in target.
- For codex targets you MAY add an optional "tab" field with the slug of a specific tab inside that cartridge (e.g. target="knyt-codex", tab="scrolls" to land on the scrolls tab). Use this when the user clearly wants a specific tab rather than the cartridge home.
- Do NOT default to targetType="codex" when an action would be more useful. Opening the whole cartridge is a heavy navigation; an action that surfaces a specific capsule is almost always better.

Select capsule IDs ONLY from the catalog below. Do not invent IDs.`;

  const user = `${welcomePrefix ? welcomePrefix + '\n\n' : ''}AVAILABLE CONTENT CATALOG:
[
${catalogBlock}
]

Select up to ${config.contentScope.maxCapsules} capsules from the catalog. Ensure variety across types where possible. Return the JSON manifest now.`;

  return { system, user };
}

// ─── LLM call with provider fallback ─────────────────────────────────────────

async function callLlm(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  // Try Anthropic first
  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      mapAnthropicModel(ANTHROPIC_MODEL),
          system,
          messages:   [{ role: 'user', content: user }],
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: Array<{ type: string; text: string }> };
        const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
        if (text) return text;
      }
    } catch { /* fall through */ }
  }

  // Try OpenAI
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:       OPENAI_MODEL,
          messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens:  maxTokens,
          temperature: 0.6,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch { /* fall through */ }
  }

  // Try Venice
  if (VENICE_API_KEY) {
    try {
      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${VENICE_API_KEY}`,
        },
        body: JSON.stringify({
          model:       VENICE_MODEL,
          messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens:  maxTokens,
          temperature: 0.6,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch { /* fall through */ }
  }

  return null;
}

// ─── Manifest parser ──────────────────────────────────────────────────────────

function parseManifest(
  raw: string,
  config: RuntimeTakeoverConfig,
  catalog: CatalogEntry[],
  isPersonalised: boolean,
): RuntimeTakeoverManifest | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const catalogIds = new Set(catalog.map((c) => c.id));

    const capsules: TakeoverCapsuleRef[] = (
      Array.isArray(parsed.capsules) ? (parsed.capsules as unknown[]) : []
    )
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .filter((c) => catalogIds.has(String(c.id)))     // only allow catalog IDs
      .slice(0, config.contentScope.maxCapsules)
      .map((c) => ({
        type:  String(c.type) as 'experience' | 'smart-content' | 'codex',
        id:    String(c.id),
        pin:   c.pin === true,
        ...(c.slug ? { slug: String(c.slug) } : {}),
        ...(c.tab  ? { tab:  String(c.tab)  } : {}),
      }));

    const welcomeNarrative =
      typeof parsed.welcomeNarrative === 'string' && parsed.welcomeNarrative.length > 0
        ? parsed.welcomeNarrative.slice(0, 300)
        : `Welcome to ${config.displayName}.`;

    const nbaRaw = typeof parsed.nextBestAction === 'object' && parsed.nextBestAction !== null
      ? (parsed.nextBestAction as Record<string, unknown>)
      : null;

    // NBA validation: only emit a NBA if label + target are non-empty strings.
    // Unknown targetType defaults to 'action' (not 'codex'), so the runtime
    // doesn't open a cartridge overlay for poorly-typed LLM output.
    const nbaLabel  = String(nbaRaw?.label  ?? '').trim();
    const nbaTarget = String(nbaRaw?.target ?? '').trim();
    const nbaTypeRaw = String(nbaRaw?.targetType ?? '').trim();
    const nbaTabRaw = String(nbaRaw?.tab ?? '').trim();
    const nbaType = (['codex','route','action'].includes(nbaTypeRaw)
      ? nbaTypeRaw : 'action') as 'codex' | 'route' | 'action';
    const nextBestAction = nbaRaw && nbaLabel && nbaTarget
      ? {
          label:      nbaLabel,
          target:     nbaTarget,
          targetType: nbaType,
          // Tab is only meaningful for codex-type targets; carry forward when present.
          ...(nbaType === 'codex' && nbaTabRaw ? { tab: nbaTabRaw } : {}),
        }
      : undefined;

    return {
      cartridgeSlug:       config.cartridgeSlug,
      welcomeNarrative,
      capsules,
      theme:               typeof parsed.theme === 'string' ? parsed.theme : undefined,
      nextBestAction,
      refreshAfterActions: Array.isArray(parsed.refreshAfterActions)
        ? (parsed.refreshAfterActions as unknown[]).map(String)
        : [],
      generatedAt:    new Date().toISOString(),
      isPersonalised,
    };
  } catch {
    return null;
  }
}

// ─── Fallback manifest ────────────────────────────────────────────────────────

function buildFallbackManifest(
  config: RuntimeTakeoverConfig,
  catalog: CatalogEntry[],
): RuntimeTakeoverManifest {
  const seeds = config.anonymousSeedCapsules ?? [];
  const capsules: TakeoverCapsuleRef[] = seeds.length > 0
    ? seeds.slice(0, config.contentScope.maxCapsules).map((s, i) => ({
        type: s.type, id: s.id, pin: i === 0,
        ...(s.slug ? { slug: s.slug } : {}),
        ...(s.tab  ? { tab:  s.tab  } : {}),
      }))
    : catalog.slice(0, 6).map((c, i) => ({
        type: c.type as TakeoverCapsuleRef['type'], id: c.id, pin: i === 0,
        ...(c.slug ? { slug: c.slug } : {}),
        ...(c.tab  ? { tab:  c.tab  } : {}),
      }));

  return {
    cartridgeSlug:   config.cartridgeSlug,
    welcomeNarrative: `Welcome to ${config.displayName}. Explore what's on offer.`,
    capsules,
    generatedAt:     new Date().toISOString(),
    isPersonalised:  false,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<TakeoverInferResponse>> {
  try {
    const body = await request.json() as Partial<TakeoverInferRequest>;
    const { cartridgeSlug, personaId, entryPoint = 'arrival' } = body;

    if (!cartridgeSlug) {
      return NextResponse.json({ ok: false, error: 'cartridgeSlug is required' }, { status: 400 });
    }

    // Resolve takeover config
    const codex = CODEX_DEFINITIONS.find((c) => c.slug === cartridgeSlug || c.id === cartridgeSlug);
    const takeoverConfig: RuntimeTakeoverConfig | undefined = codex?.runtimeTakeover;

    if (!takeoverConfig?.enabled) {
      return NextResponse.json(
        { ok: false, error: `No active runtime takeover config for cartridge: ${cartridgeSlug}` },
        { status: 404 }
      );
    }

    // Fetch content catalog and live state in parallel
    const [catalog, liveState] = await Promise.all([
      fetchContentCatalog(takeoverConfig),
      personaId ? fetchLiveState(personaId) : Promise.resolve(null),
    ]);

    // If no catalog content at all, return fallback immediately
    if (catalog.length === 0) {
      return NextResponse.json({ ok: true, manifest: buildFallbackManifest(takeoverConfig, []) });
    }

    // Build prompt and call LLM
    const { system, user } = buildPrompt(takeoverConfig, catalog, liveState, entryPoint);
    const maxTokens = takeoverConfig.inference.maxTokens ?? 500;

    const raw = await callLlm(system, user, maxTokens);

    if (!raw) {
      // LLM unavailable — return deterministic fallback
      return NextResponse.json({ ok: true, manifest: buildFallbackManifest(takeoverConfig, catalog) });
    }

    const manifest = parseManifest(raw, takeoverConfig, catalog, !!liveState);

    if (!manifest) {
      return NextResponse.json({ ok: true, manifest: buildFallbackManifest(takeoverConfig, catalog) });
    }

    return NextResponse.json({ ok: true, manifest });

  } catch (err) {
    console.error('[takeover/infer] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Inference failed' },
      { status: 500 }
    );
  }
}
