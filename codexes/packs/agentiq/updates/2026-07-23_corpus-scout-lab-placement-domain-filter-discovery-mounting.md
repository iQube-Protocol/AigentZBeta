# Corpus Scout Laboratory UX — Placement, Domain Filtering, and Discovery-Review Mounting

**Status: DESIGN — docs-first, ratify-before-build.** Companion to `PRD-ICA-001_invariant-corpus-acquisition-agent.md` (RATIFIED 2026-07-22) and CFS-048 (Discovery Engine). This is a small, precisely-scoped wiring/UX pass — NOT a new charter, NOT a change to either governing pipeline.

---

## §0 Read this first — the premise was wrong, in a good way

The operator asked for "a UI and front interface" for Corpus Scout, assuming none exists. **It already exists, is fully built, and is already mounted** — this reconciliation corrects scope before any code changes, exactly as PRD-ICA-001 §0 itself models.

| What was assumed missing | What's actually there |
|---|---|
| A UI to run/review the corpus agent | `app/triad/components/codex/tabs/CorpusScoutTab.tsx` — a complete PRD-ICA-001 §9 human-review workspace: submit-a-URL form (domain/sub-domain/title), candidate list with review-status filter, lane-coverage table, exact-duplicate detection, per-candidate verification block (mime/size/sha256/pages/extraction), content preview, structural-tag display, and the full reviewer action set (approve for EXP-P1 / general finance / reference-only, four reject reasons, mark-duplicate) — wired to `POST /api/corpus-scout/candidates` and `POST /api/corpus-scout/candidates/[sourceId]/review`. |
| It being registered anywhere | It already is: `id: 'irl-os-corpus-scout'`, `data/codex-configs.ts`, `group: 'laboratory'`, `order: 5`, `adminOnly: true`, component `CorpusScoutTab`. It renders today. |
| A way to review the *invariant hypotheses* extracted from approved sources (the operator's actual second ask — "ranking and agreeing or... challenging the hypothesis on why some [are] children of others") | Also already built: `components/composer/InvariantDiscoveryTab.tsx` — CFS-048's Stage 2–5 workspace: extract candidates, convergence-tier display, promote/reject, parent-suggestion + relationship linking (entails/specializes/depends_on/supports), domain-compare, recursive compression (roots vs. derived). **This component is NOT registered as a tab anywhere in `data/codex-configs.ts` or `TabRenderer.tsx` — it is unreachable from the app today.** This is the one genuine "missing front end" in the operator's ask. |

So the real gaps are three small, concrete items — not a build-from-scratch:

1. **Placement** — `CorpusScoutTab` sits at `order: 5`, last in the Laboratory group (after Invariant Registry at `order: 2`, Invariant Field at `order: 3`, EXP-P1 Readiness at `order: 4`). Operator wants it near/before Invariant Registry.
2. **Domain-filter model** — `GET /api/corpus-scout/candidates` **already accepts `?campaignDomain=`** (`app/api/corpus-scout/candidates/route.ts` line 33) — the filter exists server-side today. `CorpusScoutTab.tsx` only exposes a review-status filter dropdown; there is no UI control for domain/lane, and no picker of previously-used domains (submission is free-text only, so a domain typo silently creates a new, disconnected bucket).
3. **`InvariantDiscoveryTab` is orphaned, AND hardcoded to one domain** — `const [domain] = useState("financial-services");` (line 75) — no setter, no picker. This is the literal blocker for "the agent's going to have to be applied to other domains in the future": today it can't be, even by hand, without editing source.

## §1 Scope — three increments, all UI/wiring, zero backend changes

| Increment | What changes | What does NOT change |
|---|---|---|
| 1. Reorder | `data/codex-configs.ts`: move `irl-os-corpus-scout`'s `order` to sit immediately before `irl-os-invariant-registry` (i.e. `order: 1` range, renumbering the tabs between Constitutional Evaluation and Invariant Registry as needed) | No tab is renamed, removed, or re-gated |
| 2. Domain filter + picker (Corpus Scout) | `CorpusScoutTab.tsx` gets a domain `<select>` (options = distinct `campaignDomain` values already present in the loaded `candidates`, plus an "All domains" option) next to the existing status filter, wired to the existing `?campaignDomain=` query param. Submission form's domain field becomes a `<select>` (existing values) + "add new domain" affordance, so a typo can't silently fork a new bucket | `services/corpusScout/*`, the DB schema, `add-evidence` handoff — untouched. Domain remains free-text at the DATA layer (no fixed enum); the UI just surfaces what already exists instead of requiring re-typing |
| 3. Mount + generalize Discovery review | Register `InvariantDiscoveryTab` in `data/codex-configs.ts` as a Laboratory tab (admin-gated, matching Corpus Scout's pattern), placed immediately after Corpus Scout (logical pipeline order: acquire → review-as-evidence → discover/rank-as-invariant). Replace the hardcoded `useState("financial-services")` with a domain `<select>` populated the same way as Increment 2 (distinct domains already known to the Discovery Engine via existing reads), defaulting to `financial-services` for continuity | `services/invariants/discoveryEngine.ts`, `app/api/invariants/discovery/route.ts`, the promote/reject/compare/compress-domain logic — untouched. The ranking/challenge interaction model (convergence tiers, parent-suggestion linking, compare/compress-domain) is already built exactly as the operator described it; this increment only makes it reachable and domain-agnostic |

## §2 Domain-filter model, precisely

- **Source of truth for "known domains" stays the data, not a new registry.** No new table, no hardcoded domain list. Both tabs derive their picker options from what's already loaded (Corpus Scout: distinct `campaignDomain` across loaded candidates; Discovery: same approach against whatever the discovery route already returns/accepts).
- **Adding a domain is just typing a new one once** — same as today, just surfaced as "+ new domain" next to the dropdown instead of being the only option. This preserves §16's design principle (Corpus Scout as a reusable front end for every future domain crystal) without inventing a domain-approval workflow that isn't asked for.
- **Filtering composes with the existing status filter**, not replacing it — an operator can select `domain=constitutional-reasoning` AND `status=pending_review` simultaneously.

## §3 Review/ranking flow — already designed, just needs mounting

PRD-ICA-001 §9 and CFS-048's existing implementation already specify the exact interaction model the operator asked for by name:
- **"Ranking"** → convergence tiers (single/strong/broad) + abstraction-level badges (L2/L3/L4), already computed and displayed by `InvariantDiscoveryTab`.
- **"Agreeing or challenging the hypothesis"** → promote / reject actions, already wired.
- **"Why some are children of others"** → parent-suggestion + relationship linking (entails/specializes/depends_on/supports) and recursive compression (roots vs. derived), already built.

Nothing here is redesigned. Increment 3 is purely: give this existing workspace a door.

## §4 Non-goals

- No new domain-classification/auto-tagging logic — domain remains an operator-declared string, exactly as both PRDs already specify.
- No change to `PRD-ICA-001`'s Level-4-only acquisition discipline, review-workflow-status vocabulary, or the `add-evidence` handoff contract.
- No change to CFS-048's Stage 1–5 pipeline, promotion gate, or canonical-registry write path.
- No file-upload path added to Corpus Scout — it remains URL-based retrieval (PRD-ICA-001 §2's Level 4 discovery), per the existing, ratified design. (If direct file upload is wanted later, that's a new, separate ask against PRD-ICA-001 §7's parsing infrastructure — flagged, not built here.)
- No merge of Corpus Scout and Discovery-review into one tab — operator explicitly wants them separate; they stay separate, adjacent in the nav.

## §5 Verification plan

1. Reorder: Laboratory tab strip shows Corpus Scout immediately before Invariant Registry.
2. Domain filter: submit two candidates under different `campaignDomain` values; confirm the new dropdown filters the list to one domain at a time and "All domains" shows both; confirm it composes correctly with the status filter.
3. Discovery mounting: the tab appears in Laboratory, admin-gated identically to Corpus Scout; changing its new domain picker away from `financial-services` reloads evidence/candidates scoped to the new domain via the existing `/api/invariants/discovery?domain=` query, with no console errors.

---

## Ratification record

- [ ] Operator confirms Increment 1 (reorder Corpus Scout near/before Invariant Registry) — exact target position (immediately before Invariant Registry vs. some other slot) confirmed.
- [ ] Operator confirms Increment 2 (domain filter + picker on Corpus Scout, sourced from existing data, no new domain registry).
- [ ] Operator confirms Increment 3 (mount `InvariantDiscoveryTab` as its own adjacent Laboratory tab, generalize its hardcoded domain to a picker) — including the label to use for the mounted tab (e.g. "Invariant Discovery").
- [ ] Operator confirms the §4 non-goals (no file upload, no auto-domain-classification, no tab merge).
