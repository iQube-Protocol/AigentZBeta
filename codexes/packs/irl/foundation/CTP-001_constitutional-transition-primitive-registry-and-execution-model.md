# CTP-001 — Constitutional Transition Primitive Registry & Execution Model

**Status:** CHARTERED (2026-08-29) by operator act — doctrine and design recorded; **no runtime, registry, schema migration, or CI enforcement is implemented in this charter**. Implementation is explicitly sequenced to follow, not accompany, this record — see §22 and the Sequencing Note below.
**Date:** 2026-08-29
**Parent doctrine:** `appendix-a_canonical-invariants.md` `inv.constitutional.361` (Implementation Singularity), `inv.constitutional.369` (Principal-Only Constitutional Acts), `inv.engineering.362–366,370`
**Empirical basis:** OCSGA Boundary Research stabilisation — see `codexes/packs/agentiq/updates/2026-08-29_ocsga-implementation-singularity-and-principal-only-acts.md`
**Design objective:** give Constitutional Computing the missing operational object between a ratified invariant and actual machine action — the governed verb by which constitutional reality is allowed to change.

## Sequencing Note (read this before treating any section below as an implementation plan)

This document is a **charter**: it captures a complete v0.1 design so the reasoning is not lost, not a work order. Per the operator's explicit direction: *"this is a ratified doctrine/documentation commit only. Do not refactor the reciprocal-exchange implementation or introduce the CTP runtime architecture in this commit. The CTP implementation workstream should follow after Ian's stabilisation/authorization path is fully closed."* Nothing in this file authorizes writing a `constitutionalRuntime`, a `CTPQube` registry, a migration, or a CI check. When the operator opens the implementation workstream, §25 (Proposed First Implementation Package) is the intended entry point, and §21/§22 (OCSGA-first, priority-ordered migration) the intended sequencing — but opening it is a separate, future operator act.

## 0. The core rule and the principle beneath it

> Many channels may invoke. One constitutional primitive decides. One canonical state records.

> The runtime owns both constitutional state and the canonical means by which constitutional state may change.

A Constitutional Transition Primitive (CTP) is the uniquely identifiable, versioned, auditable constitutional capability through which a defined class of consequential state transition may legitimately occur. Its job is not merely to execute code: a CTP binds together the constitutional meaning of an act, the authority under which it may occur, the conditions under which it is currently authorized, the consequences expected from execution, the singular implementation that may realize it, and the evidence proving what actually happened.

## 1. Why CTP exists

Canonical state alone is insufficient. A system can have one authoritative database row and still be constitutionally inconsistent if UI, MCP, agent, admin route, and script each independently decide what the transition means — the exact OCSGA finding (see empirical basis above). CTP gives two kinds of singularity:

| Singularity | Requirement |
|---|---|
| **State singularity** | One canonical representation of constitutional state |
| **Implementation singularity** | One canonical implementation of each constitutional transition |

Constitutional computing is therefore not merely `many interfaces → one database`. It becomes `many channels → canonical CTP → canonical state → canonical evidence` — a materially stronger architecture.

## 2. The constitutional anatomy of a CTP

Every CTP answers nine questions:

| Question | Constitutional concern |
|---|---|
| What act is this? | Primitive identity |
| Who does the act constitutionally concern? | Subject |
| Who may perform it? | Actor |
| Why may they perform it? | Authority / mandate / delegation |
| May it occur now? | Authorization |
| What should happen if it executes? | Consequence projection |
| What code may actually cause it? | Canonical implementation |
| What happened? | Consequence realization |
| How can it be proved later? | Evidence / receipt |

The CTP is the operational junction between the existing concepts of Authority, Control, Mandate, State, Consequence and Evidence. Canonical sequence:

```
Authority + Control + Mandate
              ↓
         Current State
              ↓
    Consequence Projection
              ↓
        Authorization
              ↓
     Canonical CTP Execute
              ↓
      State Transition
              ↓
   Consequence Realization
              ↓
            Evidence
              ↓
      Constitutional Memory
```

This is the execution grammar of Trusted Automation.

## 3. Subject and actor must be separate

The Ian orientation defect makes this essential (see empirical basis). Every CTP must distinguish at least: `subject`, `actor`, `principal`, `delegate`, `interaction_channel` — never aliases of one another.

Principal-only declaration (`inv.constitutional.369`/`inv.engineering.370`):

```yaml
subject_requirement:
  type: PERSONHOOD
actor_requirement:
  type: AUTHORIZED_PRINCIPAL_IDENTITY
delegability:
  false
```

