# Commit Brief: `afdf02d` — fix migrations — personas RLS uses auth_profile_id, not auth_user_id (operator unblock)

| Field | Value |
|-------|-------|
| SHA | [`afdf02d`](https://github.com/iQube-Protocol/AigentZBeta/commit/afdf02d2dcb7460f866243c65b291ce721a4db65) |
| Author | Claude |
| Date | 2026-06-13T20:10:42Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix migrations — personas RLS uses auth_profile_id, not auth_user_id (operator unblock)

operator hit the following error on the first migration:
  ERROR: 42703: column 'auth_user_id' does not exist

the canonical personas table (20241202_create_personas_table.sql line 34)
uses auth_profile_id UUID. the auth_user_id column was added in a later
parallel migration (20260427000000_root_did_persona_binding.sql) that
evidently never ran on the production supabase instance.

fix: replace 'WHERE auth_user_id = auth.uid()' with
'WHERE auth_profile_id = auth.uid()' across all rls policies in
this session's migrations. both columns are uuid; no cast needed.

affected migrations (9 occurrences total):
  20260613000000_persona_qube_mints.sql            (1)
  20260613300000_passport_locker_qubetalk.sql      (5)
  20260613400000_delegation_agentkit_attestations.sql (1)
  20260613500000_persona_ens_names.sql             (2)

unaffected (no personas rls):
  20260613100000_passport_world_id_verification.sql
  20260613200000_agent_genesis_polity_bound.sql

source of truth: 20241202_create_personas_table.sql:60 policy
  USING (auth.uid()::text = auth_profile_id::text OR auth_profile_id IS NULL)
```

## Body

operator hit the following error on the first migration:
  ERROR: 42703: column 'auth_user_id' does not exist

the canonical personas table (20241202_create_personas_table.sql line 34)
uses auth_profile_id UUID. the auth_user_id column was added in a later
parallel migration (20260427000000_root_did_persona_binding.sql) that
evidently never ran on the production supabase instance.

fix: replace 'WHERE auth_user_id = auth.uid()' with
'WHERE auth_profile_id = auth.uid()' across all rls policies in
this session's migrations. both columns are uuid; no cast needed.

affected migrations (9 occurrences total):
  20260613000000_persona_qube_mints.sql            (1)
  20260613300000_passport_locker_qubetalk.sql      (5)
  20260613400000_delegation_agentkit_attestations.sql (1)
  20260613500000_persona_ens_names.sql             (2)

unaffected (no personas rls):
  20260613100000_passport_world_id_verification.sql
  20260613200000_agent_genesis_polity_bound.sql

source of truth: 20241202_create_personas_table.sql:60 policy
  USING (auth.uid()::text = auth_profile_id::text OR auth_profile_id IS NULL)

## Files Changed

| Change | File |
|--------|------|
| Modified | `supabase/migrations/20260613000000_persona_qube_mints.sql` |
| Modified | `supabase/migrations/20260613300000_passport_locker_qubetalk.sql` |
| Modified | `supabase/migrations/20260613400000_delegation_agentkit_attestations.sql` |
| Modified | `supabase/migrations/20260613500000_persona_ens_names.sql` |

## Stats

 4 files changed, 9 insertions(+), 9 deletions(-)
