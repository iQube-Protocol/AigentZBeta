/**
 * Orchestration contracts for the Aigent Z / Aigent C dual-agent model.
 * Canonical source: docs/agent-harness/aigent-z-aigent-c-contract.md
 *
 * Epic 1 — AGT-101–104
 */

// ─── Role identifiers ────────────────────────────────────────────────────────

export type AgentRoleId =
  | 'metame-guardian'
  | 'aigent-z'
  | 'aigent-c'
  | 'cartridge-lead'
  | 'specialist'
  | 'guide-agent'   // e.g. marketa, kn0w1

export type JourneyStage =
  | 'prospect'
  | 'acolyte'
  | 'keta'
  | 'keji'
  | 'first'
  | 'zero'
  | 'investor_reactivation_candidate'
  | 'collector_only'
  | 'creator_contributor'

export type ExperienceDepth = 'pill' | 'capsule' | 'mini_runtime' | 'codex'

export type AgentDisposition = 'ask' | 'act' | 'wait' | 'escalate' | 'deny'

// ─── Policy envelope ──────────────────────────────────────────────────────────

export interface PolicyEnvelope {
  tenant_id: string
  persona_id: string
  allowed_surfaces: string[]
  forbidden_actions: string[]
  disclosure_class: 'public' | 'tenant' | 'persona' | 'sovereign'
  requires_guardian_approval: boolean
  cartridge_scope: string | null
}

// ─── Journey state summary (lightweight, safe to pass between agents) ─────────

export interface JourneyStateSummary {
  persona_id: string
  journey_stage: JourneyStage
  experience_depth: ExperienceDepth
  active_cartridge: string | null
  active_codex: string | null
  blocked_reasons: string[]
  next_likely_step: string | null
  session_id: string
}

// ─── Handoff payload ──────────────────────────────────────────────────────────

export interface HandoffPayload {
  handoff_id: string
  from_agent: AgentRoleId
  to_agent: AgentRoleId
  reason: string
  /** Plain language, ≤3 sentences — safe to show in UI */
  user_context_summary: string
  journey_state_summary: JourneyStateSummary
  policy_envelope: PolicyEnvelope
  open_tasks: string[]
  /** Conditions under which control returns to metaMe */
  return_conditions: string[]
  timestamp: string
}

// ─── Orchestration decision (Z output) ───────────────────────────────────────

export interface OrchestrationDecision {
  decision_id: string
  active_role: AgentRoleId
  handoff: HandoffPayload | null
  nbe_recommendation: NBERecommendation | null
  policy_flags: string[]
  receipt_eligible: boolean
  timestamp: string
}

// ─── NBE recommendation ───────────────────────────────────────────────────────

export interface NBERecommendation {
  nbe_id: string
  recommended_action: string
  recommended_surface: 'runtime' | 'codex' | 'studio' | 'registry'
  recommended_agent: AgentRoleId
  disposition: AgentDisposition
  rationale: string
  journey_stage: JourneyStage
  experience_depth: ExperienceDepth
}

// ─── Customer interaction response (C output) ────────────────────────────────

export interface CustomerInteractionResponse {
  response_id: string
  content: string
  nbe_chips: NBEChip[]
  active_agent: AgentRoleId
  journey_stage: JourneyStage
  handoff_pending: HandoffPayload | null
  timestamp: string
}

export interface NBEChip {
  label: string
  action: string
  surface: 'runtime' | 'codex' | 'studio' | 'registry'
  disposition: AgentDisposition
}

// ─── Guardian decision ────────────────────────────────────────────────────────

export interface GuardianDecision {
  decision_id: string
  approved: boolean
  override_reason: string | null
  policy_flags: string[]
  auto_acted: boolean
  suggested_action: string | null
  receipt_eligible: boolean
  timestamp: string
}

// ─── Orchestration event (AGT-103) ───────────────────────────────────────────

export type OrchestrationEventType =
  | 'z_delegated'
  | 'c_took_control'
  | 'cartridge_lead_active'
  | 'specialist_invoked'
  | 'control_returned_to_metame'
  | 'policy_blocked'
  | 'guardian_intervened'
  | 'guardian_suggested'
  | 'guardian_auto_acted'
  | 'access_decision'

export interface OrchestrationEvent {
  event_id: string
  timestamp: string
  event_type: OrchestrationEventType
  from_role: AgentRoleId
  to_role: AgentRoleId
  reason: string
  journey_stage: JourneyStage
  active_cartridge: string | null
  active_codex: string | null
  receipt_eligible: boolean
  metadata: Record<string, unknown>
}

// ─── Runtime routing request ──────────────────────────────────────────────────

export interface RoutingRequest {
  persona_id: string
  tenant_id: string
  session_id: string
  context_type: 'user_message' | 'system_event' | 'guardian_check' | 'cartridge_action'
  content: string
  journey_state_summary: JourneyStateSummary
  active_cartridge: string | null
  policy_envelope: PolicyEnvelope
}

export interface RoutingResponse {
  active_role: AgentRoleId
  decision: OrchestrationDecision
  should_handoff: boolean
  handoff: HandoffPayload | null
}
