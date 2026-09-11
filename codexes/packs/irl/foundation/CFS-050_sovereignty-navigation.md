# CFS-050 — Sovereignty Navigation

**Chrysalis Foundation · Constitutional Charter · Status: RATIFIED (operator-directed, 2026-07-24)**
**Date:** 2026-07-24
**Depends on / composes:** the Standard Cartridge Navigation Framework (`types/codex.ts`'s `TabGroup`/`CodexTab.group`, `CodexPanelDynamic.tsx`); SPEC-VLM-001 (Venture Lab & MoneyPenny Reorganisation) — the first applied test of this principle; the Human Agency System's existing action-oriented surfaces (onboarding verbs, SmartTriad's intent-driven model, Founder Office).
**Anchors:** `CLAUDE.md`'s existing "System Model — Aigent Z / Aigent C / metaMe" journey-stage ladder (`prospect → acolyte → keta → keji → first → zero`) and experience-depth ladder (`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`) — Sovereignty Navigation is the UI-facing expression of the same progression logic those ladders already encode server-side.

---

## 1. The governing principle

> **Navigation exists to guide agency, not to classify features.**

Most software answers *"where is the thing you're looking for?"* — navigation as information architecture, a map of where functionality lives. **Sovereignty Navigation** asks a different question of every navigational element on the platform:

> **"What is the next action that moves this person toward greater agency and sovereignty?"**

Navigation is movement. Movement implies progression. Progression should move a person toward increasing capability, responsibility, and sovereignty — not merely toward a feature. Navigation is not the goal; progress is. Navigation is simply the visible expression of progress.

**Definition, canonical:** *Sovereignty Navigation is navigation that continuously guides a person toward greater constitutional capability, participation, delegation, responsibility, and agency.*

This governs **human interaction with the runtime**, not merely UI design — it belongs alongside this platform's other constitutional computing principles, not filed as a UI style guide.

*Ratified for the canon (operator-directed 2026-07-24) as a governance/architecture principle — it asserts how the Institute's surfaces should relate to the people using them, not an empirical claim requiring experimental validation, per the hypothesis-vs-canon discipline (`inv.reasoning` class).*

## 2. Constitutional Navigation Principle 001 — Action over object

Navigation should be action-oriented rather than object-oriented. Users navigate by intention, not by implementation.

| Instead of | Prefer |
|---|---|
| Community | Connect |
| Financial Services | Service |
| Growth Matrix | Grow |

The destination may still be the same underlying surface (Growth Matrix, Financial Services) — the navigation expresses the user's intent, not the platform's internal module boundary.

## 3. Constitutional Navigation Principle 002 — Progressive agency

Navigation should progressively increase agency. Every navigation decision should gently encourage movement toward greater constitutional participation — not by forcing a single linear path, but by making the *next* rung visible and reachable from wherever the person currently stands. Illustrative ladder (not a rigid gate — a shape, not a requirement):

```
Citizen → Participate → Passport → Delegate → Operate → Steward → Founder Office → Portfolio Operator
```

The navigation itself becomes part of the sovereignty journey, in the same spirit as this platform's existing journey-stage ladder (`prospect → acolyte → keta → keji → first → zero`, CLAUDE.md "System Model") and experience-depth ladder (`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`) — Sovereignty Navigation is that same progression logic, made visible in the navigation surface itself rather than only reasoned about server-side.

## 4. Constitutional Navigation Principle 003 — Reveal capability when relevant

Navigation should reveal capability only when it becomes relevant to the person's current intention. The user should not need to understand the platform's architecture — only what they are trying to accomplish. The runtime determines which capabilities support that intention, and surfaces them accordingly, rather than presenting the full capability surface area up front regardless of relevance.

## 5. Constitutional Navigation Principle 004 — Cross-cartridge consistency

Navigation should remain consistent across cartridges. Every cartridge should answer the same three questions, in the same order:

```
What am I trying to do?  →  What options exist?  →  What is my next action?
```

That consistency is what reduces cognitive load — a user who understands one cartridge should immediately understand every other cartridge (the same principle already stated for the Standard Cartridge Navigation Framework, SPEC-VLM-001 §3.1, extended here from a UI-consistency argument to a sovereignty-progression argument).

## 6. Scope of this ratification — principle now, platform review later

**Ratified now:** the four principles above (§§2–5), as a constitutional design principle governing all future navigation work on this platform.

**Explicitly deferred, not undertaken now:** a platform-wide review of every tab, menu, cartridge, sidebar, button, wizard, and onboarding flow against the question *"does this describe an action that advances agency, or merely a place where functionality lives?"* This is real, tracked future work — not abandoned, not implied by this ratification to be urgent. It should be taken up gradually, as cartridges evolve naturally, the same way this platform has historically adopted other constitutional invariants — never as a single disruptive overhaul.

**Applied now, as the first test:** Venture Lab, per SPEC-VLM-001. Venture Lab's five-domain regroup (Operate / Connect / Service / Grow / Administer) is the first live application of Sovereignty Navigation — proof of the principle before any wider adoption, not a prerequisite the principle depends on.

## 7. What this changes for future cartridge design

When a new cartridge (or a new capability inside an existing one) is designed, the first question is no longer *"what tabs do I need?"* — it is:

> **"What journey toward greater agency am I helping this person make?"**

The navigation then emerges from that journey, not the other way around.
