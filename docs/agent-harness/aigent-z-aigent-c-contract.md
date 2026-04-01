# Aigent Z / Aigent C Orchestration Contract

> Derived from metaproof-core.md §1–3. This is the canonical definition of the dual-agent model.

---

## Role Definitions

### AigentZRole — System Orchestrator
```typescript
{
  id: 'aigent-z',
  displayName: 'Aigent Z',
  layer: 'system',
  authority: 'orchestration',
  allowedActions: [
    'route_to_agent',
    'invoke_registry_package',
    'delegate_to_specialist',
    'read_journey_state',
    'emit_orchestration_event',
    'approve_handoff',
    'trigger_guardian_review',
    'read_nbe_recommendation'
  ],
  forbiddenActions: [
    'override_metame_guardian',
    'act_on_user_behalf_without_aigent_c',
    'write_to_production_db_without_policy_gate',
    'expose_sovereign_iqube_data'
  ],
  escalatesTo: 'metame-guardian',
  contextInputs: ['journey_state', 'policy_envelope', 'registry_scope', 'active_cartridge'],
  outputContract: 'OrchestrationDecision'
}
```

### AigentCRole — Customer-Facing Guide
```typescript
{
  id: 'aigent-c',
  displayName: 'Aigent C',
  layer: 'user-facing',
  authority: 'customer-interaction',
  allowedActions: [
    'present_options_to_user',
    'ask_clarifying_question',
    'deliver_nbe_recommendation',
    'trigger_handoff_to_guide',
    'explain_journey_stage',
    'surface_next_unlock',
    'escalate_to_z'
  ],
  forbiddenActions: [
    'access_system_internals_without_z',
    'override_z_routing',
    'expose_raw_wallet_credentials',
    'write_journey_state_directly'
  ],
  escalatesTo: 'aigent-z',
  contextInputs: ['user_context_summary', 'journey_state_summary', 'nbe_recommendation', 'active_guide'],
  outputContract: 'CustomerInteractionResponse'
}
```

### MetaMeGuardianRole — User-Sovereign Runtime
```typescript
{
  id: 'metame-guardian',
  displayName: 'metaMe',
  layer: 'runtime-sovereign',
  authority: 'absolute',
  allowedActions: [
    'halt_any_flow',
    'override_any_agent',
    'enforce_disclosure_policy',
    'gate_iqube_access',
    'trigger_policy_review',
    'emit_guardian_suggestion',
    'auto_act_within_policy_envelope',
    'persist_journey_state'
  ],
  forbiddenActions: [],  // guardian has no restrictions
  escalatesTo: null,     // top of hierarchy
  contextInputs: ['full_journey_state', 'policy_envelope', 'experience_goals', 'matrix_status'],
  outputContract: 'GuardianDecision'
}
```

### CartridgeLeadAgentRole — Domain Specialist
```typescript
{
  id: 'cartridge-lead',
  displayName: 'Cartridge Lead Agent',
  layer: 'cartridge',
  authority: 'domain',
  allowedActions: [
    'execute_within_cartridge_scope',
    'own_cartridge_state',
    'invoke_cartridge_skills',
    'return_control_to_metame'
  ],
  forbiddenActions: [
    'escalate_outside_cartridge_without_z_approval',
    'override_metame_guardian',
    'access_other_cartridge_data'
  ],
  escalatesTo: 'aigent-z',
  contextInputs: ['handoff_payload', 'cartridge_context', 'policy_envelope'],
  outputContract: 'CartridgeResponse'
}
```

---

## Routing Logic

The runtime routing layer resolves the active responder using this priority chain:

```
1. Is there a policy violation? → metaMe Guardian (always wins)
2. Is this a system/capability routing decision? → Aigent Z
3. Is this a customer-facing interaction? → Aigent C
4. Is this inside an active cartridge context? → Cartridge Lead Agent
5. Is this a bounded specialist task? → Specialist Subagent
6. Default → Aigent C with Z supervision
```

---

## Orchestration Events

Every routing switch emits:
```typescript
interface OrchestrationEvent {
  event_id: string
  timestamp: string
  event_type:
    | 'z_delegated'
    | 'c_took_control'
    | 'cartridge_lead_active'
    | 'specialist_invoked'
    | 'control_returned_to_metame'
    | 'policy_blocked'
    | 'guardian_intervened'
  from_role: AgentRoleId
  to_role: AgentRoleId
  reason: string
  journey_stage: JourneyStage
  active_cartridge: string | null
  active_codex: string | null
  receipt_eligible: boolean
}
```

---

## Handoff Rules

### Z → C (system hands off to customer layer)
- Trigger: user interaction required
- Z provides: route decision + NBE recommendation + policy envelope
- C receives: user context + recommended action + constraints

### C → Guide Agent (e.g. Marketa, kn0w1)
- Trigger: domain expertise needed
- C provides: user context summary + journey stage + open questions
- Guide receives: handoff payload with returnConditions

### Guide → Cartridge Lead
- Trigger: active cartridge work required
- Guide provides: full handoff payload
- Lead receives: cartridge context + policy envelope

### Any → metaMe (return to guardian)
- Trigger: task complete, escalation, policy flag, user exit
- Any agent can trigger return
- metaMe always accepts control

---

## KNYT-Specific Routing

```
User enters Runtime (KNYT context)
  → metaMe reads journey state → classifies stage
  → Z receives stage + context
  → Z selects: Aigent C (if new) or guide agent (if returning)
  → C greets + delivers stage-aware NBE
  → C hands off to Marketa/kn0w1 for guided experience
  → Guide hands off to cartridge lead on activation
  → On exit or escalation → metaMe resumes control
```

---

## Acceptance Criteria (from Epic 1)

- [ ] Z and C cannot be confused in runtime execution
- [ ] Runtime can explain which orchestration role is currently active
- [ ] Handoff rules are deterministic and testable
- [ ] Every orchestration switch emits a structured event
- [ ] Cartridge agents cannot override metaMe guardian authority
