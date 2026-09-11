-- DiDQube Phase 3 (Passport corrections), item 1: Agent Passport atomic
-- binding/issuance RPC.
--
-- Phase 0's live inventory found 3 of 10 resolvable, approved agent
-- participant Passport applications missing their agent_root_identity.
-- bound_passport_id back-reference. Root cause: issuance
-- (services/passport/issuanceService.ts's applyReviewDecision) and binding
-- (a SEPARATE, best-effort, non-transactional update, only ever run by the
-- one automated caller services/homecoming/issueDelegatePassport.ts) were
-- never one atomic act — the manual Bureau review path never bound at all,
-- and even the automated path could partially fail between the two steps.
--
-- This function makes "insert the passport record + status-transition audit
-- row + update the application + bind the agent's RootDID (when supplied)"
-- ONE transaction. It is purely additive (a new function; no existing
-- table, column, or row is altered) and reversible (DROP FUNCTION).
--
-- Scope: the AGENT-PARTICIPANT issuance path only (citizen issuance is
-- untouched — citizens have no agent_root_identity to bind). Called from
-- services/passport/issuanceService.ts's applyReviewDecision for the
-- non-citizen approve branch.

create or replace function issue_agent_participant_passport_atomic(
  p_application_id uuid,
  p_passport_id text,
  p_passport_class text,
  p_issued_status text,
  p_passport_grade text,
  p_persona_id text,
  p_did_persona_id uuid,
  p_kybe_identity_id uuid,
  p_root_identity_id uuid,
  p_persona_public_ref text,
  p_kybe_did_public_ref text,
  p_root_did_public_ref text,
  p_vault_content_id text,
  p_vault_content_hash text,
  p_agent_root_identity_id uuid,
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
as $$
declare
  v_record_id uuid;
  v_bound boolean := false;
  v_already_bound boolean := false;
  v_rows_updated int;
begin
  insert into polity_passport_records (
    passport_id, passport_class, citizen_status, participant_status, passport_grade,
    persona_id, did_persona_id, kybe_identity_id, root_identity_id,
    persona_public_ref, kybe_did_public_ref, root_did_public_ref,
    vault_content_id, vault_content_hash, application_id, issued_at
  ) values (
    p_passport_id, p_passport_class, null, p_issued_status, p_passport_grade,
    p_persona_id, p_did_persona_id, p_kybe_identity_id, p_root_identity_id,
    p_persona_public_ref, p_kybe_did_public_ref, p_root_did_public_ref,
    p_vault_content_id, p_vault_content_hash, p_application_id, now()
  )
  returning id into v_record_id;

  insert into passport_status_transitions (
    passport_record_id, from_status, to_status, passport_class,
    actor_type, actor_id, reason, evidence_type, receipt_action, transitioned_at
  ) values (
    v_record_id, 'pending_approval', p_issued_status, p_passport_class,
    p_actor_type, p_steward_persona_id, p_notes, p_evidence_type, p_receipt_action, now()
  );

  update polity_passport_applications
  set application_status = 'approved',
      passport_id = p_passport_id,
      decided_at = now(),
      updated_at = now(),
      assigned_steward_id = case when p_actor_type = 'steward' then p_steward_persona_id else assigned_steward_id end
  where id = p_application_id;

  -- Bind the agent's RootDID to the issued passport, NULL-guarded so a
  -- concurrent claim (or a retry after a receipt-emission failure) can
  -- never clobber an already-bound row — idempotent by construction.
  if p_agent_root_identity_id is not null then
    update agent_root_identity
    set bound_passport_id = p_passport_id,
        updated_at = now()
    where id = p_agent_root_identity_id
      and bound_passport_id is null;
    get diagnostics v_rows_updated = row_count;
    if v_rows_updated > 0 then
      v_bound := true;
    else
      select (bound_passport_id is not null) into v_already_bound
      from agent_root_identity
      where id = p_agent_root_identity_id;
    end if;
  end if;

  return query select v_record_id, v_bound, coalesce(v_already_bound, false);
end;
$$;

comment on function issue_agent_participant_passport_atomic is
  'DiDQube Phase 3 item 1 (2026-09-07): atomic agent-participant Passport issuance + RootDID binding. Replaces the prior non-transactional insert-then-separately-bind sequence. Additive, reversible (DROP FUNCTION). See codexes/packs/agentiq/updates/2026-09-07_didqube-canonical-resolver-execution-plan.md, Phase 3.';
