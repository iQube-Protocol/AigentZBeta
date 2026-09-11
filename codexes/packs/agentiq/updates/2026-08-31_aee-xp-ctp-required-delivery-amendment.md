# AEE-XP-001A — CTP Required Delivery Amendment

**Status:** BUILD-SPEC AMENDMENT — implementation required  
**Date:** 2026-08-31  
**Parent:** `AEE-XP-001 — Three-Paper Execution Build Specification`  
**CTP charter:** `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md`  
**Operator act:** 2026-08-31 — CTP is to be delivered as part of the AEE-XP build.

---

## 0. Governing correction

AEE-XP-001 currently treats CTP implementation as a separate/future workstream while requiring DevOn to identify CTPs for canonical/consequential changes. That sequencing is superseded by this amendment.

> **CTP is a required deliverable of AEE-XP-001.**

The AEE-XP programme is not complete merely because it is CTP-aware. It must deliver the first working Constitutional Transition Primitive runtime slice and exercise it in the programme's end-to-end acceptance journey.

This amendment supersedes any AEE-XP-001 wording that says CTP implementation remains separate, future, conditional, or not yet activated. It does **not** require an estate-wide big-bang migration. Delivery is deliberately staged: **CTP foundation → OCSGA-first migration → consequential Financial Services proof → progressive migration thereafter.**

---

# 1. Why CTP is part of the executable AEE system

AEE-XP establishes the estate-wide state rule:

> **Many channels may observe; one authoritative interpretation of relevant state is composed from canonical state owners.**

The write-side complement must now be executable too:

> **Many channels may invoke; one canonical Constitutional Transition Primitive decides; one canonical state records; one canonical evidence shape proves the transition.**

Once CI, KNYTS, Financial Services, IRL, DevOn, web, MCP, agents and external harnesses can all surface or invoke the same capabilities, implementation singularity is no longer optional infrastructure. Without CTP, the estate can have one database row while still allowing different channels to independently decide what a constitutional transition means.

Therefore CTP is a foundational runtime seam beneath every path in AEE-XP that changes canonical/consequential state.

---

# 2. Required CTP delivery

The build MUST deliver the following minimum CTP runtime capability.

## 2.1 Machine-readable CTP contract and registry

Implement a canonical, versioned CTP definition/registry capable of resolving at least:

- primitive id;
- semantic version;
- lifecycle/status;
- domain;
- subject requirement/resolution;
- actor requirement;
- principal/delegate distinction;
- delegability and required delegation scope;
- authority basis;
- mandate/control constraints;
- allowed prior state;
- resulting state;
- authorization predicate binding;
- consequence projection binding;
- canonical implementation binding;
- implementation hash/version evidence;
- consequence-realization binding;
- receipt specification;
- permitted invocation channels;
- idempotency/failure policy;
- lineage/supersession metadata;
- constitutional/invariant references.

The registry may compose the wider iQube/Registry architecture, but MUST NOT become a second execution engine. The registered CTP object describes and binds the primitive; the Constitutional Runtime executes it.

## 2.2 Constitutional Runtime

Implement the canonical invocation seam represented by the charter as:

```ts
constitutionalRuntime.execute(
  primitiveId,
  context,
  input,
)
```

The runtime MUST execute the following sequence through one canonical path:

```text
resolve primitive
  ↓
resolve subject / principal / actor / delegate / channel
  ↓
resolve authority / mandate / delegation
  ↓
read canonical prior state
  ↓
project consequence
  ↓
evaluate authorization
  ↓
verify active implementation binding
  ↓
execute canonical transition transactionally
  ↓
verify resulting state
  ↓
realize/observe immediate consequence where applicable
  ↓
write canonical transition evidence
  ↓
return result + receipt/refusal evidence
```

Authorization and execution MUST remain separate decisions.

## 2.3 Standard constitutional transition evidence

Successful transitions MUST emit a normalized constitutional transition receipt containing sufficient evidence to reconstruct at least:

- primitive id/version;
- implementation binding/hash;
- subject/personhood reference at the appropriate disclosure tier;
- principal identity reference;
- actor identity reference;
- delegate/grant reference where applicable;
- origin channel;
- authority resolution;
- authorization resolution;
- prior state;
- projected consequence;
- resulting state;
- realized consequence/evidence refs where available;
- timestamp;
- outcome.

Meaningful failed/refused attempts MUST produce refusal evidence without mutating protected state.

## 2.4 Channel equivalence

