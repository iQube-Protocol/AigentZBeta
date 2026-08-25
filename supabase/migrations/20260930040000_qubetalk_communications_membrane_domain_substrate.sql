-- 20260930040000_qubetalk_communications_membrane_domain_substrate.sql
--
-- QubeTalk Communications Membrane — Increment A: domain substrate
-- (codexes/packs/agentiq/updates/2026-08-25_qubetalk-communications-membrane-domain-spec-v0.2.md)
--
-- REUSE, NOT A SECOND ARCHITECTURE (N1/N2, inv.engineering.036/037):
--   - The existing peer-exchange primitive (passport_peer_channels /
--     passport_peer_messages, services/qubetalk/peerChannel.ts) IS the
--     RelationshipQube/MessageQube anchor. Neither is forked or replaced —
--     passport_peer_channels already guarantees exactly one row per
--     principal pair (its own generated, unique `pair_key`), which is
--     precisely what a RelationshipQube needs; this migration adds a 1:1
--     companion table for relationship-level PROJECTED state, and extends
--     passport_peer_messages with nullable columns rather than a parallel
--     message table (P2: one canonical event, multiple projections).
--   - Identity: participants/groups/publications reuse the SAME Polity
--     Public Reference discipline every existing QubeTalk table uses
--     (personaPublicRef — sha256/16-hex, T2-safe); `qubetalk_participants`
--     is explicitly NOT a new identity authority (P6/N3) — `principal_ref`
--     is nullable and, when set, is a real FK to personas.public_ref (the
--     durable generated column added by 20260930030000_persona_public_ref_column.sql).
--   - Owner-scoped rows (qubetalk_participants, qubetalk_agent_policies —
--     private per-principal address-book/policy config that never crosses
--     the network boundary) use a raw T0 `owner_persona_id uuid`, the same
--     exposure class as reciprocal_exchanges.initiator_persona_id
--     (service-role RLS only, never client-read). Anything that names
--     ANOTHER party, or that can end up referenced from a receipt
--     (channels, groups, publications), uses a T2 public ref instead —
--     matching passport_peer_channels' own `principal_a_ref`/`created_by_ref`
--     convention.
--   - Receipts ride the EXISTING activity_receipts table (see the companion
--     migration extending ANCHORABLE_ACTION_TYPES in code, per CLAUDE.md's
--     one permitted unilateral DVN-pipeline change) — no new receipt table.
--
-- All statements additive/idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS) per this repo's migration-safety convention. No destructive
-- change to any existing table; passport_peer_channels/passport_peer_messages
-- keep every existing column, index, and constraint untouched.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. ParticipantQube — a communications projection, never a new identity
--    authority (§4.1). Per-owner (each principal's own resolution of who a
--    correspondent is) so no two owners' confidence judgments can collide,
--    and no identity is ever merged platform-wide off a display-name match.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_persona_id uuid NOT NULL,
  -- Set only once resolved to a real Passport/persona; a FK (not just a
  -- text column) so a "resolved" participant can never point at a
  -- nonexistent/garbage reference — the DB itself enforces P6.
  principal_ref text REFERENCES public.personas (public_ref),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- At most one resolved-participant row per (owner, principal) — prevents a
-- duplicate directory entry once identity is confirmed. Unresolved rows
-- (principal_ref NULL) are deliberately NOT constrained here: an owner may
-- hold several distinct not-yet-linked correspondents before confirmation.
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_participants_owner_principal_uidx
  ON public.qubetalk_participants (owner_persona_id, principal_ref)
  WHERE principal_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS qubetalk_participants_owner_idx ON public.qubetalk_participants (owner_persona_id);

CREATE TABLE IF NOT EXISTS public.qubetalk_participant_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.qubetalk_participants (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN (
    'metame', 'email', 'whatsapp', 'telegram', 'signal', 'linkedin', 'discord', 'x', 'sms'
  )),
  endpoint_ref text NOT NULL,
  -- Explicit confidence tier (§4.1) — never collapsed to a boolean "verified".
  confidence text NOT NULL DEFAULT 'unresolved' CHECK (confidence IN (
    'verified', 'user_confirmed', 'high_confidence', 'tentative', 'unresolved'
  )),
  confirmed_by_persona_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_participant_endpoints_uidx
  ON public.qubetalk_participant_endpoints (participant_id, platform, endpoint_ref);
