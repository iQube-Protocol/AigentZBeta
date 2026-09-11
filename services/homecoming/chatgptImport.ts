/**
 * ChatGPT export intake — Knowledge Homecoming (CFS-023, Workstream 1).
 *
 * The one genuinely-new intake path in Knowledge Homecoming: parse a standard
 * ChatGPT data export (`conversations.json`) into linear, role-prefixed
 * transcripts ready for the EXISTING KB ingestion spine
 * (KnowledgeBaseService.ingestTextDocument). Nothing here writes — the parser is
 * PURE and deterministic (no fs, no DB, no clock, no network), so it is fully
 * canary-testable; the route (app/api/homecoming/knowledge/import) does the IO.
 *
 * Defensive by design (No-Guessing): the ChatGPT export is an EXTERNAL format we
 * do not control, so every field access is guarded and unknown shapes are
 * SKIPPED, never crashed on. It targets the documented export structure — a top
 * level array (or `{conversations:[…]}`) of conversations, each with a `mapping`
 * DAG of message nodes and a `current_node` leaf — and degrades gracefully if a
 * field is missing or a message is a non-text / hidden / system / tool node.
 */

export interface ChatGptMessage {
  role: 'user' | 'assistant';
  text: string;
  createTime: number | null;
}

export interface ParsedConversation {
  sourceId: string;
  title: string;
  createTime: number | null;
  messages: ChatGptMessage[];
}

// ─── Guarded field access ────────────────────────────────────────────────────

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

/** A URL/id-safe slug for a fallback sourceId. Pure. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Extract a single usable message from a mapping node's `message`. Returns null
 * for anything we deliberately drop: no message, a non-user/assistant role,
 * hidden-from-conversation, non-text content, or empty text.
 */
function extractMessage(rawMessage: unknown): ChatGptMessage | null {
  const message = asRecord(rawMessage);
  if (!message) return null;

  const author = asRecord(message.author);
  const role = author && typeof author.role === 'string' ? author.role : null;
  if (role !== 'user' && role !== 'assistant') return null; // drop system / tool

  const meta = asRecord(message.metadata);
  if (meta && meta.is_visually_hidden_from_conversation === true) return null;

  const content = asRecord(message.content);
  // Only plain-text content for v1; skip tool/code/multimodal parts honestly.
  if (content && typeof content.content_type === 'string' && content.content_type !== 'text') return null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter((p): p is string => typeof p === 'string')
    .join('\n')
    .trim();
  if (!text) return null;

  return { role, text, createTime: typeof message.create_time === 'number' ? message.create_time : null };
}

/**
 * Linearise a conversation's mapping DAG into an ordered message list. When a
 * `current_node` leaf is present we walk up its parent chain and reverse — the
 * "as last seen" thread, correct across edit/regeneration branches. Without one
 * we fall back to all messages sorted by create_time. Cycle-guarded. Pure.
 */
export function linearizeMapping(rawMapping: unknown, currentNode: unknown): ChatGptMessage[] {
  const mapping = asRecord(rawMapping);
  if (!mapping) return [];

  const leaf = typeof currentNode === 'string' ? currentNode : null;
  if (leaf && mapping[leaf]) {
    const chain: ChatGptMessage[] = [];
    const seen = new Set<string>();
    let nodeId: string | null = leaf;
    while (nodeId && !seen.has(nodeId)) {
      seen.add(nodeId);
      const node = asRecord(mapping[nodeId]);
      if (!node) break;
      const msg = extractMessage(node.message);
      if (msg) chain.push(msg);
      nodeId = typeof node.parent === 'string' ? node.parent : null;
    }
    return chain.reverse();
  }

  // Fallback: no current_node → collect all, order by create_time (stable).
  const all: ChatGptMessage[] = [];
  for (const key of Object.keys(mapping)) {
    const node = asRecord(mapping[key]);
    if (!node) continue;
    const msg = extractMessage(node.message);
    if (msg) all.push(msg);
  }
  return all.sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));
}

/** Stable, deterministic sourceId for a conversation (idempotent re-import). */
export function conversationSourceId(conv: Record<string, unknown>, index: number, title: string): string {
  const id =
    (typeof conv.conversation_id === 'string' && conv.conversation_id) ||
    (typeof conv.id === 'string' && conv.id) ||
    null;
  if (id) return `chatgpt:${id}`;
  const ct = typeof conv.create_time === 'number' ? String(Math.floor(conv.create_time)) : String(index);
  return `chatgpt:${slugify(title) || 'untitled'}:${ct}`;
}

/**
 * Parse a ChatGPT export into conversations with linearised messages. Accepts
 * the top-level array form OR a `{conversations:[…]}` wrapper. Conversations
 * that yield no usable messages are dropped (recorded by their absence, never
 * masked as empty transcripts). Pure.
 */
export function parseChatGptExport(raw: unknown): ParsedConversation[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : (() => {
        const rec = asRecord(raw);
        return rec && Array.isArray(rec.conversations) ? rec.conversations : [];
      })();

  const out: ParsedConversation[] = [];
  list.forEach((item, index) => {
    const conv = asRecord(item);
    if (!conv) return;
    const title = typeof conv.title === 'string' && conv.title.trim() ? conv.title.trim() : 'Untitled conversation';
    const messages = linearizeMapping(conv.mapping, conv.current_node);
    if (messages.length === 0) return; // no usable content — drop honestly
    out.push({
      sourceId: conversationSourceId(conv, index, title),
      title,
      createTime: typeof conv.create_time === 'number' ? conv.create_time : null,
      messages,
    });
  });
  return out;
}

/** Render a parsed conversation as a role-prefixed plain-text transcript. Pure. */
export function conversationToTranscript(conv: ParsedConversation): string {
  const header = `# ${conv.title}`;
  const body = conv.messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n\n');
  return `${header}\n\n${body}`;
}

export interface HomecomingDocument {
  sourceId: string;
  title: string;
  text: string;
  turnCount: number;
  createTime: number | null;
}

/**
 * Full pipeline (pure): export → ingestion-ready documents. Each carries a stable
 * sourceId (idempotent re-import) and a role-prefixed transcript. The route feeds
 * these to KnowledgeBaseService.ingestTextDocument under the `homecoming` domain.
 */
export function chatGptExportToDocuments(raw: unknown): HomecomingDocument[] {
  return parseChatGptExport(raw).map((conv) => ({
    sourceId: conv.sourceId,
    title: conv.title,
    text: conversationToTranscript(conv),
    turnCount: conv.messages.length,
    createTime: conv.createTime,
  }));
}
