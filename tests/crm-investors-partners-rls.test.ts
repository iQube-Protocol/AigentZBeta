/**
 * RLS defence-in-depth migration for the 2026-07-28 CRM PII incident tables.
 *
 * Operator ruling: "Yes, add RLS as defence in depth. Route gate =
 * authenticate and authorize the request. RLS = constrain what the
 * resulting database operation can access."
 *
 * This is a structural check over the migration SQL (no live DB in this
 * sandbox — see the session report for what would need to run against a
 * real Supabase instance to verify the policies behave as written). It
 * pins:
 *   - nakamoto_knyt_personas gets RLS enabled (it had none before) and
 *     admin-gated SELECT/INSERT/UPDATE/DELETE policies.
 *   - avl_partner_contacts' SELECT policy is tightened from "any
 *     authenticated user" to admin-only.
 *   - The migration is idempotent via DROP POLICY IF EXISTS + CREATE POLICY
 *     (Postgres has no CREATE POLICY IF NOT EXISTS), matching the pattern
 *     already used elsewhere in supabase/migrations/.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');

function findMigration(needle: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.includes(needle));
  if (!file) throw new Error(`No migration file matching "${needle}" found`);
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('RLS defence-in-depth migration for nakamoto_knyt_personas / avl_partner_contacts', () => {
  const sql = findMigration('crm_investors_partners_rls_defense_in_depth');

  it('enables RLS on nakamoto_knyt_personas, which previously had none', () => {
    expect(sql).toMatch(/ALTER TABLE public\."nakamoto_knyt_personas" ENABLE ROW LEVEL SECURITY/);
  });

  it('gates nakamoto_knyt_personas SELECT/INSERT/UPDATE/DELETE on admin access, not "any authenticated"', () => {
    expect(sql).toMatch(/nakamoto_knyt_personas_admin_read[\s\S]*?FOR SELECT/);
    expect(sql).toMatch(/nakamoto_knyt_personas_admin_write[\s\S]*?FOR INSERT/);
    expect(sql).toMatch(/nakamoto_knyt_personas_admin_update[\s\S]*?FOR UPDATE/);
    expect(sql).toMatch(/nakamoto_knyt_personas_admin_delete[\s\S]*?FOR DELETE/);
    // Every policy body must call check_admin_access, not a bare
    // auth.role() = 'authenticated' check (that was the avl_partner_contacts
    // defect this same migration fixes on the other table).
    const policyBlocks = sql.split(/CREATE POLICY "nakamoto_knyt_personas_admin_/).slice(1);
    expect(policyBlocks.length).toBe(4);
    for (const block of policyBlocks) {
      expect(block).toMatch(/check_admin_access\(auth\.uid\(\)::text/);
    }
  });

  it('tightens avl_partner_contacts SELECT from any-authenticated to admin-only', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "avl_partners_read_authenticated" ON public\.avl_partner_contacts/);
    expect(sql).toMatch(/CREATE POLICY "avl_partners_admin_read"[\s\S]*?check_admin_access\(auth\.uid\(\)::text/);
  });

  it('is idempotent: every CREATE POLICY is preceded by a matching DROP POLICY IF EXISTS', () => {
    const createNames = [...sql.matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);
    expect(createNames.length).toBeGreaterThan(0);
    for (const name of createNames) {
      const dropPattern = new RegExp(`DROP POLICY IF EXISTS "${name}"`);
      expect(sql, `CREATE POLICY "${name}" has no matching DROP POLICY IF EXISTS`).toMatch(dropPattern);
    }
    // Postgres has no CREATE POLICY IF NOT EXISTS — guard against inventing one.
    expect(sql).not.toMatch(/CREATE POLICY IF NOT EXISTS/);
  });

  it('service_role is still explicitly permitted (today\'s authorized route path is unaffected)', () => {
    expect(sql).toMatch(/auth\.role\(\) = 'service_role'/);
  });
});
