#!/usr/bin/env bash
# ============================================================================
# REAL integration canary for check_admin_access() + the 2026-07-28 RLS
# defence-in-depth migration (20260901000000_crm_investors_partners_rls_
# defense_in_depth.sql).
#
# WHY THIS SCRIPT EXISTS (not a vitest test):
# This repo has no committed local-Postgres/pg-mem/docker-compose harness for
# testing actual RLS/SQL-function behaviour (checked: no supabase/config.toml,
# no docker-compose file, no `pg` or `pg-mem` devDependency, no DATABASE_URL).
# The only Node-reachable Supabase credentials in this sandbox are REST-layer
# keys (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) for what is a
# live, presumably shared dev project — not a disposable local instance, and
# there is no JWT signing secret available to mint representative admin /
# ordinary-user / anonymous test JWTs against it safely. Running RLS probes
# against a live shared database without operator authorization is not
# something to attempt from an automated script.
#
# This sandbox DOES happen to have a local postgresql-16 package installed
# (unrelated to this repo — an OS-level package, not a repo-established test
# pattern) plus `docker`. That makes a REAL integration run possible here:
# this script spins up a throwaway local Postgres database, loads the ACTUAL
# check_admin_access() function body verbatim from
# supabase/migrations/20251128181400_agentiq_admin_roles.sql (extracted by
# line range, not retyped), loads faithful reproductions of Supabase's own
# auth.uid()/auth.role() helper functions (these are Supabase's public,
# documented reference implementations — GUC-based JWT-claim readers — not
# guessed), loads the ACTUAL new migration file's RLS policies against
# minimal stand-ins for nakamoto_knyt_personas / avl_partner_contacts, and
# then runs three real sessions against real Postgres, as a genuinely
# non-owner low-privilege role (required — table owners bypass RLS by
# default), each with a different simulated JWT identity:
#
#   1. authorised admin JWT   (sub = a uid that HAS an uber_admin row keyed
#                               kybe_did = that uid, matching the exact
#                               provisioning pattern in
#                               20260405000000_grant_dele_uber_admin.sql step 4)
#   2. ordinary authenticated JWT (sub = a uid with NO crm_admin_roles row)
#   3. anonymous request     (role = anon, no sub)
#
# and asserts what each identity can SELECT from the RLS-protected table.
#
# This is NOT wired into `npx vitest run` — it depends on a local Postgres
# server that will not exist in the deployed Amplify/CI environment, and
# starting one as a side effect of the ordinary test suite would be invasive
# and non-portable. Run it manually / in an environment that has Postgres
# available. tests/crm-investors-partners-rls.test.ts is (correctly labelled
# as) a static consistency check only; this script is the actual behavioural
# verification the operator's ruling asked for.
#
# Usage: bash scripts/rls-integration-canary-check-admin-access.sh
# Requires: a reachable Postgres server (this script assumes the local
# `postgres` OS user / peer auth is available, as it is in this sandbox after
# `service postgresql start`). Exits non-zero on any assertion failure.
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB=rls_canary_check_admin_access
ADMIN_UID="11111111-1111-1111-1111-111111111111"
ORDINARY_UID="22222222-2222-2222-2222-222222222222"

echo "== Dropping/recreating throwaway database $DB =="
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"

echo "== Extracting the ACTUAL check_admin_access() body (verbatim, by line range) =="
sed -n '213,324p' "$REPO_ROOT/supabase/migrations/20251128181400_agentiq_admin_roles.sql" > /tmp/check_admin_access_fn.sql
head -1 /tmp/check_admin_access_fn.sql | grep -q 'CREATE OR REPLACE FUNCTION check_admin_access(' \
  || { echo "FAIL: extraction range no longer starts at the function definition — re-check line numbers"; exit 1; }
tail -1 /tmp/check_admin_access_fn.sql | grep -q '\$\$ LANGUAGE plpgsql SECURITY DEFINER;' \
  || { echo "FAIL: extraction range no longer ends at the function terminator — re-check line numbers"; exit 1; }

echo "== Building minimal schema: auth.uid()/auth.role() (Supabase's own reference impl), =="
echo "==   crm_admin_categories + crm_admin_roles (columns check_admin_access reads),      =="
echo "==   minimal nakamoto_knyt_personas / avl_partner_contacts stand-ins                 =="
su postgres -c "psql -d $DB -v ON_ERROR_STOP=1" <<'SQL'
create extension if not exists pgcrypto;

create schema auth;

-- Verbatim Supabase reference implementation (public docs / every Supabase
-- project's own bootstrap migration defines exactly this): reads the JWT
-- claims GUC that PostgREST sets per-request from the caller's bearer token.
create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;

create or replace function auth.role() returns text
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'role', '')::text
$$;

-- Minimal stand-in for crm_admin_categories (check_admin_access only touches
-- it when p_category_slug is non-NULL; our calls pass NULL, but the function
-- body references the table name so it must exist to compile/run).
create table crm_admin_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null
);

-- Minimal stand-in for crm_admin_roles carrying ONLY the columns
-- check_admin_access actually reads (kybe_did, role_type, is_active,
-- expires_at, permissions, category_id, franchise_id, tenant_id).
create table crm_admin_roles (
  id uuid primary key default gen_random_uuid(),
  kybe_did text,
  role_type text not null,
  franchise_id uuid,
  tenant_id uuid,
  category_id uuid,
  permissions jsonb default '{"read":true,"write":true,"delete":false}',
  is_active boolean default true,
  expires_at timestamptz
);

-- Minimal stand-ins for the two tables the real RLS migration touches.
create table public."nakamoto_knyt_personas" (
  id uuid primary key default gen_random_uuid(),
  "Email" text
);

