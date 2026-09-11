-- DiDQube Phase 3 closure review (2026-09-07): hardens
-- issue_agent_participant_passport_atomic (20260930280000) against three
-- real gaps found on review, none of which the original migration's own
-- tests exercised:
--
-- 1. GRANTS: the function was created with Postgres/Supabase's default
--    privileges intact -- EXECUTE was granted to PUBLIC, anon AND
--    authenticated. Since this function lives in the public schema,
--    PostgREST exposes it as an RPC endpoint to ANY caller holding an anon
--    or authenticated JWT, completely bypassing every authorization check
--    applyReviewDecision performs in TypeScript (steward gate, World-ID
--    verification requirement, application-status checks) before ever
--    reaching this function. Fixed: REVOKE from PUBLIC/anon/authenticated,
--    GRANT to service_role only -- the sole role services/passport/
--    issuanceService.ts's getSupabaseServer() client authenticates as.
--
-- 2. CONCURRENCY: nothing prevented two concurrent calls against the SAME
--    application_id from both succeeding -- each mints its own unique
--    passport_id, so both INSERTs into polity_passport_records would
--    succeed, producing two active Passports for one application (with a
--    silent last-writer-wins race on polity_passport_applications.
--    passport_id). Fixed: the application-status UPDATE is now the FIRST
--    statement and the concurrency gate -- it only transitions rows still
--    in an open status, and a losing concurrent call gets zero rows back
--    and RAISEs, rolling back its entire attempted issuance (nothing it
--    would have inserted survives). This is exactly Postgres's own
--    row-level locking: a second concurrent UPDATE targeting the same row
--    blocks until the first commits, then re-evaluates its WHERE clause
--    against the now-'approved' row and finds nothing to claim.
--
-- 3. CONFUSED DEPUTY / caller-controlled issuer-binding authority: the
--    original signature accepted passport_class, persona_id, and (most
--    seriously) agent_root_identity_id as caller-supplied parameters --
--    nothing forced them to actually correspond to p_application_id's own
--    recorded data. A caller (even a correct one, by a future bug) could
--    bind application A's issued passport to a completely unrelated
--    agent's RootDID. Fixed: the function now re-reads passport_class,
--    passport_grade, persona_id, did_persona_id, kybe_identity_id,
--    root_identity_id, persona_public_ref, kybe_did_public_ref,
--    root_did_public_ref, vault_content_id, vault_content_hash, and
--    agent_card_url DIRECTLY from the claimed polity_passport_applications
--    row, and resolves agent_root_identity from THAT row's own
--    agent_card_url internally (fail closed on 0 or >1 matches) -- the
--    caller supplies only the passport_id to mint and the POLICY inputs
--    (issued_status, evidence_type, receipt_action, actor_type/persona,
--    notes) that legitimately come from the status-machine decision
--    already made in TypeScript (services/passport/passportStatusMachine.ts)
--    and are not themselves identity/binding data.
--
-- 4. UNDEFINED SUBJECT ON ISSUE: the original version carried forward
--    polity_passport_applications.root_did_public_ref as-is -- but nothing
--    in this codebase ever writes that column for an agent application, so
--    it was always null, meaning the class-sensitive VC subject fix (Phase
--    3 item 4) would resolve every freshly-issued agent Passport's
--    credentialSubject.id to undefined in practice, despite being
--    structurally correct. Fixed: the RPC now COMPUTES the commitment from
--    the resolved agent_root_identity's OWN did_uri (sha256, first 16 hex
--    chars -- byte-identical to services/passport/bureauIdentityService.ts's
--    didPublicRef, verified during this review) rather than trusting a
--    column nothing populates.
--
-- Additionally sets a fixed search_path (public, extensions, pg_temp) per
-- Postgres best practice for any function with write side effects
-- (extensions is where this project's pgcrypto lives, needed for the
-- digest() call above), and scopes the claim to
-- passport_class = 'agent_participant' exactly (never citizen,
-- robot_participant, or organization_participant -- the latter two have no
-- canonical root table yet, per the DiDQube resolver's own
-- UnsupportedSubjectClass classification, and must never silently borrow
-- this function's agent_root_identity resolution).

drop function if exists issue_agent_participant_passport_atomic(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, text, uuid, text, text, text, text, text
);

create or replace function issue_agent_participant_passport_atomic(
  p_application_id uuid,
  p_passport_id text,
  p_issued_status text,
  p_actor_type text,
  p_steward_persona_id text,
  p_notes text,
  p_evidence_type text,
  p_receipt_action text
)
returns table (
  passport_record_id uuid,
  bound boolean,
  already_bound boolean
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_app_id uuid;
  v_passport_class text;
  v_passport_grade text;
  v_persona_id text;
  v_did_persona_id uuid;
  v_kybe_identity_id uuid;
  v_root_identity_id uuid;
  v_persona_public_ref text;
  v_kybe_did_public_ref text;
  v_root_did_public_ref text;
  v_vault_content_id text;
  v_vault_content_hash text;
  v_agent_card_url text;
  v_agent_root_identity_id uuid;
  v_agent_did_uri text;
  v_agent_count int;
  v_record_id uuid;
  v_bound boolean := false;
  v_already_bound boolean := false;
  v_rows_updated int;
begin
  -- STEP 1 -- THE CONCURRENCY GATE. Atomically claim the application: only
  -- a transaction that finds it still open (and agent_participant) wins.
  -- A losing concurrent call gets NULL back below and RAISEs, rolling back
  -- everything -- no orphan passport record, no lost-update on
  -- passport_id/decided_at.
  update polity_passport_applications
  set application_status = 'approved',
      passport_id = p_passport_id,
      decided_at = now(),
      updated_at = now(),
      assigned_steward_id = case when p_actor_type = 'steward' then p_steward_persona_id else assigned_steward_id end
  where id = p_application_id
    and passport_class = 'agent_participant'
    and application_status in ('submitted', 'pending_approval', 'needs_more_information')
  returning
    id, passport_class, passport_grade, persona_id, did_persona_id, kybe_identity_id,
    root_identity_id, persona_public_ref, kybe_did_public_ref, root_did_public_ref,
    vault_content_id, vault_content_hash, agent_card_url
  into
    v_app_id, v_passport_class, v_passport_grade, v_persona_id, v_did_persona_id, v_kybe_identity_id,
    v_root_identity_id, v_persona_public_ref, v_kybe_did_public_ref, v_root_did_public_ref,
    v_vault_content_id, v_vault_content_hash, v_agent_card_url;

  if v_app_id is null then
    raise exception 'application % is not an open agent_participant application -- already decided, a concurrent issuance won the race, or this is not an agent_participant application', p_application_id;
  end if;

  -- STEP 2 -- confused-deputy-safe binding resolution: derived from the
  -- CLAIMED application's own agent_card_url, never from a caller-supplied
  -- agent_root_identity_id. Fail closed on missing or ambiguous.
  select count(*) into v_agent_count from agent_root_identity where agent_card_url = v_agent_card_url;
  if v_agent_count = 0 then
    raise exception 'no agent_root_identity resolves for agent_card_url % (missing)', coalesce(v_agent_card_url, '<null>');
  elsif v_agent_count > 1 then
    raise exception 'agent_card_url % resolves to % agent_root_identity rows (ambiguous)', v_agent_card_url, v_agent_count;
  end if;
  select id, did_uri into v_agent_root_identity_id, v_agent_did_uri from agent_root_identity where agent_card_url = v_agent_card_url;
  if v_agent_did_uri is null then
    raise exception 'agent_root_identity % carries no did_uri -- constitutional anchor is missing its public DID material', v_agent_root_identity_id;
  end if;

  -- COMPUTE the subject commitment from the resolved agent's OWN did_uri --
  -- never propagate polity_passport_applications.root_did_public_ref
  -- (nothing writes it for agent applications today, so it is always
  -- null; carrying it forward silently would reproduce the exact
  -- undefined-subject defect the class-sensitive VC subject fix (Phase 3
  -- item 4) exists to close). Same algorithm as services/passport/
  -- bureauIdentityService.ts's didPublicRef (sha256, first 16 hex chars) --
  -- verified byte-identical against that function during this review, so
  -- every OTHER commitment comparison in this codebase (e.g. the
  -- Constitutional Agreement legacy compatibility verifier) stays
  -- consistent with what this RPC writes.
  v_root_did_public_ref := substring(encode(digest(v_agent_did_uri, 'sha256'), 'hex') from 1 for 16);

  -- STEP 3 -- issue, using ONLY the claimed application's own data plus the
  -- commitment just computed above.
  insert into polity_passport_records (
    passport_id, passport_class, citizen_status, participant_status, passport_grade,
    persona_id, did_persona_id, kybe_identity_id, root_identity_id,
    persona_public_ref, kybe_did_public_ref, root_did_public_ref,
    vault_content_id, vault_content_hash, application_id, issued_at
  ) values (
    p_passport_id, v_passport_class, null, p_issued_status, v_passport_grade,
    v_persona_id, v_did_persona_id, v_kybe_identity_id, v_root_identity_id,
    v_persona_public_ref, v_kybe_did_public_ref, v_root_did_public_ref,
    v_vault_content_id, v_vault_content_hash, v_app_id, now()
  )
  returning id into v_record_id;

  insert into passport_status_transitions (
    passport_record_id, from_status, to_status, passport_class,
    actor_type, actor_id, reason, evidence_type, receipt_action, transitioned_at
  ) values (
    v_record_id, 'pending_approval', p_issued_status, v_passport_class,
    p_actor_type, p_steward_persona_id, p_notes, p_evidence_type, p_receipt_action, now()
  );

  -- STEP 4 -- RootDID bind, NULL-guarded and idempotent (unchanged from
  -- the original migration).
  update agent_root_identity
  set bound_passport_id = p_passport_id,
      updated_at = now()
  where id = v_agent_root_identity_id
    and bound_passport_id is null;
  get diagnostics v_rows_updated = row_count;
  if v_rows_updated > 0 then
    v_bound := true;
  else
    select (bound_passport_id is not null) into v_already_bound
    from agent_root_identity
    where id = v_agent_root_identity_id;
  end if;

  return query select v_record_id, v_bound, coalesce(v_already_bound, false);
end;
$$;

comment on function issue_agent_participant_passport_atomic is
  'DiDQube Phase 3 item 1, hardened 2026-09-07 (closure review): atomic agent-participant Passport issuance + RootDID binding, re-deriving all subject/binding data from the claimed application row itself (never from caller-supplied identity parameters), with the application-status claim as the concurrency gate. EXECUTE restricted to service_role. See codexes/packs/agentiq/updates/2026-09-07_didqube-canonical-resolver-execution-plan.md, Phase 3 closure review.';

revoke execute on function issue_agent_participant_passport_atomic(uuid, text, text, text, text, text, text, text) from public;
revoke execute on function issue_agent_participant_passport_atomic(uuid, text, text, text, text, text, text, text) from anon;
revoke execute on function issue_agent_participant_passport_atomic(uuid, text, text, text, text, text, text, text) from authenticated;
grant execute on function issue_agent_participant_passport_atomic(uuid, text, text, text, text, text, text, text) to service_role;
