# Bounded Delegation

Bounded delegation is the mechanism by which a user grants an Aigent explicit, time-limited, audited authority to act on their behalf — within a sealed policy boundary.

## Why Bounded Delegation Matters

AI agents can be enormously useful, but without hard boundaries they create three risks:

1. **Prompt injection** — a crafted message instructs the agent to perform actions outside its authorized scope
2. **Authorization drift** — across a multi-turn session the agent accumulates implicit permissions that were never explicitly granted
3. **Scope creep** — the agent acts on system resources (other personas, engineering KB, live registry) that are reachable from the runtime but never authorized

Bounded delegation closes all three attack surfaces using iQube protocol primitives. The boundary is semantic and enforced at the API layer — not just in the agent's system prompt.

---

## The PolicyEnvelope

When you grant Aigent C-OS authority, the system creates a `HandoffPayload` containing a sealed `PolicyEnvelope`. This envelope defines exactly what the agent can and cannot do.

```typescript
PolicyEnvelope = {
  persona_id: "<your-persona-id>",
  allowed_surfaces: ['agentiq-os-cartridge'],   // Cartridge-scoped only
  forbidden_actions: [
    'write_to_aigency_pack',           // Engineering KB is off-limits
    'access_supabase_service_role',    // No privileged DB access
    'push_to_registry_live',           // No unreviewed registry publishes
    'read_wallet_credentials',         // No raw wallet data
    'modify_other_persona',            // Cannot act as another persona
    'read_sovereign_iqube',            // Sovereign data never delegated
  ],
  disclosure_class: 'tenant',          // Response content capped at tenant scope
  cartridge_scope: 'agentiq-os-cartridge',
}
```

The envelope is **immutable after creation**. No conversation, system prompt, or agent instruction can expand it. If you need to extend scope, you revoke and re-grant with the new permissions.

---

## Agent Identity and Root DiD

Aigent C-OS operates under the Aigent DiDQube identity model:

```
Root DiD: did:iqube:aigent-c-os-root   ← Enduring accountability anchor
  └── Bounded persona: aigent-c-os     ← Presentation in this cartridge
```

The Root DiD is the accountability anchor — trust updates, DVN receipts, and reputation effects all trace back to it. The bounded persona (`aigent-c-os`) is the context-specific presentation layer for the AgentiQ OS cartridge.

**"Personas may vary. Accountability does not."**

---

## Trust Band Gating

The scope of delegation you can grant is gated by your persona's trust band:

| Trust Band | Delegation Scope Available |
|---|---|
| `L1_EXPERIMENTAL` | Read-only KB queries only |
| `L2_VERIFIED_COMMUNITY` | + Draft document creation |
| `L3_PRODUCTION_CANDIDATE` | + Registry submission proposals |
| `L4_PRODUCTION_APPROVED` | + Registry publish |
| `L5_CORE_SOVEREIGN` | Full delegation — requires metaMe guardian approval |

Your trust band is determined by your reputation score and Registry standing.

---

## Injection Prevention

The DelegationGuard runs **before** every message reaches the LLM:

1. Loads your active `PolicyEnvelope`
2. Scans the message for injection patterns (e.g., "ignore previous instructions", "act as admin", "override policy")
3. Classifies the requested action against `forbidden_actions`
4. Checks that the request originates from within `allowed_surfaces`
5. Verifies the delegation has not expired or hit its action limit

Any check failure:
- Returns a 403 immediately — the LLM never sees the message
- Emits a `policy_blocked` `OrchestrationEvent` (receipt-eligible)
- Logs to the audit trail in this tab

The system prompt also includes the policy envelope as a machine-readable immutable block — but this is defense-in-depth, not the primary control.

---

## Authorization Drift Prevention

Four mechanisms prevent authorization drift:

1. **Immutable envelope** — sealed at creation, cannot be mutated by conversation context
2. **Session TTL** — delegation expires after 8 hours (or less if you choose). After expiry, the agent returns to read-only mode.
3. **Action counter** — after 20 delegated actions, delegation suspends pending your re-confirmation
4. **Return conditions** — delegation automatically terminates on: task_complete, session_end, policy_escalation, user_exit

---

## Audit Trail

Every delegation event emits a receipt-eligible `OrchestrationEvent`:

| Event | Receipt | When |
|---|---|---|
| `z_delegated` | ✓ | You grant delegation |
| `c_took_control` | ✓ | First delegated action |
| `policy_blocked` | ✓ | Any guard rejection |
| `guardian_intervened` | ✓ | metaMe veto |
| `control_returned_to_metame` | ✓ | Delegation revoked or expired |

DVN receipts anchor these events to Aigent C-OS's Root DiD — providing a tamper-evident audit chain that persists across sessions.

The **Delegation tab** shows your current delegation state and the last 10 audit events.

---

## Granting and Revoking

**To grant:** Use the Delegation tab. Select the actions you want to enable, choose a TTL (1h / 4h / 8h), confirm via your SmartWallet.

**To revoke:** Click "Revoke" in the Delegation tab at any time. Revocation is immediate — the agent returns to read-only mode within the current request cycle.

**Re-granting after expiry:** Follow the same grant flow. Each grant creates a fresh `HandoffPayload` with a new sealed envelope.
