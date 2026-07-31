/**
 * AgentiQ Codex Chat API — Aigent Z
 *
 * Serves the engineering intelligence copilot for the AgentiQ Codex viewer.
 * Reads both the aigency engineering KB and the agentiq cartridge pack (items,
 * updates, decisions, backlog) and injects relevant excerpts into LLM context.
 *
 * File references in responses are formatted as GitHub links so the cartridge
 * doubles as a repo navigation tool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { personas } from '@/app/data/personas';
import {
  GITHUB_BLOB_BASE,
  SearchResult,
  searchCodex,
  getRecentCommits,
  buildCodexExcerptsBlock,
  ensureCorpusHydrated,
  buildRecentCommitsBlock,
} from '@/services/knowledge/agentiqPackSearch';

// ============================================================================
// Config
// ============================================================================

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

// Pack search (searchCodex / getRecentCommits / excerpt formatting) lives in
// services/knowledge/agentiqPackSearch.ts — shared with the aigent-z Dev
// Command Center copilot in app/api/codex/chat/route.ts.

// ============================================================================
// System prompt builder
// ============================================================================

const WRITE_DOC_SYSTEM_ADDENDUM = `
## Writing New Documentation

When a user asks you to create, write, or draft a new document for the codex (e.g. "write a DVN.md doc", "create documentation for X"), you CAN write it directly.

To write a document, include a block at the END of your response in this exact format:

\`\`\`write_doc
path: architecture/dvn.md
---
# DVN — Decentralized Verification Network

Full markdown content here...
\`\`\`

Rules:
- Path must be relative to items/ (e.g. architecture/dvn.md, knowledge/webhooks.md, build_/adr-001.md)
- Only .md files
- Only create docs about real AgentiQ platform topics you have knowledge of
- Do NOT write code files, configs, or scripts — documentation only
- If the user just wants a draft to review first, say so and ask for confirmation before including the write_doc block
- After the write_doc block, briefly tell the user what you wrote and where it will appear in the codex`;

const REPO_NAV_ADDENDUM = `
## Repo Navigation — File Links

You have access to two codex packs:
- **aigency** (engineering KB): architecture, API reference, knowledge docs, commit history
- **agentiq** (cartridge KB): overview docs, session updates, decisions, backlog items

When referencing any file, ALWAYS format it as a clickable markdown link:
[filename](${GITHUB_BLOB_BASE}/codexes/packs/<packName>/<relPath>)

Example: [SYSTEM_MAP.md](${GITHUB_BLOB_BASE}/codexes/packs/agentiq/items/SYSTEM_MAP.md)

The excerpts above show each file's GitHub link in the header — use those exact URLs.

## Status Conventions

Always indicate item status in your responses:
- **[SHIPPED]** — session update docs without "backlog"/"plan" in name; deployed and in code
- **[BACKLOG]** — update docs with "backlog" in name; work not yet started
- **[PLANNED]** — update docs with "plan"/"handover" in name; scoped but not started
- **[REFERENCE]** — items/ docs; canonical architecture and platform reference

When asked "is X done?", check whether there is a SHIPPED session record for it. If only a BACKLOG doc exists, it is pending. If only REFERENCE docs exist, it is architectural intent only.`;

function buildAigentZSystemPrompt(
  query: string,
  searchResults: SearchResult[],
  recentCommits: Array<Record<string, string>>,
  enableWrite = false,
): string {
  const base = (personas['aigent-z'] as { systemPrompt: string }).systemPrompt;

  const contextBlocks: string[] = [];

  const excerptsBlock = buildCodexExcerptsBlock(searchResults);
  if (excerptsBlock) contextBlocks.push(excerptsBlock);

  const commitsBlock = buildRecentCommitsBlock(recentCommits);
  if (commitsBlock) contextBlocks.push(commitsBlock);

  const repoNav = REPO_NAV_ADDENDUM;

  if (contextBlocks.length === 0) {
    const noCtx = `${base}${repoNav}`;
    return enableWrite ? `${noCtx}${WRITE_DOC_SYSTEM_ADDENDUM}` : noCtx;
  }

  const assembled = `${base}${repoNav}\n\n---\n\n${contextBlocks.join('\n\n')}`;
  return enableWrite ? `${assembled}${WRITE_DOC_SYSTEM_ADDENDUM}` : assembled;
}

// ============================================================================
// LLM callers (minimal — OpenAI / Anthropic / Venice fallback chain)
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
  if (/(commit|deploy|push|build|release)/.test(q)) {
    return 'The AgentiQ Codex tracks 1,355+ direct dev-branch commits. Use the `agentiq_codex_list_commits` action in the CopilotKit interface to query the commit index, or ask me to look up a specific feature or date range.';
  }
  if (/(architecture|stack|layer|system|map)/.test(q)) {
    return 'The platform uses a 4-layer model: Identity (DID/iQube), Data (iQubes), Payments (x402), Runtime (CopilotKit/MCP). See `items/architecture/system-map.md` in the codex for the full breakdown.';
  }
  if (/(api|route|endpoint)/.test(q)) {
    return 'The API reference at `items/knowledge/api-reference.md` documents 400+ routes across identity, x402, wallet, registry, copilotkit, codex, MCP, CRM, analytics, blockchain ops, and admin domains.';
  }
  return 'I can answer questions about the AgentiQ platform architecture, codebase, deployment history, API routes, and engineering decisions. What would you like to know?';
}

// ============================================================================
// POST handler
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

const WRITE_INTENT_RE = /\b(write|create|add|draft|generate|document)\b.*\b(doc|docs|documentation|\.md|file|page|entry)\b/i;

interface WriteDocResult {
  path: string;
  action: 'created' | 'updated' | 'skipped';
  github_url?: string;
  error?: string;
}

async function parseAndWriteDoc(
  responseText: string,
  baseUrl: string,
): Promise<{ cleanResponse: string; writeResult: WriteDocResult | null }> {
  const blockRe = /```write_doc\n([\s\S]*?)```/;
  const match = responseText.match(blockRe);
  if (!match) return { cleanResponse: responseText, writeResult: null };

  const blockContent = match[1];
  const divider = blockContent.indexOf('\n---\n');
  if (divider === -1) return { cleanResponse: responseText, writeResult: null };

  const headerLine = blockContent.slice(0, divider).trim();
  const docContent = blockContent.slice(divider + 5);
  const pathMatch = headerLine.match(/^path:\s*(.+)$/m);
  if (!pathMatch) return { cleanResponse: responseText, writeResult: null };

  const docPath = pathMatch[1].trim();
  // Strip the write_doc block from what the user sees
  const cleanResponse = responseText.replace(match[0], '').trim();

  try {
    const res = await fetch(`${baseUrl}/api/codex/chat/aigentiq/write-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: docPath, content: docContent }),
    });
    const data = await res.json();
    if (!data.ok && data.exists) {
      // File exists — treat as skipped (agent can suggest overwrite: true explicitly)
      return { cleanResponse, writeResult: { path: docPath, action: 'skipped', error: data.error } };
    }
    if (!data.ok) {
      return { cleanResponse, writeResult: { path: docPath, action: 'skipped', error: data.error } };
    }
    return {
      cleanResponse,
      writeResult: { path: data.path, action: data.action, github_url: data.github_url },
    };
  } catch (err) {
    return {
      cleanResponse,
      writeResult: { path: docPath, action: 'skipped', error: String(err) },
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, chatHistory = [], provider_id } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const enableWrite = Boolean(process.env.GITHUB_TOKEN) && WRITE_INTENT_RE.test(message);

    // Hydrate the pack corpus (no-op in local-FS/dev; fetches the remote blob
    // once per container in the SSR Lambda) before the synchronous search below.
    await ensureCorpusHydrated();

    // Search codex and fetch recent commits in parallel
    const [searchResults, recentCommits] = await Promise.all([
      Promise.resolve(searchCodex(message, 5)),
      Promise.resolve(getRecentCommits(15)),
    ]);

    const systemPrompt = buildAigentZSystemPrompt(message, searchResults, recentCommits, enableWrite);

    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory as ChatMessage[]).slice(-10),
      { role: 'user', content: message },
    ];

    // Provider preference: explicit request → Anthropic → OpenAI → Venice → fallback
    const preferredProvider =
      typeof provider_id === 'string' ? provider_id.toLowerCase() : null;

    let responseText: string | null = null;
    const errors: string[] = [];

    const tryProviders = preferredProvider
      ? [preferredProvider, 'anthropic', 'openai', 'venice'].filter(
          (v, i, a) => a.indexOf(v) === i
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
      console.warn('[AgentiQ Chat] All providers failed, using fallback', errors);
      responseText = fallbackResponse(message);
    }

    // If the response contains a write_doc block, execute it
    let writeResult: WriteDocResult | null = null;
    if (enableWrite && responseText.includes('```write_doc')) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const parsed = await parseAndWriteDoc(responseText, appUrl);
      responseText = parsed.cleanResponse;
      writeResult = parsed.writeResult;

      // Append status to the visible response
      if (writeResult) {
        if (writeResult.action === 'created' || writeResult.action === 'updated') {
          responseText += `\n\n---\n✅ **Doc ${writeResult.action}:** \`${writeResult.path}\` committed to dev.${writeResult.github_url ? ` [View on GitHub](${writeResult.github_url})` : ''}`;
        } else if (writeResult.error) {
          responseText += `\n\n---\n⚠️ **Could not write doc:** ${writeResult.error}`;
        }
      }
    }

    return NextResponse.json({
      response: responseText,
      persona: 'aigent-z',
      codex_sources: searchResults.map((r) => ({
        path: r.packRelPath,
        status: r.status,
        github_url: r.githubUrl,
      })),
      write_result: writeResult ?? undefined,
    });
  } catch (err) {
    console.error('[AgentiQ Chat] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
