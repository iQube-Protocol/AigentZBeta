# metaMe Companion 1.1 — Scope

## Constitutional Reconstitution Around Agent Me

**Status:** RATIFIED SCOPE (operator, 2026-07-26)
**Version:** 1.1
**Document class:** **Scope, deliberately not a PRD.** Operator's framing: *"This is not a new product. It is a constitutional reconstitution of an existing product."* A PRD would invite the question *"what should this product do?"* — the wrong question here, because the answer is *what it already does*. Naming it a Scope keeps the frame on reorganisation.
**Origin:** the third paragraph of the D-5 ruling (SPEC-TCP-001 §6a), separated out on the operator's instruction so that D-5 is not expanded into a Companion redesign inside the Threshold Crossing programme.
**Relationship to SPEC-TCP-001:** disjoint, and §9 states the one place they touch.
**Relationship to PRD-MMC-001 / SPEC-MMC-003:** extends the Companion those define. Supersedes neither.

---

## 1. Objective

Reconstitute the existing metaMe Companion around the Agent Me Copilot so that **Agent Me becomes the citizen's single constitutional companion across every runtime.**

**This release introduces no new constitutional capabilities.** It reorganizes existing capabilities into a single, consistent companion experience.

## 2. Vision

A citizen should encounter exactly the same companion everywhere — metaMe Runtime, Browser Companion, Partner Applications, Workspace integrations, Voice, Avatar.

**The host changes. The companion does not.**

## 3. Constitutional Principle

> **Agent Me is the Companion.**

The Edge Companion becomes a **host** for Agent Me rather than maintaining its own independent conversational interface.

### 3.1 Constitutional Continuity Principle

> A citizen should never have to decide which Agent Me they are talking to. Regardless of whether they engage through the Runtime, the Edge Companion, a partner application, voice, or an embodied avatar, they are always interacting with the same constitutional companion. Different surfaces present the same relationship; they do not create separate ones.

This is the real purpose of Companion 1.1. It shifts the Companion from being *"another interface"* to being one of several **windows into the citizen's single, persistent constitutional relationship with Agent Me.**

**Scoped per persona, deliberately not global (D-6).** *One constitutional relationship per persona.* The conversation is continuous across Runtime, Companion and partner sites **because those are all windows into the same persona** — not because continuity is a global property of the platform. **Different personas still have different constitutional relationships**, and nothing here merges them. Stating the boundary matters as much as stating the continuity: an implementation that made the conversation global would have collapsed the persona model while appearing to satisfy this principle.

**Registration note:** this is a governance rule about how the platform works, not an empirical claim about the world, so it is **eligible for `canonical`** under the hypothesis-vs-canon discipline. It is recorded here as an **invariant candidate** pending operator registration; this Scope does not self-canonize it.

---

## 4. Objectives

### 4.1 Unify conversational experience

Replace the Companion conversation panel with the existing Agent Me Copilot interface. **No duplicate chat implementations.** One conversation. One memory. One constitutional relationship.

### 4.2 Preserve existing capability

Retain all current Companion capabilities — Wallet · Agreements · Activity · Receipts · Quick Links · Overlay · Search · Workspace · Settings · Voice · Avatar. **These are reorganized rather than replaced.**

### 4.3 Establish one navigation model — *shared constitutional navigation with adaptive presentation*

The Companion uses the **same navigation principles as metaMe Runtime**. Bottom navigation becomes canonical:

```
Avatar   Wallet   Agent Me   Search   Workbench   Overlay
```

Additional icons may evolve over time **without changing the underlying architecture**.

**The navigation vocabulary is identical; the presentation adapts to the host.**

| Surface | Vocabulary | Presentation |
|---|---|---|
| metaMe Runtime | the canonical item set | full |
| Browser Companion | the same concepts | different spacing |
| Partner site | the same concepts | compact |

**The invariant is that the citizen never has to relearn navigation.** Adaptive presentation is permitted; a different vocabulary is not. "Adaptive" governs spacing, density and affordance size — never which concepts exist, what they are called, or what order they appear in.

### 4.4 Create one constitutional surface

Every runtime exposes the same Agent Me:

```
Conversation → Memory → ExperienceModel → Receipts → Workspace
             → Knowledge → Delegation → Avatar → Voice
```

**There is no separate "Extension AI" or "Runtime AI."**

### 4.5 Prepare embodiment

The Companion architecture treats **Voice and Avatar as presentation layers over the same Agent Me session.** The avatar is not another assistant; it is another rendering of Agent Me.

**The avatar owns no session of its own (D-8).** Voice, text and avatar all operate against exactly the same live conversation: **no avatar-specific memory, no avatar-specific AI, no avatar-specific context.** This is among the most consequential architectural decisions in this Scope, because the opposite arrangement — an avatar with its own model and its own memory — is the single most natural way to accidentally create a second Agent Me while believing you are only changing how one is rendered. It would satisfy every visual success criterion and violate §3.1 completely.

