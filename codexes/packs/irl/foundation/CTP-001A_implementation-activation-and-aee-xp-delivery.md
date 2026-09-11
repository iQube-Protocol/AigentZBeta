# CTP-001A — Implementation Activation & AEE-XP Delivery Mandate

**Status:** IMPLEMENTATION WORKSTREAM ACTIVATED  
**Date:** 2026-08-31  
**Parent charter:** `CTP-001_constitutional-transition-primitive-registry-and-execution-model.md`  
**Delivery programme:** `codexes/packs/agentiq/updates/2026-08-31_aee-xp-three-paper-execution-build-spec.md`  
**Delivery amendment:** `codexes/packs/agentiq/updates/2026-08-31_aee-xp-ctp-required-delivery-amendment.md`

---

## 0. Operator activation

CTP-001 was deliberately chartered without authorizing runtime implementation. Its sequencing note required a separate operator act to open implementation after the Ian/OCSGA stabilization path.

That operator act is now recorded:

> **CTP is to be delivered as part of AEE-XP-001.**

Accordingly, the implementation workstream described prospectively in CTP-001 is now active. The parent charter remains the governing constitutional/design source; this document changes its implementation status and delivery sequencing, not its semantics.

---

# 1. Required first delivery

The active workstream must deliver:

1. a machine-readable/versioned CTP contract and registry/resolver;
2. the canonical Constitutional Runtime invocation seam (`constitutionalRuntime.execute` or its exact approved implementation equivalent);
3. structural separation of subject, personhood, principal, actor, delegate and interaction channel;
4. authority/delegation resolution distinct from authorization;
5. consequence projection before execution;
6. canonical implementation binding/version/hash evidence;
7. transactional canonical state transition;
8. resulting-state verification;
9. normalized constitutional transition receipts;
10. refusal/failed-attempt evidence without protected-state mutation;
11. cross-channel equivalence proof;
12. CI/canary enforcement against parallel implementations for migrated transitions;
13. DevOn enforcement for new canonical/consequential writes.

The delivery requirements and acceptance criteria are specified in AEE-XP-001A.

---

# 2. Migration order

Implementation follows the parent charter's OCSGA-first discipline:

```text
CTP foundation
  ↓
OCSGA bounded migration
  ↓
cross-channel proof
  ↓
Financial Services consequential capstone adoption
  ↓
progressive estate migration by consequence/risk priority
```

This is explicitly **not** an estate-wide big-bang refactor.

Before activating any illustrative primitive from CTP-001's examples, implementation must reconcile the primitive against the current ratified doctrine and live service semantics. Illustrative charter examples are not to be promoted into active runtime contracts merely because they appear in the charter.

---

# 3. Existing implementations are bound, not gratuitously rewritten

CTP introduces implementation singularity, not needless implementation replacement.

Where a current service function is already the correct canonical realization of a constitutional act, the CTP should bind that implementation beneath the Constitutional Runtime rather than reproduce it.

```text
CTP contract
  ↓
authorization / consequence / implementation binding
  ↓
existing canonical service implementation
  ↓
canonical state
  ↓
normalized CTP evidence
```

Only defects, duplicated semantics, missing authority checks, or incompatible transaction/evidence behavior justify changing the underlying service implementation.

---

# 4. DevOn rule is now active

For implementation work opened after this activation:

> **Before implementing code capable of changing canonical, consequential or constitutionally governed state: identify the active CTP. If one exists, invoke it. If none exists and the act is genuinely new, surface a constitutional gap and govern the new primitive. Do not create a direct mutation path as a workaround.**

This rule applies across web, MCP, agent, API, operator, Bridge, AEE/provider and DevOn surfaces.

---

# 5. Completion condition

CTP-001's implementation activation is not satisfied by types or documentation alone.

The first milestone is complete only when:

- a real OCSGA constitutional transition executes through the Constitutional Runtime;
- the same constitutional semantics are demonstrated across at least two supported invocation channels where available;
- canonical transition/refusal evidence is emitted;
- migrated alternate routes no longer independently implement the mutation semantics;
- the AEE-XP Financial Services capstone contains at least one consequential transition executed through an active CTP.

---

# 6. Canonical activation statement

> **CTP-001 is no longer a future-only charter. Its implementation workstream is active under AEE-XP-001, OCSGA-first, with Financial Services as the second proving domain.**
