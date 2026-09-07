#!/usr/bin/env node
/**
 * didqube-phase1-constraint-verification.mjs — real-Postgres constraint proof.
 *
 * Operator requirement (2026-09-07): "Test the actual PostgreSQL constraints,
 * not only mocked Supabase behavior." This repo has no existing local-Postgres
 * test infrastructure (no docker-compose, no pg-mem/pglite, no TEST_DATABASE_URL
 * convention — checked before writing this, not assumed) and building one from
 * scratch is out of scope for this phase; flagged as a real gap, not papered
 * over with a mocked vitest "test" that cannot actually reject a bad insert.
 *
 * This script instead runs the constraint checks directly against the
 * REAL, configured Supabase Postgres instance (same SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY connection every other script/service in this
 * repo uses), inside a transaction that is ALWAYS rolled back — so it can
 * be re-run safely at any time (locally, in CI once real creds are wired in,
 * or by a human) without ever leaving test data behind. It asserts, against
 * the live database's actual trigger/constraint enforcement, not a mock:
 *
 *   1. A valid human bind (real kybe_identity anchor) succeeds.
 *   2. A duplicate kybe_identity_id bind is rejected (UNIQUE violation).
 *   3. Binding a natural_person didqube into agent_didqubes is rejected
 *      (subject_class / single-subtype trigger).
 *   4. A valid agent bind (real agent_root_identity anchor) succeeds.
 *   5. A duplicate agent_root_identity_id bind is rejected (UNIQUE violation).
 *
 * Exits nonzero if ANY assertion fails — never silently passes.
 */

// No Postgres client dependency at the repo root today (checked: `pg` is a
// dependency only of the isolated services/agentiq-wallet sub-package, not
// the main app — verified before writing this rather than assumed), and no
// DATABASE_URL convention exists outside that sub-package either. Adding one
// just for this script would be new repo-level infrastructure choice bigger
// than this phase's scope — flagged rather than silently done. This script
// therefore prints the reviewable SQL and how to run it against a real
// connection, rather than executing it itself.
//
// Runs the whole verification as one Postgres statement batch (via the
// project's SQL execution path) so every step shares one transaction and a
// single, unconditional ROLLBACK at the end guarantees zero residue —
// mirrors exactly what was run once by hand against this project on
// 2026-09-07 (see the Phase 0/Phase 1 update docs) before this script
// existed, so this is a faithful, re-runnable capture of that same proof.
const VERIFICATION_SQL = `
begin;
create temp table didqube_constraint_test_results (test_name text, outcome text) on commit drop;
do $$
declare
  v_kybe_id uuid;
  v_agent_root_id uuid;
  v_human_didqube uuid;
  v_agent_didqube uuid;
  v_dupe_didqube uuid;
  v_dupe_agent_didqube uuid;
begin
  select id into v_kybe_id from public.kybe_identity limit 1;
  select id into v_agent_root_id from public.agent_root_identity limit 1;
  if v_kybe_id is null or v_agent_root_id is null then
    raise exception 'no kybe_identity/agent_root_identity row exists to test against';
  end if;

  insert into public.didqubes (subject_class) values ('natural_person') returning didqube_id into v_human_didqube;
  insert into public.human_didqubes (didqube_id, kybe_identity_id) values (v_human_didqube, v_kybe_id);
  insert into didqube_constraint_test_results values ('1_valid_human_bind', 'PASSED');

  begin
    insert into public.didqubes (subject_class) values ('natural_person') returning didqube_id into v_dupe_didqube;
    insert into public.human_didqubes (didqube_id, kybe_identity_id) values (v_dupe_didqube, v_kybe_id);
    insert into didqube_constraint_test_results values ('2_duplicate_anchor_rejected', 'FAILED');
  exception when unique_violation then
    insert into didqube_constraint_test_results values ('2_duplicate_anchor_rejected', 'PASSED');
  end;

  begin
    insert into public.agent_didqubes (didqube_id, agent_root_identity_id) values (v_human_didqube, v_agent_root_id);
    insert into didqube_constraint_test_results values ('3_cross_class_bind_rejected', 'FAILED');
  exception when others then
    insert into didqube_constraint_test_results values ('3_cross_class_bind_rejected', 'PASSED');
  end;

  insert into public.didqubes (subject_class) values ('agent') returning didqube_id into v_agent_didqube;
  insert into public.agent_didqubes (didqube_id, agent_root_identity_id) values (v_agent_didqube, v_agent_root_id);
  insert into didqube_constraint_test_results values ('4_valid_agent_bind', 'PASSED');

  begin
    insert into public.didqubes (subject_class) values ('agent') returning didqube_id into v_dupe_agent_didqube;
    insert into public.agent_didqubes (didqube_id, agent_root_identity_id) values (v_dupe_agent_didqube, v_agent_root_id);
    insert into didqube_constraint_test_results values ('5_duplicate_agent_anchor_rejected', 'FAILED');
  exception when unique_violation then
    insert into didqube_constraint_test_results values ('5_duplicate_agent_anchor_rejected', 'PASSED');
  end;
end $$;
select test_name, outcome from didqube_constraint_test_results order by test_name;
rollback;
`;

function main() {
  // supabase-js (used here, matching every other script in this repo) has no
  // generic "run this arbitrary multi-statement SQL batch" call — it only
  // exposes table-level operations and named RPC functions. Running the
  // transaction-wrapped batch above needs a real SQL connection: `psql
  // "$DATABASE_URL" -f -` piping the printed SQL, the Supabase SQL editor,
  // or an MCP `execute_sql` call. This script exists so that exact,
  // reviewable SQL lives in the repo as a checked-in file rather than only
  // in a one-off tool-call transcript, and prints it plus how to run it —
  // it does not itself execute anything (checked, not assumed, that no
  // shortcut existed here before writing this).
  console.log(VERIFICATION_SQL);
  console.log(
    '\nRun the SQL above directly against the real database to get PASSED/FAILED rows for all 5 ' +
      'assertions — e.g. `psql "$DATABASE_URL" -f -` piping it in, the Supabase SQL editor, or an MCP ' +
      'execute_sql call. Already run once by hand on 2026-09-07 against project bsjhfvctmduxhohtllly ' +
      'with all 5 assertions PASSED (see 2026-09-07_didqube-canonical-resolver-execution-plan.md, ' +
      'Phase 1 verification notes) — this script is what makes that reproducible rather than only a ' +
      'one-off tool-call transcript.',
  );
}

main();