CREATE INDEX IF NOT EXISTS qubetalk_participant_endpoints_participant_idx
  ON public.qubetalk_participant_endpoints (participant_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. RelationshipQube — a 1:1 PROJECTED-state companion to the EXISTING
--    passport_peer_channels row (the relationship anchor; not duplicated).
--    Every field here is a derived projection, traceable back to source
--    messages via memory_source_message_ids — raw history is never
--    overwritten (P5/N15).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_relationship_state (
  channel_id uuid PRIMARY KEY REFERENCES public.passport_peer_channels (id) ON DELETE CASCADE,
  open_loops jsonb NOT NULL DEFAULT '[]',
  commitments jsonb NOT NULL DEFAULT '[]',
  memory_summary text,
  memory_summary_updated_at timestamptz,
  -- Traceability requirement (P5): every derived summary names the raw
  -- messages it was built from — never a bare unattributed synthesis.
  memory_source_message_ids uuid[] NOT NULL DEFAULT '{}',
  last_interaction_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. GroupQube — genuinely new; nothing in the existing schema models a
--    multi-party context (passport_peer_channels is hard-pinned to exactly
--    two principals). Membership is temporal (§4.3) — an audience snapshot
--    frozen on each message (added to passport_peer_messages below) is what
--    actually protects P4; this membership table is the current/live roster.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_ref text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qubetalk_groups_created_by_idx ON public.qubetalk_groups (created_by_ref);

CREATE TABLE IF NOT EXISTS public.qubetalk_group_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.qubetalk_groups (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN (
    'metame', 'whatsapp', 'discord', 'telegram', 'signal'
  )),
  external_group_ref text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_group_endpoints_uidx
  ON public.qubetalk_group_endpoints (group_id, platform, external_group_ref);

CREATE TABLE IF NOT EXISTS public.qubetalk_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.qubetalk_groups (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.qubetalk_participants (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  -- A participant may re-join the same group after leaving; joined_at in
  -- the key lets that history coexist rather than colliding.
  UNIQUE (group_id, participant_id, joined_at)
);
CREATE INDEX IF NOT EXISTS qubetalk_group_memberships_group_idx ON public.qubetalk_group_memberships (group_id);
CREATE INDEX IF NOT EXISTS qubetalk_group_memberships_participant_idx ON public.qubetalk_group_memberships (participant_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. ConversationQube — episodic/topic context, genuinely new. Anchored to
--    a relationship (dyadic) and/or a group; both nullable so BROADCAST /
--    PUBLIC_THREAD / FEDERATED topologies aren't forced into either shape.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_channel_id uuid REFERENCES public.passport_peer_channels (id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.qubetalk_groups (id) ON DELETE CASCADE,
  topology text NOT NULL CHECK (topology IN (
    'dyadic', 'group', 'broadcast', 'fan_in', 'public_thread', 'federated'
  )),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qubetalk_conversations_relationship_idx
  ON public.qubetalk_conversations (relationship_channel_id);
CREATE INDEX IF NOT EXISTS qubetalk_conversations_group_idx ON public.qubetalk_conversations (group_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. MessageQube — EXTENDS the existing passport_peer_messages row rather
--    than forking a parallel table (P2, N2). Every new column is nullable
--    or carries a default matching the CURRENT (native, outbound) rows, so
--    every existing row remains valid with zero backfill.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.passport_peer_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.qubetalk_conversations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.qubetalk_groups (id) ON DELETE SET NULL,
  -- 'qubetalk-native' — the ONE supported transport as of this increment
  -- (services/qubetalk/transportRegistry.ts); future adapters populate
  -- this with their own registered transport id, never a fabricated one.
  ADD COLUMN IF NOT EXISTS transport text NOT NULL DEFAULT 'qubetalk-native',
  -- Idempotency key for future external-event ingestion (§4.5/§11) — NULL
  -- for every native message today.
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  -- Agent attribution (§10) — both null for an ordinary human-authored
  -- message; set only when an Agent sent it under a bounded grant.
  ADD COLUMN IF NOT EXISTS acting_agent_ref text,
  ADD COLUMN IF NOT EXISTS delegation_grant_ref text,
  -- Frozen at send/ingest time — who could see this message THEN (§4.3/P4).
  ADD COLUMN IF NOT EXISTS audience_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard', 'confidential', 'restricted')),
  ADD COLUMN IF NOT EXISTS consequence text NOT NULL DEFAULT 'conversational' CHECK (consequence IN ('conversational', 'operational', 'consequential')),
  ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'delivered' CHECK (delivery_state IN ('pending', 'delivered', 'failed'));

-- Duplicate webhook/poll delivery of the SAME external event must not
-- create a duplicate row (§4.5). Partial (WHERE external_message_id IS NOT
-- NULL) so native messages — which never set this column — are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS passport_peer_messages_external_idempotency_uidx
  ON public.passport_peer_messages (transport, external_message_id)
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS passport_peer_messages_conversation_idx ON public.passport_peer_messages (conversation_id);
CREATE INDEX IF NOT EXISTS passport_peer_messages_group_idx ON public.passport_peer_messages (group_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Publishing plane — PublicationQube + channel projections (§4.6/§14).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_ref text NOT NULL,
  persona_label text,
  agent_ref text,
  source_content_ref text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'prepared', 'pending_authority', 'pending_approval', 'scheduled',
    'publishing', 'published', 'partially_published', 'failed', 'withdrawn', 'archived'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qubetalk_publications_author_idx ON public.qubetalk_publications (author_ref);

CREATE TABLE IF NOT EXISTS public.qubetalk_publication_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.qubetalk_publications (id) ON DELETE CASCADE,
  -- Free text, NOT a CHECK enum: the capability registry (code, not schema)
  -- is the single source of truth for which channels are actually
  -- supported (N11) — a schema-level enum here would silently imply
  -- support this migration cannot honestly promise.
  channel text NOT NULL,
  external_publication_id text,
  projection_status text NOT NULL DEFAULT 'pending' CHECK (projection_status IN (
    'pending', 'publishing', 'published', 'failed', 'withdrawn'
  )),
  url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, channel)
);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Engagement plane — EngagementQube (§4.7/§15), feeding back through
--    participant resolution into RelationshipQube (P13).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_projection_id uuid NOT NULL REFERENCES public.qubetalk_publication_projections (id) ON DELETE CASCADE,
  engagement_type text NOT NULL CHECK (engagement_type IN (
    'comment', 'reply', 'mention', 'quote', 'reaction', 'question', 'direct_message_referral', 'reshare'
  )),
  external_engagement_id text,
  -- Resolved participant when evidence is sufficient — NEVER auto-merged
  -- off a display name alone (N4); author_raw_handle is kept regardless,
  -- so provenance survives even after resolution (N15).
  author_participant_id uuid REFERENCES public.qubetalk_participants (id) ON DELETE SET NULL,
  author_raw_handle text,
  body text,
  state text NOT NULL DEFAULT 'ingested' CHECK (state IN (
    'ingested', 'resolved_participant', 'triaged', 'needs_user', 'agent_manageable',
    'responded', 'converted_to_conversation', 'closed', 'quarantined'
  )),
  converted_conversation_id uuid REFERENCES public.qubetalk_conversations (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qubetalk_engagements_projection_idx ON public.qubetalk_engagements (publication_projection_id);
CREATE INDEX IF NOT EXISTS qubetalk_engagements_state_idx ON public.qubetalk_engagements (state);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Agent management — policy modes + inheritance scope (§10). Reuses the
--    EXISTING bounded-delegation grant store for authority; this table only
--    records WHICH mode/scope applies where, never a parallel grant.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_persona_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('default', 'participant', 'relationship', 'group', 'conversation', 'transport')),
  scope_ref text,
  mode text NOT NULL CHECK (mode IN ('manual', 'agent_drafts', 'agent_routine', 'agent_bounded', 'no_agent')),
  -- Required (validated in the service layer, not by this CHECK) when
  -- mode = 'agent_bounded' — the actual grant lives in delegationGrantStore.ts;
  -- this column only names WHICH grant this policy defers to.
  delegation_grant_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_persona_id, scope_type, scope_ref)
);
CREATE INDEX IF NOT EXISTS qubetalk_agent_policies_owner_idx ON public.qubetalk_agent_policies (owner_persona_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 9. Communications events — rewardable event log (§21). QubeTalk emits;
--    it never calculates Standing/QriptoCENT/$KNYT itself (P14/N13) — no
--    column here computes or stores a reward amount.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'message.sent', 'message.received', 'conversation.started', 'conversation.responded',
    'group.participated', 'publication.published', 'publication.shared', 'publication.engaged',
    'publication.reshared', 'comment.responded', 'referral.generated'
  )),
  subject_ref text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qubetalk_events_type_idx ON public.qubetalk_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS qubetalk_events_subject_idx ON public.qubetalk_events (subject_ref, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — deny-all on every new table, same discipline as passport_peer_*:
-- service-role-only, membership/ownership enforced in the service layer.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_participant_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_relationship_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_group_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_publication_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qubetalk_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.qubetalk_participants IS
  'QubeTalk Communications Membrane — ParticipantQube. A per-owner communications projection of an existing principal/Agent/org or an unresolved correspondent. NOT a new identity authority (P6) — principal_ref, when set, FKs to personas.public_ref.';
COMMENT ON TABLE public.qubetalk_relationship_state IS
  'QubeTalk Communications Membrane — RelationshipQube projected state, 1:1 with an existing passport_peer_channels row (the relationship anchor). Derived/traceable only (P5) — never overwrites raw messages.';
COMMENT ON TABLE public.qubetalk_groups IS
  'QubeTalk Communications Membrane — GroupQube. First-class multi-party context; may span several platform endpoints (qubetalk_group_endpoints) with temporal membership (qubetalk_group_memberships).';
COMMENT ON TABLE public.qubetalk_conversations IS
  'QubeTalk Communications Membrane — ConversationQube. Episodic/topic context, anchored to a relationship and/or group; deterministic-evidence resolution lives in services/qubetalk/conversationResolver.ts, never in this schema.';
COMMENT ON TABLE public.qubetalk_publications IS
  'QubeTalk Communications Membrane — PublicationQube. One canonical publishing act; per-channel projections live in qubetalk_publication_projections.';
COMMENT ON TABLE public.qubetalk_engagements IS
  'QubeTalk Communications Membrane — EngagementQube. Comments/replies/mentions/quotes/reactions on a publication projection; feeds back through participant resolution into RelationshipQube (P13).';
COMMENT ON TABLE public.qubetalk_agent_policies IS
  'QubeTalk Communications Membrane — Agent management mode per scope (default/participant/relationship/group/conversation/transport). Authority itself still lives in services/delegation/delegationGrantStore.ts — this table only records which mode applies where.';
COMMENT ON TABLE public.qubetalk_events IS
  'QubeTalk Communications Membrane — rewardable event log. QubeTalk emits; it never computes Standing/QriptoCENT/$KNYT itself (P14/N13).';

-- ═══════════════════════════════════════════════════════════════════════
-- 10. activity_receipts CHECK-constraint rebuild — new action types.
--
-- Wholesale rebuild per the drift-incident regression guard
-- (tests/activity-receipts-action-type-parity.test.ts): every migration that
-- extends services/receipts/activityReceiptService.ts's ActivityActionType
-- union must ALSO rebuild this constraint with the COMPLETE current list,
-- carried forward verbatim from 20260930020000 plus the nine new
-- 'qubetalk_*' types this capability introduces (§17's candidate list,
-- literal names, plus the justified 'withdrawn' addition — see
-- activityReceiptService.ts's own comment for the full reasoning).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued',
    'specialist_consulted',
    'artifact_created',
    'artifact_published',
    'artifact_sent',
    'approval_granted',
    'approval_rejected',
    'experience_model_updated',
    'session_started',
    'session_completed',
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
    'governance_decision_ratified',
    'governance_decision_amended',
    'governance_authority_exercised',
    'governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'operator_action_logged',
    'standing_document_added',
    'partner_agent_evidence_recorded',
    'agent_delegated',
    'agent_delegation_revoked',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'capability_registered',
    'capability_operationally_validated',
    'capability_deprecated',
    'research_lifecycle_transition',
    'experiment_result_published',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'canonical_plate_composed',
    'plan_cancelled',
    'venture_blueprint_handoff',
    'standing_accrued',
    'standing_corrected',
    'workspace_report_published',
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed',
    'qriptocent_payment_instruction_accepted',
    'qriptocent_settlement_authority_verified',
    'qriptocent_source_debit_initiated',
    'qriptocent_source_debit_finalised',
    'qriptocent_settlement_message_verified',
    'qriptocent_destination_liquidity_reserved',
    'qriptocent_destination_credit_completed',
    'qriptocent_settlement_reconciled',
    'qriptocent_settlement_exception_recorded',
    'qriptocent_liquidity_proof_verified',
    'qriptocent_replenishment_authorised',
    'qriptocent_native_issuance_executed',
    'independent_review_completed',
    'bitcent_treasury_etch_executed',
    'agent_card_discovered',
    'horizen_agent_registered',
    'horizen_pnl_transparency_enabled',
    'agent_card_enriched',
    'agent_control_proven',
    'marketa_eligibility_recommended',
    'operator_passport_validated',
    'agent_sponsorship_recorded',
    'agent_delegate_passport_issued',
    'aigentme_activated',
    'experienceqube_focus_disposition_recorded',
    'journey_completed',
    'horizen_pulse_authorized',
    'marketa_eligibility_assessed',
    'marketa_eligibility_refused',
    'marketa_eligibility_quarantined',
    'principal_registration_mandate_signed',
    'agent_registry_transaction_signed',
    'horizen_registration_submitted',
    'horizen_registration_confirmed',
    'agent_registry_binding_recorded',
    'address_only_placeholder_superseded',
    'external_wallet_binding_migrated',
    'principal_wallet_provisioned',
    'principal_wallet_control_proven',
    'external_wallet_control_proven',
    'trust_dimension_incremented',
    'population_record_repaired',
    'population_record_excluded',
    'capability_invocation_requested',
    'capability_invocation_authorized',
    'capability_invocation_refused',
    'capability_invocation_completed',
    'pulse_enrollment_verified',
    'pulse_commitment_verified',
    'reconciliation_discrepancy_recorded',
    'pnl_service_verified',
    'orientation_ritual_completed',
    'pnl_service_registered',
    'agent_registry_activated',
    'agent_delegate_stood_up',
    'agent_delegation_anchor_repaired',
    'legacy_passport_linkage_reconciled',
    'implementation_execution_observed',
    'implementation_execution_returned',
    'commerce_action_authorised',
    'commerce_action_refused',
    'commerce_action_unresolved',
    'commerce_execution_bound',
    'commerce_execution_refused',
    'commerce_consequence_recorded',
    -- Reciprocal Artifact Exchange (PRD-IRL-AX-001, this migration).
    'exchange_created',
    'exchange_counterparty_joined',
    'exchange_artifact_deposited',
    'exchange_artifact_replaced',
    'exchange_freeze_declared',
    'exchange_instrument_signed',
    'exchange_crossed',
    'exchange_receipt_acknowledged',
    'exchange_comparison_opened',
    'exchange_derivative_created',
    'exchange_withdrawn',
    'exchange_access_revoked',
    -- QubeTalk Communications Membrane (2026-08-25) — canonical §17 names.
    'qubetalk_publication_published',
    'qubetalk_publication_withdrawn',
    'qubetalk_publication_projection_failed',
    'qubetalk_message_agent_sent',
    'qubetalk_group_message_agent_sent',
    'qubetalk_agent_approval_used',
    'qubetalk_endpoint_linked',
    'qubetalk_group_federated',
    'qubetalk_conversation_context_disclosure'
));