---

## 5. In scope

| Area | Scope |
|---|---|
| **Agent Me** | Use the **existing** Agent Me Copilot as the primary Companion interface. No new conversation implementation |
| **Navigation** | Reorganize Companion navigation; bottom navigation canonical. **Wallet becomes a peer mode**, not a separate application |
| **Wallet** | Functionally unchanged. Only navigation changes |
| **Search** | Exposed as a first-class Companion mode. **No search redesign** |
| **Overlay** | Exposed as a Companion mode. Maintains the existing Wallet-over-Cartridge overlay architecture |
| **Workbench** | Exposed as a Companion mode. **No workflow redesign** |
| **Quick Links** | Become Agent Me actions — Agent Me opens them while maintaining conversational continuity |
| **Avatar** | Existing avatar retained, **no visual redesign**. One architectural requirement: it renders Agent Me rather than an isolated uploaded knowledge model (see §5.2) |
| **Voice** | Existing voice integration continues. Voice becomes another interaction channel for the same Agent Me session |
| **Activity** | Preserve Agreements · Receipts · Activity timeline · Constitutional history, all within the Companion |
| **Settings** | Preserved. Relocated only if the new navigation requires it |

### 5.1 Quick Links — the behavioural contract

```
Open Venture Lab  →  Agent Me opens Venture Lab  →  Conversation continues
```

Following a Quick Link must **not fork, reset, or replace the conversation**. The runtime moves; the conversation continues. That single property is what distinguishes this from "a menu that happens to sit in the chat," and it is the first thing to canary (§11.2).

### 5.2 The one item in scope that is a rewiring, not a relayout

Every other in-scope item is layout, navigation or exposure. **The avatar requirement is different in kind:** today the avatar may be backed by a separately uploaded knowledge model; §4.5 and §5 require it to render Agent Me instead.

This is called out explicitly rather than left buried, because it is the one place a reader could reasonably ask whether §6's no-new-capabilities rule is being bent. It is not: **no capability is added** — the avatar already speaks, and Agent Me already reasons. What changes is which runtime backs the rendering. But it is a behavioural change rather than a cosmetic one, so it carries its own verification burden (§11.6) and must not be sequenced as though it were a layout task (§12, C5).

---

## 6. Explicitly out of scope

Companion 1.1 does **not** introduce:

- new constitutional capabilities
- new delegation model
- new wallet functionality
- new search engine
- new overlay capabilities
- new workspace model
- new memory architecture
- new avatar behaviours
- new voice architecture

Those belong to future programmes.

### 6.1 The no-new-capabilities rule, operationally

Every proposed item must trace to a capability that already ships.

> **Where consolidation reveals a capability gap, Companion 1.1 records the gap and defers it to a subsequent charter. Companion 1.1 never introduces new constitutional capability to close such gaps.**

That wording is deliberately absolute. The failure mode it forecloses is scope expansion under the guise of *"just one missing thing"* — which is how a layout release becomes a platform redesign, one reasonable-sounding exception at a time. Saying *"that is 2.x"* is a success of this Scope, not a failure of it.

Also out of scope by ownership rather than by rule: Threshold Crossing behaviour (SPEC-TCP-001), Stage B module hosting (TCP D-5 / §6a), Companion install/pairing observability (SPEC-MMC-003 + TCP D-9 — 1.1 consumes whatever exists and changes nothing), and personalization derivation (TCP §6b.4).

---

## 7. Runtime architecture

```
                  Agent Me Runtime
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
  metaMe Runtime     Edge Companion     Partner Site
      │                  │                  │
      └──────────────────┼──────────────────┘
                         │
                 Shared Conversation
                 Shared Memory
                 Shared Context
                 Shared Delegation
                 Shared ExperienceModel
                 Shared Knowledge
```

**The runtime is singular. Presentation surfaces are plural.**

---

## 8. Constitutional constraints inherited

1. **Principal–Delegate Separation (CFS-043 §2).** Agent Me acting on the citizen's behalf is still bounded delegation. Anything that today requires human authorisation continues to. **A Quick Link becoming an Agent Me action MUST NOT convert an authorised step into an automatic one** — the single most likely way a reorganisation causes a constitutional regression, and therefore canaried (§11.3) rather than reviewed.
2. **Identity spine.** One resolved persona per surface; `personaFetch` with a consistent `personaIdHint` on every spine read. A Companion whose panels resolve two different personas is the exact inconsistency the spine exists to abolish — and §7's shared context makes this sharper, not softer.
3. **Identifier tiers.** T0 identifiers never cross to the Companion, the extension, or a partner site.
4. **Wallet-Over-Cartridge Overlay (CLAUDE.md).** TCP §6a.4 records that the section's *side-by-side* wording is superseded by toggled peer modes. Whichever build lands first owns that amendment; if it is this one, it must make it.
5. **House style.** Slate surfaces, `border-slate-800`, no white hairlines — a navigation rebuild is exactly where the deprecated residual creeps back.