create table public.avl_partner_contacts (
  id uuid primary key default gen_random_uuid(),
  email text
);
-- The real 20260417000002_avl_partner_contacts.sql migration enables RLS on
-- this table before the RLS-defence-in-depth migration touches it; replicate
-- that ordering so the new migration's DROP POLICY / CREATE POLICY runs
-- against a table already in the same starting state as production.
alter table public.avl_partner_contacts enable row level security;
SQL

echo "== Loading the ACTUAL check_admin_access() function body (extracted above) =="
su postgres -c "psql -d $DB -v ON_ERROR_STOP=1 -f /tmp/check_admin_access_fn.sql"

echo "== Loading the ACTUAL new RLS migration file, unmodified =="
su postgres -c "psql -d $DB -v ON_ERROR_STOP=1 -f '$REPO_ROOT/supabase/migrations/20260901000000_crm_investors_partners_rls_defense_in_depth.sql'"

echo "== Provisioning one admin identity, matching the real provisioning pattern =="
echo "== in 20260405000000_grant_dele_uber_admin.sql step 4: kybe_did = auth.uid()::text =="
su postgres -c "psql -d $DB -v ON_ERROR_STOP=1" <<SQL
insert into crm_admin_roles (kybe_did, role_type, is_active, permissions)
values ('$ADMIN_UID', 'uber_admin', true, '{"read":true,"write":true,"delete":true}');

insert into public."nakamoto_knyt_personas" (id, "Email") values (gen_random_uuid(), 'row1@example.com');
insert into public.avl_partner_contacts (id, email) values (gen_random_uuid(), 'partner1@example.com');
SQL

echo "== Creating a genuinely non-owner low-privilege role (table owners bypass RLS) =="
su postgres -c "psql -d $DB -v ON_ERROR_STOP=1" <<'SQL'
drop role if exists rls_canary_caller;
create role rls_canary_caller nologin nosuperuser nobypassrls;
grant select on public."nakamoto_knyt_personas" to rls_canary_caller;
grant select on public.avl_partner_contacts to rls_canary_caller;
SQL

# NOLOGIN + SET ROLE (from a superuser session) rather than a real login role
# over a socket: peer auth in this sandbox maps the connecting OS user to a
# same-named Postgres role, so a second login role needs password/host auth
# plumbing that has nothing to do with what's under test. SET ROLE changes
# the effective user id for privilege AND RLS-policy evaluation exactly like
# a real non-owner connection would (RLS checks the effective role, not the
# authenticating one) — begin/set role/set claims/query/reset all in one
# session, in one transaction, mirroring what PostgREST does per-request
# (SET LOCAL role + SET LOCAL request.jwt.claims, scoped to the transaction).
run_as() {
  local label="$1" claims="$2"
  su postgres -c "psql -d $DB -v ON_ERROR_STOP=1 -Atq" <<SQL
begin;
set local request.jwt.claims = '$claims';
set local role rls_canary_caller;
select 'personas=' || count(*) from public."nakamoto_knyt_personas";
select 'partners=' || count(*) from public.avl_partner_contacts;
rollback;
SQL
}

echo ""
echo "== CASE 1: authorised admin JWT (sub=$ADMIN_UID, role=authenticated) =="
OUT_ADMIN=$(run_as admin "{\"sub\":\"$ADMIN_UID\",\"role\":\"authenticated\"}")
echo "$OUT_ADMIN"

echo ""
echo "== CASE 2: ordinary authenticated JWT (sub=$ORDINARY_UID, no admin row, role=authenticated) =="
OUT_ORDINARY=$(run_as ordinary "{\"sub\":\"$ORDINARY_UID\",\"role\":\"authenticated\"}")
echo "$OUT_ORDINARY"

echo ""
echo "== CASE 3: anonymous request (no sub, role=anon) =="
OUT_ANON=$(run_as anon "{\"role\":\"anon\"}")
echo "$OUT_ANON"

echo ""
echo "== ASSERTIONS =="
FAIL=0
echo "$OUT_ADMIN" | grep -qx "personas=1" && echo "PASS: admin sees the 1 personas row" || { echo "FAIL: admin should see 1 personas row"; FAIL=1; }
echo "$OUT_ADMIN" | grep -qx "partners=1" && echo "PASS: admin sees the 1 partners row" || { echo "FAIL: admin should see 1 partners row"; FAIL=1; }
echo "$OUT_ORDINARY" | grep -qx "personas=0" && echo "PASS: ordinary authenticated user sees 0 personas rows" || { echo "FAIL: ordinary user should see 0 personas rows"; FAIL=1; }
echo "$OUT_ORDINARY" | grep -qx "partners=0" && echo "PASS: ordinary authenticated user sees 0 partners rows" || { echo "FAIL: ordinary user should see 0 partners rows"; FAIL=1; }
echo "$OUT_ANON" | grep -qx "personas=0" && echo "PASS: anonymous request sees 0 personas rows" || { echo "FAIL: anon should see 0 personas rows"; FAIL=1; }
echo "$OUT_ANON" | grep -qx "partners=0" && echo "PASS: anonymous request sees 0 partners rows" || { echo "FAIL: anon should see 0 partners rows"; FAIL=1; }

echo ""
echo "== Cleanup =="
su postgres -c "psql -d $DB -c 'drop role if exists rls_canary_caller;'" 2>/dev/null || true
su postgres -c "dropdb --if-exists $DB"

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "RESULT: FAIL — check_admin_access()/RLS policy did not behave as expected."
  exit 1
fi
echo ""
echo "RESULT: PASS — real Postgres, real check_admin_access() body, real RLS policies from"
echo "the actual migration file: admin JWT allowed, ordinary JWT denied, anonymous denied."
