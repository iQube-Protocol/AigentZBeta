/**
 * app/api/agents/factor/invoke/route.ts and
 * app/api/agents/aegis/invoke/route.ts — the governed invoke surfaces
 * mirroring app/api/agents/nakamoto/invoke/route.ts exactly (operator
 * directive 2026-09-05, "the next Factor step is narrow").
 *
 * Neither is a second implementation of "ask Factor"/"ask Aegis" — both
 * delegate to the SAME app/api/assistant/ask-agent/route.ts POST handler,
 * with specialistId pinned so each route can never be redirected to answer
 * as a different specialist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAskAgentPost = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
vi.mock('@/app/api/assistant/ask-agent/route', () => ({
  POST: (...args: any[]) => mockAskAgentPost(...args),
}));

import { POST as factorInvokePost } from '@/app/api/agents/factor/invoke/route';
import { POST as aegisInvokePost } from '@/app/api/agents/aegis/invoke/route';

beforeEach(() => {
  mockAskAgentPost.mockClear();
});

function makeRequest(path: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://dev-beta.aigentz.me${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/agents/factor/invoke', () => {
  it('delegates to the ask-agent handler — the one canonical execution path, never a parallel one', async () => {
    await factorInvokePost(makeRequest('/api/agents/factor/invoke', { prompt: 'Is this candidate ready for Aegis?' }));
    expect(mockAskAgentPost).toHaveBeenCalledTimes(1);
  });

  it('pins specialistId to factor even when the caller tries to ask a different specialist', async () => {
    await factorInvokePost(makeRequest('/api/agents/factor/invoke', { prompt: 'hello', specialistId: 'aegis' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    const forwardedBody = await forwarded.json();
    expect(forwardedBody.specialistId).toBe('factor');
    expect(forwardedBody.prompt).toBe('hello');
  });

  it("forwards the caller's Authorization header unchanged", async () => {
    await factorInvokePost(makeRequest('/api/agents/factor/invoke', { prompt: 'hi' }, { Authorization: 'Bearer test-token-123' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    expect(forwarded.headers.get('authorization')).toBe('Bearer test-token-123');
  });

  it("forwards an unparseable body verbatim so ask-agent's own invalid-json handling applies", async () => {
    await factorInvokePost(makeRequest('/api/agents/factor/invoke', 'not json at all'));
    expect(mockAskAgentPost).toHaveBeenCalledTimes(1);
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    expect(await forwarded.text()).toBe('not json at all');
  });
});

describe('POST /api/agents/aegis/invoke', () => {
  it('delegates to the ask-agent handler — the one canonical execution path, never a parallel one', async () => {
    await aegisInvokePost(makeRequest('/api/agents/aegis/invoke', { prompt: 'Assess this candidate' }));
    expect(mockAskAgentPost).toHaveBeenCalledTimes(1);
  });

  it('pins specialistId to aegis even when the caller tries to ask a different specialist', async () => {
    await aegisInvokePost(makeRequest('/api/agents/aegis/invoke', { prompt: 'hello', specialistId: 'factor' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    const forwardedBody = await forwarded.json();
    expect(forwardedBody.specialistId).toBe('aegis');
    expect(forwardedBody.prompt).toBe('hello');
  });

  it("forwards the caller's Authorization header unchanged", async () => {
    await aegisInvokePost(makeRequest('/api/agents/aegis/invoke', { prompt: 'hi' }, { Authorization: 'Bearer test-token-456' }));
    const forwarded = mockAskAgentPost.mock.calls[0][0] as NextRequest;
    expect(forwarded.headers.get('authorization')).toBe('Bearer test-token-456');
  });
});
