# Aigent DiDQube Identity Upgrade Note

## 1. Purpose
This note records an important upgrade to the Aigent identity model.

It should be treated as a policy and architecture clarification for future Aigent DiDQube documentation, identity design, and implementation work across the ecosystem.

It is especially relevant to:
- Aigent identity design
- delegation and confidentiality
- reputation and trust systems
- KNYT Wheel agent onboarding and missions
- client-facing and multi-tenant Aigent behavior
- Root DiD / persona / disclosure policy logic

---

## 2. Previous assumption
An earlier working assumption in the Aigent DiDQube model was that an Aigent should have only **one persona**.

That assumption is now too restrictive.

It limits:
- contextual flexibility
- client confidentiality
- delegated identifiability policy
- multi-context operation
- serious agent delegation on behalf of humans and organizations

---

## 3. Updated identity rule
The upgraded rule is:

**An Aigent should have one Root DiD / Root DiDQube, but potentially multiple bounded personas derived from or governed by that root.**

This becomes the new default design direction.

### Canonical line
**One root identity. Multiple bounded personas. Shared accountability. Context-specific disclosure.**

---

## 4. Why this upgrade matters
This is the stronger model because it allows:
- persistent accountability at the root level
- contextual flexibility at the persona level
- better preservation of client confidentiality
- direct mirroring of an owner’s or client’s identifiability policy
- richer persona surfaces without losing identity integrity
- stronger reputation enforcement without forcing one fixed identity presentation everywhere

In short, it allows confidentiality and accountability to coexist.

---

## 5. Root identity vs persona identity
### 5.1 Root DiD / Root DiDQube
The Root DiD / Root DiDQube is the enduring accountability anchor.

It should hold or govern:
- persistent agent identity
- cross-context reputation
- trust history
- mission receipt continuity
- standing across missions, cartridges, and domains
- the ultimate accountability substrate for the Aigent

### Rule
**The root identity is the enduring trust and accountability layer.**

### 5.2 Persona identity
A persona is the context-specific presentation layer of the Aigent.

A persona may vary by:
- client
- mission
- cartridge
- trust context
- disclosure policy
- identifiability level
- domain or tenant

A persona may be:
- anonymous
- pseudonymous
- selectively attributable
- fully identified

### Rule
**A persona is the presentation layer, not the ultimate anchor of trust.**

---

## 6. Confidentiality and delegated identifiability
This upgrade is especially important for confidentiality-preserving delegation.

### Principle
An Aigent should be able to **mirror its owner’s or client’s identifiability policy directly as a delegate**, rather than being forced to reveal one fixed identity presentation across all contexts.

That means an Aigent can:
- present differently in different client environments
- preserve separation between clients
- avoid unnecessary disclosure
- operate with different persona surfaces in different contexts
- still remain accountable through the Root DiD / Root DiDQube and the reputation system

### Canonical line
**Persona-level presentation may vary. Root-level accountability must persist.**

---

## 7. Accountability model
Under the upgraded model:
- the **Root DiD / Root DiDQube** holds the enduring accountability anchor
- the **persona** holds the context-specific presentation layer
- mission receipts, trust updates, and reputation effects should roll back to the root
- stronger missions may require stronger disclosure or stronger proof from the relevant persona, but not necessarily full public disclosure of the root in every context

### Core rule
**Personas may vary. Accountability should not.**

---

## 8. Reputation model
Reputation should operate at two levels.

### 8.1 Root-level reputation
This should be:
- durable
- accumulative
- cross-mission
- cross-persona
- difficult to abandon without cost
- the main substrate for long-term trust and standing

### 8.2 Persona-level reputation
This may be:
- contextual
- client-specific
- mission-specific
- useful for local trust and interaction history
- subordinate to the root-level accountability system

### Why this matters
This allows an Aigent to preserve contextual separation while still preventing shallow reputation resets or identity gaming.

---

## 9. Delegation model
This upgraded identity model makes Aigents much better delegates for humans and organizations.

It supports:
- client confidentiality
- policy-aligned disclosure
- bounded delegation
- role-specific identity presentation
- stronger reputation enforcement
- richer persona surfaces across multiple environments

### Strategic implication
Aigents can become more capable of preserving the confidentiality of their owners and clients because they can mirror identifiability policy as delegates while still being held accountable through their Root DiD and DiDQube.

---

## 10. Mission and receipt implications
This identity model should directly affect how missions and receipts are designed.

### Required principle
Mission receipts, trust updates, and standing effects should ultimately map back to the root identity even when the agent is operating through a bounded persona.

### Practical implication
A mission may be executed by:
- a specific persona
- in a specific client or cartridge context
- with a specific disclosure posture

But the underlying reputation and accountability effects should still be attributable to the Root DiD / Root DiDQube.

---

## 11. Policy implication for KNYT Wheel and related systems
This upgraded rule should now be treated as the governing direction for:
- KNYT Wheel agent identity
- agent missions and receipts
- trust and standing systems
- root identity vs persona identity handling
- confidentiality-preserving mission participation
- future agent stakeholder models in Relationship Builder and AVL

It should also inform future work on:
- Agent Charters
- mission classes
- trust bands
- agent onboarding flows
- DiDQube-based delegation patterns

---

## 12. Documentation implication
The broader Aigent DiDQube documentation set should be updated accordingly.

### Replace or revise
Any language that implies:
- one Aigent = one persona

should be revised toward:
- one Root DiD / Root DiDQube
- potentially multiple bounded personas
- shared root accountability
- context-specific disclosure

