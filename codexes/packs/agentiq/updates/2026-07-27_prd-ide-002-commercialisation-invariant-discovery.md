# 2026-07-27 — PRD-IDE-002: Commercialisation as a horizontal invariant discovery domain

**Session:** `claude/constitutional-ground-review-7yg8nb` · **Scope:** `services/invariants/`, the discovery route + its two client surfaces, `codexes/packs/irl/`, `tests/`.

## What shipped

**The spec.** `codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md` — registered in `codexes/packs/irl/collections.json` under `col_foundation`. Status **DESIGN (docs-first, ratify-before-build)**; it carries all eight of the operator's deliverables inline (ontology · taxonomy · corpus acquisition plan · candidate library · cross-domain comparison · confidence analysis · suggested crystal additions · experiment recommendations).

**The one genuinely new mechanism: the Cross-Domain Recurrence Score — DERIVED, never stored.**
`computeRecurrence(evidenceIds, evidence)` counts the *distinct domains* a candidate's evidence was observed in, at read time, exactly as `computeConvergence` already counts distinct source documents. Nothing is persisted, so a score cannot drift from the evidence that justifies it (`inv.engineering.036` applied to a number instead of a list). No migration.

The enabling convention is a qualified evidence-domain key, `<discoveryDomain>/<observedDomain>` — e.g. `commercialisation/media`. It gives the observed domain a home on the `domain` axis (leaving `sub_domain` free for the capability taxonomy) and prevents a `financial-services` run from sweeping up commercialisation observations made inside the FS vertical.

It also makes **Amendment D §D.4a mechanical** rather than a matter of reviewer memory: one domain ⇒ classification floor `specialized` and abstraction capped at **L3**; a second domain lifts the floor to `supported` and unlocks L4.

**A pre-existing source-of-truth defect fixed on the way.** The discovery domain list was hand-copied into three places — `SUB_DOMAIN_PRESETS`/`DEFAULT_DOMAIN` in the route, `KNOWN_DOMAINS` in `CorpusScoutTab`, and `useState("financial-services")` in `InvariantDiscoveryTab`. Adding a second domain to three hand-maintained copies is exactly the defect `tests/source-of-truth-parity.test.ts` exists to fail the build on. `services/invariants/discoveryDomains.ts` is now the single authoritative registry; all three surfaces derive from it, and a canary fails the build if any of them regresses to a literal.

## Files

| File | Change |
|---|---|
| `services/invariants/discoveryDomains.ts` | **NEW** — the Discovery Domain Registry (kind, constitutional definition, sub-domain ladder, observed-in verticals, tangential domains; `evidenceDomainsFor`, `observationDomainKey`, `parseObservationDomain`) |
| `services/invariants/discoveryEngine.ts` | **Additive** — `RecurrenceInfo`, `computeRecurrence`, `enrichRecurrence`, `listEvidenceForDomains`; three read paths route their corpus through `evidenceDomainsFor` (a vertical resolves to `[itself]` — the FS path is byte-for-byte unchanged) |
| `app/api/invariants/discovery/route.ts` | Derives default / presets / domain list from the registry |
| `components/composer/InvariantDiscoveryTab.tsx` | Registry-fed domain picker + recurrence badge |
| `app/triad/components/codex/tabs/CorpusScoutTab.tsx` | `KNOWN_DOMAINS` derived |
| `tests/commercialisation-discovery.test.ts` | **NEW** — 31 canaries, all mutation-tested |
| `tests/source-of-truth-parity.test.ts` | Index entry only (the canary lives in its own file, per the file's own convention) |

## Discipline notes for the next agent

- **Nothing here is canonical, and nothing amended the crystal.** `canonical-invariants.seed.json` is untouched; PRD §10 supplies the exact block for the operator to apply, and a canary asserts the seed file contains no commercialisation entry. Amending canon is an operator act under Law XI.
- **No external source is cited anywhere.** Every citation in the candidate library is a repo path that was read, and every quotation was verified at the path and line given. §7 is a *corpus acquisition plan* (a campaign brief for the already-built Corpus Scout), not a fetch.
- **No L4 claim.** The three Addendum A domains share a platform architecture, so a shared common cause cannot be ruled out from inside the corpus. The whole library is `platform-derived` and provenance caps it — recorded in PRD §9.4 as the library's largest limitation.
- **The taxonomy was tested, not accepted.** Fifteen sub-domains in, fourteen out: three merges, one rejection-with-absorption, one split, two additions, each with named evidence (PRD §5).

## Addendum — the operator rulings of 2026-07-27 (executed same session)

### 1. Commercialisation Crystal — seeded

The first-class `commercialisation` namespace was created and the **eight** recurrence-3 candidates seeded at `status: "proposed"`, excluding the `equivalent` candidate (C-006) and both single-domain `specialized` ones (C-009, C-010), which stay in the discovered library. Namespace is **flat and first-class** (`inv.commercialisation.001`–`008`) — not nested under finance, because the three evidence domains are *application contexts*, not the parent ontology. Declared ahead of its members per CFS-013 §3: `InvariantNamespace` union, `INVARIANT_NAMESPACES`, `COMPOSITION_LAWS.commercialisation = 'contextual'`, plus a CHECK-widening migration. Full record in PRD-IDE-002 §10.

**Two things the ruling surfaced that the operator must still decide (PRD-IDE-002 §10.4):** all eight are `platform-derived`, and `CRYSTAL-ENLARGEMENT_plan.md` §2a bars `platform-derived` invariants from `Crystal vP1` — a live conflict, recorded and not resolved. And financial-services invariants are **not** partitionable from constitutional ones today, because `promoteCandidate` hardcodes `namespace: 'constitutional'` for every domain.

### 2. The fifteen Laws — promoted to canonical by reflection

```
Constitution → ratifies → Law N → Invariant Representation → Canonical
```

Not `Crystal → Canon`. The crystal is **reflecting** constitutional canon, not creating it. **20 records** across **Laws I–XV** were promoted from `proposed` to `canonical` — 20 not 15 because Laws XII, XIII and XV are multi-clause, and the crystal's own one-sentence canonicalization rule forces a multi-clause Law into several atomic records.

Each promoted record gained, inside its existing `provenance` object (not as foreign top-level keys):

```json
"canonical_basis": { "source": "CFS-009", "ratified": true },
"derived_from":    { "law": "XIII" }
```

Left `proposed` deliberately: Law XIII Corollaries I–III, the Law XV class-purity and sequencing corollaries, the Constitutional Evolution / Constitutional Emergence bridge principles, and `inv.engineering.037` (primary source CLAUDE.md, Law II only as support). None is a clause of a Law's ratified text. **Law XVI has no seed entry at all** — CFS-052 §9 leaves it to the operator, so there was nothing to promote and manufacturing one would have been inventing canon.

## Operator action outstanding

Registering this doc in `codexes/packs/agentiq/collections.json` (`col_updates`) was **out of this session's file scope** — another agent held that file. Add:

```
"updates/2026-07-27_prd-ide-002-commercialisation-invariant-discovery.md"
```

to the `col_updates` collection's `items` array so it surfaces in the AgentiQ cartridge Updates tab.