The same constitutional act invoked through different permitted channels MUST resolve to the same active CTP and constitutional semantics.

Channel provenance is preserved; channel-specific authorization semantics are prohibited.

At minimum, the first migrated OCSGA primitive must be demonstrated through two supported invocation channels (preferably web + MCP where both exist), showing:

- same primitive id/version;
- same authorization rules;
- same canonical state transition;
- same normalized evidence schema;
- distinct origin-channel provenance.

## 2.5 Implementation singularity / bypass protection

For migrated transitions, CI/tests MUST detect or prevent a second application implementation from independently reproducing the same constitutional mutation semantics.

At minimum the build must establish canaries/checks for:

- active primitive resolves to exactly one canonical implementation binding;
- migrated web/MCP/agent routes invoke the CTP/runtime rather than independently mutating state;
- actor/principal/delegate/channel fields are not collapsed;
- authorization cannot be bypassed by alternate surface;
- a missing/unknown primitive fails closed for a declared CTP-governed mutation;
- same primitive version cannot silently change semantic meaning underneath an implementation update;
- receipt/evidence is required for a successful constitutional transition.

Database-level enforcement may be strengthened progressively, but the first slice must make bypass detectable and testable rather than relying on convention alone.

---

# 3. Migration sequence

## 3.1 Slice A — CTP foundation

Build:

1. CTP definition/types;
2. registry/resolution mechanism;
3. `constitutionalRuntime.execute`;
4. authorization/execution separation;
5. consequence projection/realization contract;
6. normalized transition/refusal evidence;
7. implementation binding/version/hash discipline;
8. cross-channel context model;
9. test/canary harness.

## 3.2 Slice B — OCSGA first

Per CTP-001's own sequencing, migrate a bounded OCSGA transition family first rather than touching the entire estate.

The implementation team must first inventory the current reciprocal-exchange transitions and select the smallest coherent migration slice that proves implementation singularity end-to-end. Candidate primitives already identified by the charter include:

- `ctp.personhood.orientation.acknowledge`;
- `ctp.exchange.join`;
- `ctp.exchange.artifact.deposit`;
- `ctp.exchange.artifact.register-operator-assisted`;
- `ctp.exchange.artifact.confirm`;
- `ctp.exchange.freeze`;
- `ctp.exchange.sign`.

Do not assume every illustrative primitive is already ratified for production semantics. Before activating each primitive, reconcile its current service semantics, authority/delegability rules, state transitions and evidence requirements against the live OCSGA implementation and ratified doctrine.

The first acceptance slice MUST prove at least one real constitutional transition through the CTP runtime with cross-channel equivalence and no parallel mutation path.

## 3.3 Slice C — Financial Services consequence proof

Inventory the canonical/consequential state transitions exercised by AEE-XP's Financial Services capstone.

At least the consequential Financial Services transition used in the capstone MUST execute through an active CTP before AEE-XP is considered complete.

This does **not** mean rewriting MoneyPenny, the Constitutional Service Pipeline, Constitutional Commerce/VELA, Wallet, or settlement rails. CTP binds the constitutional meaning, authorization, consequence and canonical implementation of the relevant transition; existing service implementations remain the implementation beneath the primitive wherever valid.

## 3.4 Slice D — progressive estate migration

After OCSGA + capstone FS proof, create a migration inventory/prioritization for remaining constitutional transitions across the estate.

Progressive migration is outside the minimum AEE-XP completion boundary unless a transition is required by the capstone, but all newly introduced canonical/consequential state mutations from this build MUST be CTP-governed from inception.

---

# 4. DevOn integration is now executable enforcement

For every DevOn intent:

```text
Does the proposed implementation change canonical/consequential state?
  │
  NO → normal implementation path
  │
  YES
  ↓
identify active CTP
  ├── exists → reuse/invoke it
  └── absent
        ↓
     constitutional gap
        ↓
     candidate/new CTP analysis
        ↓
     consequence model + constitutional decision
        ↓
     required ratification/activation
        ↓
     implementation through Constitutional Runtime
```

A direct state mutation is not an acceptable temporary workaround.

DevOn's Context Assembly / Gap Analysis / Constitutional Decision / Consequence Validation must preserve the distinction between:

- no new constitutional act: reuse an existing CTP;
- genuinely new constitutional act: define/govern a candidate CTP;
- implementation defect underneath an existing CTP: repair the implementation without silently changing the primitive's semantics.

---

