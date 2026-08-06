# Governed Capability Invocation — Design Pass (Phase 4 of the Agent Bench / aigentMe Specialist Orchestration brief)

**Date:** 2026-08-06 (revised same day — operator correction, §0)
**Status:** Design only — produced before coding, per operator instruction. No code in this pass. Extends `services/registry/invocationGateway.ts`; does **not** build a third gate (inv.engineering.036/037).
**Scope of the first implementation:** `aigentMe → MoneyPenny → Nakamoto`, `preview`/`shadow` execution modes only, for the `bitcoin_decentralisation_expertise` capability. No authoritative money-moving execution. No generic multi-agent planning, autonomous payments, or cross-domain orchestration.

This doc answers the operator's nine required items in order, revised per §0.

---

## 0. Revision note — governed CAPABILITY invocation, not governed AGENT invocation

Two corrections, both structural, applied throughout this revision:

**Not every invocation has an orchestrator.** The first draft required `orchestratorAgentId`, which silently assumed every call is a three-hop `aigentMe → domain expert → helper` chain. It isn't — a human's direct aigentMe specialist consultation (`Person → Nakamoto`, no MoneyPenny) is an equally valid, equally first-class pattern. The envelope now carries `requestingAgentId` (required — who is making this specific call) and `orchestratorAgentId` (optional — present only when a domain orchestrator sits between the request and the target):

| Pattern | `requestingAgentId` | `orchestratorAgentId` | `targetAgentId` (resolved, §2) |
|---|---|---|---|
| Direct specialist | `aigent-nakamoto` | *absent* | `aigent-nakamoto` (requester === target) |
| Orchestrated (Financial Services) | `aigent-moneypenny` | `aigent-moneypenny` | `aigent-nakamoto` |

**The runtime governs a capability, not a named agent.** `invokeAgent()`'s job is never "call Nakamoto" — it is "call whoever currently implements `bitcoin_decentralisation_expertise`." Routing becomes `Intent → Capability → current implementation → Runtime endpoint`, not `Intent → Agent → Endpoint`. This matters because capability implementations can move, more than one agent can implement the same capability, capability selection becomes a constitutional decision the gateway makes (not a hardcoded caller choice), and Agent Bench becomes the capability-provider registry rather than a list of agents. `targetAgentId` on the envelope is now a **hint**, not an instruction: the gateway resolves the current provider from `capabilityId` and cross-checks any caller-supplied hint against that resolution (§2, §4).

Every other section below is updated to this framing; where a rule from the first draft still holds unchanged, it says so rather than re-deriving it.

---

## 1. Current `invocationGateway.ts` contract and its three gates

Unchanged from the first draft — re-verified, not re-derived. `services/registry/invocationGateway.ts::invokeAsset(req: InvocationRequest): Promise<InvocationResult>` is the existing single governed entry point for **asset** invocation:

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

Three gates, in order, each able to short-circuit before dispatch: **(1) publication** (`publicationStatus !== "published"` → `blocked_policy`), **(2) human-approval** (`policyClass === "human_approval_required"` → `blocked_approval`), **(3) SkillQube alpha-posture** (`evaluateSkillQubePolicy()` → `blocked_policy` on refusal). After the gates: generate `invocationId`, hash `input`, record `registry_invocations` (start), dispatch via `dispatchWrapper()` (`http | skill | workflow | mcp | cli_container | browser`), record end state + output hash, emit one `asset.invoked` receipt. This request→gate→dispatch→record→receipt shape is exactly what capability invocation reuses.

**What this gateway does NOT do today:** resolve a human principal, resolve a delegation chain, resolve a capability to its current provider, resolve a requester/orchestrator/provider relationship, bound context, or guard against invocation recursion. All of this is net-new surface for the capability-invocation mode below — additive, not a replacement of the asset-mode gates.

---

## 2. Proposed discriminated envelope

