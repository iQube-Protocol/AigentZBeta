/**
 * Fail-closed on an invalid `agentSlug` across the Horizen journey routes
 * that resolve MoneyPenny as a backward-compatible default — GJR audit,
 * 2026-09-05.
 *
 * Prior bug (confirmed by direct read of each route, pre-fix): each of
 * these routes computed
 *   `resolveRegistrableAgent(agentSlug) ?? resolveRegistrableAgent(DEFAULT)!`
 * which cannot distinguish "agentSlug omitted" from "agentSlug explicitly
 * invalid" — both silently resolved to MoneyPenny, so a request for a typo'd
 * or nonexistent agent (`agentSlug=not-a-real-agent`) would read/write
 * MoneyPenny-scoped state under the wrong identity, with the caller never
 * told anything was wrong.
 *
 * These tests exercise the REAL route handlers (only their I/O
 * dependencies are mocked) and assert BEHAVIOR: an explicit unknown slug is
 * refused with 400 + refusalCode UNKNOWN_AGENT before any read/write occurs
 * (proved via spies on the mocked backends), `factor` (a real, valid slug)
 * still resolves, and an omitted slug still defaults as before.
 *
 * All `vi.mock` calls are declared at MODULE top level (not nested inside
 * `describe`) — Vitest hoists `vi.mock` to the very top of the file
 * regardless of where it's written, so a factory referencing a `const`
 * declared inside a `describe` block throws `ReferenceError` at import
 * time (confirmed while writing this file). Every mock double is therefore
 * declared here, once, and reset per-suite in that suite's own `beforeEach`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── shared identity mock ────────────────────────────────────────────────
const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

// ── orient/acknowledge dependencies ─────────────────────────────────────
const mockGetSupabaseServer = vi.fn();
const mockCreateActivityReceipt = vi.fn();
const mockListActivityReceiptsForPersona = vi.fn();
const mockResolveOrientationContext = vi.fn();
const mockResolveOrientationCompletion = vi.fn();

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
  listActivityReceiptsForPersona: (...args: unknown[]) => mockListActivityReceiptsForPersona(...args),
  // journey/state's own imports from the same module — harmless no-ops,
  // never reached by the fail-closed exit this file proves.
  findAgentReceiptRefs: vi.fn(async () => []),
  findReceiptsByIds: vi.fn(async () => []),
  readReceiptAnchorStatus: vi.fn(async () => ({})),
}));
vi.mock('@/services/journey/orientationContext', () => ({
  resolveOrientationContext: (...args: unknown[]) => mockResolveOrientationContext(...args),
  resolveOrientationCompletion: (...args: unknown[]) => mockResolveOrientationCompletion(...args),
  orientationLegacyPrecedentEstablished: vi.fn(() => false),
}));

// ── aigentme/disposition dependencies ───────────────────────────────────
const mockRecordExperienceQubeDisposition = vi.fn();
const mockReadExperienceQubeDisposition = vi.fn();

vi.mock('@/services/journey/experienceQubeDispositionService', () => ({
  recordExperienceQubeDisposition: (...args: unknown[]) => mockRecordExperienceQubeDisposition(...args),
  readExperienceQubeDisposition: (...args: unknown[]) => mockReadExperienceQubeDisposition(...args),
}));

// ── journey/state dependencies (only the fail-closed exit is exercised) ─
const mockResolveRequestOrigin = vi.fn(() => 'https://dev-beta.aigentz.me');
vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: (...args: unknown[]) => mockResolveRequestOrigin(...args),
}));

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(params);
  return {
    nextUrl: { searchParams },
    url: `https://dev-beta.aigentz.me/api/x?${searchParams.toString()}`,
  } as unknown as NextRequest;
}

function makePostRequest(body: Record<string, unknown> | null): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => {
      if (body === null) throw new Error('no body');
      return body;
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

// ─────────────────────────────────────────────────────────────────────────
// orient/acknowledge — the lightest-dependency route of the three, so it
// gets full read+write zero-side-effect coverage.
// ─────────────────────────────────────────────────────────────────────────
describe('orient/acknowledge — fail-closed on agentSlug', () => {
  beforeEach(() => {
    mockGetSupabaseServer.mockReset().mockReturnValue({ from: vi.fn() });
    mockCreateActivityReceipt.mockReset().mockResolvedValue({ id: 'receipt-orient' });
    mockListActivityReceiptsForPersona.mockReset().mockResolvedValue([]);
    mockResolveOrientationContext.mockReset().mockResolvedValue({ ritualKind: 'acknowledgment' });
    mockResolveOrientationCompletion.mockReset().mockResolvedValue({ complete: false, source: 'none' });
  });

  it('GET refuses an explicit unknown agentSlug with 400 UNKNOWN_AGENT and touches nothing', async () => {
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await GET(makeGetRequest({ agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
    expect(mockResolveOrientationContext).not.toHaveBeenCalled();
    expect(mockResolveOrientationCompletion).not.toHaveBeenCalled();
  });

  it('POST refuses an explicit unknown agentSlug with 400 UNKNOWN_AGENT and writes NOTHING', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await POST(makePostRequest({ agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
    expect(mockResolveOrientationContext).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(mockListActivityReceiptsForPersona).not.toHaveBeenCalled();
  });

  it('POST still defaults to MoneyPenny when agentSlug is omitted (backward compatible)', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(200);
    expect(mockResolveOrientationContext).toHaveBeenCalledWith(
      'persona-operator-1',
      expect.objectContaining({ runtimeAgentId: 'aigent-moneypenny' }),
    );
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ agentsInvoked: ['aigent-moneypenny'] }),
    );
  });

  it('POST records the acknowledgment for Factor when agentSlug=factor is explicit', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/orient/acknowledge/route');
    const res = await POST(makePostRequest({ agentSlug: 'factor' }));
    expect(res.status).toBe(200);
    expect(mockResolveOrientationContext).toHaveBeenCalledWith(
      'persona-operator-1',
      expect.objectContaining({ runtimeAgentId: 'aigent-factor' }),
    );
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ agentsInvoked: ['aigent-factor'] }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// aigentme/disposition
// ─────────────────────────────────────────────────────────────────────────
describe('aigentme/disposition — fail-closed on agentSlug', () => {
  beforeEach(() => {
    mockRecordExperienceQubeDisposition.mockReset().mockResolvedValue({ ok: true, receiptId: 'r-1' });
    mockReadExperienceQubeDisposition.mockReset().mockResolvedValue({ aigentMeActive: false, dispositionReceipt: null });
  });

  it('GET refuses an explicit unknown agentSlug with 400 UNKNOWN_AGENT and reads nothing', async () => {
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/aigentme/disposition/route');
    const res = await GET(makeGetRequest({ agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
    expect(mockReadExperienceQubeDisposition).not.toHaveBeenCalled();
  });

  it('POST refuses an explicit unknown agentSlug with 400 UNKNOWN_AGENT and writes NOTHING', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/aigentme/disposition/route');
    const res = await POST(makePostRequest({ disposition: 'central', agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
    expect(mockRecordExperienceQubeDisposition).not.toHaveBeenCalled();
  });

  it('POST still defaults to MoneyPenny when agentSlug is omitted', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/aigentme/disposition/route');
    const res = await POST(makePostRequest({ disposition: 'central' }));
    expect(res.status).toBe(200);
    expect(mockRecordExperienceQubeDisposition).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeAgentId: 'aigent-moneypenny' }),
    );
  });

  it('POST records the disposition for Factor when agentSlug=factor is explicit', async () => {
    const { POST } = await import('@/app/api/journey/moneypenny-horizen/aigentme/disposition/route');
    const res = await POST(makePostRequest({ disposition: 'central', agentSlug: 'factor' }));
    expect(res.status).toBe(200);
    expect(mockRecordExperienceQubeDisposition).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeAgentId: 'aigent-factor', agentDisplayName: 'Aigent Factor' }),
    );
  });

  it("GET reads Factor-scoped disposition state when agentSlug=factor is explicit — never MoneyPenny's", async () => {
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/aigentme/disposition/route');
    const res = await GET(makeGetRequest({ agentSlug: 'factor' }));
    expect(res.status).toBe(200);
    expect(mockReadExperienceQubeDisposition).toHaveBeenCalledWith('persona-operator-1', 'aigent-factor');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// journey/state — the heaviest-dependency route; only the fail-closed exit
// is exercised, proving it returns 400 before touching ANY downstream read.
// ─────────────────────────────────────────────────────────────────────────
describe('journey state — fail-closed on agentSlug', () => {
  it('refuses an explicit unknown agentSlug with 400 UNKNOWN_AGENT before any receipt read', async () => {
    const receiptService = await import('@/services/receipts/activityReceiptService');
    const findAgentReceiptRefsSpy = vi.spyOn(receiptService, 'findAgentReceiptRefs');
    const { GET } = await import('@/app/api/journey/moneypenny-horizen/state/route');
    const res = await GET(makeGetRequest({ agentSlug: 'not-a-real-agent' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
    expect(findAgentReceiptRefsSpy).not.toHaveBeenCalled();
  });
});
