/**
 * AgentiQ Codex Chat API — Aigent Z
 *
 * Serves the engineering intelligence copilot for the AgentiQ Codex viewer.
 * Unlike the content-domain codex chat route (which uses Supabase embeddings
 * for metaKnyts / Qriptopian), this route reads the AgentiQ Codex markdown
 * files directly from the filesystem and injects the most relevant excerpts
 * into the LLM context alongside the Aigent Z system prompt.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { personas } from '@/app/data/personas';

// ============================================================================
// Config
// ============================================================================

const CODEX_ROOT = path.join(process.cwd(), 'codexes/packs/aigency');
const ITEMS_ROOT = path.join(CODEX_ROOT, 'items');

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

// ============================================================================
// Filesystem helpers
// ============================================================================

function readCodexFile(relPath: string): string | null {
  try {
    const abs = path.join(CODEX_ROOT, relPath);
    if (!abs.startsWith(CODEX_ROOT)) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function listMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listMarkdownFiles(full));
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        results.push(path.relative(CODEX_ROOT, full));
      }
    }
  } catch {
    // ignore
  }
  return results;
}

function isDeployCommit(content: string): boolean {
  return /\|\s*Type\s*\|\s*`deploy`/.test(content);
}

/** Keyword search across the AgentiQ Codex markdown files. */
function searchCodex(query: string, limit = 5): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  // Prioritise architecture, knowledge, repos, build_ docs — not every commit brief
  const priorityDirs = ['items/architecture', 'items/knowledge', 'items/repos', 'items/build_'];
  const allFiles = listMarkdownFiles(ITEMS_ROOT).map((f) => `items/${f}`);

  // Sort: priority dirs first
  const sorted = [
    ...allFiles.filter((f) => priorityDirs.some((d) => f.startsWith(d) && !f.includes('/COMMITS/'))),
    ...allFiles.filter((f) => f.includes('/COMMITS/')),
  ];

  const results: SearchResult[] = [];

  for (const relPath of sorted) {
    const content = readCodexFile(relPath);
    if (!content) continue;
    // Skip deploy-trigger commit briefs
    if (relPath.includes('/COMMITS/') && isDeployCommit(content)) continue;

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

/** Pull the most recent substantive commits from index.json. */
function getRecentCommits(limit = 10): Array<Record<string, string>> {
  try {
    const raw = readCodexFile('index.json');
    if (!raw) return [];
    const idx = JSON.parse(raw);
    const history: Array<Record<string, string>> = idx.commit_history || [];
    return history
      .filter((c) => c.type !== 'deploy')
      .slice(0, limit);
  } catch {
    return [];
  }
}

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

function buildAigentZSystemPrompt(
  query: string,
  searchResults: SearchResult[],
  recentCommits: Array<Record<string, string>>,
  enableWrite = false,
): string {
  const base = (personas['aigent-z'] as { systemPrompt: string }).systemPrompt;

  const contextBlocks: string[] = [];

  if (searchResults.length > 0) {
    const block = searchResults
      .map((r) => {
        // For architecture/knowledge/repos files, include more content
        const isStructured =
          r.path.includes('/architecture/') ||
          r.path.includes('/knowledge/') ||
          r.path.includes('/repos/') ||
          r.path.includes('/build_/decisions') ||
          r.path.includes('/build_/changelog');

        if (isStructured) {
          const full = readCodexFile(r.path);
          const snippet = full ? full.slice(0, 1200) : r.excerpt;
          return `### ${r.path}\n${snippet}${full && full.length > 1200 ? '\n...[truncated]' : ''}`;
        }
        return `### ${r.path}\n${r.excerpt}`;
      })
      .join('\n\n');

    contextBlocks.push(`## Relevant Codex Excerpts\n\n${block}`);
  }

  if (recentCommits.length > 0) {
    const rows = recentCommits
      .map((c) => `- \`${c.sha}\` ${c.timestamp?.slice(0, 10)} [${c.type}] ${c.title} (${c.author})`)
      .join('\n');
    contextBlocks.push(`## Recent Dev Commits (last ${recentCommits.length}, excluding deploy triggers)\n\n${rows}`);
  }

  if (contextBlocks.length === 0) {
    return enableWrite ? `${base}${WRITE_DOC_SYSTEM_ADDENDUM}` : base;
  }

  const assembled = `${base}\n\n---\n\n${contextBlocks.join('\n\n')}`;
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
      codex_sources: searchResults.map((r) => r.path),
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
