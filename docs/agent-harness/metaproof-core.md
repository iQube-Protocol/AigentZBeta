# metaProof Core — Canonical Harness Spec

> **Source of truth.** All tool-specific instruction layers (CLAUDE.md, AGENTS.md, Lovable workspace knowledge) are derived from this file. Edit here, then propagate.

---

## 1. System Model

### Role Hierarchy

```
metaMe Guardian          ← user-sovereign runtime layer; always active
  └── Aigent Z           ← system-side orchestrator; routes capabilities
        └── Aigent C     ← customer-facing guide; owns user interaction
              └── Cartridge Lead Agent   ← domain specialist within cartridge rules
                    └── Specialist Subagents   ← bounded task workers
```

### Authority Boundaries

| Role | Can do | Cannot do |
|------|--------|-----------|
| **metaMe Guardian** | Override any agent, halt any flow, enforce policy, gate disclosure | Nothing — highest authority |
| **Aigent Z** | Route tasks, delegate, invoke registry, orchestrate across cartridges | Override metaMe, act on user's behalf without C |
| **Aigent C** | Guide user, present options, take customer-facing actions | Access system internals, override Z routing |
| **Cartridge Lead** | Execute within cartridge scope, own cartridge state | Escalate outside cartridge without Z approval |
| **Specialist** | Execute single bounded task | Persist state, cross cartridge boundaries |

### Non-Negotiable Rules

1. **metaMe remains above the cartridge** — no cartridge agent can override guardian policy
2. **Aigent Z is the system-side orchestrator** — all cross-cartridge routing goes through Z
3. **Aigent C is the customer-facing corollary of Z** — they are a pair, not competitors
4. **Journey context is first-class system state** — not a prompt decoration
5. **Registry is an operational trust/package surface** — not a passive catalog
6. **All material state changes must be DVN receipt-eligible**
7. **DiDQube/iQube disclosure minimization is enforced at every layer**
8. **Reuse and extend before creating new** — check existing stack first

---

## 2. Experience Model

### Journey Stages (KNYT)
```
prospect → acolyte → keta → keji → first → zero
                                         ↕
                               investor-reactivation-candidate
                               collector-only
                               creator-contributor
```

### Experience Depth Ladder (L0–L3)
```
L0: pill          → surface awareness
L1: capsule       → contextual engagement
L2: mini_runtime  → active participation
L3: codex         → deep immersion + creation
```
One-step escalation only. L0→L1→L2→L3. No skipping.

### Next-Best-Experience (NBE) Output Contract
```typescript
{
  recommendedAction: string
  recommendedSurface: 'runtime' | 'codex' | 'studio' | 'registry'
  recommendedAgent: AgentRoleId
  disposition: 'ask' | 'act' | 'wait' | 'escalate' | 'deny'
  rationale: string
  journeyStage: JourneyStage
  experienceDepth: ExperienceDepth
}
```

---

## 3. Handoff Protocol

Every agent-to-agent handoff must include:
```typescript
{
  fromAgent: AgentRoleId
  toAgent: AgentRoleId
  reason: string
  userContextSummary: string       // plain language, ≤3 sentences
  journeyStateSummary: JourneyStateSummary
  policyEnvelope: PolicyEnvelope
  openTasks: string[]
  returnConditions: string[]       // when control returns to metaMe
}
```

Handoff chain for KNYT entry:
```
metaMe → Aigent C → guide agent (Marketa/kn0w1) → cartridge lead → metaMe (on exit/escalation)
```

---

## 4. Studio Artifact Schema

Every Studio run that produces material changes must emit:
```typescript
{
  job_id: string
  source_surface: 'studio' | 'codex' | 'registry'
  target_surfaces: ('runtime' | 'codex' | 'registry' | 'studio')[]
  journey_segments_affected: JourneyStage[]
  ui_surfaces_affected: string[]
  package_dependencies: string[]
  state_changes: StateChange[]
  proof_requirements: string[]
  acceptance_checks: string[]
  follow_up_tasks: string[]
}
```

---

## 5. Registry Package Manifest

Every registry package must declare:
```typescript
{
  package_id: string
  package_type: 'skill' | 'agent' | 'hook' | 'mcp' | 'cartridge' | 'plugin'
  version: string
  release_channel: 'alpha' | 'beta' | 'stable' | 'archived'
  trust_status: 'unverified' | 'reviewed' | 'certified' | 'sovereign'
  proof_status: 'none' | 'pending' | 'issued'
  required_scopes: string[]
  supported_surfaces: string[]
  data_disclosure_class: 'public' | 'tenant' | 'persona' | 'sovereign'
  compatible_ecosystems: ('mcp' | 'claude-plugin' | 'codex-plugin')[]
  install_method: 'auto' | 'manual' | 'policy-gated'
}
```

---

## 6. DVN Receipt Taxonomy

Events that must be receipt-eligible:
```
stage_assigned          next_action_recommended   handoff_started
handoff_completed       activation_attempted      activation_completed
package_activated       policy_denied             guardian_suggested
guardian_auto_acted     artifact_synced           rollback_triggered
```

---

## 7. DiDQube / iQube Policy

- Never expose sovereign iQube data beyond the declared disclosure class
- `NEXT_PUBLIC_` env vars are browser-safe only — never use for service role keys
- Agent C never receives raw wallet credentials — only scoped capability tokens
- blakQube data is persona-private unless explicitly disclosed
- All identity resolution follows canonical email → crm_auth_profiles chain

---

## 8. UI Parity Rules

Runtime shell must preserve:
- Spacing: 4px grid
- Border radius: sm=4px, md=8px, lg=12px, xl=16px
- Modal sizing: sm=400px, md=600px, lg=800px, xl=1000px
- Breakpoints: sm=640, md=768, lg=1024, xl=1280, 2xl=1536
- Typography rhythm: base=14px, scale=1.25
- Color tokens from design system — never raw hex in components

---

## 9. QubeTalk Coordination

**Channel:** `metame-runtime-thinclient`  
**Agents:** `claude-code`, `openai-codex` (Codex), `lovable-agent`

| Event | Thread | Severity |
|-------|--------|----------|
| Contract/schema ready for consumption | `spec` | info |
| API endpoint ready for Codex/Lovable | `api-wiring` | info |
| UI prop contract ready for Lovable | `ui-shell` | info |
| Story complete | `dev-exec` | info |
| Blocker | `dev-exec` | blocker |
| Architecture decision | `spec` | info |

---

## 10. Security Posture

- No production credentials in code
- All secrets in `.env.local` (server-side) or Amplify environment variables
- `SUPABASE_SERVICE_ROLE_KEY` is never `NEXT_PUBLIC_`
- Hooks enforce: no prod DB writes, no live wallet access, no unmanaged secrets
- Guardian cannot be bypassed by cartridge or specialist agents
