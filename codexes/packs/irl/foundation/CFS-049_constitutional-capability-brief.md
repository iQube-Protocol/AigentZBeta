# CFS-049 — The Constitutional Capability Brief (CCB): Operationalization as a Lifecycle Stage

**Chrysalis Foundation · Constitutional Charter · Status: RATIFIED (operator-directed, 2026-07-24)**
**Date:** 2026-07-24
**Depends on / composes:** the existing PRD → Ratification → Implementation → Validation → Deployment chain (every PRD-\*/CFS-\* build in this repo); the Registry (`AigentQubeRegistry`, iQube registry SoT); Companion Search (`components/companion/CompanionSearchPanel.tsx`, PRD-MMC-001); the Artifact publishing framework (Claude's own artifact tool, already used for execution plans and review reports).
**Anchors:** `codexes/packs/agentiq/updates/` (session update docs — the CCB's markdown twin lives here), `codexes/packs/irl/collections.json` col_foundation (this charter's own registration).

---

## 1. The governing principle

> **A capability is not constitutionally complete when it deploys. It is complete when it is understood.** Code that ships without an operator-grade, human-readable record of what now exists, where it lives, and how to use it is a capability the constitution cannot yet account for — indistinguishable, from the outside, from something that was never built at all.

The existing constitutional lifecycle in this repo is forward-looking only:

```
Intent → PRD → Ratification → Implementation → Validation → Deployment
```

Every stage answers "what should exist" or "does it work." None of them answers the questions an operator, a support agent, a new session of Claude, or an end user actually asks after the fact:

- What just shipped?
- Where is it, in the running app?
- How do I use it?
- What problem did it solve?
- How does it integrate with everything else already built?
- What can't it do yet?

**Operationalization** is the missing stage. It closes the loop:

```
Intent → PRD → Ratification → Implementation → Validation → Deployment
                                                                  ↓
                                                    Constitutional Capability Brief
                                                                  ↓
                                                              Registry
```

*Proposed for the canon as a governance/lifecycle rule (`canonical` per the hypothesis-vs-canon discipline — this is a rule about how the Institute operates, not an empirical claim requiring experimental validation).*

## 2. What a Constitutional Capability Brief is

A **Constitutional Capability Brief (CCB)** is the operator-grade, backward-looking record of one completed capability. Where a PRD looks forward ("here is what we will build and why"), a CCB looks backward ("here is what now exists, and here is everything you need to use it"). It is generated once, at the close of a build, as the final deliverable before that capability is marked **Complete**.

A single CCB is simultaneously:

- the **operator guide** — where to find it, how it's gated, how to test it
- the **user guide** — how to actually use it, step by step
- the **support guide** — what it does and doesn't do, so a support conversation doesn't require re-reading the PRD or the code
- the **registry documentation** — the human-readable face of the capability's Registry entry
- the **onboarding document** — how a new team member or a fresh Claude session learns this capability exists
- the **completion receipt** — the artifact whose existence is itself proof the capability reached constitutional completion

## 3. Required sections

Every CCB is a single document containing all of the following, in order. Sections with nothing to report are kept and marked "None" rather than omitted — a missing section reads as an oversight, not as "not applicable."

1. **Executive Summary** — one paragraph. What this capability is, in plain language.
2. **What Was Built** — a simple bullet list of the concrete sub-capabilities shipped.
3. **Why It Exists** — the problem this solves, stated without repeating the PRD's own framing.
4. **Where To Find It** — the navigation path, as a literal step-by-step location trail (e.g. `Browser → Companion Extension → Wallet → Search → Overlay`, or `Venture Lab α → Financial Services`). This is one of the most valuable sections — never skip or abbreviate it.
5. **How To Use It** — step-by-step, in plain operator language, no implementation detail.
6. **Screens** — embed screenshots where available; call out buttons, menus, and navigation landmarks.
7. **User Journey** — a single realistic end-to-end flow through the capability, as a short step chain.
8. **Constitutional Behaviour** — Observer permissions, consent, Standing, Passport, delegation, identity tiers (T0/T1/T2), or any other constitutional mechanism this capability touches. If none apply, say so explicitly.
9. **Technical Summary** — not code; just enough context (which services, which registries, which APIs) that a future session can locate the implementation without re-discovering it from scratch.
10. **Dependencies** — what this capability requires to function (Passport, Wallet, Standing, Registry, a specific runtime, another capability).
11. **New Registry Objects** — any new Qube types, tables, or registry entries this capability introduced.
12. **Related Capabilities** — cross-references to what this composes with or extends.
13. **Permissions** — if the capability touches Observer capabilities or any consent-gated surface, list them and explain why each is needed.
14. **Example Use Cases** — short, concrete scenarios (by persona type: researcher, founder, operator, etc.).
15. **Limitations** — honest, specific. What is deliberately out of scope right now, not just "known issues."
16. **Future Roadmap** — a short "coming next" list. Not another PRD — pointers only.
17. **Registry Metadata** — capability ID, source PRD/CFS reference(s), version, date, owner, ratification status, deployment status.
18. **Completion Receipt** — the checklist below (§6), filled in.
19. **Capability Tour** — a 60–90 second guided walkthrough, numbered, written so a first-time reader could follow it live in the running app inside two minutes. This is the section most likely to actually get read — write it last, write it tightest.

## 4. The standardized generation prompt

Every CCB is produced from the same instruction, so tone and completeness stay comparable across capabilities regardless of which session or which agent generates it:

> Generate the Constitutional Capability Brief. Describe only what was actually implemented — do not repeat the PRD. Explain what exists, where it exists, how it is used, what constitutional behaviour it introduces, current limitations, and future planned evolution. Produce operator-grade documentation suitable for direct publication in the Registry.

## 5. Authoring mechanism — the Artifact framework, not a new one

A CCB is authored using the **same Artifact publishing framework** already used for execution plans and review reports — never a parallel document renderer. Concretely, per generated CCB:

- A published **HTML Artifact** (Claude's `Artifact` tool) is the primary, shareable, rendered form — this is what gets linked to an operator or a user for quick reading.
- A **markdown twin** is committed to the repo at `codexes/packs/agentiq/updates/YYYY-MM-DD_ccb-<capability-slug>.md` (the canonical update-doc location per this repo's own discipline) and registered in `codexes/packs/agentiq/collections.json` → `col_updates`, so it is durable, versioned, and diffable even if the published artifact link is later revoked.
- The markdown twin is the **source of truth**; the Artifact is a rendering of it, exactly the same relationship an execution-plan artifact has to the plan it renders.

## 6. Storage & the completion receipt

Every capability's presence in the Registry gains a peer artifact set:

```
Capability
├── PRD
├── Implementation
├── Tests
├── SQL / migrations
├── Screens
├── Constitutional Capability Brief   ← peer to the PRD, not an appendix to it
├── Video (optional)
└── Receipts
```

The **Completion Receipt** (CCB §18) is the literal checklist that gates "Complete":

```
Capability: <name>
[ ] Ratified
[ ] Implemented
[ ] Validated
[ ] Deployed
[ ] Documented   (this Brief)
[ ] Registered   (Registry entry links to this Brief)
```

Only once every line is checked is the capability constitutionally complete. A capability that has shipped code but no Brief is **deployed, not complete** — the two states are now distinct, and the Registry should be able to represent the difference.

## 7. Companion Search integration (the payoff)

metaMe Companion's Universal Search (PRD-MMC-001) should index Constitutional Capability Briefs alongside registry assets and research corpus content. Searching "Standing" returns the Standing capability's Brief directly — what it is, where to find it, its screenshots, its user journey — without the searcher needing to know documentation exists at all, let alone where. This is a follow-on integration, not required for a Brief to be valid on its own; noted here so it isn't lost.

## 8. Naming

**Constitutional Capability Brief (CCB)** is the canonical name. Not "completion document," not "capability report" — the name signals what it structurally is: generated after implementation, attached permanently to the Registry, operator- and user-facing, discoverable through Companion Search, and the canonical explanation of what now exists. It is the living front door to every capability in the platform — the bridge between code and the people who need to use it.
