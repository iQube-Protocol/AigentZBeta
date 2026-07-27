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

## Operator action outstanding

Registering this doc in `codexes/packs/agentiq/collections.json` (`col_updates`) was **out of this session's file scope** — another agent held that file. Add:

```
"updates/2026-07-27_prd-ide-002-commercialisation-invariant-discovery.md"
```

to the `col_updates` collection's `items` array so it surfaces in the AgentiQ cartridge Updates tab.