means: the constitutional right or obligation belongs to the personhood; the action must currently be exercised through an identity recognized as an authorized principal expression of that personhood; an agent cannot perform it merely because it is attached to the same account or happens to be the currently active persona.

A delegable act instead declares:

```yaml
subject_requirement:
  type: PERSONHOOD
actor_requirement:
  type:
    - AUTHORIZED_PRINCIPAL_IDENTITY
    - AUTHORIZED_DELEGATE
delegability:
  true
delegation:
  required_scope:
    - exchange.artifact.deposit
```

That distinction lives inside the primitive, never inside whichever UI happens to expose the button.

## 4. CTP object model

The logical CTP record, approximately:

> **Amended 2026-08-30** — this record's `actor`/`delegability`/`control` fields
> below originally illustrated `ctp.exchange.artifact.confirm` as
> non-delegable (`AUTHORIZED_PRINCIPAL_IDENTITY` only, `delegability: false`,
> `actor_is_principal_identity`). A constitutional audit (occasioned by
> Ian's OCSGA completion path — see `codexes/packs/agentiq/updates/
> 2026-08-30_ocsga-delegated-completion-and-ctp-001-delegability-correction.md`)
> found NO ratified invariant, PRD, or spec text anywhere in this repo that
> declares `confirm` (or `freeze`/`sign`) constitutionally non-delegable —
> this record was itself the only place the claim existed, and it was never
> more than an illustrative charter example, not a ratified rule. Corrected
> below, before this charter becomes active implementation, per the
> operator's direction: *"amend the charter while it is still chartered
> than let that example harden into implementation."* The governing rule is
> now stated once, generally, rather than illustrated by a since-falsified
> example: **delegability is explicit authority, not an exception to
> constitutional action — non-delegability requires an explicit
> constitutional basis.** `inv.constitutional.369` still applies in full: an
> agent acting under a valid delegation grant must still be correctly
> attributed (principal ≠ actor, both recorded), never conflated with the
> principal itself acting.

```yaml
primitive_id: ctp.exchange.artifact.confirm
version: 1.0.0
status: RATIFIED
domain:
  name: reciprocal-artifact-exchange
  constitution: OCSGA / IRL
description:
  "The bound principal — directly, or an authorized delegate acting within
   an active delegation grant covering this act — confirms an
   operator-assisted artifact as the principal's own submitted artifact."
subject:
  requirement: PERSONHOOD
  resolution: exchange.party_principal
actor:
  requirement:
    - AUTHORIZED_PRINCIPAL_IDENTITY
    - AUTHORIZED_DELEGATE
  delegability: true
  delegation:
    required_scope:
      - exchange.artifact.confirm
authority:
  required_basis:
    - exchange_party_membership
    - registered_artifact_subject
mandate:
  required: false
control:
  constraints:
    - artifact_pending_principal_attestation
    - actor_matches_subject_personhood
    - actor_is_principal_identity_or_authorized_delegate
state:
  allowed_from:
    - B_DEPOSITED
  results_in:
    - B_CONFIRMED
authorization:
  predicate: authorizeExchangeArtifactConfirmation
consequence:
  projection: projectArtifactConfirmation
  realization: evaluateArtifactConfirmationResult
execution:
  implementation_ref: confirmOperatorAssistedArtifact
  implementation_hash: "sha256:..."
  runtime: constitutional-runtime
evidence:
  receipt_type: constitutional_transition
  required_fields:
    - primitive_id
    - primitive_version
    - implementation_hash
    - subject_personhood
    - actor_identity
    - prior_state
    - resulting_state
    - origin_channel
    - timestamp
channels:
  permitted:
    - web
    - MCP
    - agent
    - API
    - operator
idempotency:
  mode: same_subject_same_transition
failure:
  default: FAIL_CLOSED
lineage:
  supersedes: null
  superseded_by: null
ratification:
  invariant_refs:
    - inv.constitutional.361   # Implementation Singularity
    - inv.constitutional.369   # Principal-Only Constitutional Acts
    - CI-2026-08-28-PRINCIPAL-AGENT-CHANNEL-ARE-DISTINCT-IDENTITIES-001
```

A machine-readable constitutional contract.

## 5. A CTP is not merely a service function

Today's service functions (`confirmOperatorAssistedArtifact()`, `freezeExchange()`, `signExchangeInstrument()`) may become the implementation *inside* a CTP, but the CTP is larger than the function. A service function answers "what code performs this operation?" The CTP answers "what constitutional act is this, who owns it, who can perform it, under what authority, from what states, with what projected consequences, through which singular implementation, and what evidence must exist afterwards?"

```
CTP
 ├── constitutional contract
 ├── authorization
 ├── consequence model
 ├── canonical implementation binding
 ├── receipt specification
 └── lifecycle / lineage
```

Service functions are not renamed CTPs; the implementation stays replaceable over time provided the CTP is versioned and properly superseded.

## 6. The CTP Registry

A special class of governed object in the broader iQube architecture. **The registered iQube describes and binds the constitutional primitive — it does not become a second execution engine.** Working name: `ConstitutionalTransitionPrimitiveQube` (`CTPQube`). Illustrative future catalogue:

| Primitive | Version | Status |
|---|---|---|
| `ctp.exchange.join` | 1.0.0 | Ratified |
| `ctp.exchange.artifact.deposit` | 1.0.0 | Ratified |
| `ctp.exchange.artifact.register-operator-assisted` | 1.0.0 | Ratified |
| `ctp.exchange.artifact.confirm` | 1.0.0 | Ratified |
| `ctp.exchange.freeze` | 1.0.0 | Ratified |
| `ctp.exchange.sign` | 1.0.0 | Ratified |
| `ctp.personhood.orientation.acknowledge` | 1.0.0 | Ratified |

Over time, a discoverable, constitutional capability map of the entire estate.

## 7. The Constitutional Runtime

The architectural shift: channels cease to call state-changing services directly. Instead:

```ts
constitutionalRuntime.execute(
  "ctp.exchange.artifact.confirm",
  context,
  input
)
```

Resolver sequence: resolve primitive → resolve subject → resolve actor → resolve authority → resolve mandate/delegation → read canonical state → project consequences → evaluate authorization → verify active implementation → execute transition transactionally → verify resulting state → realize consequences → write canonical receipt → return result + receipt. No constitutional transition is complete merely because a service function returned 200 OK — the receipt is part of the transition.

## 8. Authorization and execution must remain separate

A CTP can know a principal has *Authority* to perform an act while still refusing *Authorization* because the current state does not permit it. Authority (durable) ≠ Authorization (evaluated at invocation time against actor + authority + mandate + control + current state + primitive constraints + consequence projection). The primitive may be durable; the authority may be durable; the authorization is calculated against current reality.

## 9. Consequence projection becomes mandatory

Every consequential CTP declares its expected effect before execution:

```yaml
projection:
  current_state: B_DEPOSITED
  proposed_state: B_CONFIRMED
  effects:
    - pending_principal_attestation becomes false
    - principal attribution becomes authoritative
    - freeze becomes potentially available
```

More complex primitives project broader effect categories: legal, financial, privacy, security, standing, reputation, resource, delegation, external-system, irreversible. This lets authorization reason about whether expected consequences are constitutionally admissible, not merely whether code may run — the bridge between Constitutional Computing and Trusted Automation.

## 10. Every CTP produces a canonical transition receipt

Standardized base receipt shape:

```yaml
receipt_id: ...
primitive_id: ctp.exchange.artifact.confirm
primitive_version: 1.0.0
implementation_hash: "sha256:..."
subject:
  personhood_id: ...
principal:
  identity_id: ...
actor:
  identity_id: ...
delegation:
  grant_id: null
channel:
  type: MCP
  session_id: ...
authority_resolution:
  result: VALID
  basis: ...
authorization_resolution:
  result: AUTHORIZED
prior_state:
  exchange: B_DEPOSITED
projected_consequence:
  ...
resulting_state:
  exchange: B_CONFIRMED
realized_consequence:
  ...
evidence_refs:
  ...
timestamp: ...
outcome:
  SUCCESS
```

Identical shape regardless of whether the invocation came through a bridge, MCP, an agent, DevOn, or an operator console — this is how channel equivalence with provenance preservation becomes real.

## 11. Failed attempts are also evidence

Not only successful transitions are receipted. Meaningful attempted acts produce authorization/refusal evidence:

```yaml
outcome: REFUSED
reason:
  code: PRINCIPAL_REQUIRED
subject_personhood: Ian
actor_identity: Ian-aigentMe
primitive_id: ctp.personhood.orientation.acknowledge
```

Valuable for attack detection, debugging, governance review and experimentation. Refusals must never mutate the constitutional state being protected.

## 12. Primitive lifecycle

```
CANDIDATE → EXPERIMENTAL → RATIFIED → ACTIVE → DEPRECATED → SUPERSEDED
```

(Potentially `REVOKED` as a separate terminal state.) An implementation must never silently replace another implementation underneath the same primitive version. Same constitutional semantics → new implementation hash / controlled implementation revision. Changed constitutional semantics → new primitive semantic version. Lineage is retained; no silent rewriting.

## 13. Enforcement at the database boundary

The eventual, stronger architecture:

```
application channel
      ↓
CTP Runtime
      ↓
canonical transaction boundary
      ↓
constitutional tables
```

Normal application roles progressively lose direct state-transition permission. This does not mean constitutional logic moves into stored procedures — the constitutional runtime can remain application-level — it means the database must no longer treat arbitrary application code as equally entitled to mutate constitutional state.

## 14. DevOn integration (future)

```
Intent Capture
      ↓
Does this change consequential/canonical state?
      ↓
NO ───────────→ normal implementation path
YES
 ↓
Identify relevant CTP
 ↓
Existing primitive?
 ├── YES → invoke/reuse
 └── NO
       ↓
   Gap analysis
       ↓
 Is this actually a new constitutional act?
       ↓
 candidate CTP → consequence model → constitutional decision →
 ratification if required → implementation → cross-channel validation →
 CI singularity validation → deployment authorization
```

The first developer question shifts from *"Where should I add the API handler?"* to *"Which canonical constitutional primitive authorizes this transition?"* — the absence of an answer is an architectural finding, not a coding task.

## 15. CLAUDE.md / AGENTS.md invariant (future addition — not applied in this charter)

Intended wording for a future development-instruction amendment:

> **CONSTITUTIONAL TRANSITION RULE.** Before implementing any code capable of changing canonical, consequential or constitutionally governed state: (1) identify the canonical Constitutional Transition Primitive (CTP); (2) if an active CTP exists, invoke it — do not reproduce its semantics; (3) if no CTP exists, stop and flag a constitutional gap; (4) do not introduce direct state mutation as a workaround; (5) do not implement channel-specific authorization semantics; (6) preserve actor, principal, personhood, delegation and channel provenance; (7) all realized transitions must produce canonical evidence attributable to the active primitive version and implementation; (8) implementation divergence fails closed.

Intended to bind Claude, Codex, DevOn and future development agents equally — agent development discipline, not merely runtime architecture. **Not inserted into CLAUDE.md/AGENTS.md by this charter** — recorded here as the exact intended text for the implementation workstream to apply.

## 16. CI/CD integration (future)

A constitutional CI suite, eventually capable of detecting:

| Check | Failure |
|---|---|
| Primitive registration | consequential state change has no CTP |
| Unique implementation | >1 active implementation for primitive/version |
| Implementation hash | deployed implementation differs from registry |
| Direct-write scan | application bypasses registered primitive |
| Channel adapter scan | UI/API/MCP reimplements transition rules |
| Receipt contract | transition can occur without evidence |
| Actor rules | principal/delegate semantics inconsistent |
| State machine | implementation allows undeclared transition |
| Supersession | deprecated primitive still executable |
| Cross-channel parity | channels produce materially different constitutional results |

Illustrative failure message:

```
CONSTITUTIONAL SINGULARITY VIOLATION
Primitive: ctp.exchange.artifact.confirm@1.0.0
Canonical implementation: services/research/reciprocalExchange.ts: confirmOperatorAssistedArtifact
Competing implementation detected: app/api/foo/confirm/route.ts
Deployment denied.
```

## 17. Gap analysis integration (future)

Formal DevOn Gap Analysis output:

```yaml
constitutional_transition_analysis:
  changes_constitutional_state: true
  candidate_primitive: ctp.exchange.artifact.confirm
  primitive_status: EXISTS
  implementation_status: CANONICAL
  required_action: REUSE
  divergence_risk: HIGH
  forbidden:
    - implement local confirmation semantics
    - direct DB update
```

Or, when no primitive exists:

```yaml
primitive_status: MISSING
required_action: CONSTITUTIONAL_DESIGN_REQUIRED
```

DevOn must not automatically invent new constitutional powers merely because a product requirement asks for them.

## 18. Relationship to iQubes

```
iQube Protocol
      │
      ├── identity / provenance / governed objects
      │
      └── CTPQube
             ├── identifies the primitive
             ├── binds its constitution
             ├── binds its implementation
             ├── records ratification
             ├── records lineage
             └── exposes discovery metadata
Constitutional Runtime
      │
      └── executes the CTP
```

The iQube is the governed constitutional object; the runtime is the execution authority; Crystal records evidence and learning; DevOn orchestrates development/change; IDE 2.0 discovers new invariants and gaps:

```
IDE 2.0            discovers what must remain true
   ↓
Constitution/Registry   ratifies what is permitted
   ↓
DevOn               ensures implementations respect it
   ↓
DCIR/Runtime        enforces it during execution
   ↓
Crystal             preserves what actually happened
   ↺
```

CTPs sit directly across the Registry → DevOn → Runtime → Crystal axis.

## 19. Relationship to DCIR

CTP does not replace DCIR (CFS-020, the Dynamic Constitutional Interaction Runtime). **CTP defines what transition exists and how it may legitimately occur. DCIR determines whether that transition is authorized under the actual circumstances of this interaction.** CTP is the constitutional verb; DCIR is the constitutional runtime grammar/context. `ctp.exchange.freeze` defines what freezing an exchange means; DCIR evaluates the current situation, authority, state, evidence, unresolved attestations, controls and consequences to determine whether that verb may execute now.

## 20. CTPs and constitutional state machines

A state machine should no longer have anonymous edges — every edge points to a CTP:

```
B_DEPOSITED
     │
     │ ctp.exchange.artifact.confirm@1
     ↓
B_CONFIRMED
```

A state transition without a CTP should eventually be structurally impossible.

## 21. OCSGA as the first migration exemplar (future)

Once Ian is fully through the current live journey, the reciprocal exchange is the intended first migration — it produced the evidence that produced this architecture. Initial primitive family:

```
ctp.exchange.create
ctp.exchange.party.join
ctp.exchange.artifact.deposit
ctp.exchange.artifact.register.operator-assisted
ctp.exchange.artifact.confirm
ctp.exchange.freeze
ctp.exchange.sign
ctp.exchange.complete
ctp.research.orientation.acknowledge   (potentially separate)
```

Each primitive should map the current canonical implementation rather than trigger an immediate rewrite — CTP migration wraps and registers proven implementations first; collapsing genuine duplication is a later, separate step.

## 22. Migration strategy for the rest of the estate (future)

Not every state mutation at once — prioritize by constitutional consequence:

| Priority | Domain |
|---|---|
| P0 | Personhood / identity binding |
| P0 | Delegation / revocation |
| P0 | Reciprocal exchanges |
| P0 | Freeze / attest / sign |
| P0 | Passport issuance / standing |
| P1 | Registry admission / supersession |
| P1 | Financial authority / consequential transfers |
| P1 | External communications sent under delegation |
| P1 | Data disclosure / sharing |
| P2 | Lower-consequence workflow transitions |

CRUD does not automatically equal constitutional transition — CTP is never a universal application-service abstraction. The threshold is consequential governed state.

## 23. Determining whether something needs a CTP

Test: *would an unauthorized, incorrectly attributed, incorrectly sequenced, or inconsistently implemented version of this action materially alter rights, authority, standing, obligations, control, evidence, resources, commitments, or consequential external state?* If yes, it is probably a CTP candidate. Changing a UI preference probably isn't; issuing a Passport is. Changing font size isn't; delegating authority is. Saving a draft probably isn't; sending it as the person may be.

## 24. CTP as the unit of constitutional change management

Beyond tickets/PRs/commits/deployments, CTP adds an axis: `constitutional capability → ratified semantic contract → implementation → deployment → realized evidence`. "What constitutional powers does this system actually possess?" resolves against the CTP Registry. "How did this action happen?" resolves the receipt back to the CTP. "Which code was authorized to perform this transition at that time?" resolves its implementation hash. "What changed in release X?" distinguishes normal software changes from changes to constitutional capability — substantially more powerful than conventional audit logging.

## 25. Proposed first implementation package (future workstream — not opened by this charter)

A bounded vertical slice, when the operator opens this workstream:

1. CTP schema and lifecycle.
2. `ConstitutionalTransitionPrimitiveQube` registry representation.
3. Canonical `constitutionalRuntime` resolver/executor contract.
4. Base transition receipt schema.
5. Authority / Authorization / Consequence interfaces.
6. DevOn gap-analysis integration.
7. CLAUDE.md + AGENTS.md invariant (§15's exact text).
8. CI singularity checks (§16).
9. OCSGA reciprocal exchange as first mapped/migrated primitive family (§21).
10. Cross-channel acceptance: UI and MCP invoke the same underlying CTP and produce equivalent state/evidence with distinct channel provenance.

Phase 1 maps and wraps existing canonical implementations before rewriting them — institutionalizing Implementation Singularity without destabilizing the work that revealed it.

## Ratification

`inv.constitutional.361` (Implementation Singularity), `inv.constitutional.369` (Principal-Only Constitutional Acts), and their engineering corollaries (`inv.engineering.362–366,370`) are ratified as of 2026-08-29 — see `appendix-a_canonical-invariants.md`. This charter (the CTP object model, registry, runtime, and migration plan above) is **recorded, not ratified as built** — it is design authored by the operator for a future implementation workstream, sequenced explicitly to follow Ian's OCSGA stabilisation, never to precede or accompany it.
