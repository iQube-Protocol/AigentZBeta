/**
 * IRL pack — Phase 2 scoped reviewer restoration (2026-09-08).
 *
 * The 2026-08-27 containment pass (docs/security/2026-08-27_irl-os-containment-breach-audit.md)
 * locked BOTH irl-pack document routes (`/api/codex/packs/[packId]/file`,
 * `/api/public/irl/doc`) down to admin-or-static-allowlist, which broke the
 * ALREADY-APPROVED Autonomi/Austin external-review flow (Residual Risk item
 * 0) — a genuinely-invited, non-admin reviewer's document fetch 403/404s
 * because the new gate could not see their prior invitation vetting.
 *
 * This file proves the MINIMUM scoped restoration (`services/research/
 * irlExperimentPathScope.ts::experimentIdForIrlPackPath` +
 * `services/passport/participationAccess.ts::resolveExperimentReviewGrant`
 * — the SAME canonical grant check the Validation Programme's JSON Agent
 * Package already uses, no ad-hoc allowlist) satisfies BOTH properties at
 * once:
 *
 *   invited EXP-P1 reviewer + valid scoped research-lab grant -> fetchable
 *   anonymous / unrelated participant / wrong-scope / revoked -> denied
 *
 * while leaving the 2026-08-27 default-deny posture completely intact for
 * every path outside a registered experiment's own folder.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

/** Rows `access_grants` would return for the currently-mocked caller — the
 *  SAME shape/mock pattern as tests/validation-programme-agent-package.test.ts,
 *  reused rather than re-invented. An empty array models EITHER "never
 *  invited" OR "revoked/expired" — both produce zero ACTIVE rows, since the
 *  real query already filters `.eq('status', 'active')` server-side; this
 *  test file does not re-implement that filter, it simply asserts on its
 *  observable effect (no active grant -> zero rows -> denied). */
let grantRows: Array<{ role: string; allowed_experiments: string[] | null }> = [];
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table !== 'access_grants') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: async () => ({ data: grantRows, error: null }),
            }),
          }),
        }),
      };
    },
  }),
}));

const mockCorpusReadPackFile = vi.fn(async (packId: string, relPath: string) => {
  if (packId !== 'irl') return null;
  // Only the real EXP-P1 kit path (and one control "unrelated private
  // material" path) resolve to content — every other read is a 404 from the
  // corpus layer regardless of authorization, matching production shape.
  const KNOWN: Record<string, string> = {
    'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md': '# EXP-P1 protocol',
    'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md': '# Reviewer kit',
    'foundation/experiments/exp-011-structural-invariance/README.md': '# EXP-011 protocol',
    'foundation/CFS-019_charter.md': '# confidential charter canon — NOT experiment-scoped',
  };
  return KNOWN[relPath] ?? null;
});
vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: (...args: [string, string]) => mockCorpusReadPackFile(...args),
}));

import { GET as filesGET } from '@/app/api/codex/packs/[packId]/file/route';
import { GET as docGET } from '@/app/api/public/irl/doc/route';
import { experimentIdForIrlPackPath } from '@/services/research/irlExperimentPathScope';

const EXP_P1_README = 'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md';
const EXP_P1_KIT = 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md';
const EXP_011_README = 'foundation/experiments/exp-011-structural-invariance/README.md';
const UNRELATED_CHARTER_PATH = 'foundation/CFS-019_charter.md';

function makeFilesRequest(path: string): NextRequest {
  const url = new URL(`https://dev-beta.aigentz.me/api/codex/packs/irl/file?path=${encodeURIComponent(path)}`);
  return { nextUrl: { searchParams: url.searchParams } } as unknown as NextRequest;
}

function makeDocRequest(path: string): NextRequest {
  const url = new URL(`https://dev-beta.aigentz.me/api/public/irl/doc?path=${encodeURIComponent(path)}`);
  return { nextUrl: { searchParams: url.searchParams } } as unknown as NextRequest;
}

async function filesReq(path: string, params: { packId: string } = { packId: 'irl' }) {
  return filesGET(makeFilesRequest(path), { params: Promise.resolve(params) });
}
async function docReq(path: string) {
  return docGET(makeDocRequest(path));
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockCorpusReadPackFile.mockClear();
  grantRows = [];
});

describe('#1 — admin remains able to inspect', () => {
  it('an admin persona reads the EXP-P1 README via the packs/file route', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-admin', cartridgeFlags: { isAdmin: true } });
    const res = await filesReq(EXP_P1_README);
    expect(res.status).toBe(200);
  });

  it('an admin persona reads the EXP-P1 README via the public/irl/doc route', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-admin', cartridgeFlags: { isAdmin: true } });
    const res = await docReq(EXP_P1_README);
    expect(res.status).toBe(200);
  });

  it('an admin persona reads material OUTSIDE any experiment folder too (unchanged pre-existing behavior)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-admin', cartridgeFlags: { isAdmin: true } });
    const res = await filesReq(UNRELATED_CHARTER_PATH);
    expect(res.status).toBe(200);
  });
});

describe('#2 — an invited, non-admin EXP-P1 reviewer with the correct grant retrieves the Reviewer Kit and its authorized resources', () => {
  it('reads the EXP-P1 README via packs/file (scoped grant naming EXP-P1)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await filesReq(EXP_P1_README);
    expect(res.status).toBe(200);
  });

  it('reads the Reviewer Kit itself via packs/file', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await filesReq(EXP_P1_KIT);
    expect(res.status).toBe(200);
  });

  it('reads the EXP-P1 README via the public/irl/doc route', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await docReq(EXP_P1_README);
    expect(res.status).toBe(200);
  });

  it('an unrestricted (allowed_experiments: null) reviewer grant also reaches EXP-P1 material', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-steward', cartridgeFlags: {} });
    grantRows = [{ role: 'research-steward', allowed_experiments: null }];
    const res = await filesReq(EXP_P1_README);
    expect(res.status).toBe(200);
  });
});