```ts
export type GovernedInvocation = AssetInvocation | CapabilityInvocation;

// AssetInvocation is InvocationRequest given an explicit mode tag —
// existing callers are unaffected; the tag is additive (see §7).
export interface AssetInvocation extends InvocationRequest {
  mode: 'asset';
}

export interface CapabilityInvocation {
  mode: 'capability';

  invocationId: string;

  principalRef: string;
  personaRef?: string;
  passportRef?: string;

  originatingSurface: 'aigentme' | 'wallet-copilot' | 'financial-services' | 'agent-bench' | string;

  // §0 — requester is always present; orchestrator is present only when a
  // domain expert sits between the request and the resolved provider.
  requestingAgentId: string;
  orchestratorAgentId?: string;

  // §0 — the constitutional object being invoked. Resolution, never free
  // text: the gateway resolves the CURRENT provider from capabilityId; a
  // caller-supplied targetAgentId is a hint that must match that resolution
  // or the request is refused (PROVIDER_MISMATCH, §4), never a URL the
  // caller picks and the gateway rubber-stamps.
  capabilityId: string;
  targetAgentId?: string;

  runtimeMembershipRef: string;

  executionMode: 'preview' | 'shadow' | 'authoritative';

  intent: string;
  input: Record<string, unknown>;

  delegationRef?: string;
  policyBindingRefs: string[];

  contextRefs?: string[];

  // Loop/depth guard (§6) — required, not optional, so a caller cannot omit
  // its way past the gate.
  delegationDepth: number;
  invocationPath: string[];
  maxInvocationDepth: number;
}

export type InvocationDecision =
  | { decision: 'allow'; envelope: ExecutionEnvelope; resolvedProviderId: string }
  | { decision: 'allow-with-approval'; approvalRequest: ApprovalRequest }
  | { decision: 'shadow-only'; reason: string }
  | { decision: 'refuse'; code: string; reason: string };
```

