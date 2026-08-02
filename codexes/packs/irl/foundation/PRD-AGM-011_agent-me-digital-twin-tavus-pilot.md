# PRD-AGM-011 — Agent Me Digital Twin (Tavus Pilot)

**Document ID:** PRD-AGM-011
**Status:** **Draft — canonised for review and planning. NOT approved for execution.**
**Version:** 0.1
**Date:** 2026-08-02
**Product owners:** metaProof / metaMe
**First embodiment provider:** Tavus
**Primary system:** Agent Me (aigentMe) delegated personas
**Supporting systems:** Polity Passport, delegation framework, constitutional memory, receipts, standing
**Classification:** Constitutional architecture specification

---

## Canonisation note (read first)

Canonised as a **specification of record**, not an authorisation to build — the same footing as
`PRD-DIDQ-QBIT-001`.

| | |
|---|---|
| **Architectural direction** | Operator-authored, 2026-08-02 |
| **Implementation specification** | Provided, pending review |
| **Execution authority** | **NOT granted.** An execution plan must be written and approved first. |
| **Current code state** | A **D-ID** iframe host exists (`packages/avatar-host/`, `app/components/metaVatar/MetaAvatar.tsx`). It carries **no** delegate-status, principal, mandate or limits fields. No embodiment adapter exists. No Tavus integration exists. |
| **Related ratified doctrine** | `services/polity/frameworks/agent-charter.v1.json` → `agentsMustBeIdentifiedAsNonHuman: true` |

**Cross-references to the Constitutional Internet audit.** This PRD is the artifact that would close
discrepancy **B-1** (*the embodied delegate has no code, test or receipt*) and supply the
implementation evidence sought by matrix rows **CI-07** and **CI-15**. Until it is built, tested and
receipted, the manuscript's embodied-delegate passages remain **Projected**.

---

## Purpose

Introduce **Digital Twin** as a capability of **delegated Agent Me personas**. The pilot integrates
**Tavus** as the first embodiment provider while preserving a **provider-independent constitutional
embodiment architecture**.

> **This is not an avatar feature. It is the first implementation of constitutional digital
> embodiment.**

The significance is architectural, not cosmetic. It establishes a new constitutional primitive —
**delegated embodiment**. Just as bounded delegation governs *what* an agent may do, embodied
delegation governs *how that agent appears in the world*. That becomes the foundation for every
future embodiment provider — Tavus, D-ID, HeyGen, MetaHuman, robotics — **without changing the
constitutional model**.

---

## Constitutional principle

> **The Citizen is never embodied.**
> **Delegated personas may be embodied.**

Digital Twins are **constitutional capabilities attached to delegated personas through bounded
delegation**. They may act **only within the authority delegated to that persona**.

### Architecture

```text
Citizen
      │
Polity Passport
      │
Delegation
      │
Persona
      │
Digital Twin
      │
Avatar Provider
```

**Not:**

```text
Citizen
      │
Avatar
```

**This distinction is extremely important.** The avatar belongs to a **delegated persona**, not to
the Citizen directly. That preserves bounded delegation and makes the avatar another constitutional
capability of that persona rather than becoming the user's universal identity.

---

## Embodiment adapter

A provider abstraction. **Agent Me never speaks directly to Tavus — everything goes through the
adapter.**

```ts
interface EmbodimentProvider {
  createAvatar()
  updateAvatar()
  deleteAvatar()
  startConversation()
  endConversation()
  synchronizeMemory()
  getCapabilities()
  getStatus()
}
```

Providers become plugins: `TavusProvider` · `DIDProvider` · `HeyGenProvider` · `MetaHumanProvider` ·
`FutureProvider`.

> **Note:** `DIDProvider` is **not hypothetical**. D-ID is already in place
> (`packages/avatar-host/`, `app/components/metaVatar/MetaAvatar.tsx`). The adapter work therefore
> **absorbs an existing integration** rather than starting greenfield — the existing host becomes the
> first provider implementation behind the interface.

---

## Agent Me workflow

Within Agent Me, **"Avatar" becomes "Digital Twin"**. Selecting it launches:

| Step | Action |
|---|---|
| **1** | **Choose delegated persona** — Founder · Researcher · Creative · Steward · MoneyPenny · etc. **Only delegated personas appear.** |
| **2** | **Choose embodiment provider** — initially Tavus; future D-ID, HeyGen, MetaHuman |
| **3** | **Capture** — upload video or record video, following Tavus onboarding |
| **4** | **Voice** — select existing voice or clone voice |
| **5** | **Confirmation** — the full chain shown to the user: Citizen → Passport → Delegation → Founder Persona → Digital Twin → Tavus. User confirms. |
| **6** | **Provision** — platform creates: Digital Twin Record · Embodiment Record · Provider Mapping · Capability References |

---

## Persona binding

Each delegated persona may have **0 or 1** Digital Twin.

> **One avatar. One delegated persona. One constitutional authority. No sharing.**

