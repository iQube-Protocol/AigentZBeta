# AgentiQ Position Paper — Policy as the New Perimeter

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-08  
**Version:** doctrine-1.0

---

## Purpose

This paper states the AgentiQ position on the long-running false binaries that continue to distort digital architecture:

- centralized vs decentralized
- open vs closed
- on-chain vs off-chain
- private vs transparent
- perimeter security vs modern dynamic systems

The AgentiQ position is that these binaries are too crude for the operating environment now emerging.

The future does not belong to one pole. It belongs to systems mature enough to combine the strengths of seemingly opposed approaches in the right layer, under the right policy, for the right reason.

---

## Canonical thesis

> The network may be open, but the real perimeter is policy.

The current information-security model remains too dependent on a firewall-centric imagination inherited from a more static era.

That model assumes the decisive question is whether an unauthorized party can get in.

In the modern operating environment — defined by cloud systems, software supply chains, public package ecosystems, agents, APIs, registries, cross-domain workflows, and machine-mediated action — the decisive question is increasingly different:

> What is allowed to move out, in what form, under what entitlement, under what state conditions, into which execution realm, and with what evidence?

That is why AgentiQ treats policy, identity, entitlement, cryptography, controlled execution, and attested state as the true perimeter of the system.

---

## Canonical positions

### 1. Open and closed are not moral categories

AgentiQ rejects the simplistic assumption that systems must be either fully open or fully closed.

The correct distinction is layered:

- **Qripto protocols** should be open where openness increases trust, interoperability, and ecosystem growth
- **AgentiQ OS** should be open as the operating substrate and common runtime semantics layer
- **AgentiQ Platform and metaMe** may remain proprietary where managed orchestration, product quality, and commercial differentiation require control

Open foundation and proprietary product are not contradictory. They are the correct layered response.

### 2. Centralized and decentralized are not sufficient descriptions of trust

AgentiQ rejects the simplistic assumption that decentralized automatically means secure, sovereign, or private, and that centralized automatically means vulnerable or inferior.

Those claims collapse distinct properties into one vague discussion about trust.

The relevant guarantees are different:

- **Privacy** comes chiefly from cryptography, controlled disclosure, scoped entitlement, and controlled execution
- **Auditability** comes chiefly from receipts, policy evidence, attested state transitions, and durable trust trails
- **Censorship resistance** comes chiefly from distributed storage, replication, and provider diversity
- **Production agility** comes chiefly from mutable high-performance systems and governed workflow environments
- **Canonical permanence** comes from deliberate finalization and durable anchoring, not from forcing all assets into immutable infrastructure from inception

### 3. Policy is the new perimeter

The old model treats the network edge as the primary boundary.

AgentiQ treats the meaningful perimeter as the intersection of:

- actor identity
- object identity
- role
- entitlement
- current state
- purpose
- policy
- execution context
- audit obligations
- revocation conditions

This is the architectural response to an environment in which code, workflows, prompts, models, data, and machine-executable capabilities constantly move through legitimate internal and external systems.

### 4. The trust layer should be uncompromising; payload storage should be pragmatic

AgentiQ is uncompromising about:

- policy enforcement
- attested state changes
- access evidence
- durable trust trails
- controlled unlock paths
- canonical trust events

AgentiQ is pragmatic about:

- where draft assets live
- where working state is stored
- where protected payloads reside
- which assets need distributed replication
- which artifacts should remain mutable until they are ready for canonical finalization

This is a deliberate design distinction.

> The trust layer is uncompromising. The payload layer is fit-for-purpose.

### 5. Custody and control should be separated where possible

AgentiQ does not assume that the platform must hold custody of all assets in order to govern them.

Its preferred model is:

- tenant payloads remain tenant-custodied where appropriate
- access rights travel more readily than raw content
- policy is platform-governed and auditable
- verification is distributable
- product reliability may still be centrally managed where needed

This reduces lock-in pressure while strengthening trust.

### 6. Working state is not canonical state

AgentiQ explicitly distinguishes between:

- working state
- review state
- published state
- canonical state
- archival state

This means:

- not every asset should be immutable from inception
- not every draft should be publicly referenced
- not every canonical object should share the same substrate as its mutable working precursor

Lifecycle discipline is part of architectural maturity.

---

## The AgentiQ answer to the classic trilemma mindset

AgentiQ does not deny that trade-offs are real.

It rejects the assumption that all trade-offs must be resolved in the same layer.

A more advanced system separates:

- protocol from product
- trust from payload storage
- custody from control
- openness from commoditization
- working state from canonical state
- privacy from censorship resistance
- auditability from publication

This allows the system to manage apparent trilemmas more intelligently by assigning each concern to the layer best suited to carry it.

---

## Operating doctrine

### What should be open

Open what benefits from:

- shared trust
- interoperability
- ecosystem growth
- portability
- inspectable semantics

### What may remain proprietary

Keep proprietary what depends on:

- managed orchestration
- product reliability
- premium UX
- enterprise accountability
- differentiated service delivery
- commercial durability

### What should remain tenant-owned

Keep tenant-owned what is:

- sovereignty-sensitive
- tenant-specific
- confidential by nature
- business-critical and customer-custodied

### What must be verifiable

Make verifiable what affects:

- access rights
- state transitions
- publication/finalization events
- approvals
- provenance claims
- reward or treasury logic
- policy execution

---

## Storage doctrine summary

AgentiQ selects storage according to the guarantee required.

- Use **cryptography** when privacy matters
- Use **DVN-style receipts and attested state** when auditability matters
- Use **distributed storage and replication** when censorship resistance and survivability matter
- Use **mutable high-performance systems** when working-state agility matters
- Use **deliberate finalization and anchoring** when canonical permanence matters

The first question is not, “Should this be centralized or decentralized?”

The first question is:

> Which guarantee matters for this asset, at this stage, under this threat model, and which layer should provide it?

---

## What this means for AgentiQ

AgentiQ should be understood as a system in which:

- the **protocol layer** is open enough to support trust and ecosystem growth
- the **OS layer** is open enough to support portability and composability
- the **platform layer** is controlled enough to support quality and managed governance
- the **trust layer** is verifiable enough to support auditability without universal publication
- the **storage and execution layers** are selected according to capability objective rather than ideology

This is the AgentiQ answer to the open/closed and centralized/decentralized conundrums.

---

## Final canonical statement

> AgentiQ resolves the old digital binaries by separating protocol, operating substrate, product, trust fabric, and storage function. Qripto provides the open protocol foundation. AgentiQ OS provides the open operating substrate. AgentiQ Platform and metaMe provide the proprietary product and managed-experience layer. DVN-style verification provides the policy-evidence and state-attestation fabric that makes open networks governable. Storage is selected according to the guarantee required: privacy through cryptography, auditability through attested state, censorship resistance through distributed infrastructure, and production agility through mutable high-performance systems. In this model, the real perimeter is not the firewall. It is policy.

---

## Related documents

- `items/ALPHA_ARCHITECTURE_MEMO.md`
- `items/ALPHA_BUILD_PLAN.md`
- `items/OS_README.md`
- `items/OS_PACKAGING_STANDARDS.md`
- `../../metame/items/METAME_EXPERIENCE_FRAMEWORK.md`
- `../../knyt/items/KNYT_EXPERIENCE_PACK_PRD.md`