---

## 9. Relationship to Threshold Crossing

**Companion 1.1 does not modify Threshold Crossing.** It remains:

```
Passport → Delegation → Agent Me Activation → Companion Pairing → Threshold Crossed
```

ExperienceModel, ExperienceGuide, Preferences and personalization remain **post-threshold enrichment, not prerequisites.**

### 9.1 This resolves TCP D-24 — recorded, because it was an open blocking decision

D-24 asked whether **Companion installed / paired** survive as Threshold Crossing criteria, after the D-7 supersession named only *"Passport, Delegation and Agent Me activation."* This Scope answers it: **Companion Pairing is retained**, as the fourth and final step before Threshold Crossed.

Two consequences follow, both written back into SPEC-TCP-001:

- **`Companion installed` is not listed as a separate criterion.** Pairing cannot occur without an installed Companion, so install is treated as a **precondition of pairing rather than an independent criterion.** This is an inference from the four-step sequence, not a statement the operator made — flagged so it can be corrected cheaply if separate install tracking is wanted.
- **TCP D-9 remains the long pole.** Pairing state lives in `chrome.storage.local` only, so the retained criterion is still unobservable server-side. This settles the conditional left open earlier: D-9 is on the threshold critical path, and D-10 is not the long pole.

---

## 10. Relationship to ExperienceModel

The ExperienceModel becomes **progressively populated through interaction with Agent Me.** Manual editing remains available; the setup forms become **review and refinement tools rather than mandatory onboarding.**

This is the consumption side of TCP §6b.4.

> **Deferred to Companion 1.2:** progressive derivation and population of the ExperienceModel and ExperienceGuide from ongoing interaction with Agent Me. **Companion 1.1 consumes these models if they exist but does not alter how they are created or maintained.**

The deferral is stated explicitly, with its reason, so that a later reader does not mistake the omission for an oversight: the models are **post-threshold enrichment, not prerequisites** (TCP D-7 as superseded), and building their derivation would be new capability under §6.1.

---

## 11. Canary obligations

Recorded at scope time so they are designed in rather than retrofitted:

1. **No-new-capability canary.** The capability set reachable from the Companion after 1.1 equals the set before it. Derived from the §12 C0 inventory, never hand-maintained (`inv.engineering.036`).
2. **Conversation-continuity canary.** Following a Quick Link moves the runtime without forking, resetting or replacing the conversation (§5.1).
3. **Authority-boundary canary.** No affordance that previously required human authorisation becomes agent-completable. Structural, in the style of `tests/moneypenny-runtime-authority-boundary.test.ts`.
4. **Single-persona canary.** Every spine read on the Companion resolves the same persona; no mixed transports.
5. **House-style canary.** No white hairline borders on the rebuilt navigation.
6. **Single-session canary (D-8).** Voice, Avatar and text operate against the **same** Agent Me session, with no avatar-specific memory, model or context. This is the assertion that §4.5 and §5.2 are actually true rather than merely intended — and it is the canary that would catch a second Agent Me being created by accident.
7. **Navigation-vocabulary canary (D-3).** The item set is identical across surfaces; only presentation differs. Derived from one shared definition, never three hand-maintained lists (`inv.engineering.036`).

---

## 12. Sequencing (indicative — gated on §13)

| Phase | Scope | Gated on |
|---|---|---|
| **C0** | **Capability inventory.** Enumerate every conversational surface, Quick Link and navigation affordance across Runtime / Companion / Partner, each with its shipped capability | — |
| **C1** | Agent Me as the primary Companion interface at Companion dimensions (§4.1) | ~~D-2~~ (ratified: inside-only) |
| **C2** | Canonical bottom navigation; Wallet / Search / Overlay / Workbench as peer modes (§4.3), shared vocabulary with adaptive presentation | ~~D-4~~ (ratified), and C1 |
| **C3** | Quick Links as Agent Me actions, one continuous conversation (§5.1) | C1 |
| **C4** | Activity / Agreements / Receipts / Settings relocated into the new navigation (§5) | C2 |
| **C5** | Avatar renders Agent Me; Voice as a channel on the same session (§4.5, §5.2, D-8) | C1 |

**C0 is not optional.** §6.1 is unenforceable without an inventory of what already ships — "no new capabilities" can only be checked against a list of the existing ones, and §11.1's canary derives from it.

**All §13 decisions are now ratified**, so C0–C5 are gated only on each other.

