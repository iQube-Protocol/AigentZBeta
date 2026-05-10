# Backlog — Migrate `persona_legacy_20260125` rows into canonical `personas`

**Date filed:** 2026-05-10
**Workstream:** Identity / Storefront entitlements
**Severity:** medium (not blocking new sales after the FK NOT VALID fix; latent for affected legacy users)
**Discovered by:** debugging fost@knyt's missing entitlement after Satoshi KNYT Collection purchase

---

## Context

Per the spine integration brief (`2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`), the canonical persona table is **`personas` (plural)** — `personas.id` is the FK target every per-persona row should reference.

In the run-up to the spine work, the original `persona` (singular) table was renamed to `persona_legacy_20260125`. The intent was to migrate its rows into `personas` and retire the legacy snapshot. **That migration step never completed** — `persona_legacy_20260125` still holds rows that don't exist in `personas`.

The orphan was discovered when the `20260511010000_fix_user_entitlements_fk.sql` migration first tried to add the FK constraint (without `NOT VALID`) and Postgres aborted with:

```
23503: insert or update on table "user_entitlements" violates foreign key constraint
"user_entitlements_persona_id_fkey"
DETAIL: Key (persona_id)=(d7b0738a-4080-4a4d-9b26-a214742c94aa) is not present in table "personas".
```

The user `d7b0738a-…` and an unknown number of others have:
- `user_entitlements` rows pointing at their legacy persona id
- (likely) `purchases`, `wallet_balances`, `wallet_transactions`, `crm_*` rows under the same id
- No row in `personas`

The current state, after the FK was added as `NOT VALID`:
- **New** entitlement grants validate against `personas` (works for fost@knyt and any new user)
- **Existing** orphan rows in `user_entitlements` are tolerated (constraint not enforced retroactively)
- Affected users see whatever they had before; new purchases by them would fail at FK insertion until their persona row is materialised in `personas`

---

## Why this matters

- Affected legacy users **cannot complete new purchases** today — the entitlement grant will now fail loudly with the same FK error fost@knyt hit, since their `personas` row is missing.
- Their **old entitlements still exist** as DB rows but cannot be repaired through the diagnose-entitlements tool unless the persona is materialised (the repair endpoint resolves persona via `personas`).
- The split keeps `persona_legacy_20260125` from being safely dropped, so the schema retains a confusing "two tables, one logical entity" pattern that future agents will trip on.

---

## Proposed scope

A new migration `YYYYMMDDHHMMSS_migrate_persona_legacy_to_personas.sql` that:

1. **Inventory** — produce a row-count diff between `persona_legacy_20260125` and `personas`. Surface the count so the operator can sanity-check before applying.
2. **Backfill** — `INSERT INTO personas (...) SELECT (...) FROM persona_legacy_20260125 ON CONFLICT (id) DO NOTHING`. Map columns explicitly — the schemas may diverge (legacy may have columns `personas` doesn't and vice versa). Choose conservative defaults for any required `personas` field the legacy row doesn't have.
3. **Audit log** — write the migrated ids to a one-off `persona_legacy_migration_log` table so the cleanup is auditable and rollback is possible.
4. **Validate the existing FK** — once orphans are resolved, run `ALTER TABLE user_entitlements VALIDATE CONSTRAINT user_entitlements_persona_id_fkey` (and same for `purchases`). This converts the `NOT VALID` constraint into a fully-enforced one, closing the loophole that today lets stale orphan rows linger.
5. **(Optional, follow-up)** — drop `persona_legacy_20260125` once it's verified empty / safely backed up to cold storage.

The migration should be **idempotent and reversible**: an aborted run mid-way should leave the system in a clean state, and the audit log lets the operator UNDO the backfill if needed.

---

## Pre-work — schema diff

Before writing the migration the operator/agent should run a diff query to see what columns the two tables have. Best done in the Supabase SQL editor:

```sql
-- Column-level comparison between persona_legacy_20260125 and personas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'persona_legacy_20260125'
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'personas'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Row count of legacy personas not present in personas
SELECT COUNT(*)
FROM persona_legacy_20260125 l
LEFT JOIN personas p ON l.id = p.id
WHERE p.id IS NULL;

-- Sample 10 orphan rows (so the operator can eyeball before bulk migration)
SELECT l.*
FROM persona_legacy_20260125 l
LEFT JOIN personas p ON l.id = p.id
WHERE p.id IS NULL
LIMIT 10;
```

Whoever picks this up files a follow-up update doc with the schema diff + row count before writing the migration.

---

## Acceptance criteria

- [ ] All persona ids referenced by `user_entitlements`, `purchases`, `wallet_balances`, `wallet_transactions` and any other persona-FK'd table exist in `personas`
- [ ] `ALTER TABLE user_entitlements VALIDATE CONSTRAINT user_entitlements_persona_id_fkey` runs without errors (i.e. zero remaining orphans)
- [ ] Same for `purchases` and any other table given the same `NOT VALID` treatment
- [ ] `persona_legacy_20260125` is either dropped or moved to a `_archive` schema
- [ ] An audit log lists exactly which legacy ids were migrated, with timestamp + migrating agent
- [ ] At least one previously-affected user (e.g. the one whose UUID surfaced as the FK violation, `d7b0738a-…`) is verified to be able to complete a new purchase + see their codex access

---

## References

- `supabase/migrations/20260511010000_fix_user_entitlements_fk.sql` — the `NOT VALID` FK fix that this backlog item closes
- `supabase/migrations/20251217_fix_purchases_fk.sql` — the regression that re-pointed the FK at the legacy table in the first place
- `supabase/migrations/20251217_phase1_rewards_entitlements.sql` — the original (correct) schema with FK to `personas`
- `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md` — spine brief that names `personas.id` as the canonical FK target
- `app/api/wallet/knyt/diagnose-entitlements/route.ts` — operator tool used to surface the original orphan
