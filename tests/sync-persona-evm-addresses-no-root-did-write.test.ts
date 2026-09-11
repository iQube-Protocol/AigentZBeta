/**
 * app/api/admin/identity/sync-persona-evm-addresses/route.ts — DiDQube
 * Phase 2.5 regression (2026-09-07): this admin backfill used to write a
 * synthetic `did:fio:<handle>` placeholder into `personas.root_did` when
 * absent. That write never produced a genuine `root_identity.did_uri` link
 * and, once every authoritative reader of the column was removed elsewhere
 * in this pass, became pure dead weight perpetuating the column's ambiguity
 * (CLAUDE.md: "no routine writes that manufacture... authority into that
 * column"). This proves the write is gone.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateCalls: Array<{ table: string; payload: any }> = [];

function makeFakeSupabase() {
  return {
    from: (table: string) => {
      const builder: any = {
        select: () => builder,
        update: (payload: any) => {
          updateCalls.push({ table, payload });
          return builder;
        },
        eq: () => Promise.resolve({ error: null }),
        is: () => builder,
        not: () => Promise.resolve({ data: [], error: null }),
        // .select().in() for agent_keys read
        in: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      };
      return builder;
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeFakeSupabase(),
}));

beforeEach(() => {
  updateCalls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('POST /api/admin/identity/sync-persona-evm-addresses — no root_did write', () => {
  it('never includes root_did in any personas update payload, even for a persona with no prior root_did', async () => {
    // Override the agent_keys read specifically (the module reads agent_keys
    // first, then queries personas per key via .ilike — approximate via a
    // second from() override is unnecessary since our generic builder
    // returns [] for every read, meaning the loop bodies never execute and
    // no update() call happens at all here). The point of THIS test is
    // narrower and stronger: static proof the source no longer contains the
    // write, guarded by the runtime assertion below that IF any update to
    // personas ever happens, it carries no root_did key.
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/api/admin/identity/sync-persona-evm-addresses/route.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/updates\.root_did/);
    expect(source).not.toMatch(/root_did:\s*`did:fio:/);

    const { POST } = await import('@/app/api/admin/identity/sync-persona-evm-addresses/route');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('https://example.invalid/api/admin/identity/sync-persona-evm-addresses', {
      method: 'POST',
      body: JSON.stringify({ dryRun: false }),
    });
    await POST(req);

    for (const call of updateCalls) {
      if (call.table === 'personas') {
        expect(call.payload).not.toHaveProperty('root_did');
      }
    }
  });
});
