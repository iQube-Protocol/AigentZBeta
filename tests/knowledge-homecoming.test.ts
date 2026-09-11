/**
 * Knowledge Homecoming — ChatGPT export parser canaries (CFS-023, Workstream 1).
 *
 * Pins the PURE, deterministic intake core: mapping-DAG linearisation (incl.
 * edit/regeneration branches via current_node), the message drop rules (system /
 * tool / hidden / non-text / empty), stable idempotent sourceIds, transcript
 * rendering, and defensive tolerance of malformed input. No IO is exercised.
 */

import { describe, it, expect } from 'vitest';
import {
  parseChatGptExport,
  linearizeMapping,
  conversationToTranscript,
  chatGptExportToDocuments,
  conversationSourceId,
  slugify,
} from '@/services/homecoming/chatgptImport';

// A synthetic export with an edit branch: `a` has two assistant children; the
// active leaf (current_node) is `b2`, so `b`'s "hi v1" must be excluded.
const branchingConversation = {
  title: 'First chat',
  create_time: 1700000000,
  conversation_id: 'conv-123',
  current_node: 'b2',
  mapping: {
    root: { id: 'root', message: { author: { role: 'system' }, content: { content_type: 'text', parts: [''] } }, parent: null, children: ['a'] },
    a: { id: 'a', message: { author: { role: 'user' }, create_time: 1, content: { content_type: 'text', parts: ['hello'] } }, parent: 'root', children: ['b', 'b2'] },
    b: { id: 'b', message: { author: { role: 'assistant' }, create_time: 2, content: { content_type: 'text', parts: ['hi v1 (abandoned)'] } }, parent: 'a', children: [] },
    b2: { id: 'b2', message: { author: { role: 'assistant' }, create_time: 3, content: { content_type: 'text', parts: ['hi v2'] } }, parent: 'a', children: [] },
  },
};

describe('linearizeMapping — walk the active leaf chain, honour drop rules', () => {
  it('follows current_node up to root and reverses (edit branch excluded)', () => {
    const msgs = linearizeMapping(branchingConversation.mapping, 'b2');
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant']); // system root dropped
    expect(msgs.map((m) => m.text)).toEqual(['hello', 'hi v2']); // 'hi v1' branch not on the path
  });

  it('drops system, tool, hidden, non-text, and empty messages', () => {
    const mapping = {
      n1: { message: { author: { role: 'system' }, content: { content_type: 'text', parts: ['sys'] } }, parent: null, children: ['n2'] },
      n2: { message: { author: { role: 'tool' }, content: { content_type: 'text', parts: ['tool out'] } }, parent: 'n1', children: ['n3'] },
      n3: { message: { author: { role: 'assistant' }, content: { content_type: 'code', parts: ['print(1)'] } }, parent: 'n2', children: ['n4'] },
      n4: { message: { author: { role: 'user' }, metadata: { is_visually_hidden_from_conversation: true }, content: { content_type: 'text', parts: ['hidden'] } }, parent: 'n3', children: ['n5'] },
      n5: { message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['   '] } }, parent: 'n4', children: ['n6'] },
      n6: { message: { author: { role: 'assistant' }, content: { content_type: 'text', parts: ['kept'] } }, parent: 'n5', children: [] },
    };
    const msgs = linearizeMapping(mapping, 'n6');
    expect(msgs.map((m) => m.text)).toEqual(['kept']);
  });

  it('falls back to create_time ordering when there is no current_node', () => {
    const mapping = {
      x: { message: { author: { role: 'assistant' }, create_time: 20, content: { content_type: 'text', parts: ['second'] } }, parent: null, children: [] },
      y: { message: { author: { role: 'user' }, create_time: 10, content: { content_type: 'text', parts: ['first'] } }, parent: null, children: [] },
    };
    expect(linearizeMapping(mapping, undefined).map((m) => m.text)).toEqual(['first', 'second']);
  });
});

describe('sourceId — stable + idempotent', () => {
  it('prefers conversation_id, then id, then slug:create_time', () => {
    expect(conversationSourceId({ conversation_id: 'abc' }, 0, 'T')).toBe('chatgpt:abc');
    expect(conversationSourceId({ id: 'xyz' }, 0, 'T')).toBe('chatgpt:xyz');
    expect(conversationSourceId({ create_time: 1700000000.5 }, 3, 'My Chat!')).toBe('chatgpt:my-chat:1700000000');
    expect(slugify('  Hello, World!! ')).toBe('hello-world');
  });
});

describe('parseChatGptExport + documents — array + wrapper forms, honest drops', () => {
  it('parses the array form and links a stable sourceId', () => {
    const parsed = parseChatGptExport([branchingConversation]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].sourceId).toBe('chatgpt:conv-123');
    expect(parsed[0].messages).toHaveLength(2);
  });

  it('accepts the { conversations: [...] } wrapper form', () => {
    const parsed = parseChatGptExport({ conversations: [branchingConversation] });
    expect(parsed).toHaveLength(1);
  });

  it('drops conversations with no usable messages (never a phantom empty doc)', () => {
    const empty = { title: 'Empty', current_node: 'r', mapping: { r: { message: { author: { role: 'system' }, content: { content_type: 'text', parts: ['x'] } }, parent: null, children: [] } } };
    expect(parseChatGptExport([empty, branchingConversation])).toHaveLength(1);
  });

  it('renders a role-prefixed transcript and counts turns', () => {
    const docs = chatGptExportToDocuments([branchingConversation]);
    expect(docs).toHaveLength(1);
    expect(docs[0].turnCount).toBe(2);
    expect(docs[0].text).toBe('# First chat\n\nUser: hello\n\nAssistant: hi v2');
    expect(conversationToTranscript(parseChatGptExport([branchingConversation])[0])).toContain('User: hello');
  });

  it('is defensive — malformed input yields [], never throws', () => {
    expect(parseChatGptExport(null)).toEqual([]);
    expect(parseChatGptExport('nonsense')).toEqual([]);
    expect(parseChatGptExport([{ title: 'no mapping' }, 42, null])).toEqual([]);
    expect(chatGptExportToDocuments(undefined)).toEqual([]);
  });
});
