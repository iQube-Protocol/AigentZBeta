/**
 * app/api/agents/nakamoto/health/route.ts and
 * app/api/agents/nakamoto/invoke/route.ts — Aigent Nakamoto's canonical
 * Agent Runtime Endpoint surfaces (operator direction, 2026-08-04): "Trace
 * the current Ask Nakamoto action to its server-side execution path...
 * Do not create a second Nakamoto execution path."
 *
 * /health must be public, deterministic, and side-effect-free (no LLM call,
 * no DB read) — it is the URL Horizen Pulse itself polls.
 *
 * /invoke must NOT be a second implementation of "ask Nakamoto" — it
 * delegates to the SAME app/api/assistant/ask-agent/route.ts POST handler
 * the aigentMe specialist panel already calls, with specialistId pinned to
 * 'aigent-nakamoto' so this agent-scoped route can never be redirected to
 * answer as a different specialist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAskAgentPost = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
vi.mock('@/app/api/assistant/ask-agent/route', () => ({
  POST: (...args: any[]) => mockAskAgentPost(...args),
}));

import { GET as healthGet } from '@/app/api/agents/nakamoto/health/route';
import { POST as invokePost } from '@/app/api/agents/nakamoto/invoke/route';

const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'VENICE_API_KEY'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  mockAskAgentPost.mockClear();
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('GET /api/agents/nakamoto/health', () => {
  it('answers ok with no LLM provider configured — reports "template", never fails the check', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', agent: 'aigent-nakamoto', runtime: 'template', providers: [] });
  });

  it('reports "llm" and the configured provider list when a key is present', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const res = await healthGet();
    const body = await res.json();
    expect(body).toMatchObject({ runtime: 'llm', providers: ['openai'] });
  });

  it('never calls the ask-agent/invoke execution path — a health check must be side-effect-free', async () => {
    await healthGet();
    expect(mockAskAgentPost).not.toHaveBeenCalled();
  });

  it('sets no-store cache headers and CORS for external (Pulse) pollers', async () => {
    const res = await healthGet();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('POST /api/agents/nakamoto/invoke', () => {
  function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://dev-beta.aigentz.me/api/agents/nakamoto/invoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('delegates to the ask-agent handler — the one canonical execution path, never a parallel one', async () => {
    await invokePost(makeRequest({ prompt: 'What is self-custody?' }));
    expect(mockAskAgentPost).toHaveBeenCalledTimes(1);
  });

  it('pins specialistId to aigent-nakamoto even when the caller tries to ask a different specialist', async () => {
    await invokePost(makeRequest({ prompt: 'hello', specialistId: 'moneypenny' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    const forwardedBody = await forwarded.json();
    expect(forwardedBody.specialistId).toBe('aigent-nakamoto');
    expect(forwardedBody.prompt).toBe('hello');
  });

  it('forwards the caller\'s Authorization header unchanged — governed by the same identity spine, not a new auth scheme', async () => {
    await invokePost(makeRequest({ prompt: 'hi' }, { Authorization: 'Bearer test-token-123' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    expect(forwarded.headers.get('authorization')).toBe('Bearer test-token-123');
  });

  it('forwards an unparseable body verbatim so ask-agent\'s own invalid-json handling applies — never duplicates that error path', async () => {
    await invokePost(makeRequest('not json at all'));
    expect(mockAskAgentPost).toHaveBeenCalledTimes(1);
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    const text = await forwarded.text();
    expect(text).toBe('not json at all');
  });
});
