# Governed Agent Invocation — Design Pass (Phase 4 of the Agent Bench / aigentMe Specialist Orchestration brief)

**Date:** 2026-08-06
**Status:** Design only — produced before coding, per operator instruction. No code in this pass. Extends `services/registry/invocationGateway.ts`; does **not** build a third gate (inv.engineering.036/037).
**Scope of the first implementation:** `aigentMe → MoneyPenny → Nakamoto`, `preview`/`shadow` execution modes only. No authoritative money-moving execution. No generic multi-agent planning, autonomous payments, or cross-domain orchestration.

This doc answers the operator's nine required items in order.

---

## 1. Current `invocationGateway.ts` contract and its three gates

`services/registry/invocationGateway.ts::invokeAsset(req: InvocationRequest): Promise<InvocationResult>` is the existing single governed entry point for **asset** invocation. Verified from the live file (2026-08-06):

```ts
interface InvocationRequest {
  assetId: string;
  invokedBy: string;
  tenantId: string;
  input: Record<string, unknown>;
  wrapperOverride?: WrapperStrategy;
}
interface InvocationResult {
  ok: boolean;
  invocationId?: string;
  output?: Record<string, unknown>;
  status: "completed" | "failed" | "blocked_policy" | "blocked_approval" | "deferred";
  error?: string;
}
```

The three gates run in this order, each able to short-circuit before any dispatch:

1. **Publication gate** — `asset.publicationStatus !== "published"` → `blocked_policy`.
2. **Human-approval gate** — `asset.policyClass === "human_approval_required"` → `blocked_approval`.
3. **SkillQube alpha-posture gate** — for `assetClass === "SkillQube"`, delegates to `evaluateSkillQubePolicy()` (`services/policy/skillQubePolicyGate.ts`) → `blocked_policy` on refusal.

After the gates: it generates an `invocationId`, hashes `input`, records `registry_invocations` (start), dispatches via `dispatchWrapper()` (a `switch` over `WrapperStrategy`: `http | skill | workflow | mcp | cli_container | browser`, each a named function), records the end state + output hash, and emits one receipt (`emitReceipt({eventType:'asset.invoked', ...})`). This request→gate→dispatch→record→receipt shape is exactly the shape the operator's brief asks agent invocation to reuse.

**What this gateway does NOT do today:** resolve a human principal, resolve a delegation chain, resolve a caller/orchestrator/target agent triple, bound context, or guard against invocation recursion. All five are net-new surface for the `agent` mode below — additive, not a replacement of the asset-mode gates.

---

## 2. Proposed discriminated envelope

Adopt the operator's envelope verbatim, added as a second member of a new discriminated union that the asset shape joins:

```ts
export type GovernedInvocation = AssetInvocation | AgentInvocation;

// AssetInvocation is InvocationRequest given an explicit mode tag —
// existing callers are unaffected; the tag is additive (see §7).
export interface AssetInvocation extends InvocationRequest {
  mode: 'asset';
}

export interface AgentInvocation {
  mode: 'agent';

  invocationId: string;

  principalRef: string;
  personaRef?: string;
  passportRef?: string;

  originatingSurface: 'aigentme' | 'wallet-copilot' | 'financial-services' | 'agent-bench' | string;

  orchestratorAgentId: string;
  callerAgentId: string;
  targetAgentId: string;

  capabilityId: string;
  runtimeMembershipRef: string;

  executionMode: 'preview' | 'shadow' | 'authoritative';

  intent: string;
  input: Record<string, unknown>;

  delegationRef?: string;
  policyBindingRefs: string[];

  contextRefs?: string[];

  // Loop/depth guard (§5) — required, not optional, so a caller cannot omit
  // its way past the gate.
  delegationDepth: number;
  invocationPath: string[];
  maxInvocationDepth: number;
}

export type InvocationDecision =
  | { decision: 'allow'; envelope: ExecutionEnvelope }
  | { decision: 'allow-with-approval'; approvalRequest: ApprovalRequest }
  | { decision: 'shadow-only'; reason: string }
  | { decision: 'refuse'; code: string; reason: string };
```

