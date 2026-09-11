/**
 * `findAgentReceiptRefs` — per-action-type coverage, not one global scan
 * (Final Horizen Projection Reconciliation, operator directive, 2026-08-09,
 * part 5).
 *
 * The observed defect: `findAgentReceiptRefs` used to run ONE query —
 * `action_type IN (requested types) AND agents_invoked CONTAINS agent`,
 * ordered by `created_at DESC`, with a SINGLE limit applied across the whole
 * filtered set. A caller asking for many action types (the journey state
 * route asks for ~20) could see an old, `dvn_recorded` receipt of one type
 * silently excluded because more than `limit` NEWER receipts of OTHER
 * requested types existed for the same agent — a constitutional fact
 * disappearing because unrelated receipt volume grew, never because the fact
 * itself changed.
 *
 * This fixture seeds >100 unrelated (`agent_card_discovered`) receipts, all
 * newer than one older `standing_accrued` receipt that is `dvn_recorded`, and
 * asserts the older receipt is still returned when both action types are
 * requested together with a limit far smaller than 100.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeRow {
  id: string;
  action_type: string;
  receipt_status: string;
  created_at: string;
  agents_invoked: string[];
}

let rows: FakeRow[] = [];

function makeFakeSupabase() {
  return {
    from(table: string) {
      if (table !== 'activity_receipts') throw new Error(`unexpected table ${table}`);
      const state: { eqActionType?: string; containsAgent?: string } = {};
      let inActionTypes: string[] | null = null;
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          if (col === 'action_type') state.eqActionType = val;
          return builder;
        },
        in(col: string, vals: string[]) {
          if (col === 'action_type') inActionTypes = vals;
          return builder;
        },
        contains(col: string, val: string[]) {
          if (col === 'agents_invoked') state.containsAgent = val[0];
          return builder;
        },
        order() {
          return builder;
        },
        // The terminal call — resolves the query. Mirrors supabase-js's
        // thenable builder by returning a real Promise from `limit()`.
        limit(n: number) {
          const typeFilter = inActionTypes
            ? (t: string) => inActionTypes!.includes(t)
            : (t: string) => t === state.eqActionType;
          const matched = rows
            .filter((r) => typeFilter(r.action_type) && r.agents_invoked.includes(state.containsAgent ?? ''))
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, n);
          return Promise.resolve({ data: matched, error: null });
        },
      };
      return builder;
    },
  };
}

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

beforeEach(() => {
  rows = [];
  mockGetSupabaseServer.mockReturnValue(makeFakeSupabase());
});

describe('findAgentReceiptRefs — an old dvn_recorded receipt survives >100 newer unrelated receipts (2026-08-09)', () => {
  it('returns the older standing_accrued:dvn_recorded receipt alongside 100+ newer agent_card_discovered receipts, with a limit far below the unrelated volume', async () => {
    const { findAgentReceiptRefs } = await import('@/services/receipts/activityReceiptService');

    // One old, strong, load-bearing fact.
    rows.push({
      id: 'standing-old-dvn-recorded',
      action_type: 'standing_accrued',
      receipt_status: 'dvn_recorded',
      created_at: '2026-01-01T00:00:00.000Z',
      agents_invoked: ['aigent-nakamoto'],
    });

    // 150 newer, unrelated receipts for the SAME agent — more than any
    // single-type limit, and more than the old global limit (100) that used
    // to be applied across the combined filtered set.
    for (let i = 0; i < 150; i++) {
      rows.push({
        id: `unrelated-${i}`,
        action_type: 'agent_card_discovered',
        receipt_status: 'local',
        created_at: `2026-06-01T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
        agents_invoked: ['aigent-nakamoto'],
      });
    }

    const refs = await findAgentReceiptRefs(
      'aigent-nakamoto',
      ['agent_card_discovered', 'standing_accrued'] as any,
      { limit: 20 },
    );

    const standing = refs.find((r) => r.actionType === 'standing_accrued');
    expect(standing, 'the old standing_accrued receipt must not be crowded out by newer unrelated receipts').toBeDefined();
    expect(standing?.id).toBe('standing-old-dvn-recorded');
    expect(standing?.receiptStatus).toBe('dvn_recorded');

    // The unrelated type is still capped at its own per-type limit (20) —
    // this is a coverage guarantee, not an unbounded read.
    const unrelated = refs.filter((r) => r.actionType === 'agent_card_discovered');
    expect(unrelated.length).toBe(20);
  });

  it('same guarantee holds independently for pnl_service_registered and pnl_service_verified', async () => {
    const { findAgentReceiptRefs } = await import('@/services/receipts/activityReceiptService');

    rows.push(
      {
        id: 'pnl-registered-old-dvn-recorded',
        action_type: 'pnl_service_registered',
        receipt_status: 'dvn_recorded',
        created_at: '2026-01-01T00:00:00.000Z',
        agents_invoked: ['aigent-nakamoto'],
      },
      {
        id: 'pnl-verified-old-dvn-recorded',
        action_type: 'pnl_service_verified',
        receipt_status: 'dvn_recorded',
        created_at: '2026-01-02T00:00:00.000Z',
        agents_invoked: ['aigent-nakamoto'],
      },
    );
    for (let i = 0; i < 120; i++) {
      rows.push({
        id: `unrelated-${i}`,
        action_type: 'agent_card_discovered',
        receipt_status: 'local',
        created_at: `2026-06-01T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
        agents_invoked: ['aigent-nakamoto'],
      });
    }

    const refs = await findAgentReceiptRefs(
      'aigent-nakamoto',
      ['agent_card_discovered', 'pnl_service_registered', 'pnl_service_verified'] as any,
      { limit: 20 },
    );

    expect(refs.find((r) => r.actionType === 'pnl_service_registered')?.receiptStatus).toBe('dvn_recorded');
    expect(refs.find((r) => r.actionType === 'pnl_service_verified')?.receiptStatus).toBe('dvn_recorded');
  });
});