# 5. Relationship to AR/CPS, DCIR and AEE

These seams remain distinct.

```text
AEE
= what experience should happen next

AR/CPS
= what governed artifact was actually produced

CTP / Constitutional Runtime
= what constitutional state transition is allowed and canonically executed

DCIR
= what consequence actually occurred / what evidence challenges or supports expectations
```

Reference loop:

```text
Authoritative State
  ↓
AEE / NBE
  ↓
interaction / specialist / AgentiQ
  ↓
AR/CPS where an artifact is produced
  ↓
CTP where canonical/consequential state changes
  ↓
canonical transition receipt
  ↓
DCIR consequence observation
  ↓
ExQube / IRL / DevOn / Crystal as applicable
  ↓
Authoritative State
  ↓
AEE re-evaluation
```

AEE may recommend a CTP-backed act and adapt the experience around it. It may never invoke an alternate state-changing implementation because that would create a better UX.

---

# 6. Revised AEE-XP sequencing

This amendment inserts CTP delivery into the main programme rather than leaving it after the programme.

Recommended sequence:

```text
Phase 0  Convergence + CTP transition inventory
Phase 1  CTP foundation + OCSGA-first proof
Phase 2  CI/KNYTS → FS main-spine connection
Phase 3  Experience Control Plane convergence
Phase 4  R3 state/observation loop
Phase 5  Financial Services Experience Pack + FS CTP proof
Phase 6  Progressive Sovereignty Pack/content
Phase 7  IRL Research branch
Phase 8  DevOn branch + CTP enforcement
Phase 9  Differ/provider experiment
```

Some implementation can proceed in parallel, but the consequential FS capstone cannot pass until the required CTP is active.

---

# 7. Revised capstone CTP requirements

AEE-XP's capstone acceptance journey is amended as follows.

Before the main journey is declared complete:

1. CTP foundation is active.
2. At least one OCSGA constitutional transition has been migrated and proven through the Constitutional Runtime.
3. That OCSGA transition has cross-channel equivalence evidence using at least two supported channels where available.
4. No migrated channel retains an independent semantic/state-mutation implementation for that act.
5. The consequential Financial Services action in the capstone resolves and executes through an active CTP.
6. The CTP receipt becomes canonical evidence observed by Journey/AEE rather than AEE manufacturing completion.
7. DCIR can observe the resulting consequence without becoming the owner of the constitutional transition.
8. A later DevOn branch that touches canonical state either reuses an active CTP or fails closed as a constitutional gap.

---

# 8. Additional hard acceptance criteria

The following criteria are appended to AEE-XP-001 §17 and are mandatory:

26. A working CTP registry/resolver is delivered.
27. A working `constitutionalRuntime.execute` seam is delivered.
28. Subject, principal, actor, delegate and interaction channel are structurally distinct in CTP execution/evidence.
29. Authorization is evaluated before and separately from canonical execution.
30. Successful CTP transitions emit normalized canonical transition evidence; meaningful refusals emit refusal evidence without protected-state mutation.
31. At least one OCSGA transition is migrated and proven through two supported invocation channels where available.
32. CI/tests detect or prohibit parallel mutation semantics for migrated CTP transitions.
33. At least one consequential Financial Services transition in the capstone executes through an active CTP.
34. Existing service/runtime implementations are bound beneath CTPs where valid rather than duplicated.
35. Newly introduced canonical/consequential state writes in AEE-XP may not ship without an active CTP or an explicitly governed candidate-CTP path.
36. CTP implementation failure or unresolved primitive state fails closed and cannot be bypassed through AEE, provider, MCP, agent, Bridge or DevOn surface logic.

---

# 9. Non-goal clarification

The following prior AEE-XP non-goal is superseded:

> "Do not implement an estate-wide CTP big-bang migration before the OCSGA-first CTP programme is explicitly activated."

The programme **is now explicitly activated**.

The corrected non-goal is:

> **Do not turn required CTP delivery into an estate-wide big-bang migration. Deliver the CTP runtime, prove it OCSGA-first, adopt it for the consequential Financial Services capstone path, and migrate the remainder progressively by consequence/risk priority.**

---

# 10. Canonical execution statement

> **AEE-XP is not complete until the experience control plane can both read authoritative state coherently and cause constitutional state to change only through a working canonical Constitutional Transition Primitive runtime.**

Simpler:

> **State first. Experience adapts. Constitutional change goes through CTP. Evidence comes back. The system learns and resumes.**
