import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const API = join(REPO, 'app/api/qubetalk');

/** Every QubeTalk route that returns channel or message CONTENT to a caller. */
const READ_ROUTES = [
  'channels/route.ts',
  'channels/[id]/route.ts',
  'channels/[id]/messages/route.ts',
  'channels/[id]/stream/route.ts',
];

describe('QubeTalk read paths authenticate the caller (2026-07-28 leak)', () => {
  for (const rel of READ_ROUTES) {
    it(`${rel} gates through requireChannelAccess`, () => {
      const src = readFileSync(join(API, rel), 'utf-8');
      expect(src, `${rel} must import the gate`).toMatch(/requireChannelAccess/);
      // The gate must be AWAITED and its refusal RETURNED — importing it and
      // ignoring the result is the shape that reads as fixed and is not.
      expect(src).toMatch(/await requireChannelAccess\(/);
      expect(src).toMatch(/if \(!gate\.ok\) return gate\.response;/);
    });

    it(`${rel} never uses a caller-supplied tenant_id as the query scope`, () => {
      const src = readFileSync(join(API, rel), 'utf-8');
      // `const tenant_id = searchParams.get('tenant_id')` was THE defect: a
      // filter the caller chooses is not an authorization. The scope must come
      // off the resolved gate.
      expect(
        src,
        `${rel} must not read tenant scope from the query string`,
      ).not.toMatch(/const\s+tenant_id\s*=\s*searchParams\.get\(/);
      expect(src).toMatch(/gate\.access\.tenantId/);
    });
  }

  it('the gate fails closed on an anonymous caller', () => {
    const src = readFileSync(join(API, '_lib/requireChannelAccess.ts'), 'utf-8');
    // No persona ⇒ 401 and no rows. An anonymous embed gets nothing, whatever
    // the surface would like to render.
    expect(src).toMatch(/getActivePersona/);
    expect(src).toMatch(/status: 401/);
    const gate = src.slice(src.indexOf('if (!persona?.personaId)'));
    expect(gate.slice(0, 200)).toMatch(/ok: false/);
  });

  it('a non-admin cannot request another tenant — 403, never a silent downgrade', () => {
    const src = readFileSync(join(API, '_lib/requireChannelAccess.ts'), 'utf-8');
    expect(src).toMatch(/status: 403/);
    // A silent downgrade would hide a misconfigured surface; the error surfaces it.
    expect(src).toMatch(/requestedTenantId !== allowedTenant && !isAdmin/);
  });
});

describe('QubeTalk database layer is deny-by-default', () => {
  const migrations = readdirSync(join(REPO, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
  const repair = migrations.find((f) => f.includes('qubetalk_revoke_anon'));

  it('ships the repair migration', () => {
    expect(repair, 'the anon-revoke migration must exist').toBeTruthy();
  });

  it('revokes select from anon on all three tables', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    for (const t of ['qubetalk_channels', 'qubetalk_delegations', 'qubetalk_messages']) {
      expect(sql, `${t} must be revoked from anon`).toMatch(
        new RegExp(`revoke select on ${t}\\s+from anon`, 'i'),
      );
    }
  });

  it('drops the inert current_setting policies rather than preserving them', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    // They gated on a GUC nothing sets, under a service-role connection that
    // bypasses RLS — CB-1. Kept in place they would preserve a false assurance.
    expect(sql).toMatch(/drop policy if exists "Users can view channels they participate in"/i);
    expect(sql).toMatch(/drop policy if exists "Users can view messages in their tenant channels"/i);
    expect(sql).not.toMatch(/create policy[\s\S]*current_setting\('app\.current_tenant_id'\)/i);
  });

  it('leaves RLS enabled AND forced, with no permissive policy', () => {
    const sql = readFileSync(join(REPO, 'supabase/migrations', repair!), 'utf-8');
    for (const t of ['qubetalk_channels', 'qubetalk_delegations', 'qubetalk_messages']) {
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+force row level security`, 'i'));
    }
  });

  it('no LATER migration re-grants QubeTalk to anon', () => {
    // The original grant is in 20260113090500. Any migration after the repair
    // that hands these tables back to anon re-opens the leak.
    const after = migrations.filter((f) => f > repair!);
    for (const f of after) {
      const sql = readFileSync(join(REPO, 'supabase/migrations', f), 'utf-8');
      expect(
        sql,
        `${f} must not grant QubeTalk tables to anon`,
      ).not.toMatch(/grant[^;]*on\s+qubetalk_\w+[^;]*to[^;]*anon/i);
    }
  });
});
