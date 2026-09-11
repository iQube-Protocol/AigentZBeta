/**
 * EXP-P1 go-live: server-side reviewer-cohort resolution + Observer Round
 * bootstrap (operator instruction, 2026-08-09). Covers:
 *  - `assignObserverRound` (services/research/observerRoundAssignment.ts) —
 *    the ONE assignment implementation now shared by the existing
 *    POST /api/research/observer-review/[experimentId] route and the new
 *    ops bootstrap route — is genuinely idempotent at the package-hash
 *    level, never alters the frozen package hash, and refuses a
 *    caller-supplied roundPolicy that disagrees with a pin.
 *  - POST /api/ops/research/bootstrap-exp-p1-observer-round — dual auth
 *    (mirrors tests/ops-dvn-mutation-routes-auth.test.ts's convention) and
 *    the "exactly two reviewers" requirement.
 *  - `listActiveReviewerPersonaIds` / `ensureCurrentObserverRoundAssignments`
 *    — structural/source checks (participationAccess.ts's existing test
 *    convention, e.g. tests/invite-auto-channel.test.ts, is source-authority
 *    style rather than a full chained-query-builder mock).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FROZEN_ARTIFACT = {
  id: 'EXP-P1/crystal-vP1',
  kind: 'crystal-version' as const,
  lifecycle: 'frozen' as const,
  contentHash: 'a'.repeat(64),
  commitmentHash: 'a'.repeat(64),
  frozenAt: '2026-08-05T21:39:57.033Z',
  signedBy: ['operator-ref'],
};

const mockLatestFrozenCrystalArtifact = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: unknown[]) => mockLatestFrozenCrystalArtifact(...args),
}));

const mockWriteLifecycleReceipt = vi.fn();
vi.mock('@/services/research/lifecycle', () => ({
  writeLifecycleReceipt: (...args: unknown[]) => mockWriteLifecycleReceipt(...args),
}));

// Declared at module top level (not inside a describe block) — vi.mock
// factories are hoisted above everything else in the file, so a mock fn
// referenced from one must ALSO be declared at this level or the hoisted
// factory throws "is not defined" before the describe block's const runs.
const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockListActiveReviewerPersonaIds = vi.fn();
vi.mock('@/services/passport/participationAccess', () => ({
  listActiveReviewerPersonaIds: (...args: unknown[]) => mockListActiveReviewerPersonaIds(...args),
}));

// In-memory fake store — enough to prove idempotency without a real DB.
const roundsById = new Map<string, any>();
const mockGetObserverRound = vi.fn(async (_admin: unknown, roundId: string) => roundsById.get(roundId) ?? null);
const mockUpsertObserverRound = vi.fn(async (_admin: unknown, record: any) => {
  roundsById.set(record.roundId, { ...record, createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z' });
});
vi.mock('@/services/research/observerReviewStore', async () => {
  const actual = await vi.importActual<typeof import('@/services/research/observerReviewStore')>(
    '@/services/research/observerReviewStore',
  );
  return {
    ...actual,
    getObserverRound: (...args: [unknown, string]) => mockGetObserverRound(...args),
    upsertObserverRound: (...args: [unknown, any]) => mockUpsertObserverRound(...args),
  };
});

beforeEach(() => {
  roundsById.clear();
  mockLatestFrozenCrystalArtifact.mockReset();
  mockLatestFrozenCrystalArtifact.mockResolvedValue(FROZEN_ARTIFACT);
  mockWriteLifecycleReceipt.mockReset();
  mockWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'r1' });
  mockGetObserverRound.mockClear();
  mockUpsertObserverRound.mockClear();
});

describe('assignObserverRound — the ONE shared assignment implementation', () => {
  it('builds a round against the frozen artifact with the pinned EXP-P1 policy', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const result = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
      actorPersonaId: 'admin-persona-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.round.roundPolicy).toBe('all-assigned'); // pinned, not the unset default
    expect(result.round.assignedObserverRefs).toHaveLength(2);
    expect(mockWriteLifecycleReceipt).toHaveBeenCalledTimes(1);
  });

  it('resolves the artifact to review via latestFrozenCrystalArtifact — never a first-match lookup that could stall on a superseded generation (operator ruling, 2026-08-27, "Crystal v1/v2 lineage collision", item 2)', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    expect(mockLatestFrozenCrystalArtifact).toHaveBeenCalledWith('EXP-P1');
  });

  it('deduplicates and SORTS observerRefs before hashing — the same cohort in a different discovery order reproduces the SAME packageHash', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const first = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref', 'avi-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    roundsById.clear(); // simulate a completely fresh call, not a readback of the same row
    const second = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['austin-ref', 'avi-ref'],
      createdAt: '2026-08-09T21:05:00.000Z', // different createdAt — excluded from the hash
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.round.package?.packageHash).toBe(second.round.package?.packageHash);
  });

  it('is idempotent — a repeat call with the identical cohort returns the EXISTING round, never re-upserts, never alters the frozen package hash', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const opts = { experimentId: 'EXP-P1', observerRefs: ['avi-ref', 'austin-ref'], createdAt: '2026-08-09T21:00:00.000Z' };
    const first = await assignObserverRound({} as any, opts);
    expect(first.ok).toBe(true);
    const upsertCallsAfterFirst = mockUpsertObserverRound.mock.calls.length;

    const second = await assignObserverRound({} as any, { ...opts, createdAt: '2026-08-09T22:00:00.000Z' });
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.round.package?.packageHash).toBe(first.round.package?.packageHash);
    // The critical idempotency guarantee: no SECOND write happened.
    expect(mockUpsertObserverRound.mock.calls.length).toBe(upsertCallsAfterFirst);
  });

  it('preserves already-recorded decisions across a re-assignment (e.g. the invitation-claim regression guard firing again)', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const first = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const roundId = first.round.roundId;
    const existing = roundsById.get(roundId);
    existing.decisions = [{ observerRef: 'avi-ref', decision: 'accepted', rationale: 'ok', evidenceRefs: [], submittedByAgentRef: null, decidedAt: '2026-08-09T21:01:00.000Z', packageHash: existing.package.packageHash }];
    roundsById.set(roundId, existing);

    // Re-assigning with a WIDER cohort (Austin joins) must not drop Avi's decision.
    const second = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      createdAt: '2026-08-09T22:00:00.000Z',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.round.decisions).toHaveLength(1);
    expect(second.round.decisions[0].observerRef).toBe('avi-ref');
  });

  it('refuses a caller-supplied roundPolicy that disagrees with a PINNED policy (EXP-P1 is pinned all-assigned)', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const result = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      requestedRoundPolicy: 'any-assigned',
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/pinned to 'all-assigned'/);
  });

  it('refuses when nothing is frozen yet (2026-08-27: latestFrozenCrystalArtifact never returns a non-frozen artifact — that IS the "not frozen" signal now)', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const result = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/frozen/);
  });

  it('skips the lifecycle receipt (never fabricates an actor) when no actorPersonaId is supplied — the cron/system-triggered path', async () => {
    const { assignObserverRound } = await import('@/services/research/observerRoundAssignment');
    const result = await assignObserverRound({} as any, {
      experimentId: 'EXP-P1',
      observerRefs: ['avi-ref', 'austin-ref'],
      createdAt: '2026-08-09T21:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    expect(mockWriteLifecycleReceipt).not.toHaveBeenCalled();
  });
});

describe('POST /api/ops/research/bootstrap-exp-p1-observer-round — dual auth + reviewer-count gate', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockGetActivePersona.mockResolvedValue(null);
    mockGetSupabaseServer.mockReset();
    mockGetSupabaseServer.mockReturnValue({});
    mockListActiveReviewerPersonaIds.mockReset();
    mockListActiveReviewerPersonaIds.mockResolvedValue(['austin-persona-id', 'avi-persona-id']);
    process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';
  });

  function bootstrapRequest(headers: Record<string, string> = {}) {
    return new Request('https://dev-beta.aigentz.me/api/ops/research/bootstrap-exp-p1-observer-round', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
    }) as any;
  }

  it('401s an unauthenticated caller with no cron token and no admin persona', async () => {
    const { POST } = await import('@/app/api/ops/research/bootstrap-exp-p1-observer-round/route');
    const res = await POST(bootstrapRequest());
    expect(res.status).toBe(401);
  });

  it('accepts a valid CRON_TRIGGER_TOKEN and assigns the round for the two resolved reviewers', async () => {
    const { POST } = await import('@/app/api/ops/research/bootstrap-exp-p1-observer-round/route');
    const res = await POST(bootstrapRequest({ 'x-cron-token': 'test-cron-token' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.assignedObserverCount).toBe(2);
    expect(body.roundPolicy).toBe('all-assigned');
  });

  it('accepts an authenticated admin persona with no cron token', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'admin-1', cartridgeFlags: { isAdmin: true } });
    const { POST } = await import('@/app/api/ops/research/bootstrap-exp-p1-observer-round/route');
    const res = await POST(bootstrapRequest());
    expect(res.status).toBe(200);
  });

  it('refuses (409) when the resolved reviewer cohort is not EXACTLY two', async () => {
    mockListActiveReviewerPersonaIds.mockResolvedValue(['only-one-persona-id']);
    const { POST } = await import('@/app/api/ops/research/bootstrap-exp-p1-observer-round/route');
    const res = await POST(bootstrapRequest({ 'x-cron-token': 'test-cron-token' }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.activeReviewerCount).toBe(1);
  });

  it('never serializes a raw persona id — only the derived T2 personaPublicRef reaches assignObserverRound', async () => {
    const src = readFileSync(
      join(__dirname, '..', 'app', 'api', 'ops', 'research', 'bootstrap-exp-p1-observer-round', 'route.ts'),
      'utf8',
    );
    expect(src).toMatch(/personaPublicRef\(id\)/);
    expect(src).not.toMatch(/observerRefs:\s*personaIds/);
  });
});

describe('listActiveReviewerPersonaIds / ensureCurrentObserverRoundAssignments (source-authority — matches this file\'s existing test convention)', () => {
  const src = readFileSync(join(__dirname, '..', 'services', 'passport', 'participationAccess.ts'), 'utf8');

  it('listActiveReviewerPersonaIds queries the narrower REVIEWER_INVITATION_ROLE, never the wider REVIEW_VIEW_READABLE_ROLES', () => {
    const fn = src.slice(src.indexOf('export async function listActiveReviewerPersonaIds'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/\.eq\('role', REVIEWER_INVITATION_ROLE\)/);
    expect(body).not.toMatch(/REVIEW_VIEW_READABLE_ROLES/);
  });

  it('a grant reaches experimentId when allowed_experiments is unrestricted (null/empty) OR explicitly contains it', () => {
    const fn = src.slice(src.indexOf('export async function listActiveReviewerPersonaIds'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/!allowed \|\| allowed\.length === 0 \|\| allowed\.includes\(experimentId\)/);
  });

  it('deduplicates by persona_id (a Set, not a plain array push)', () => {
    const fn = src.slice(src.indexOf('export async function listActiveReviewerPersonaIds'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/const ids = new Set<string>/);
  });

  it('ensureCurrentObserverRoundAssignments never widens authority — it calls the SAME assignObserverRound, never a raw table write', () => {
    const fn = src.slice(src.indexOf('export async function ensureCurrentObserverRoundAssignments'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).not.toMatch(/\.from\('research_objects'\)/);
    expect(body).not.toMatch(/\.from\('access_grants'\)\s*\n?\s*\.(insert|update|upsert)/);
    expect(body).toMatch(/assignObserverRound\(/);
  });

  it('ensureCurrentObserverRoundAssignments is a no-op before the crystal is frozen', () => {
    const fn = src.slice(src.indexOf('export async function ensureCurrentObserverRoundAssignments'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toMatch(/!artifact \|\| artifact\.lifecycle !== 'frozen'/);
  });

  it('both invitation-claim paths (bearer-code AND email-auto-claim) fire the SAME regression-guard hook, gated on research-lab/reviewer/EXP-P1', () => {
    const occurrences = [...src.matchAll(/ensureCurrentObserverRoundAssignments\(admin, OBSERVER_ROUND_BOOTSTRAP_EXPERIMENT_ID\)/g)];
    expect(occurrences.length).toBe(2);
    const claimFn = src.slice(src.indexOf('export async function claimAccessInvitation'), src.indexOf('export async function autoClaimEmailInvitation'));
    expect(claimFn).toMatch(/domain === 'research-lab' && role === REVIEWER_INVITATION_ROLE/);
  });

  it('the hook is scoped to ONE experiment (EXP-P1) — not a generic multi-experiment mechanism', () => {
    expect(src).toMatch(/const OBSERVER_ROUND_BOOTSTRAP_EXPERIMENT_ID = 'EXP-P1'/);
  });
});
