# Policy as the New Perimeter

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-08  
**Version:** doctrine-1.0

---

## Thesis

AgentiQ’s position is that the long-running binaries of digital architecture are no longer sufficient:

- centralized vs decentralized
- open vs closed
- on-chain vs off-chain
- private vs transparent
- firewall security vs dynamic systems

The future does not belong to one side of these binaries. It belongs to systems mature enough to combine the strengths of seemingly opposed approaches in the right layer, under the right policy, for the right reason.

> The network may be open, but the real perimeter is policy.

---

## Why the old perimeter model fails

The classic model assumes the decisive security question is whether an unauthorized actor can get in.

That model no longer matches an environment defined by:

- cloud systems
- software supply chains
- public package ecosystems
- APIs and registries
- cross-domain workflows
- agentic and machine-mediated action

In this environment, the decisive question is increasingly different:

> What is allowed to move out, in what form, under what entitlement, under what state conditions, into which execution realm, and with what evidence?

This is why AgentiQ treats policy, identity, entitlement, cryptography, controlled execution, and attested state as the true perimeter of the system.

---

## The canonical positions

### 1. Open and closed are not moral categories

The correct distinction is layered:

| Layer | Position |
|---|---|
| Qripto protocols | Open where openness increases trust, interoperability, and ecosystem growth |
| AgentiQ OS | Open as the operating substrate and common runtime semantics layer |
| AgentiQ Platform and metaMe | Proprietary / governed where orchestration, product quality, and commercial differentiation require control |

Open foundation and proprietary product are not contradictory. They are the correct layered response.

### 2. Centralized and decentralized do not describe trust precisely enough

The relevant guarantees are different:

| Guarantee | Primary source |
|---|---|
| Privacy | Cryptography, controlled disclosure, scoped entitlement, controlled execution |
| Auditability | Receipts, policy evidence, attested state transitions, durable trust trails |
| Censorship resistance | Distributed storage, replication, provider diversity |
| Production agility | Mutable high-performance systems and governed workflow environments |
| Canonical permanence | Deliberate finalization and durable anchoring |

### 3. The trust layer should be uncompromising; the payload layer should be pragmatic

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
- which artifacts should remain mutable until ready for canonical finalization

> The trust layer is uncompromising. The payload layer is fit-for-purpose.

### 4. Custody and control should be separated where possible

AgentiQ prefers a model in which:

- tenant payloads remain tenant-custodied where appropriate
- access rights travel more readily than raw content
- policy is platform-governed and auditable
- verification is distributable
- product reliability may still be centrally managed where needed

### 5. Working state is not canonical state

AgentiQ explicitly distinguishes between:

- working state
- review state
- published state
- canonical state
- archival state

This means not every asset should be immutable from inception and not every draft should be publicly referenced.

---

## The AgentiQ answer to the trilemma mindset

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
- publication / finalization events
- approvals
- provenance claims
- reward or treasury logic
- policy execution

---

## Storage doctrine summary

| Objective | Mechanism |
|---|---|
| Privacy | Cryptography |
| Auditability | DVN-style receipts and attested state |
| Censorship resistance | Distributed storage and replication |
| Production agility | Mutable high-performance systems |
| Canonical permanence | Deliberate finalization and anchoring |

The first question is not, “Should this be centralized or decentralized?”

The first question is:

> Which guarantee matters for this asset, at this stage, under this threat model, and which layer should provide it?

---

## Final canonical statement

> AgentiQ resolves the old digital binaries by separating protocol, operating substrate, product, trust fabric, and storage function. Qripto provides the open protocol foundation. AgentiQ OS provides the open operating substrate. AgentiQ Platform and metaMe provide the proprietary product and managed-experience layer. DVN-style verification provides the policy-evidence and state-attestation fabric that makes open networks governable. Storage is selected according to the guarantee required: privacy through cryptography, auditability through attested state, censorship resistance through distributed infrastructure, and production agility through mutable high-performance systems. In this model, the real perimeter is not the firewall. It is policy.

---

## Related documents

- `../architecture/policy-perimeter-architecture.md`
- `identity-policy.md`
- `dvn.md`
- `operators-manual.md`
- `../../agentiq/items/POLICY_PERIMETER_POSITION_PAPER.md`