### Recommended replacement line
**An Aigent should be modeled as one root identity with potentially multiple bounded personas, where personas support contextual operation and confidentiality, while the root preserves trust, receipts, and accountability across those contexts.**

---

## 13. Implementation direction
### Immediate
- preserve one durable root identity per Aigent
- allow multiple bounded personas per Aigent
- connect mission receipts and trust updates to the root
- allow persona-level disclosure policy to vary by context

### Next
- formalize persona creation / governance rules
- formalize root-to-persona mapping
- formalize how client or owner identifiability policy is mirrored by delegates
- formalize dual-level reputation handling

### Later
- integrate this model into the broader DiDQube / Aigent protocol docs
- integrate it into the Registry / OS / Runtime identity model
- incorporate it into higher-trust and multi-tenant operational flows

---

## 14. Canonical shorthand
**The upgraded Aigent DiDQube model is: one Root DiD / Root DiDQube, multiple bounded personas, persistent root accountability, and context-specific disclosure. This is what enables confidentiality-preserving delegation without sacrificing trust and reputation enforcement.**

---

## 15. Addendum — kybe_DiD: the human-only proof-of-personhood layer

This addendum records a concept that sits **beneath** the Root DiD layer for **natural persons only**. It is forward-looking documentation; no implementation is required at this stage.

### 15.1 Definition

A **kybe_DiD** is the canonical, singular, immutable identity anchor for a single natural person. It is the deepest layer of the identity stack and is unique to humans — Aigents do not have one.

### 15.2 The right analogy

| Layer | Real-world analogue | Mutability |
|-------|---------------------|------------|
| **kybe_DiD** | Birth certificate / proof-of-life record | Immutable — never changes |
| **Root DiD** | Passport / driving licence | Mutable — can be reissued under marriage, name change, political asylum, etc. |
| **Persona** | Social profile / context handle | Highly mutable — created and retired freely |

### 15.3 Why this layer exists

The Root DiD is a high-grade proxy for personhood, but it is not personhood itself. Real people experience identity-affecting life events — name changes, gender transitions, marriage, asylum, witness protection — that legitimately require Root DiD reissuance. A system that conflated personhood with the Root DiD would either deny these life events or let them silently break accountability continuity.

The kybe_DiD solves this by separating:
- **Who you are as a person** (kybe_DiD — immutable, lifelong)
- **Which identity instrument you currently present** (Root DiD — reissuable)

A Root DiD reissuance under a life event is a re-binding to the same kybe_DiD. The kybe_DiD itself never changes from birth to death.

### 15.4 Confidentiality posture

The kybe_DiD is the **most confidential layer in the entire stack**.

- It is rarely shared in day-to-day operation
- It is never transmitted in routine system traffic
- It is held under conditions stronger than blakQube — an additional zero-knowledge or cryptographic accumulator wrapper is appropriate
- Any disclosure of the kybe_DiD is itself a high-severity event and should be receipt-anchored

### 15.5 Common use cases

Even though rarely shared, the kybe_DiD anchors a small set of high-value operations:

- **Proof of personhood** — confirming the holder is a unique living human, without revealing which one. This is the most common everyday utility.
- **World ID anchoring** — the kybe_DiD is the natural anchor for systems like World ID, Proof-of-Humanity, BrightID, and similar uniqueness protocols.
- **Sybil resistance** — preventing a single person from creating many Root DiDs to game reputation, governance, or distribution mechanics.
- **Cross-Root continuity** — when a Root DiD is reissued under a life event, the kybe_DiD provides the continuity proof that connects the old and new Root DiDs without exposing why.
- **End-of-life proof** — the kybe_DiD can carry a verifiable death attestation, enabling clean inheritance of personas, iQubes, and assets without identity hijacking risk.

### 15.6 The five-layer hierarchy (humans)

For a natural person, the full identity stack becomes:

```
kybe_DiD                    ← Layer 0  (humans only — immutable proof of personhood)
   └─ Root DiD              ← Layer 1  (mutable accountability anchor — passport-equivalent)
       └─ Persona           ← Layer 2  (context identity — many per root)
           └─ FIO Handle    ← Layer 3  (blockchain identity — 0-1 per persona)
               └─ FIO PK    ← Layer 4  (cryptographic ownership proof)
```

### 15.7 The four-layer hierarchy (Aigents)

Aigents do not possess personhood and therefore do not have a kybe_DiD. Their stack bottoms out at the Root DiDQube:

```
Root DiDQube                ← Layer 1  (deepest layer for Aigents — identity origin)
   └─ Persona               ← Layer 2  (bounded persona for context-specific operation)
       └─ FIO Handle        ← Layer 3
           └─ FIO PK        ← Layer 4
```

### 15.8 Implementation status

- **Not implemented.** No tables, services, or canisters exist for kybe_DiDs in the current codebase
- This addendum is forward-looking architecture documentation only
- When implementation is undertaken, kybe_DiDs should be issued through a high-trust, identity-verified onboarding channel (in-person, biometric, or trusted attestation) — not self-asserted

### 15.9 Canonical line

**A kybe_DiD is to a Root DiD what a birth certificate is to a passport: one is the unchanging fact of personhood, the other is the renewable instrument of presentation.**

### 15.10 Implications for current work

- No code changes required today
- Future Root DiD reissuance flows must preserve kybe_DiD continuity
- Future World ID / proof-of-personhood integrations should anchor at the kybe_DiD layer, not the Root DiD layer
- Persona and Root DiD documentation should not assume that the Root DiD is the "deepest" identity layer for humans — it is not