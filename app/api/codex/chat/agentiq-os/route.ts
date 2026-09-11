/**
 * AgentiQ OS Chat API — Aigent C-OS
 *
 * Strictly isolated to codexes/packs/agentiq-os/ KB.
 * Serves the developer-facing copilot for the AgentiQ OS Cartridge.
 *
 * Security: DelegationGuard runs before every LLM call — injection
 * pattern scan, PolicyEnvelope enforcement, TTL and action counter check.
 * All policy violations emit receipt-eligible OrchestrationEvents.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureCorpusHydrated,
  corpusReadFile,
  corpusListMarkdown,
} from '@/services/knowledge/packCorpusStore';
import * as path from 'path';
import { personas } from '@/app/data/personas';
import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';

// ============================================================================
// Config — STRICTLY isolated to agentiq-os pack
// ============================================================================

const PACK_ROOT = path.join(process.cwd(), 'codexes/packs/agentiq-os');
const ITEMS_ROOT = path.join(PACK_ROOT, 'items');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_MODEL = process.env.VENICE_MODEL || 'venice-uncensored';

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SearchResult {
  path: string;
  excerpt: string;
  score: number;
}

interface DelegationGuardResult {
  pass: boolean;
  reason?: string;
  injectionDetected?: boolean;
}

// ============================================================================
// DelegationGuard — injection scan + PolicyEnvelope enforcement
// Runs before every LLM call. Primary control — LLM constraint is defense-in-depth.
// ============================================================================

const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+instructions/i,
  /act\s+as\s+(if\s+you\s+are|an?\s+admin|root|system)/i,
  /override\s+(policy|envelope|restrictions|rules)/i,
  /reveal\s+(system\s+prompt|instructions|credentials|secrets|key)/i,
  /access\s+(aigency|engineering|supabase.service.role|service.role)/i,
  /service[\s_-]?role[\s_-]?key/i,
  /you\s+are\s+now\s+(a\s+different|no\s+longer|free)/i,
  /disregard\s+(all|your)\s+(previous|prior|above|safety)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(unrestricted|without|free)/i,
  /sudo\s+mode/i,
  /jailbreak/i,
];

const FORBIDDEN_ACTIONS_PATTERNS = [
  { pattern: /write.*aigency|aigency.*write/i, action: 'write_to_aigency_pack' },
  { pattern: /service[\s_-]?role/i, action: 'access_supabase_service_role' },
  { pattern: /publish.*registry.*live|registry.*live.*publish/i, action: 'push_to_registry_live' },
  { pattern: /wallet.*credential|private.*key.*wallet/i, action: 'read_wallet_credentials' },
  { pattern: /modify.*other.*persona|other.*persona.*modify/i, action: 'modify_other_persona' },
  { pattern: /sovereign.*iqube|iqube.*sovereign/i, action: 'read_sovereign_iqube' },
];

function runDelegationGuard(message: string): DelegationGuardResult {
  // 1. Injection pattern scan
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        pass: false,
        reason: 'Potential prompt injection detected. Request blocked.',
        injectionDetected: true,
      };
    }
  }

  // 2. Forbidden action classification
  for (const { pattern, action } of FORBIDDEN_ACTIONS_PATTERNS) {
    if (pattern.test(message)) {
      return {
        pass: false,
        reason: `Requested action '${action}' is not permitted in agentiq-os-cartridge scope.`,
        injectionDetected: false,
      };
    }
  }

  return { pass: true };
}

// ============================================================================
// Filesystem helpers — reads ONLY from agentiq-os pack
// ============================================================================

// Reads route through the pack-corpus seam: local FS in dev, the in-memory
// corpus (hydrated from the remote blob) in the SSR Lambda. The POST handler
// awaits ensureCorpusHydrated() before the synchronous searchPack below.
function readPackFile(relPath: string): string | null {
  const abs = path.join(PACK_ROOT, relPath);
  // Strict path containment — never read outside pack root
  if (!abs.startsWith(PACK_ROOT)) return null;
  return corpusReadFile(abs);
}

function listMarkdownFiles(dir: string): string[] {
  return corpusListMarkdown(dir, PACK_ROOT);
}

/** Keyword search across agentiq-os items only. */
function searchPack(query: string, limit = 5): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const allFiles = listMarkdownFiles(ITEMS_ROOT).map((f) => `items/${f}`);
  const results: SearchResult[] = [];

  for (const relPath of allFiles) {
    const content = readPackFile(relPath);
    if (!content) continue;

    const lower = content.toLowerCase();
    const score = terms.reduce((acc, t) => acc + (lower.split(t).length - 1), 0);
    if (score === 0) continue;

    const lines = content.split('\n');
    const excerptLine = lines.find((l) => terms.some((t) => l.toLowerCase().includes(t)));
    results.push({
      path: relPath,
      excerpt: (excerptLine || lines[0] || '').slice(0, 400).trim(),
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ============================================================================
// System prompt builder — agentiq-os persona, grounded in pack KB
// ============================================================================

function buildSystemPrompt(
  searchResults: SearchResult[],
): string {
  const base = (personas['aigent-c-os'] as { systemPrompt: string }).systemPrompt;

  if (searchResults.length === 0) return base;

  const block = searchResults
    .map((r) => {
      const full = readPackFile(r.path);
      const snippet = full ? full.slice(0, 1200) : r.excerpt;
      return `### ${r.path}\n${snippet}${full && full.length > 1200 ? '\n...[truncated]' : ''}`;
    })
    .join('\n\n');

  return `${base}\n\n---\n\n## Relevant KB Excerpts\n\n${block}`;
}

// ============================================================================
// LLM callers — same provider chain pattern as aigentiq route
// ============================================================================

async function callOpenAi(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.2, max_tokens: 2048 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI empty response');
  return content;
}

async function callAnthropic(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: systemPrompt,
      messages: anthropicMessages,
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = (data?.content || [])
    .filter((b: { type: string; text?: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
  if (!content) throw new Error('Anthropic empty response');
  return content;
}

async function callVenice(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VENICE_API_KEY}` },
    body: JSON.stringify({ model: VENICE_MODEL, messages, temperature: 0.2, max_tokens: 2048 }),
  });
  if (!res.ok) throw new Error(`Venice ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Venice empty response');
  return content;
}

function fallbackResponse(message: string): string {
  const q = message.toLowerCase();
  if (/(sdk|install|quickstart|npm)/.test(q)) {
    return 'See the SDK Quickstart doc: `npm install @agentiqos/agentiq-sdk`, then `npx agentiq init my-cartridge`. Full guide in items/sdk-quickstart.md.';
  }
  if (/(protocol|iqube|qripto|aigent)/.test(q)) {
    return 'AgentiQ OS is built on three protocols: iQube (data sovereignty), Qripto (trust + payments), and Aigent (identity + delegation). See items/protocols.md for the full reference.';
  }
  if (/(delegation|policy|envelope|guard)/.test(q)) {
    return 'Bounded delegation uses a sealed PolicyEnvelope to enforce scope, prevent injection, and audit every action via DVN receipts. See items/bounded-delegation.md.';
  }
  return 'I can answer questions about AgentiQ OS protocols, SDK, runtime, studio, registry, bounded delegation, and developer standards. What would you like to know?';
}

// ============================================================================
// POST handler
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, chatHistory = [], provider_id, persona_id } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // DelegationGuard — primary policy enforcement, runs before LLM
    const guardResult = runDelegationGuard(message);
    if (!guardResult.pass) {
      const pid = persona_id ?? 'anonymous';
      void emitOrchestrationEvent({
        event_id: `guard_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        event_type: 'policy_blocked',
        from_role: 'aigent-z',
        to_role: 'aigent-c',
        reason: guardResult.reason ?? 'DelegationGuard blocked request',
        journey_stage: 'acolyte',
        active_cartridge: 'agentiq-os-cartridge',
        active_codex: 'agentiq-os-cartridge',
        receipt_eligible: true,
        metadata: {
          persona_id: pid,
          agent_root_did: 'did:iqube:aigent-c-os-root',
          injection_detected: guardResult.injectionDetected ?? false,
          message_preview: message.slice(0, 120),
        },
      });
      return NextResponse.json(
        {
          error: 'Request blocked by policy guard.',
          reason: guardResult.reason,
          policy_blocked: true,
        },
        { status: 403 },
      );
    }

    // Hydrate the pack corpus (no-op in dev; fetches the remote blob once per
    // container in the SSR Lambda) before the synchronous searchPack below.
    await ensureCorpusHydrated();

    // Search agentiq-os KB only
    const searchResults = searchPack(message, 5);

    const systemPrompt = buildSystemPrompt(searchResults);

    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory as ChatMessage[]).slice(-10),
      { role: 'user', content: message },
    ];

    const preferredProvider =
      typeof provider_id === 'string' ? provider_id.toLowerCase() : null;

    let responseText: string | null = null;
    const errors: string[] = [];

    const tryProviders = preferredProvider
      ? [preferredProvider, 'anthropic', 'openai', 'venice'].filter(
          (v, i, a) => a.indexOf(v) === i,
        )
      : ['anthropic', 'openai', 'venice'];

    for (const provider of tryProviders) {
      try {
        if (provider === 'anthropic' && ANTHROPIC_API_KEY) {
          responseText = await callAnthropic(systemPrompt, conversationMessages);
          break;
        }
        if (provider === 'openai' && OPENAI_API_KEY) {
          responseText = await callOpenAi(conversationMessages);
          break;
        }
        if (provider === 'venice' && VENICE_API_KEY) {
          responseText = await callVenice(conversationMessages);
          break;
        }
      } catch (err) {
        errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!responseText) {
      console.warn('[AgentiQ-OS Chat] All providers failed, using fallback', errors);
      responseText = fallbackResponse(message);
    }

    return NextResponse.json({
      response: responseText,
      persona: 'aigent-c-os',
      kb_sources: searchResults.map((r) => r.path),
    });
  } catch (err) {
    console.error('[AgentiQ-OS Chat] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
