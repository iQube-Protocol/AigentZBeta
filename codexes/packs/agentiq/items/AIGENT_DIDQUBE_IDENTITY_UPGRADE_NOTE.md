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