---

## Runtime

```text
Agent Me activates
      ↓
Current Persona
      ↓
Digital Twin?
      ↓ yes
Launch Tavus session
      ↓
Conversation → Memory → Receipts → Standing
```

If no Digital Twin exists → **normal Copilot**.

---

## Memory

**Conversation memory remains entirely inside Agent Me. Tavus is rendering only.**

```text
Agent Me → constitutional memory → Tavus
```

**Never:**

```text
Tavus → memory
```

**That distinction is critical.** It is the same shape as `PRD-DIDQ-QBIT-001`'s entropy invariant —
*the provider contributes a capability; it never becomes the source of constitutional state.*

---

## Knowledge

Knowledge always comes from **Agent Me**, not Tavus.

Tavus provides **only**: Input · Output · Emotion · Lip Sync · Video · Streaming. **Nothing else.**

---

## Constitutional receipts

Every interaction generates: **Conversation Receipt · Delegation Receipt · Standing Receipt ·
Session Receipt** — exactly like chat today.

> **Embodiment changes nothing constitutionally.**

*Audit note (CR-11): receipt **generation** is distinct from receipt **anchoring**. These receipts
must be specified by class, and any anchoring claim scoped to the class actually anchored. Governance
anchoring is presently not operational.*

---

## Sovereignty ladder

The commercial ladder already exists:

```text
Citizen → Digital Twin → Premium → Voice Clone → Professional
        → Multiple Personas → Enterprise → Team Twins
```

---

## Future providers

Nothing here is Tavus-specific:

```text
Agent Me → Embodiment Adapter → Tavus / D-ID / HeyGen / MetaHuman / future providers
```

**The Citizen never notices.**

### MetaHuman bridge — reserved scope

**MetaHuman is explicitly reserved** for **platform-owned characters**: metaKnyt characters ·
constitutional guides · platform agents · immersive Founder Office · XR · conferences · embodied
Venture Lab.

**Tavus is your constitutional digital twin.**

That distinction is clean and avoids forcing one technology to serve two very different purposes.

---

## Success criteria (pilot — deliberately simple)

1. A Citizen can select **one** delegated persona.
2. That persona can provision a Tavus Digital Twin.
3. The Digital Twin speaks using **Agent Me's** constitutional memory and knowledge.
4. All interactions continue to generate constitutional receipts and standing.
5. The embodiment provider **remains interchangeable** through the adapter.

---

## ⚠ Open gap flagged for review — third-party disclosure

**Raised by the agent during canonisation; not a change to the PRD, and requiring an operator ruling.**

This PRD governs the **constitutional chain** (who may be embodied, under whose authority, with whose
memory) rigorously. It does **not yet specify the disclosure surface** that the manuscript's ratified
embodied-delegate doctrine requires.

The manuscript (**ADD-1**, `01-working-manuscript.md:5030-5045`) states that an embodied delegate
**must make its status legible** — that those encountering it can know:

- that it **is an agent**;
- **which person** it represents;
- whether the person **authorised this appearance**;
- what **role** it is performing;
- what subjects it **may address**;
- what **commitments** it may make;
- when it must **defer** to the person;
- how its actions can be **verified**.

And the governing proof question: *"How can those encountering the agent know what it is, whom it
represents, what authority it possesses, and where that authority ends?"*

**Current state.** `agentsMustBeIdentifiedAsNonHuman: true` is **ratified doctrine** in
`agent-charter.v1.json`, but no rendering surface implements it: grep of `packages/avatar-host/` and
`app/components/metaVatar/` returns **no** principal, delegate-status, mandate or disclosure fields.

**Why it matters here.** PRD-AGM-011's Step 5 shows the full delegation chain **to the Citizen
provisioning the twin**. The manuscript's requirement is about **the third party encountering it** —
a different audience and a different surface. Without it, the pilot could ship a constitutionally
correct twin that is nonetheless **indistinguishable from the person** to everyone who meets it,
which is precisely the harm the doctrine names: *"the closer the representation comes to the person,
the clearer the delegation must become."*

**Recommendation:** add a **disclosure profile** to the `EmbodimentProvider` interface and to the
Digital Twin Record — carried per session, surfaced to counterparties, and receipted. Until it
exists, the manuscript's embodied-delegate passages must remain **Projected** (discrepancy **B-1**
stays open) even if the twin ships.

---

## Next actions (execution not authorised)

1. **Write an execution plan** — sequencing, owners, review gates. **This PRD is not an authorisation
   to build.**
2. Operator ruling on the **disclosure gap** above.
3. Constitutional admissibility review against the delegation framework and agent charter.
4. Adapter design absorbing the existing D-ID host as `DIDProvider`.
5. Tavus technical discovery and contractual terms (memory boundary, retention, deletion).
6. Only then begin the pilot.

Until implementation, tests and receipts exist, **CI-07 / CI-15 embodied-delegate claims remain
Projected** and discrepancy **B-1** remains open.
