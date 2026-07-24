/**
 * activity_receipts action_type CHECK-constraint parity — regression guard
 * for the "2026-07-15 constraint-drift incident" class of bug (named in
 * every action-type-adding migration's own comments since).
 *
 * Every migration that extends `services/receipts/activityReceiptService.ts`'s
 * `ActivityActionType` union is supposed to ALSO rebuild the
 * `activity_receipts_action_type_check` CHECK constraint wholesale — dropping
 * and re-adding it with the COMPLETE current list. When that second step is
 * skipped, `createActivityReceipt` for the new action type throws a
 * check-violation in production (not caught by the `isMissingTable`/
 * `isMissingColumn` soft-fail paths), silently losing the receipt AND its
 * DVN anchor.
 *
 * Found and fixed 2026-07-24 (SPEC-MMC-002 §6.3 Phase 3 pass,
 * `codexes/packs/agentiq/updates/2026-07-24_spec-mmc-002-phase3-mysoftware-core-actions.md`
 * §7): four TypeScript action types (`qubetalk_artifact_shared`,
 * `qubetalk_artifact_opened`, `qubetalk_artifact_copied`,
 * `finance_authoritative_execution`) had shipped with no matching CHECK
 * entry since 2026-07-21. This canary makes that drift fail the build
 * instead of failing silently at receipt-write time — per CLAUDE.md's
 * "Source-of-truth parity is canary-enforced" doctrine
 * (`inv.engineering.036`/`037`). Indexed in `tests/source-of-truth-parity.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const SERVICE_PATH = join(process.cwd(), 'services', 'receipts', 'activityReceiptService.ts');

/** Filenames are timestamp-prefixed (`YYYYMMDDHHMMSS_description.sql`), so a
 *  lexical sort is a chronological sort — the LAST migration that touches
 *  the constraint is the one that actually governs the live schema today. */
function latestActionTypeCheckMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let latest: string | null = null;
  for (const f of files) {
    const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    if (content.includes('activity_receipts_action_type_check')) latest = f;
  }
  if (!latest) throw new Error('no migration rebuilds activity_receipts_action_type_check — cannot verify parity');
  return latest;
}

describe('activity_receipts action_type CHECK parity (drift-incident regression guard)', () => {
  it('every TypeScript ActivityActionType is present in the LATEST CHECK-constraint rebuild', () => {
    const migrationFile = latestActionTypeCheckMigration();
    const sqlContent = readFileSync(join(MIGRATIONS_DIR, migrationFile), 'utf8');
    const match = sqlContent.match(/CHECK \(action_type IN \(([\s\S]*?)\)\);/);
    expect(match).not.toBeNull();
    const sqlTypes = new Set([...match![1].matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]));

    const tsContent = readFileSync(SERVICE_PATH, 'utf8');
    const start = tsContent.indexOf('export type ActivityActionType =');
    const end = tsContent.indexOf('export type ReceiptStatus');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const tsTypes = [...tsContent.slice(start, end).matchAll(/^\s*\|\s*'([a-z_0-9]+)'/gm)].map((m) => m[1]);
    // A sanity floor -- if this drops to near-zero the extraction regex
    // itself broke (e.g. the union's declaration shape changed) and the
    // "missing" assertion below would pass vacuously.
    expect(tsTypes.length).toBeGreaterThan(40);

    const missing = tsTypes.filter((t) => !sqlTypes.has(t));
    expect(missing).toEqual([]);
  });
});