**Resolution, never free text.** `targetAgentId`/`capabilityId`/`runtimeMembershipRef` are never taken as caller-supplied opaque strings and executed directly — each is resolved against the canonical registry record (`getAsset()`, `resolveRegistrableAgentByRuntimeId()`, the Agent Bench read model's `runtimeMemberships`) before dispatch. A caller proposing an unregistered `targetAgentId` or an unresolvable `capabilityId` fails Gate 2 (§4), never reaches a URL of its own choosing. This is the direct answer to "do not accept an unconstrained arbitrary agent URL from the caller."

---

## 3. Authority / delegation trace

The chain the operator specified:

```
Human principal → aigentMe → domain orchestrator → helper agent → capability
```

is resolved, not asserted, from records this codebase already has:

| Link | Resolved from |
|---|---|
| Human principal | `getActivePersona(request)` → `persona.personaId` (T0, server-internal — `principalRef` in the envelope is the T1-safe `personaPublicRef()` projection, per the Identity & Access Spine's three-level reference model — never the raw persona UUID network-bound) |
| aigentMe's standing authorization | the persona's active session — no separate delegation record needed; aigentMe acting for its own principal is the platform baseline, not a delegated act |
| Domain orchestrator (MoneyPenny) | `resolveRegistrableAgentByRuntimeId('aigent-moneypenny')` + `resolveAgentAdmissionState()` — MoneyPenny must show `delegationActive === true` under the SAME principal's session; her `runtimeMembershipRef` must resolve to an `'active'` or `'approved'` Financial Services membership (`agentBenchReadModel.ts::buildFinancialServicesMembership`) |
| Helper agent (Nakamoto) | `resolveRegistrableAgentByRuntimeId('aigent-nakamoto')` + her own `AgentAdmissionState` — verified as a **registered target the platform already knows**, never a delegate of MoneyPenny's |
| Capability | resolved against `registryAsset.capabilities` (`getAsset()`) — must be a capability Nakamoto's registry asset actually declares |

**The one-degree rule, made concrete:** `delegationRef` on an `AgentInvocation` always names a grant whose principal is the human, never a grant MoneyPenny herself issued. Gate 1 (§4) explicitly checks this: it resolves `delegationRef` back to `agentAdmissionState.ts`'s admission-fact reader for the **calling** agent (MoneyPenny) under the **principal's own session**, and separately confirms the **target** agent (Nakamoto) is independently registered and admitted — never that MoneyPenny delegated to her. MoneyPenny calling Nakamoto is authorized because the principal's session already covers the governed Financial-Services service chain that names Nakamoto as an eligible helper for the invoked capability — not because MoneyPenny, as an agent, created new authority. No code path in this design ever writes a delegation record where the grantor is a non-human agent.

---

## 4. Gateway checks (the three gates, agent-dispatch form)

**Gate 1 — Identity and authority.**
- `callerAgentId` and `targetAgentId` both resolve to canonical `RegistrableAgentConfig` entries (`services/horizen/registrableAgents.ts`) — refuse (`code: 'UNKNOWN_AGENT'`) otherwise.
- `principalRef` resolves to an active persona (`getActivePersona`) — refuse (`code: 'PRINCIPAL_UNRESOLVED'`) otherwise.
- The caller's own `AgentAdmissionState.delegationActive === true` under that principal — refuse (`code: 'CALLER_NOT_DELEGATED'`) otherwise.
- `orchestratorAgentId === callerAgentId` for this narrow phase (MoneyPenny always both orchestrates and calls in the first implementation) — a future phase that separates the two roles gets a new, explicitly-designed check, not an implicit widening.
- `delegationRef`, when present, is re-resolved (never trusted from the envelope alone) and must belong to the resolved principal — refuse (`code: 'DELEGATION_MISMATCH'`) otherwise.
- The target agent is independently admitted (its own `AgentAdmissionState`, not derived from the caller's) — refuse (`code: 'TARGET_NOT_ADMITTED'`) otherwise. This is the concrete enforcement of "non-human agents are not creating new authority or redelegating."

**Gate 2 — Capability and runtime eligibility.**
- `targetAgentId`'s registry asset (`getAsset()`) declares `capabilityId` — refuse (`code: 'CAPABILITY_NOT_DECLARED'`) otherwise.
- The capability's descriptor is not disabled/deprecated — refuse (`code: 'CAPABILITY_INACTIVE'`).
- `runtimeMembershipRef` resolves to a membership on the target with `status` in `{'active','approved'}` for `executionMode !== 'preview'`; `preview` is permitted against any resolvable membership regardless of status, since a preview call has no side effects to gate — refuse (`code: 'RUNTIME_NOT_ELIGIBLE'`) otherwise.
- `executionMode` is one of the modes the capability's policy binding actually allows (§4 Gate 3 supplies the binding; this check is `requestedMode ⊆ allowedModes`) — refuse (`code: 'MODE_NOT_PERMITTED'`).
- Pulse/P&L: read as **signals attached to the capability's policy binding**, never a universal predicate on the target agent. A policy binding may name `requiresPulse: true` / `requiresPnl: true` for a specific capability + mode pair (e.g. `authoritative` treasury execution); a binding that omits them imposes no such requirement (e.g. `preview`/`shadow` advisory analysis). This directly encodes the operator's example (`bitcoin_decentralisation_expertise` in `preview`/`shadow` — no Pulse required) without hard-coding an exemption list.

**Gate 3 — Policy and consequence.**
- Evaluate the resolved `policyBindingRefs` for the capability + mode pair — mirrors `evaluateSkillQubePolicy()`'s existing shape (policy class × trust band × cartridge scope), extended with the agent-specific fields above.
- `authoritative` mode on any binding that declares `requiresHumanApproval: true` → `{decision: 'allow-with-approval', approvalRequest}` rather than `allow`. In this phase's narrow scope (`preview`/`shadow` only), no binding reachable from `aigentMe → MoneyPenny → Nakamoto` is ever evaluated in `authoritative` mode — Gate 2's `MODE_NOT_PERMITTED` check refuses any attempt before Gate 3 is reached.
- Spend/settlement/wallet-authority checks reuse the existing `PolicyEnvelope`/spend-cap primitives (`services/constitutional/constitutionalAgreement.ts`, P3's `spendWithinCap`) — never a second cap mechanism. Out of scope for this phase's decision surface (no money-moving capability is reachable), but the binding shape must reserve the field so a later phase does not need to widen the envelope.
- A binding whose risk profile calls for observation-only routing returns `{decision: 'shadow-only', reason}` — the SAME distinction `constitutionalServicePipeline.ts` already makes between `shadow` (records what would happen, zero side effects) and `authoritative` (executes).

---

## 5. Context-sharing contract

The gateway derives the **bounded grounding slice** — it is never the caller's responsibility to redact, and the parent conversation is never forwarded by default:

- `contextRefs?: string[]` on the envelope names *references* (e.g. an intent id, a capability-relevant fact id) — never inline conversation history.
- The gateway resolves each ref against the SAME grounding primitive the platform already has for bounded, purpose-scoped context: `buildInvariantSlice`/`GroundingContext` (`services/invariants/grounding.ts`) for invariant-shaped context, and a minimal per-capability "required fields" list declared on the capability descriptor for structured facts (e.g. "the treasury architecture question and its stated constraints," never "the user's full wallet history").
- The **resolved** slice — not the request — is what the target agent's runtime actually receives. The envelope records, for audit, exactly what was resolved and why (`contextRefs` echoed back with a one-line justification per ref), so "Nakamoto received X because Y" is always answerable from the receipt (§6), not just from code inspection.
- Default with no `contextRefs` supplied: the minimum viable slice for the named `capabilityId` and nothing else — never "whatever aigentMe currently has in memory."

---

## 6. Loop / depth policy

Fields, already present on the envelope (§2): `delegationDepth: number`, `invocationPath: string[]`, `maxInvocationDepth: number`.

Enforcement, evaluated in Gate 1 before any resolution work:

- `invocationPath` must not already contain `targetAgentId` — refuse (`code: 'CIRCULAR_INVOCATION'`) otherwise.
- `callerAgentId === targetAgentId` — refuse (`code: 'SELF_INVOCATION'`).
- `delegationDepth >= maxInvocationDepth` — refuse (`code: 'DEPTH_EXCEEDED'`).
- **First-phase `maxInvocationDepth` is fixed at 2**, matching the operator's stated initial rule (`aigentMe → domain expert → helper`, depth 0 → 1 → 2): aigentMe issuing the call is depth 0, MoneyPenny→Nakamoto is depth 1. Nakamoto is not permitted to call a further agent in this phase — Gate 1 refuses any `AgentInvocation` where `callerAgentId === 'aigent-nakamoto'` outright (`code: 'HELPER_MAY_NOT_ORCHESTRATE'`), independent of the depth counter, so the restriction survives even if a future phase raises `maxInvocationDepth` for other chains.
- The gateway appends `targetAgentId` to `invocationPath` and increments `delegationDepth` itself before any downstream call it makes on the envelope's behalf — a caller cannot under- or over-report either field to influence the check, since the gateway is the sole writer of both on the outbound leg.

---

## 7. Compatibility assessment for existing asset invocation

**No change to `AssetInvocation` behavior.** `invokeAsset()`'s existing three gates, dispatch table, and `registry_invocations`/`asset.invoked` receipt are untouched. The only structural change is wrapping the existing `InvocationRequest` shape in `{mode: 'asset', ...req}` at the discriminated-union boundary — every existing caller of `invokeAsset(req)` keeps calling it with the exact same shape it uses today; the `mode` tag is populated by the gateway's own dispatcher, not by callers. `AgentInvocation` is a new sibling function, e.g. `invokeAgent(req: AgentInvocation)`, sharing the module and its receipt/logging conventions but not the asset-specific dispatch table.

**Existing specialist path — NOT touched by this phase, flagged for a follow-on.** Today, `aigentMe → Nakamoto` (the direct specialist consultation) runs entirely outside any gateway: `app/api/assistant/ask-agent/route.ts` → `askSpecialist({specialistId:'aigent-nakamoto', ...})` (`services/agents/specialistRouter.ts`), and `/api/agents/nakamoto/invoke` forwards verbatim into that same handler. Per the operator's explicit instruction, **this path is preserved unchanged** — a human's direct consultation with Nakamoto must never be forced through MoneyPenny. It does NOT yet enter the new `invokeAgent()` gateway in this phase.

This is a real, disclosed gap against acceptance criterion #9 ("A direct Bench call to Nakamoto passes through the same gateway") and the closing requirement that ALL Nakamoto invocations resolve one shared contract. The reconciling design, deferred to the follow-on phase named in §9's scope note: `askSpecialist`'s Nakamoto branch and `/api/agents/nakamoto/invoke` both come to call `invokeAgent()` with `orchestratorAgentId = callerAgentId = 'aigent-me'` (aigentMe's own runtime id) and `originatingSurface` set per caller (`'aigentme'` for the panel, `'agent-bench'` for a direct Bench action) — the SAME gate, capability resolution, and receipt path as the MoneyPenny-orchestrated call, just with `orchestratorAgentId === callerAgentId` (no intermediate domain expert) and depth 1 instead of 2. Because Gate 1/2/3 above already work in terms of resolved agent ids rather than a fixed three-hop shape, this extension requires no gate redesign — only wiring `askSpecialist`'s Nakamoto branch to call through `invokeAgent()` instead of calling the LLM chain directly. **Not built in this pass** — named here so it is not silently forgotten, per this repo's Resolution → Invariant Loop discipline.

---

## 8. Exact minimal code surface (for the follow-on coding pass)

| File | Change | Kind |
|---|---|---|
| `services/registry/invocationGateway.ts` | Add `GovernedInvocation`/`AssetInvocation`/`AgentInvocation`/`InvocationDecision` types; add `invokeAgent(req: AgentInvocation): Promise<InvocationDecision>` implementing Gates 1-3 (§4) + depth/loop guard (§6); existing `invokeAsset` unchanged | Additive |
| `services/registry/agentInvocationGates.ts` (new) | The three gate functions, factored out for isolated testing — mirrors how `evaluateSkillQubePolicy` is its own module rather than inlined in `invokeAsset` | New, small |
| `types/registryIngestion.ts` or a new `types/agentInvocation.ts` | The envelope + decision types (§2) | New types only |
| `services/receipts/activityReceiptService.ts` | Add 4 `ActivityActionType` union members: `agent_invocation_requested`, `agent_invocation_authorized`, `agent_invocation_refused`, `agent_invocation_completed` — same extension point already used for `specialist_consulted` | Additive, one line each |
| `services/dvn/activityReceiptDvnPipeline.ts` | Add the 4 new types to `ANCHORABLE_ACTION_TYPES` — the ONE unilateral change this file permits per its own header | Additive, explicitly pre-authorized |
| MoneyPenny's proposal path (wherever she decides to call a helper — new, not yet built) | Calls `invokeAgent()` instead of calling Nakamoto's runtime directly | New call site |
| Agent Bench's existing direct-call action | Repoint to `invokeAgent()` with `orchestratorAgentId === callerAgentId === 'agent-bench-operator'` semantics, i.e. no domain-expert hop | Rewire, no new mechanism |

Nothing else changes. No new database table is required for the first phase — `registry_invocations` gains rows the same way it does for asset invocations (the `mode` field distinguishes them), and the 4 new receipt types ride the existing `activity_receipts` table.

---

## 9. OS-9 canaries (to accompany the coding pass, not written here)

Each canary proves the gate *catches* the failure, not merely that the happy path works:

1. **Direct endpoint bypass** — a test that calls Nakamoto's underlying runtime mechanism directly (bypassing `invokeAgent()`) and asserts that path is *only* reachable from the two explicitly-preserved callers (`ask-agent` direct specialist route, `/invoke`'s verbatim forward) — i.e. a static/import-graph assertion that no NEW call site reaches `askSpecialist`/the runtime invoke handler except through `invokeAgent()` or the two named legacy paths. Mirrors this repo's existing "grep for a forbidden call shape" canary style (e.g. `tests/persona-spine-fetch.test.ts`).
2. **Capability mismatch** — `invokeAgent()` with a `capabilityId` the target's registry asset does not declare → asserts `{decision:'refuse', code:'CAPABILITY_NOT_DECLARED'}`, and that no receipt of type `agent_invocation_authorized` or `agent_invocation_completed` was written (only `agent_invocation_refused`).
3. **Delegation-depth violation** — `invocationPath` already containing the target → `CIRCULAR_INVOCATION`; `delegationDepth >= maxInvocationDepth` → `DEPTH_EXCEEDED`; `callerAgentId === 'aigent-nakamoto'` attempting to call a third agent → `HELPER_MAY_NOT_ORCHESTRATE`. Three separate assertions, not one combined test, so a future change to one rule cannot silently weaken another.
4. **Unauthorized context sharing** — a request whose `contextRefs` resolve to fields outside the target capability's declared minimum-context list → asserts the resolved slice actually delivered to the target excludes those fields (inspect the envelope's recorded "what was shared and why," §5) — never merely that the request was accepted.

These are specified, not implemented, per the operator's "produce before coding" instruction — they are the acceptance bar the coding pass must satisfy, written before any implementation exists to make them trivially pass.

---

## Scope note — what this pass deliberately does not do

- No `authoritative` execution mode is reachable from any gate above for the first implementation — Gate 2's `MODE_NOT_PERMITTED` refuses it structurally, not by convention.
- No second orchestrator, no helper-calls-helper chain, no cross-domain (non-Financial-Services) runtime is in scope.
- The pre-existing direct `aigentMe → Nakamoto` consultation path is preserved exactly as it behaves today; its migration onto `invokeAgent()` is named in §7 as a disclosed follow-on, not silently deferred.
- MoneyPenny's own decision logic for *when* to call Nakamoto (vs. answer directly) is out of scope for this design — it is a MoneyPenny-side proposal that the gateway then governs, per the operator's "MoneyPenny proposes the team and invocation. The gateway governs it." MoneyPenny is the required orchestrator only for the Financial-Services orchestration path or multi-helper composition; she is never inserted in front of an explicit direct Nakamoto consultation.