**Resolution, never free text — now capability-first.** `capabilityId` resolves to its current provider via the SAME read model Agent Bench already builds (`agentBenchReadModel.ts` — §3's reframing). `runtimeMembershipRef` and the resolved provider's identity are derived from that resolution, never taken as caller-supplied opaque strings and executed directly. A caller proposing a `capabilityId` nobody currently provides, or a `targetAgentId` hint that disagrees with the resolved provider, fails Gate 2 (§4) before any dispatch. This is the direct answer to "do not accept an unconstrained arbitrary agent URL from the caller," now generalized to "do not accept an unconstrained arbitrary provider either."

---

## 3. Authority / delegation trace — and Agent Bench as the capability-provider registry

The chain the operator specified, generalized per §0 (orchestrator optional, provider resolved from capability rather than named directly):

```
Human principal → [requesting agent] → [domain orchestrator, if any] → resolved capability provider → capability
```

resolved, not asserted, from records this codebase already has:

| Link | Resolved from |
|---|---|
| Human principal | `getActivePersona(request)` → `persona.personaId` (T0 — `principalRef` in the envelope is the T1-safe `personaPublicRef()` projection, never the raw persona UUID network-bound) |
| Requesting agent | If it equals a resolved provider identity (direct specialist), no separate delegation record needed — the platform baseline covers a human's direct specialist consultation via aigentMe. If it is a domain orchestrator (MoneyPenny), see next row. |
| Domain orchestrator (MoneyPenny), when present | `resolveRegistrableAgentByRuntimeId('aigent-moneypenny')` + `resolveAgentAdmissionState()` — must show `delegationActive === true` under the SAME principal's session; her `runtimeMembershipRef` must resolve to an `'active'`/`'approved'` Financial Services membership |
| Resolved capability provider (e.g. Nakamoto) | **Capability-first resolution, not a caller-named agent**: query "who currently provides `capabilityId`" against the Agent Bench read model (below) — the result names the provider; a caller-supplied `targetAgentId` hint is cross-checked against it, never substituted for it |
| Capability | the resolved provider's registry asset (`getAsset()`) must actually declare `capabilityId` |

**Agent Bench, reframed.** Per the operator's correction, the Bench is not a list of agents — it is **the registry of governed capability providers**. Every Bench card already carries (Agent Bench §5, unchanged data, reframed reading): identity, capabilities (`row.capabilityDescriptors`, Phase 3), runtime memberships, Pulse/P&L, agreements (a proxy for Standing). The capability-resolution query this design needs — "who currently provides `bitcoin_decentralisation_expertise`" — is a **filter over existing Bench rows** (`capabilityDescriptors` containing that capability name, `lifecycleState === 'service-ready'` or `'engaged'`), not a new store. Today that filter returns exactly one row (Nakamoto) for the pilot capability; the design commitment is that returning more than one row later requires no caller-visible change — the gateway's resolution step, not the caller, decides among them (a future selection policy — trust band, Standing, health — is out of scope for this phase, which has exactly one provider to resolve to).

**The one-degree rule, made concrete (unchanged from the first draft in substance, reworded for the optional orchestrator):** when `orchestratorAgentId` is present, `delegationRef` always names a grant whose principal is the human, never a grant the orchestrator itself issued. Gate 1 (§4) resolves `delegationRef` back to `agentAdmissionState.ts`'s admission-fact reader for the orchestrator under the principal's own session, and separately confirms the resolved provider is independently registered and admitted — never that the orchestrator delegated to it. MoneyPenny calling into Nakamoto's capability is authorized because the principal's session already covers the governed Financial-Services chain that names that capability as in-scope — not because MoneyPenny, as an agent, created new authority. No code path in this design ever writes a delegation record where the grantor is a non-human agent.

---

## 4. Gateway checks (the three gates, capability-dispatch form)

**Gate 1 — Identity and authority.**
- `requestingAgentId` resolves to a canonical `RegistrableAgentConfig` (`services/horizen/registrableAgents.ts`) — refuse (`code: 'UNKNOWN_AGENT'`) otherwise.
- `principalRef` resolves to an active persona (`getActivePersona`) — refuse (`code: 'PRINCIPAL_UNRESOLVED'`) otherwise.
- If `orchestratorAgentId` is present: it equals `requestingAgentId` for this narrow phase (MoneyPenny always both orchestrates and requests in the first implementation — a future phase that separates the two roles gets a new, explicitly-designed check, not an implicit widening), and its own `AgentAdmissionState.delegationActive === true` under that principal — refuse (`code: 'ORCHESTRATOR_NOT_DELEGATED'`) otherwise.
- If `orchestratorAgentId` is absent (direct specialist pattern): `requestingAgentId` must equal the capability's resolved provider (§4 Gate 2) — refuse (`code: 'DIRECT_REQUEST_TARGET_MISMATCH'`) if a direct request names a capability it does not itself provide; this is the structural form of "a helper may not orchestrate" (§6) applied to the requester side.
- `delegationRef`, when present, is re-resolved (never trusted from the envelope alone) and must belong to the resolved principal — refuse (`code: 'DELEGATION_MISMATCH'`) otherwise.
- The resolved provider (§4 Gate 2) is independently admitted (its own `AgentAdmissionState`, never derived from the orchestrator's) — refuse (`code: 'PROVIDER_NOT_ADMITTED'`) otherwise. This is the concrete enforcement of "non-human agents are not creating new authority or redelegating."

**Gate 2 — Capability and runtime eligibility.**
- Resolve `capabilityId` to its current provider via the Agent Bench capability-provider filter (§3) — refuse (`code: 'CAPABILITY_NOT_PROVIDED'`) if no eligible row provides it.
- If the envelope carries a `targetAgentId` hint, it must equal the resolved provider — refuse (`code: 'PROVIDER_MISMATCH'`) otherwise (this is the concrete "do not accept an arbitrary target" gate, now phrased capability-first).
- The capability's descriptor on the resolved provider's registry asset is not disabled/deprecated — refuse (`code: 'CAPABILITY_INACTIVE'`).
- `runtimeMembershipRef` resolves to a membership on the resolved provider with `status` in `{'active','approved'}` for `executionMode !== 'preview'`; `preview` is permitted against any resolvable membership regardless of status, since a preview call has no side effects to gate — refuse (`code: 'RUNTIME_NOT_ELIGIBLE'`) otherwise.
- `executionMode` is one of the modes the capability's policy binding actually allows (Gate 3 supplies the binding; this check is `requestedMode ⊆ allowedModes`) — refuse (`code: 'MODE_NOT_PERMITTED'`).
- Pulse/P&L: read as **signals attached to the capability's policy binding**, never a universal predicate on the provider. A binding may name `requiresPulse: true` / `requiresPnl: true` for a specific capability + mode pair (e.g. `authoritative` treasury execution); a binding that omits them imposes no such requirement (e.g. `preview`/`shadow` advisory analysis) — directly encoding the operator's example (`bitcoin_decentralisation_expertise` in `preview`/`shadow` — no Pulse required) without a hard-coded exemption list.

**Gate 3 — Policy and consequence.**
- Evaluate the resolved `policyBindingRefs` for the capability + mode pair — mirrors `evaluateSkillQubePolicy()`'s existing shape, extended with the capability-resolution fields above.
- `authoritative` mode on any binding that declares `requiresHumanApproval: true` → `{decision: 'allow-with-approval', approvalRequest}` rather than `allow`. In this phase's narrow scope (`preview`/`shadow` only), no binding reachable from the pilot capability is ever evaluated in `authoritative` mode — Gate 2's `MODE_NOT_PERMITTED` check refuses any attempt before Gate 3 is reached.
- Spend/settlement/wallet-authority checks reuse the existing `PolicyEnvelope`/spend-cap primitives (`constitutionalAgreement.ts`, P3's `spendWithinCap`) — never a second cap mechanism. Out of scope for this phase's decision surface (no money-moving capability is reachable), but the binding shape must reserve the field so a later phase does not need to widen the envelope.
- A binding whose risk profile calls for observation-only routing returns `{decision: 'shadow-only', reason}` — the SAME distinction `constitutionalServicePipeline.ts` already makes between `shadow` and `authoritative`.

---

## 5. Context-sharing contract

Unchanged in substance from the first draft; the resolved entity receiving context is now "the resolved provider" rather than "the named target agent" — no other change:

- `contextRefs?: string[]` names *references* (an intent id, a capability-relevant fact id) — never inline conversation history.
- The gateway resolves each ref against `buildInvariantSlice`/`GroundingContext` (`services/invariants/grounding.ts`) for invariant-shaped context, and a minimal per-capability "required fields" list declared on the capability descriptor for structured facts (e.g. "the treasury architecture question and its stated constraints," never "the user's full wallet history").
- The **resolved** slice — not the request — is what the provider's runtime actually receives, with what-was-shared-and-why echoed onto the envelope for audit (§8).
- Default with no `contextRefs`: the minimum viable slice for `capabilityId` and nothing else.

---

## 6. Loop / depth policy

Unchanged fields and enforcement from the first draft, restated in capability terms where the distinction matters:

- `invocationPath` must not already contain the resolved provider — refuse (`code: 'CIRCULAR_INVOCATION'`).
- `requestingAgentId === ` resolved provider with `orchestratorAgentId` present is nonsensical (an orchestrator is, by definition, not the provider it's calling) — refuse (`code: 'SELF_INVOCATION'`) if it occurs.
- `delegationDepth >= maxInvocationDepth` — refuse (`code: 'DEPTH_EXCEEDED'`).
- **First-phase `maxInvocationDepth` is fixed at 2**: aigentMe/the human-facing surface issuing the request is depth 0, MoneyPenny→(resolved provider) is depth 1. A resolved provider (Nakamoto) is not permitted to itself become a requester in this phase — Gate 1 refuses any `CapabilityInvocation` where `requestingAgentId === 'aigent-nakamoto'` **and** `orchestratorAgentId` is present outright (`code: 'PROVIDER_MAY_NOT_ORCHESTRATE'`; a direct specialist request, where Nakamoto is both requester and resolved provider with no orchestrator, is unaffected — that is the valid direct pattern, not a violation), independent of the depth counter, so the restriction survives even if a future phase raises `maxInvocationDepth` for other chains.
- The gateway appends the resolved provider to `invocationPath` and increments `delegationDepth` itself before any downstream call it makes on the envelope's behalf — a caller cannot under- or over-report either field to influence the check.

---

## 7. Compatibility assessment for existing asset invocation — and the direct specialist path (§0 closes most of this gap)

**No change to `AssetInvocation` behavior.** `invokeAsset()`'s existing three gates, dispatch table, and `registry_invocations`/`asset.invoked` receipt are untouched. The only structural change is wrapping the existing `InvocationRequest` shape in `{mode: 'asset', ...req}` at the discriminated-union boundary — every existing caller keeps calling `invokeAsset(req)` with the exact same shape it uses today. `CapabilityInvocation` is a new sibling function, `invokeCapability(req: CapabilityInvocation)`, sharing the module and its receipt/logging conventions but not the asset-specific dispatch table.

**Existing specialist path — now representable in this same design, not a deferred gap.** The first draft treated the direct `aigentMe → Nakamoto` consultation (`app/api/assistant/ask-agent/route.ts` → `askSpecialist({specialistId:'aigent-nakamoto', ...})`, and `/api/agents/nakamoto/invoke`'s verbatim forward into that same handler) as something the gateway could not yet express, and deferred it. §0's `orchestratorAgentId` becoming optional removes that obstacle: a direct consultation is simply `requestingAgentId: 'aigent-nakamoto'`, `orchestratorAgentId: undefined`, `capabilityId` resolving to Nakamoto herself, `originatingSurface: 'aigentme'`. **This phase still does not wire `askSpecialist`'s Nakamoto branch to actually call `invokeCapability()`** — per the operator's explicit instruction, the human-facing behavior of that path is preserved exactly as-is, and the wiring is a small, disclosed follow-on (swap the LLM-chain call for a call to `invokeCapability()` with the envelope shape above; no gate redesign required, since Gates 1-3 already accept this shape natively). What changed is that the follow-on is now "wire an already-representable case," not "redesign the envelope to fit a case it couldn't express."

---

## 8. Exact minimal code surface (for the follow-on coding pass)

| File | Change | Kind |
|---|---|---|
| `services/registry/invocationGateway.ts` | Add `GovernedInvocation`/`AssetInvocation`/`CapabilityInvocation`/`InvocationDecision` types; add `invokeCapability(req: CapabilityInvocation): Promise<InvocationDecision>` implementing Gates 1-3 (§4) + depth/loop guard (§6); existing `invokeAsset` unchanged | Additive |
| `services/registry/capabilityProviderResolution.ts` (new) | The "who currently provides `capabilityId`" query — a filter over the Agent Bench read model (§3), returning zero/one/many eligible provider rows; `invokeCapability` calls this before any gate runs | New, small — the concrete Agent Bench-as-registry seam |
| `services/registry/capabilityInvocationGates.ts` (new) | The three gate functions, factored out for isolated testing — mirrors how `evaluateSkillQubePolicy` is its own module | New, small |
| `types/registryIngestion.ts` or a new `types/capabilityInvocation.ts` | The envelope + decision types (§2) | New types only |
| `services/receipts/activityReceiptService.ts` | Add 4 `ActivityActionType` union members: `capability_invocation_requested`, `capability_invocation_authorized`, `capability_invocation_refused`, `capability_invocation_completed` — same extension point already used for `specialist_consulted` | Additive, one line each |
| `services/dvn/activityReceiptDvnPipeline.ts` | Add the 4 new types to `ANCHORABLE_ACTION_TYPES` — the ONE unilateral change this file permits per its own header | Additive, explicitly pre-authorized |
| MoneyPenny's proposal path (wherever she decides to call a helper — new, not yet built) | Calls `invokeCapability()` with `orchestratorAgentId` set, instead of calling Nakamoto's runtime directly | New call site |
| Agent Bench's existing direct-call action | Calls `invokeCapability()` with `orchestratorAgentId` absent (direct pattern) | Rewire, no new mechanism |
| `askSpecialist`'s Nakamoto branch (follow-on, §7) | Calls `invokeCapability()` with `orchestratorAgentId` absent | Follow-on, disclosed, not built this pass |

Nothing else changes. No new database table is required — `registry_invocations` gains rows the same way it does for asset invocations (the `mode` field distinguishes them), and the 4 new receipt types ride the existing `activity_receipts` table.

---

## 9. OS-9 canaries (to accompany the coding pass, not written here)

Each canary proves the gate *catches* the failure, not merely that the happy path works:

1. **Direct endpoint bypass** — asserts (static/import-graph check, mirroring `tests/persona-spine-fetch.test.ts`'s style) that no NEW call site reaches `askSpecialist`/the runtime invoke handler except through `invokeCapability()` or the two named legacy paths still calling the LLM chain directly during the disclosed follow-on window (§7).
2. **Capability mismatch** — `invokeCapability()` with a `capabilityId` no eligible Bench row provides → `{decision:'refuse', code:'CAPABILITY_NOT_PROVIDED'}`; separately, a `targetAgentId` hint that disagrees with the resolved provider → `code:'PROVIDER_MISMATCH'`. Two assertions, since they are two different failure causes with two different codes.
3. **Delegation-depth violation** — `invocationPath` already containing the resolved provider → `CIRCULAR_INVOCATION`; `delegationDepth >= maxInvocationDepth` → `DEPTH_EXCEEDED`; a resolved provider issuing a further orchestrated request → `PROVIDER_MAY_NOT_ORCHESTRATE`. Three separate assertions, so a future change to one rule cannot silently weaken another.
4. **Unauthorized context sharing** — a request whose `contextRefs` resolve to fields outside the target capability's declared minimum-context list → asserts the resolved slice actually delivered to the provider excludes those fields (inspect the envelope's recorded "what was shared and why," §5) — never merely that the request was accepted.

These are specified, not implemented, per the operator's "produce before coding" instruction.

---

## The four invocation surfaces (operator framing, adopted verbatim)

1. **aigentMe Specialist** — explicit human selection, `Person → Nakamoto`, no orchestrator. `requestingAgentId === ` resolved provider, `orchestratorAgentId` absent.
2. **Wallet Copilot** — Financial Services intent, `Person → MoneyPenny → capability resolution → Nakamoto`. `orchestratorAgentId` present.
3. **Agent Bench** — operator/developer capability discovery + invoke provider. `orchestratorAgentId` absent; `originatingSurface: 'agent-bench'`.
4. **Internal orchestration** — `MoneyPenny → capability lookup → provider`, no UI. Same shape as (2) without a human-facing surface name attached beyond `originatingSurface`.

All four enter `invokeCapability()` through the identical gates — the surface name travels only as `originatingSurface`, never as a fork in gate logic.

---

## Scope note — what this pass deliberately does not do

- No `authoritative` execution mode is reachable from any gate above for the first implementation — Gate 2's `MODE_NOT_PERMITTED` refuses it structurally, not by convention.
- No second orchestrator, no provider-calls-provider chain, no cross-domain (non-Financial-Services) runtime is in scope.
- No provider-selection POLICY (choosing among multiple eligible providers for one capability) is designed here — this phase has exactly one provider to resolve to (Nakamoto, for `bitcoin_decentralisation_expertise`). The resolution step (§3, §8) is built to make that a real decision point later without changing any caller.
- The pre-existing direct `aigentMe → Nakamoto` consultation path's human-facing behavior is preserved exactly as it behaves today; wiring it onto `invokeCapability()` is named in §7/§8 as a disclosed, small follow-on, not silently deferred, and — per §0's correction — is now representable by this same envelope rather than needing a second design pass to become representable.
- MoneyPenny's own decision logic for *when* to call into a capability (vs. answer directly) is out of scope for this design — it is a MoneyPenny-side proposal that the gateway then governs, per the operator's "MoneyPenny proposes the team and invocation. The gateway governs it." MoneyPenny is the required orchestrator only for the Financial-Services orchestration path or multi-helper composition; she is never inserted in front of an explicit direct specialist consultation.
