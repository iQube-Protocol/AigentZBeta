# SPEC-MMC-004 — Companion 1.1: reconstituting the Edge Companion around aigentMe

**Status:** CHARTERED 2026-07-26 (docs-first, ratify-before-build). No code authorised.
**Origin:** the third paragraph of the operator's D-5 ruling (SPEC-TCP-001 §6a), separated out on the operator's instruction: *"Complete the current implementation programme exactly as scoped. Do not expand D-5 into a Companion redesign. Create a separate Companion 1.1 charter…"*
**Relationship to SPEC-TCP-001:** disjoint. TCP's D-5 authorises Stage B **hosting** only (`CodexCopilotLayer` mounted as the full-width aigentMe runtime; wallet and aigentMe as toggled peer modes). Everything in this charter is explicitly out of TCP's scope.
**Relationship to PRD-MMC-001 / SPEC-MMC-003:** extends the Companion those documents define. Does not supersede either.

---

## 1. Purpose

Reconstitute the Edge Companion around the **existing** aigentMe Copilot.

- The **Companion becomes the container.**
- **aigentMe becomes the primary interaction surface.**

The Companion today is a panel that hosts several things, one of which is a conversational surface. After 1.1 it is a shell whose primary occupant is aigentMe, with everything else reachable *through* that conversation rather than beside it.

## 2. The hard constraint — no new capabilities

**Companion 1.1 introduces NO new capabilities. Only layout, navigation and interaction consolidation.**

This is the charter's governing constraint and its main risk control. Every proposed item must be traceable to a capability that already ships. If a slice requires a new capability, it is not part of 1.1 — it is a later charter, and saying so is the correct outcome rather than a failure.

Concretely, 1.1 may **not**:

- add a new agent skill, tool, or MCP verb;
- add a new data store, table, or persisted entity;
- add a new external integration;
- change any authority boundary, gate, or consent surface;
- change what aigentMe is *permitted* to do — only how the citizen reaches it.

Where consolidation surfaces a genuine capability gap, the charter's answer is to **record the gap**, not to fill it.

## 3. Scope

### 3.1 aigentMe as the primary occupant

Mount the existing aigentMe Copilot (`CodexCopilotLayer`) as the Companion's primary surface at the Companion's own dimensions. Reuse before replacement (`inv.engineering.037`) — **no second Copilot is built, and none is embedded inside the Companion.** The shipped copilot IS the runtime.

### 3.2 Unified bottom navigation

One bottom navigation, consistent across **Runtime, Companion, and partner sites** — a single constitutional companion everywhere. The citizen should not have to learn a different companion depending on which surface they are standing on.

**The open question this raises (§6, D-3):** "consistent" spans three surfaces with genuinely different constraints — an in-app runtime, a browser extension panel, and a third-party page the platform does not control. Whether "unified" means *identical*, *the same items with surface-appropriate presentation*, or *the same information architecture* is a decision, not a detail.

### 3.3 Quick Links become aigentMe actions

Quick Links stop being navigation chrome and become **actions aigentMe performs on the citizen's behalf**, driving the left-hand runtime while maintaining **a single continuous conversation**.

The behavioural contract: following a Quick Link must not fork, reset, or replace the conversation. The runtime moves; the conversation continues. That single property is what distinguishes this from "a menu that also happens to be in the chat" and it should be the first thing canaried.

### 3.4 Interaction consolidation

Collapse today's duplicate conversational surfaces into one persistent constitutional interaction model, spanning: Runtime Copilot · Companion history · agreements · activity · settings.

**Preserved through the consolidation:** a single aigentMe identity across metaMe and the broader web. The citizen's companion is the same companion regardless of the surface it is reached through — which is the point of the whole exercise.

## 4. Explicitly out of scope

| Out | Why |
|---|---|
| Any new agent capability, skill, tool or MCP verb | §2 |
| Threshold Crossing behaviour | SPEC-TCP-001; this charter must not move that gate |
| Stage B module hosting | TCP D-5 / §6a — already scoped there, deliberately not duplicated |
| Companion install / pairing observability | SPEC-MMC-003 + TCP D-9; 1.1 consumes whatever exists, changes nothing |
| Authority, delegation, consent and gating changes | Principal–Delegate Separation is untouched by a layout charter |
| Personalization derivation (ExperienceModel / ExperienceGuide) | TCP §6b.4's post-threshold track; a separate build |

## 5. Constitutional constraints inherited

