# Bounded Delegation

Bounded delegation is the mechanism by which a user grants any Aigent — a platform agent like Aigent C, or a custom agent you build — explicit, time-limited, audited authority to act on their behalf, within a sealed policy boundary.

## Why Bounded Delegation Matters

AI agents can be enormously useful, but without hard boundaries they create three risks:

1. **Prompt injection** — a crafted message instructs the agent to perform actions outside its authorized scope
2. **Authorization drift** — across a multi-turn session the agent accumulates implicit permissions that were never explicitly granted
3. **Scope creep** — the agent acts on system resources (other personas, engineering KB, live registry) that are reachable from the runtime but never authorized

Bounded delegation closes all three attack surfaces using iQube protocol primitives. The boundary is semantic and enforced at the API layer — not just in the agent's system prompt.

---

## The PolicyEnvelope

When you grant an agent authority, the system creates a `HandoffPayload` containing a sealed `PolicyEnvelope`. This envelope defines exactly what the agent can and cannot do — regardless of whether it is a platform agent (Aigent C) or a custom agent you built.

```typescript
PolicyEnvelope = {
  persona_id: "<your-persona-id>",
  agent_did: "did:iqube:<agent-root>",         // The agent being delegated to
  allowed_surfaces: ['agentiq-os-cartridge'],   // Which cartridges the agent may access
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
  max_actions: 20,                     // Action limit before re-confirmation required
}
```

The envelope is **immutable after creation**. No conversation, system prompt, or agent instruction can expand it. If you need to extend scope, you revoke and re-grant with the new permissions.

---

## Bounding Custom Agents You Build

The same protocol works for agents you build using the AgentiQ SDK. When you register a new agent in the registry:

1. **The agent receives a Root DiD** — `did:iqube:<your-agent-id>` — which is its persistent identity across all sessions.
2. **You become the delegating authority** — your persona signs the initial `HandoffPayload`, binding your disclosure ceiling to the agent's behaviour.
3. **The agent operates within your PolicyEnvelope** — `allowed_surfaces` constrains which cartridges it can touch; `forbidden_actions` blocks dangerous API calls at the gateway.

```typescript
// Register a custom agent
const agent = await AgentiQClient.agents.register({
  name: 'my-research-agent',
  root_did: 'did:iqube:my-research-agent-root',
  cartridge_scope: 'agentiq-os-cartridge',
});

// Grant delegation — same flow as any platform agent
await AgentiQClient.delegation.grant({
  persona_id: myPersonaId,
  agent_did: agent.root_did,
  trust_band: 'L2_VERIFIED_COMMUNITY',
  allowed_surfaces: ['agentiq-os-cartridge'],
  ttl_hours: 4,
  max_actions: 20,
});
```

The platform treats your custom agent identically to Aigent C: every action it takes emits a DVN receipt anchored to both your Root DiD (authoriser) and the agent's Root DiD (actor).

---

## Human Persona vs Agent Persona — Two Identity Models, One Contract

Bounded delegation is the contract that binds these two identity models together. See [Identity Sovereignty](./identity-sovereignty.md) for the full four-layer model; the relevant contrast for delegation is:

### Human (you)

```
Root DiD: did:iqube:<your-root>           ← The user's enduring identity
  ├── PersonaQube (anonymous)             ← Browse / read-only context
  ├── PersonaQube (semi-anonymous)        ← Build / publish context
  └── PersonaQube (verified)              ← Reputation-bearing context
```

A human chooses **which persona is active** when they grant delegation. The agent inherits that persona's disclosure class — not the user's full identity. This is how you keep your sovereign data sealed while still enabling agentic action.

### Agent (Aigent C, or any custom agent you register)

```
Root DiD: did:iqube:<agent-root>          ← The agent's enduring identity
  └── Bounded persona: <agent>@<surface>  ← How the agent appears inside one cartridge
```

Any agent — platform or custom — has its own Root DiD. When it acts under your delegation, every action emits a DVN receipt that anchors to **both** identities — yours (which authorised it) and the agent's (which performed it). This dual-anchor receipt is what lets reputation flow correctly to both parties.

For custom agents you register via the SDK, the Root DiD is generated at registration time and is immutable. This means you can identify exactly which version of your agent performed a delegated action, even after you've deployed a new version.

### How identity states bind across the delegation

When you grant delegation:

1. The system reads your active persona's disclosure class (e.g. `tenant`, `peer`, `community`, `public`)
2. Writes that class into the agent's `PolicyEnvelope.disclosure_class`
3. The agent's responses can never exceed that class — even if a downstream tool would otherwise return more data

This is how your identity state is **preserved across delegation** rather than collapsed into the agent's identity. The agent acts within your disclosure ceiling, not its own.

**"Personas may vary. Accountability does not."**

---

## Scope Binding and Enforcement

Agent scope is bound at two layers:

| Layer | Bound by | Enforced by |
|---|---|---|
| Cartridge surface | `allowed_surfaces` in PolicyEnvelope | API gateway — rejects requests from outside scope |
| Action class | `forbidden_actions` in PolicyEnvelope | DelegationGuard — rejects forbidden actions before LLM |
| Disclosure ceiling | `disclosure_class` from your persona | Response filter — caps payload sensitivity |
| Time | TTL (1h / 4h / 8h) | Session manager — auto-revokes on expiry |
| Volume | Action counter (default 20) | DelegationGuard — pauses for re-confirmation |

### Reputation as a feedback signal

Every delegated action's outcome updates the agent's Root DiD reputation:

- `policy_blocked` → reputation flag against the agent
- `c_took_control` followed by `task_complete` → reputation credit
- `guardian_intervened` → reputation hit + escalation record

Trust band is a function of reputation score. **Higher reputation unlocks broader delegation scopes** (see Trust Band Gating below). This creates a built-in incentive: well-behaved agents earn the right to do more.

### DVN receipts as the tamper-evident chain

Every lifecycle event in delegation emits a receipt that is:

- Anchored to both Root DiDs (yours and the agent's)
- Signed cryptographically before persistence
- Replayable for audit — you can reconstruct any session's full action chain

The audit trail in the Aigent Delegates tab is just the queryable view of these receipts.

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

DVN receipts anchor these events to the agent's Root DiD — providing a tamper-evident audit chain that persists across sessions. For custom agents, this means you can audit the full action history of any agent you deployed, by Root DiD.

The **Delegation tab** shows your current delegation state and the last 10 audit events.

---

## Granting and Revoking

**To grant:** Use the Aigent Delegates tab. Select the agent, the surfaces it may access, the actions you want to enable, and choose a TTL (1h / 4h / 8h). Confirm via your SmartWallet.

**To revoke:** Click "Revoke" in the Aigent Delegates tab at any time. Revocation is immediate — the agent returns to read-only mode within the current request cycle.

**Re-granting after expiry:** Follow the same grant flow. Each grant creates a fresh `HandoffPayload` with a new sealed envelope.

**For custom agents:** Use the same tab or the SDK's `AgentiQClient.delegation.grant()` method programmatically. The grant API is agent-agnostic — any registered Root DiD can receive delegation.