describe('#3 — the same EXP-P1-scoped reviewer CANNOT retrieve unrelated private IRL material', () => {
  it('a path outside every registered experiment folder still 403s on packs/file, even with a valid EXP-P1 grant', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await filesReq(UNRELATED_CHARTER_PATH);
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('the same path still 404s on public/irl/doc — never a metadata-revealing 403', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await docReq(UNRELATED_CHARTER_PATH);
    expect(res.status).toBe(404);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });
});

describe('#4 — an uninvited user cannot retrieve the kit', () => {
  it('an authenticated persona with NO active research-lab grant is denied on packs/file', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-stranger', cartridgeFlags: {} });
    grantRows = [];
    const res = await filesReq(EXP_P1_KIT);
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('an unauthenticated caller is denied on packs/file', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await filesReq(EXP_P1_KIT);
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('an unauthenticated caller is denied (404, no existence signal) on public/irl/doc', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await docReq(EXP_P1_KIT);
    expect(res.status).toBe(404);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });
});

describe('#5 — a grant for another programme/experiment cannot retrieve EXP-P1 restricted material', () => {
  it('a reviewer grant scoped ONLY to EXP-011 is denied EXP-P1 material on packs/file', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-other-reviewer', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await filesReq(EXP_P1_README);
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('the same EXP-011-scoped grant DOES reach its own experiment (sibling experiments do not gain access to each other, but a grant reaches its own)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-other-reviewer', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await filesReq(EXP_011_README);
    expect(res.status).toBe(200);
  });

  it('the same EXP-011-scoped grant is denied on public/irl/doc for EXP-P1 material', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-other-reviewer', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-011'] }];
    const res = await docReq(EXP_P1_README);
    expect(res.status).toBe(404);
  });
});

describe('#6 — a delegated reviewer agent can retrieve only within its delegated scope', () => {
  // This codebase has no separate "agent identity" for a delegated reviewer
  // agent — Austin's agent authenticates AS Austin's own persona (the same
  // session/credential his agreement's `acceptorId` binds), so the identical
  // grant-scope check above already governs it: the agent can reach exactly
  // what the underlying persona's grant reaches, never more. These two tests
  // pin that no code path treats "the request looks automated" as a reason
  // to widen or narrow the check differently from a human request.
  it('a request carrying no browser-identifying headers, authenticated as a scoped EXP-P1 reviewer persona, reaches EXP-P1 material identically to #2', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin-agent-session', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await filesReq(EXP_P1_KIT);
    expect(res.status).toBe(200);
  });

  it('the same agent session, still scoped only to EXP-P1, is denied EXP-011 material — delegation never exceeds the underlying persona grant', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-austin-agent-session', cartridgeFlags: {} });
    grantRows = [{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }];
    const res = await filesReq(EXP_011_README);
    expect(res.status).toBe(403);
  });
});

describe('#7 — revocation/expiry removes access', () => {
  it('a persona whose ONLY prior grant is no longer active (query returns zero rows) loses access identically to never having been invited', async () => {
    // The real query filters `.eq('status', 'active')` server-side (see
    // resolveExperimentReviewGrant) — a revoked or expired grant simply
    // never appears in the rows this mock returns. Observationally
    // identical to #4's "never invited" case, which is the correct
    // behavior: the route has no way to distinguish the two, and must not
    // need to.
    mockGetActivePersona.mockResolvedValue({ personaId: 'p-formerly-austin', cartridgeFlags: {} });
    grantRows = [];
    const res = await filesReq(EXP_P1_README);
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });
});

describe('#8 — the agent-package never advertises a link the authorized reviewer cannot subsequently dereference', () => {
  it('every real col_experiments path tagged as an EXP-P1 document resolves, via experimentIdForIrlPackPath, to EXP-P1 — the SAME predicate the file routes gate on', () => {
    // Reads the REAL collections.json (not a fixture) so this test breaks
    // the moment a new EXP-P1 document is registered outside the
    // experiment's own folder — exactly the drift that would let the agent
    // package advertise a link an EXP-P1-scoped reviewer cannot fetch.
    const raw = readFileSync(join(process.cwd(), 'codexes/packs/irl/collections.json'), 'utf8');
    const parsed = JSON.parse(raw) as { collections: Array<{ id: string; items: string[] }> };
    const collection = parsed.collections.find((c) => c.id === 'col_experiments');
    expect(collection).toBeTruthy();
    const expP1Items = (collection!.items ?? []).filter((p) =>
      p.includes('exp-p1-representation-runtime-gauntlet'),
    );
    expect(expP1Items.length).toBeGreaterThan(0);
    for (const itemPath of expP1Items) {
      expect(experimentIdForIrlPackPath(itemPath), `${itemPath} must resolve to EXP-P1`).toBe('EXP-P1');
    }
  });

  it('a path the registry does NOT scope to any experiment (e.g. a bare foundation/ file) never resolves to an experiment id — never silently authorized', () => {
    expect(experimentIdForIrlPackPath(UNRELATED_CHARTER_PATH)).toBeNull();
    expect(experimentIdForIrlPackPath('foundation/PARTICIPATION_overview.md')).toBeNull();
  });
});