1. **Principal–Delegate Separation (CFS-043 §2).** aigentMe performing an action on the citizen's behalf is still bounded delegation. Anything that today requires human authorisation continues to; a Quick Link becoming an aigentMe action MUST NOT convert an authorised step into an automatic one. This is the single most likely way a layout change causes a constitutional regression, and it should be canaried rather than reviewed.
2. **Identity spine.** One resolved persona per surface. Every spine-endpoint read uses `personaFetch` with a consistent `personaIdHint`; a Companion that reads two different personas across its panels is the exact inconsistency the spine abolishes.
3. **Identifier tiers.** T0 identifiers never cross to the Companion, the extension, or a partner site. A partner-site surface makes this sharper, not softer.
4. **Wallet-Over-Cartridge Overlay (CLAUDE.md).** TCP §6a.4 already records that the section's *side-by-side* wording is superseded by toggled peer modes. Whichever charter's build lands first owns that amendment; if it is this one, it must make it.
5. **House style.** Slate surfaces, `border-slate-800`, no white hairlines. A navigation rebuild is precisely where the deprecated residual tends to creep back in.

## 6. Decision register

| # | Question | Recommendation | Status |
|---|---|---|---|
| **D-1** | Confirm §2's no-new-capabilities constraint is absolute for 1.1, including where consolidation exposes a capability gap | Adopt as absolute. Record gaps; do not fill them | **Open** |
| **D-2** | Does "the Companion becomes the container" change the extension's own chrome (popup, side panel entry), or only what is rendered inside it? | Prefer inside-only for 1.1 — extension chrome changes carry store-review and permission consequences disproportionate to a layout release | **Open** |
| **D-3** | What "unified bottom navigation" means across Runtime / Companion / partner sites: identical · same items, surface-appropriate presentation · same information architecture (§3.2) | **Requires an operator choice.** Do not default — the three readings imply materially different builds | **Open — BLOCKING for §3.2** |
| **D-4** | On a partner site, does the bottom navigation render inside the Companion's own frame only, or is any injection into the host page contemplated? | Companion frame only. Injecting navigation into a page the platform does not control is a security and trust surface, not a layout choice | **Open — BLOCKING for §3.2** |
| **D-5** | Which surfaces' histories merge in §3.4, and does merging alter retention or visibility of any existing record? | Merge presentation only; no change to retention or visibility. If a record becomes visible somewhere it was not, that is a capability change (§2) | **Open** |
| **D-6** | Is "a single continuous conversation" scoped per persona, per surface, or global across metaMe and partner sites? | Per persona, continuous across surfaces — that is what "single aigentMe identity across metaMe and the broader web" states. Confirm, because it determines the session model | **Open — BLOCKING for §3.3** |
| **D-7** | Does any 1.1 surface emit receipts, or is a layout release receipt-neutral? | Receipt-neutral. A layout change that starts emitting receipts is a capability change | **Open** |

## 7. Sequencing (indicative — not authorised until §6 resolves)

| Phase | Scope | Gated on |
|---|---|---|
| **C0** | Audit: enumerate every conversational surface, every Quick Link, and every navigation affordance across the three surfaces, with its shipped capability. The inventory is the evidence base for §2 | — |
| **C1** | aigentMe as primary occupant at Companion dimensions (§3.1) | D-2 |
| **C2** | Unified bottom navigation (§3.2) | D-3, D-4, and C1 |
| **C3** | Quick Links as aigentMe actions driving the left-hand runtime, one continuous conversation (§3.3) | D-6, and C1 |
| **C4** | Interaction consolidation (§3.4) | D-5, and C3 |

**C0 is not optional.** §2's constraint is unenforceable without an inventory of what already ships — "no new capabilities" can only be checked against a list of the existing ones.

## 8. Canary obligations

Recorded at charter time so they are designed in rather than retrofitted:

1. **No-new-capability canary.** The capability set reachable from the Companion after 1.1 equals the set before it. Derived from the C0 inventory, not hand-maintained (`inv.engineering.036`).
2. **Conversation-continuity canary.** Following a Quick Link moves the runtime without forking, resetting or replacing the conversation.
3. **Authority-boundary canary.** No affordance that previously required human authorisation becomes agent-completable. Structural, in the style of `tests/moneypenny-runtime-authority-boundary.test.ts`.
4. **Single-persona canary.** Every spine read on the Companion resolves the same persona; no mixed transports.
5. **House-style canary.** No white hairline borders reintroduced on the rebuilt navigation.

## 9. Success criteria

1. A citizen meets the same aigentMe on Runtime, in the Companion, and on a partner site, and it remembers the conversation.
2. Quick Links accomplish what they used to, as aigentMe actions, without a second conversational surface appearing anywhere.
3. The capability set is provably unchanged (§8.1).
4. No authority boundary moved (§8.3).