**C5 is sequenced last deliberately** — it is the one behavioural rewiring (§5.2), and it should land against a Companion whose session model has already been proved singular by C1–C3.

---

## 13. Decision register

| # | Question | Resolution | Status |
|---|---|---|---|
| **D-1** | Is §6's no-new-capabilities constraint absolute, including where reorganisation exposes a gap? | **RATIFIED (Aletheon review, operator-forwarded 2026-07-26), with strengthened wording now in §6.1:** *"Where consolidation reveals a capability gap, Companion 1.1 records the gap and defers it to a subsequent charter. Companion 1.1 never introduces new constitutional capability to close such gaps."* Absolute, to foreclose scope expansion under the guise of "just one missing thing" | **RATIFIED** |
| **D-2** | Does "the Companion becomes the host" change the extension's own chrome, or only what renders inside it? | **RATIFIED: inside-only.** Companion 1.1 governs what renders **inside the existing side panel**. Browser actions, permissions, extension lifecycle, popup behaviour and store packaging are **Extension 2.x** concerns and are untouched | **RATIFIED** |
| **D-3** | What "unified navigation" means across Runtime / Companion / partner surfaces | **RATIFIED: shared constitutional navigation with adaptive presentation** (§4.3). The navigation **vocabulary is identical**; the **presentation adapts** to the host (full / different spacing / compact). The invariant: the citizen never has to relearn navigation. **This refines rather than reverses the operator's earlier "no change"** — that answer settled *whether to redesign* (no); this settles *how the unchanged model renders across three surfaces*, which the earlier answer did not address. Flagged in case "no change" was meant as literally identical rendering | **RATIFIED (refinement)** |
| **D-4** | On a partner site, does navigation render only inside the Companion's own frame, or is injection into the host page contemplated? | **RATIFIED: Companion frame only. Absolutely no host-page injection.** This keeps the trust boundary clean. Supersedes the assumption previously recorded here pending a ruling — the assumption was correct, and is now a decision | **RATIFIED** |
| **D-5** | Which surfaces' histories merge, and does merging change retention or visibility of any record? | **RATIFIED: merge presentation only.** Nothing changes about receipts, storage, retention or audit history — only **where they are surfaced**. If a record becomes visible where it was not, that is a capability change (§6.1) | **RATIFIED** |
| **D-6** | Is "a single continuous conversation" scoped per persona, per surface, or global? | **RATIFIED: one constitutional relationship per persona** (§3.1). Continuous across Runtime, Companion and partner sites **because those are windows onto the same persona** — **not global.** Different personas retain different constitutional relationships, and nothing here merges them | **RATIFIED** |
| **D-7** | Does any 1.1 surface emit receipts, or is the release receipt-neutral? | **RATIFIED: receipt-neutral.** Emitting receipts from a layout release would accidentally change constitutional behaviour | **RATIFIED** |
| **D-8** | **NEW (Aletheon review).** Does the avatar own a separate conversational session? | **RATIFIED: no.** The avatar is another **renderer** of Agent Me. Voice, text and avatar operate against exactly the same live conversation — **no avatar-specific memory, no avatar-specific AI, no avatar-specific context** (§4.5). Among the most consequential decisions in this Scope: an avatar with its own model and memory is the most natural way to create a second Agent Me while believing you are only changing a rendering, and it would pass every visual criterion while violating §3.1 outright | **RATIFIED** |

---

## 14. Success criteria

Companion 1.1 is complete when:

1. Agent Me is the primary Companion interface.
2. Wallet, Search, Overlay and Workbench are peer modes within the same Companion.
3. Runtime and Companion expose the same conversational experience.
4. Quick Links drive Agent Me rather than bypassing it.
5. Voice and Avatar operate against the same Agent Me session.
6. **No existing constitutional capability is lost.**
7. **The citizen never has to decide which Agent Me they are speaking to.**

Criterion 7 is the behavioural test for the whole release. If a citizen ever wonders *"am I talking to the Runtime AI or the Extension AI?"* — Companion 1.1 has failed, however well every other criterion reads.

---

## 15. Future evolution — not part of 1.1

**Companion 1.2 — the nearest deferral.** Progressive derivation and population of the ExperienceModel and ExperienceGuide from ongoing interaction with Agent Me (§10). 1.1 consumes those models if they exist; it does not alter how they are created or maintained.

**Extension 2.x.** Browser actions, permissions, extension lifecycle, popup behaviour and store packaging — everything D-2 placed outside the side panel.

Companion 2.x may explore:

- Dynamic avatar providers backed directly by the Agent Me knowledge runtime.
- Continuous multimodal interaction (voice, avatar, text) within a single live session.
- Cross-device session continuity.
- Mobile-native Companion surfaces.
- Rich embodiment and expressive interaction.
