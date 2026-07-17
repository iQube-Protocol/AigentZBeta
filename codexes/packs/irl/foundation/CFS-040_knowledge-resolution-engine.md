# CFS-040 / PRD-KRE-001 — The Knowledge Resolution Engine (KRE)

**Status:** Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17).
**Classification:** Constitutional Runtime Primitive (knowledge realisation — the pre-reasoning layer).
**Designation:** IRL ratified-spec filing of **PRD-KRE-001** (the PRD family, §9 of CFS-037).
**Dependencies:** CFS-037 (IRE — produces the Resolved Constitutional Field the KRE realises in knowledge), CFS-038 (CCR — constitutional proximity as the retrieval signal), CFS-002/004 (iQube ontology + evolution — extended, not replaced), `services/constitutional/capabilityDiscovery.ts` + `services/capability/capabilityGraph.ts` (the discovery substrate), `services/constitutional/capabilityRegistry.ts` (registration = acceptance).

---

## 0. The layer between resolution and reasoning

The IRE resolves *which constitutional field* an intent requires. Before any LLM reasons, a second question must be answered: **is that field already realised in knowledge?** The KRE answers it. It sits between field and reasoning, and it makes the platform reason over **prepared constitutional knowledge, not raw knowledge** (CFS-037 §10).

Its governing principle — long a software guideline, now promoted to a **constitutional invariant governing knowledge itself**:

> **Reuse where possible. Create where needed.**

An iQube is no longer merely a knowledge container; it is a **constitutional realisation** — evidence that a region of constitutional space has already been resolved (CFS-037 §8, an extension of CFS-002, not a replacement). Retrieval therefore asks: *has this constitutional region already been solved (by civilisation / this org / this user)?*

## 1. Code-truth — what exists vs what's new

| KRE stage | Verdict | Existing seam | KRE relationship |
|---|---|---|---|
| **Discover** | **Exists** | `discoverCapabilities` (matches/gaps/recommendation, trust-ranked); `recommendProducers` (CFS-028) | Reuse — extend the ranking signal from trust to **constitutional proximity** (CCR) |
| **Evaluate** | **Partial** | trust scores, standing, provenance on records | Extend — completeness/trust/standing/provenance/freshness/**constitutional-proximity** as one evaluation |
| **Compose** | **ABSENT** | composition engine exists for assets (CFS-022b) but nothing composes iQubes to satisfy an intent | **New** — multiple iQubes → one constitutional context (weakest-link + composition laws, CFS-013/014) |
| **Realise** | **Partial** | artifact/production runtimes create; nothing creates *to fill a resolved-field gap* | **New** — generation belongs HERE, gated by an explicit gap, not a first move |
| **Register** | **Exists** | `registerCapability` = Constitutional Acceptance (CFS-032) — the realisation becomes canonical | Reuse — the created iQube is registered → constitutional infrastructure, reusable forever |
| **Reuse** | **ABSENT** (the loop) | discovery finds gaps but never closes into reuse→compose→create | **New** — the decision node that closes the loop |

**The genuinely new work:** the reuse-before-create **decision node** (does an iQube exist? → reuse; partial? → compose; insufficient? → create → validate → canonicalise → register → reuse forever) and iQube **composition to satisfy an intent**. Discovery, registration/acceptance, and generation runtimes already exist — the KRE orchestrates them into the loop.

## 2. The constitutional retrieval loop

```
Resolved Constitutional Field (IRE)
        ↓
Discover     — find assets occupying the field's region (constitutional proximity, CCR)
        ↓
Evaluate     — completeness · trust · standing · provenance · freshness · proximity
        ↓
Compose      — multiple iQubes → one constitutional context (weakest-link, composition laws)
        ↓
Realise      — if the field cannot be satisfied, CREATE the missing knowledge (generation belongs here)
        ↓
Register     — the realisation becomes canonical (Constitutional Acceptance, CFS-032)
        ↓
Reuse        — future intents inherit it → the field's topology expands
```

Each stage has a constitutional purpose; **generation is the last resort within the loop**, exactly as reasoning is the last resort across the pipeline. The recursive property (CFS-037 §7): every realisation expands the constitutional landscape, so the next intent begins from richer knowledge — the platform gets smarter by expanding its topology.

## 3. Pre-reasoning — knowledge assembly before the LLM

The KRE is **pre-reasoning**: iQube selection, composition, and (only if needed) realisation happen *before* the reasoning face runs. This makes the eventual reasoning phase smaller, cheaper, more explainable, more reproducible, more constitutional. Three intelligences in order (CFS-037 §10): Constitutional (IRE) → **Knowledge (KRE)** → Reasoning (IPE + LLM).

## 4. iQube ontology — extension, not replacement (operator directive)

- "iQube = constitutional realisation" **refines** CFS-002's "knowledge container" reading — it does not supersede it.
- Composition uses the **existing** composition laws (CFS-013/014, weakest-link manifests) — no new composition mechanism.
- Registration uses the **existing** Constitutional Acceptance (CFS-032) — the created iQube is accepted exactly as a shipped capability is.
- The four native iQube axes (sensitivity/verifiability/accuracy/risk) become the Evaluate stage's structural inputs (via the CCR) — reused, not reinvented.

## 5. Build plan (ratify-before-build)

- **Phase 0:** the reuse-before-create **decision node** as a pure function over a Resolved Field + discovery results (`does-exist? / partial? / absent?` → `reuse / compose / create`), shadow-only — it *recommends*, never auto-generates (Law XI: recommend, never auto-select). Node-verifiable.
- **Phase 1:** constitutional-proximity ranking on Discover (consume CCR coordinates).
- **Phase 2:** iQube composition-to-satisfy-intent (compose existing iQubes into one constitutional context via the existing laws).
- **Phase 3:** the Realise→Register→Reuse close — gap-gated creation → Constitutional Acceptance → discoverable by the next intent.

## 6. Honest limits

- **Compose + Realise + the loop are genuinely new** — Discover/Register/generation runtimes exist but are not wired into the reuse-before-create loop today.
- **Constitutional proximity depends on the CCR** (CFS-038) — until a coordinate basis exists, Discover ranks by the current trust signal (the additive default).
- **Realisation must stay gap-gated** — creating an iQube when one exists is the CS-001 duplicate-capability defect at the knowledge level; the decision node exists precisely to prevent it.
- Generation quality/validation is deferred to the existing artifact/validation runtimes — the KRE decides *whether* to create, not *how* to reason.
- This spec seeds no invariant and gates no Chrysalis deliverable.

## Ratification record
- [ ] **DRAFT 2026-07-17** — PRD-KRE-001 filing. Awaiting operator ratification of: (1) "reuse where possible, create where needed" as a constitutional invariant governing knowledge (§0); (2) the six-stage constitutional retrieval loop (§2); (3) the reuse-before-create decision node as the Phase-0 build, recommend-not-auto (§5).
