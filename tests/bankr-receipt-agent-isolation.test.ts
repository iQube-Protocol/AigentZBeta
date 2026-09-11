/**
 * Cross-agent Bankr receipt isolation (Factor + Aegis PRD tranche, item 6).
 *
 * `listActivityReceiptsForAgent` (services/receipts/activityReceiptService.ts)
 * is the per-agent receipt read every agent-scoped observer in this codebase
 * uses (the Journey Spine's Standing route among them) — it filters by
 * Postgres `agents_invoked @> [runtimeAgentId]` containment. This test proves
 * that filter actually ISOLATES two agents operating under the SAME persona:
 * a negative test, not just a "the query was called" assertion — it exercises
 * the real function against a minimal fake Postgres query builder that
 * implements array-containment semantics faithfully, so a regression that
 * broadened the filter (e.g. matching on persona_id instead of/alongside
 * agents_invoked) would fail this test even though it might still "look"
 * scoped by eye.
 *
 * Bankr receipts are exactly the case this matters for: two agents Factor
 * tokenizes (or a launch Factor prepares for itself vs. for another agent)
 * can share one requesting persona, and their receipts must never bleed
 * into each other's history.
 */
import { describe, it, expect, vi } from 'vitest';

interface FakeReceiptRow {
  id: string;
  persona_id: string;
  active_cartridge: string;
  action_type: string;
  summary: string;
  agents_invoked: string[];
  created_at: string;
}

const SAME_PERSONA = 'persona-shared-1';

const ROWS: FakeReceiptRow[] = [
  {
    id: 'receipt-factor-1',
    persona_id: SAME_PERSONA,
    active_cartridge: 'moneypenny',
    action_type: 'bankr_launch_preflighted',
    summary: 'Token launch preflighted for aigent-factor',
    agents_invoked: ['aigent-factor'],
    created_at: '2026-09-05T10:00:00.000Z',
  },
  {
    id: 'receipt-other-agent-1',
    persona_id: SAME_PERSONA, // SAME persona as above — the exact scenario the operator named
    active_cartridge: 'moneypenny',
    action_type: 'bankr_launch_preflighted',
    summary: 'Token launch preflighted for aigent-other-tokenized-agent',
    agents_invoked: ['aigent-other-tokenized-agent'],
    created_at: '2026-09-05T10:05:00.000Z',
  },
];

/**
 * A minimal chainable fake that implements exactly the call shape
 * `listActivityReceiptsForAgent` issues — `.from().select().contains(col,
 * [value]).order().limit()` — with REAL Postgres `@>` array-containment
 * semantics for `.contains`, over the in-memory ROWS above. This is
 * deliberately narrower than tests/fixtures/fakeSupabase.ts (which has no
 * `.contains` support at all) rather than widening that shared fixture for
 * one call shape.
 */
function fakeAdminWithContains(rows: FakeReceiptRow[]) {
  function builder(filtered: FakeReceiptRow[]) {
    return {
      contains(column: keyof FakeReceiptRow, value: string[]) {
        const next = filtered.filter((r) => {
          const columnValue = r[column];
          return Array.isArray(columnValue) && value.every((v) => columnValue.includes(v));
        });
        return builder(next);
      },
      in(column: keyof FakeReceiptRow, values: string[]) {
        const next = filtered.filter((r) => values.includes(String(r[column])));
        return builder(next);
      },
      order() {
        return builder([...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      },
      limit(n: number) {
        return Promise.resolve({ data: filtered.slice(0, n), error: null });
      },
    };
  }
  return {
    from(table: string) {
      if (table !== 'activity_receipts') throw new Error(`unexpected table: ${table}`);
      return {
        select() {
          return builder(rows);
        },
      };
    },
  };
}

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

describe('listActivityReceiptsForAgent — cross-agent isolation under a shared persona', () => {
  it('never returns another agent\'s Bankr receipt, even when both receipts share the same persona_id', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeAdminWithContains(ROWS));
    const { listActivityReceiptsForAgent } = await import('@/services/receipts/activityReceiptService');

    const factorReceipts = await listActivityReceiptsForAgent('aigent-factor');
    expect(factorReceipts).toHaveLength(1);
    expect(factorReceipts[0].id).toBe('receipt-factor-1');
    expect(factorReceipts.some((r) => r.summary.includes('aigent-other-tokenized-agent'))).toBe(false);

    const otherAgentReceipts = await listActivityReceiptsForAgent('aigent-other-tokenized-agent');
    expect(otherAgentReceipts).toHaveLength(1);
    expect(otherAgentReceipts[0].id).toBe('receipt-other-agent-1');
    expect(otherAgentReceipts.some((r) => r.summary.includes('aigent-factor'))).toBe(false);

    // Confirm the shared persona_id really is shared — this is the negative
    // test's precondition, not an incidental fact.
    expect(ROWS.every((r) => r.persona_id === SAME_PERSONA)).toBe(true);
  });

  it('returns nothing for an agent with no agents_invoked entry at all — never falls back to persona-wide receipts', async () => {
    mockGetSupabaseServer.mockReturnValue(fakeAdminWithContains(ROWS));
    const { listActivityReceiptsForAgent } = await import('@/services/receipts/activityReceiptService');

    const receipts = await listActivityReceiptsForAgent('aigent-never-invoked');
    expect(receipts).toHaveLength(0);
  });
});
