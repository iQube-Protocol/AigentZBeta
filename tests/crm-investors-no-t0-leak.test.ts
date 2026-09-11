/**
 * GET /api/crm/investors must never serialise platform_auth_profile_id
 * (crm_auth_profiles.id — a T0 identifier per CLAUDE.md's Identity & Access
 * Spine, "authProfileId" never-serialise field) into the browser-bound
 * response, under any field name.
 *
 * BACKGROUND. The 2026-07-28 PII incident fix (tests/crm-pii-route-auth.test.ts)
 * added admin gating to this route, which closed the unauthenticated-access
 * hole but left the field itself leaking to any admin's browser as
 * `personaId`. Operator ruling (2026-07-28): "The remaining
 * platform_auth_profile_id serialization should also be removed. The fact
 * that it is now admin-gated reduces exposure but does not make
 * serialization of a never-expose spine field acceptable."
 *
 * WHY THIS TEST IS BEHAVIOURAL, NOT A GREP. buildInvestorResponseRow() was
 * extracted from the route handler specifically so this property can be
 * exercised by calling the function and inspecting what it actually
 * returns — a stronger guarantee than "the string 'platform_auth_profile_id'
 * does not appear in the route source", which a future refactor (e.g.
 * spreading `...inv` into the response) could defeat while still passing a
 * source grep.
 *
 * THE /crm/personas/[id] CONTRACT. The operator's ruling also said the
 * "[id] contract should be changed to use a public reference rather than
 * preserve the leak for compatibility" — but with an explicit carve-out:
 * "If no safe reference makes sense for this specific linkage ... removing
 * it entirely ... may be the correct, simpler fix." Investigation found the
 * investor -> /crm/personas/[id] cross-navigation was ALREADY non-functional
 * before this fix: it passed platform_auth_profile_id (crm_auth_profiles.id)
 * into a route that resolves by matching against `personas.id` — a
 * different UUID namespace entirely (see personas table migration
 * 20241202_create_personas_table.sql: `auth_profile_id` is a distinct
 * column from `id`). No stored mapping lets the server reverse a one-way
 * public-ref hash back to the right personas row without a new indexed
 * column nobody has asked to add. So the "no legitimate client-facing
 * purpose" carve-out applies: the leaking field and its (non-functional)
 * consumers were removed rather than reference-ified. This suite asserts
 * that removal held, in both directions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { stripComments } from './_lib/sourceAuthority';
import { buildInvestorResponseRow, type InvestorResponseRow } from '@/app/api/crm/investors/_lib';

const RAW_AUTH_PROFILE_ID = '11111111-2222-3333-4444-555555555555';

function fabricatedRow(): Record<string, unknown> {
  return {
    id: 'investor-row-id',
    'First-Name': 'Ada',
    'Last-Name': 'Lovelace',
    Email: 'ada@example.com',
    platform_activated_at: '2026-07-01T00:00:00Z',
    platform_auth_profile_id: RAW_AUTH_PROFILE_ID,
    'KNYT-ID': 'KNYT-001',
  };
}

describe('buildInvestorResponseRow never leaks platform_auth_profile_id', () => {
  it('the returned object has no key named personaId or platform_auth_profile_id', () => {
    const row = buildInvestorResponseRow(fabricatedRow()) as unknown as Record<string, unknown>;
    const keys = Object.keys(row);
    expect(keys).not.toContain('personaId');
    expect(keys).not.toContain('platform_auth_profile_id');
    expect(keys).not.toContain('authProfileId');
  });

  it('the raw auth profile id value never appears anywhere in the serialised row', () => {
    const row = buildInvestorResponseRow(fabricatedRow());
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(RAW_AUTH_PROFILE_ID);
  });

  it('isActivated/isLinked still convey platform-linkage without the raw id', () => {
    const linked = buildInvestorResponseRow(fabricatedRow());
    expect(linked.isActivated).toBe(true);
    expect(linked.isLinked).toBe(true);

    const unlinkedRaw = fabricatedRow();
    delete unlinkedRaw.platform_activated_at;
    delete unlinkedRaw.platform_auth_profile_id;
    const unlinked = buildInvestorResponseRow(unlinkedRaw);
    expect(unlinked.isActivated).toBe(false);
    expect(unlinked.isLinked).toBe(false);
  });

  it('a mutation that reintroduces the leak (spreading raw fields) is caught', () => {
    // Simulates the exact regression this suite exists to prevent: a future
    // edit that does `{ ...buildInvestorResponseRow(inv), ...rawFieldsForDebug }`.
    // We don't call the mutated code (it doesn't exist) — we assert the type
    // contract instead: InvestorResponseRow's own shape has no such field, so
    // any code that tried to satisfy the type while adding one would fail to
    // compile. This is a static backstop alongside the runtime checks above.
    const row: InvestorResponseRow = buildInvestorResponseRow(fabricatedRow());
    // @ts-expect-error — personaId must not be a valid property of InvestorResponseRow
    void row.personaId;
  });
});

describe('the investor -> persona cross-navigation leak path is closed end-to-end', () => {
  const CALLERS = [
    'app/triad/components/codex/tabs/InvestorDirectoryTab.tsx',
    'app/(shell)/crm/investors/page.tsx',
  ];

  it('neither UI caller references inv.personaId / investor.personaId any more', () => {
    for (const caller of CALLERS) {
      const src = stripComments(readFileSync(caller, 'utf-8'));
      expect(src, `${caller} still references a removed personaId field`).not.toMatch(
        /\b(inv|investor)\.personaId\b/,
      );
    }
  });

  it('neither UI caller navigates to /crm/personas/ using an investor-derived id', () => {
    for (const caller of CALLERS) {
      const src = stripComments(readFileSync(caller, 'utf-8'));
      expect(
        src,
        `${caller} still builds a /crm/personas/ link from investor data`,
      ).not.toMatch(/`\/crm\/personas\/\$\{\s*(inv|investor)\./);
    }
  });

  it('GET /api/crm/investors response construction goes through buildInvestorResponseRow, not an inline object literal', () => {
    // Guards against someone reverting the extraction and reintroducing an
    // inline `.map(inv => ({ ..., personaId: inv.platform_auth_profile_id }))`.
    const src = stripComments(readFileSync('app/api/crm/investors/route.ts', 'utf-8'));
    expect(src).toMatch(/investorRows\.map\(buildInvestorResponseRow\)/);
    expect(src).not.toMatch(/platform_auth_profile_id/);
  });
});
