# Track 2 → freeze — path audit, the gaps closed, and a rehearsed ceremony

**Status: ENGINEERING RECORD · 2026-08-02 · nothing ratified, frozen, published or assigned**

Companion to `2026-08-02_exp-p1-crystal-constitution-and-verification-regime.md`. That
document established that EXP-P1 sits at **Internal Readiness** and that the zero counts
describe an unstarted acquisition, not a defective crystal. This one asks the next
question: **the day Track 2 lands, does the path from an external source to a frozen
crystal actually run?**

It did not. Four links were missing or wrong, and one of them would have failed at the
moment of the constitutional act itself.

---

## 0. What was NOT done, deliberately

- **No invariant was authored, imported, seeded or assigned into
  `financial-risk-value-systems`.** The ratified domain is still empty, and that is
  correct: it is empty because Track 2 has not been run, not because a tool was missing.
  Populating it with generated content would fabricate scientific evidence into a governed
  corpus and would be invisible afterwards, because the counts would look right.
- **No eligibility rule was widened.** `validated | canonical` × `external-established |
  external-empirical` is unchanged, and is now enforced at the point of entry as well as at
  read time.
- **No `proposed` invariant was promoted to `canonical`.**
- **Nothing was frozen, ratified or published.** The freeze remains the operator's own act.
- **The historical 18-invariant `constitutional-reasoning` collection was not relabelled.**

---

## 1. The chain, traced in code

| # | Step | Implementation | Verdict |
|---|---|---|---|
| 1 | External source admitted | `services/corpusScout/*`; `POST /api/corpus-scout/domain-constitution`, `/institution-discovery/domain`, `/candidates`, `/candidates/[sourceId]/review` → `ingestionBroker.ts` → `addEvidence` | **works** — human approval (`approved_exp_p1`) is required and the broker refuses without a verified artifact hash |
| 2 | Candidate invariant extracted | `runConstitutionalDiscovery` → `discovery_candidates`; `POST /api/invariants/discovery { action: 'extract' }` | **works** |
| 3 | Landed as `proposed` | `promoteCandidate` → `discoverInvariant(status: 'proposed')`; `{ action: 'promote' }` | **works**, with a caveat — see §2.1 |
| 4 | Evidence provenance recorded | `applyProvenanceReclassification`; `{ action: 'classify' }` | **works** — refuses a move into Population A citing only repo-internal sources |
| 5 | Validated through the receipted lifecycle | `validateInvariant`; `POST /api/invariants/[id]/advance { action: 'validate' }` | **works** — increments `times_validated`, writes a receipt |
| 6 | Intra-crystal relationships recorded | `addEdge` (`services/invariants/lifecycle.ts`) | **GAP — no caller anywhere.** §2.4 |
| 7 | **Assigned to the crystal domain** | — | **GAP — no path existed at all.** §2.1 |
| 8 | Readiness assesses | `runCrystalReadinessReport`; `GET /api/research/crystal/[experimentId]` | **works** |
| 9 | Freeze package built | `runFreezeCeremonyPreview`; `POST …/freeze-preview` | **worked, over the WRONG DOMAIN.** §2.2 |
| 10 | Operator freeze | `freezeArtifact` | **GAP — no caller, and no artifact to freeze.** §2.3 |
| 11 | Published as canonical | — | **GAP — no mechanism exists.** §2.5 |

Steps 1–5 are real, substantial, and have simply not been run. The honest headline is
narrower than "the pipeline is missing": **acquisition is built; admission and ratification
were not.**

---

## 2. What was broken, and what was done about it

### 2.1 The crystal had no door (step 7)

`upsertContext` — the only way an invariant acquires a domain — had exactly two callers,
both inside `services/invariants/lifecycle.ts`: `discoverInvariant` (creation time only)
and `mergeInvariants`. **Nothing in the codebase could add a domain to an invariant that
already exists.**

Worse, `promoteCandidate` tags a promoted candidate with its *discovery* domain
(`financial-services`), never a crystal domain. So running Track 2 end to end would have
produced correctly-validated, correctly-provenanced invariants that **never appear in
`financial-risk-value-systems`** — and the readiness surface would still have reported
zero, for a completely different reason, after the acquisition had actually succeeded.

`domainAcceptsAssignment()` — written as the gate for the ruling's sixth point — had **no
production caller at all**. It was tested and inert.

**Built:**

- `evaluateCrystalAssignment()` in `services/research/crystalDomains.ts` — pure, evaluates
  the ratified declaration's own `eligibleStatuses` × `eligibleProvenance` against one
  record and names **every** rule that refused, not just the first. A `null` evidence
  provenance is refused, never defaulted.
- `POST /api/research/crystal/[experimentId]/assign` — steward-gated. Refuses the whole
  request on an unratified boundary; evaluates each id; writes an `invariant_contexts` row
  only for admitted records. **`dryRun` defaults to `true`** — a caller who forgets the flag
  inspects, it does not write to a governed boundary.

The eligibility rule was previously enforced only at READ time, by readiness's
`provenance-eligibility` check — which reports an ineligible member as a **failing crystal**
rather than refusing the assignment that created it. A rule enforced only after the fact
lets the wrong row in and then blames the crystal for holding it.

### 2.2 The namespace bug, one layer down (step 9)

The morning of 2026-08-02 fixed `IndependentReviewPanel` seeding its domain field to
`constitutional-reasoning`, because a caller-supplied domain WINS server-side.

`POST /api/research/crystal/[experimentId]/freeze-preview` carried the identical defect in
its own body: `crystalDomain: asString(body.crystalDomain) || 'constitutional-reasoning'`.
A freeze ceremony package requested without an explicit domain would have been **built over
the historical collection and named it as the crystal being frozen** — the exact
substitution `crystalDomains.ts` exists to prevent, arriving at the one act where it would
have been hardest to undo.

**Fixed:** blank means the ratified declaration governs (as readiness, statistics and the
recommendation already resolved it); an explicit domain still wins; no declaration and no
override is now a 400 rather than a guess.

### 2.3 An eligible package above an act that would fail (step 10)

`freezeArtifact` has existed, gated and receipted, since PRD-EPI-001 §2 — with **no caller
anywhere in this repository**. Neither did `upsertArtifact`, so **no `crystal-version`
artifact has ever been created.** `freezeArtifact` refuses unless one exists at lifecycle
`validated`.

So the ladder terminated in a package reading `eligibleForRatification: true` above an act
that would have failed with `unknown artifact 'EXP-P1/crystal-vP1'`. Discovering that
during a constitutional ceremony is the worst available time.

**Built:**

- `evaluateFreezeExecutionPreconditions()` in `crystalFreezeCeremony.ts` — pure, five
  named preconditions (evidence supports freeze · artifact exists · artifact at `validated`
  · content hash present · signatory present), each with a remedy in the operator's
  register. `runFreezeCeremonyPreview` now reads (never writes) the persisted artifact and
  returns `execution` beside `package`. The panel renders both, because **adding a field to
  a payload is not the same as surfacing it**.
- `POST /api/research/crystal/[experimentId]/freeze` — two explicit acts, never one:
  - `action: "provision"` — creates/refreshes the `crystal-version` artifact at
    `validated`. Refuses to reset an already-frozen artifact.
  - `action: "freeze"` — requires `confirm: true`, a rationale, a non-empty signatory list,
    and a `contentHash`.

  **The staleness guard.** `freezeArtifact` writes whatever hash it is handed as the
  immutable `commitmentHash` and never recomputes one. An operator who previewed on Monday,
  had an invariant assigned on Tuesday and ratified on Wednesday would commit Monday's hash
  over Wednesday's crystal — an immutable, receipted, DVN-anchored commitment to a set that
  no longer exists. The route recomputes the statistics hash at the moment of the act and
  **refuses a mismatch, naming both values**. It never substitutes the fresh hash for the
  operator's: ratifying a value the operator did not read is the same defect wearing a
  helpful face.

  **T0 discipline.** `signedBy` enters a durable, receipted, chain-anchorable record, so a
  UUID-shaped signatory is refused outright — T2-safe references only.

Also fixed: `crystalLifecycleStage` accepts `frozen`/`canonical` and documented that they
"default false until a real freeze receipt is threaded through". **No caller ever threaded
one**, so the FROZEN and CANONICAL rungs were unreachable by any code path — a genuinely
frozen crystal would still have displayed READY_FOR_FREEZE and offered a second freeze of an
immutable object. The readiness route now reads the persisted artifact lifecycle (and
nothing else) for `frozen`.

### 2.4 No way to record a relationship — NOT BUILT (step 6)

Three of the nine readiness checks (relationship-density, graph-connectivity,
orphan-detection) read `invariant_edges`. `addEdge()` — the cycle-guarded writer, exported
from `services/invariants/index.ts` — has **zero callers**. The only edges ever created come
as side effects of `promoteCandidate`'s parent linking and `materializeCompressionEdges`.

A crystal assembled from independently discovered invariants would therefore be **all
orphans**, and three checks would fail with no operator path to fix them.

**Deliberately not built here:** the remedy belongs in `app/api/invariants/**`, which is
outside this session's declared file scope. The change is small — expose `addEdge` as an
action on the existing invariant routes, with the cycle guard and the `contradicts`
quarantine it already carries. It should be done before Track 2 acquisition begins, not
after.

### 2.5 No publication act — NOT BUILT (step 11)

`ARTIFACT_LIFECYCLE` is `draft | validated | frozen | executed | archived`. There is no
state meaning "published", and nothing anywhere sets `canonical` on the crystal ladder. The
CANONICAL rung is therefore still unreachable, and is left that way rather than guessed —
inventing a publication semantic for a constitutional object is a ruling, not a patch.

---

## 3. The rehearsal — `tests/crystal-freeze-rehearsal.test.ts`

Every existing crystal canary runs over either synthetic report objects or an **empty**
domain. Both are correct; neither exercises what actually happens the day Track 2 lands. So
the first populated crystal would also have been the first run of this path.

The rehearsal runs readiness → statistics → commitment → package → ladder end-to-end over a
**non-governed sandbox domain** (`sandbox-freeze-rehearsal`, 14 fixture rows that exist only
in that file, mounted through the existing `vi.mock` of the invariant store). A canary at
the bottom of the file fails the build if `financial-risk-value-systems` is ever named as
the subject of a rehearsal report, or if any store mutator is called.

**What passes over a populated crystal:**

- All nine readiness checks, with `invariantCount: 14`, `eligibleCount: 14`,
  populations `A: 14, B: 0, C: 0, unclassified: 0`.
- The ⊆40% Arm C slice is a genuine proper subset at meaningful size (⌊0.4 × 14⌋ = 5).
- Statistics: 18 distinct source refs, 13 relationships, non-zero semantic entropy.
- **The content hash is deterministic** across recomputation, and the clock is not an
  input — asserted with fake timers set a year apart, producing different `computedAt` and
  an identical `frozenHash`.
- **Member ORDER does not change the hash; membership does.** A reversed collection commits
  identically; a 13-member subset does not; an amended statement does not.
- The ceremony package: `eligibleForRatification: true`, both signatories,
  `contentHash === statistics.frozenHash`, `dvnAnchorRef: null`, deterministic `packageHash`.
- Ladder: READY_FOR_FREEZE, `remainingWorkKind: 'governance'`,
  `mayOfferFreezeAffordance: true`, review stage INDEPENDENT_REVIEW_OPEN.

**What correctly breaks:**

- One unclassified member ⇒ `provenance-eligibility` fails and `eligibleCount` drops to 13.
  One bad record blocks the crystal rather than being averaged away.
- One `timesValidated: 0` member ⇒ lifecycle integrity fails, the package still builds for
  diagnosis, `eligibleForRatification` flips to false, and the ladder falls back to
  CANDIDATE_READY_FOR_REVIEW with `remainingWorkKind: 'scientific'` — so no freeze is
  offered.
- A sparse edge set ⇒ connectivity and orphan detection fail together.
- **An eligible package over a missing artifact ⇒ `wouldFreezeSucceed: false`.** This is the
  §2.3 defect, pinned.
- An already-frozen artifact ⇒ refused; freeze is immutable.

No bug was found in readiness, statistics or the hash itself. Every defect this session
found sat at the seams — assignment, namespace resolution, execution preconditions, ladder
reachability — which is where they were always going to be.

---

## 4. Operator runbook — Track 2, in order

Nothing below has been run. Every call is steward-gated and needs a Bearer token.

**SQL required: none.** `invariant_contexts` already carries `UNIQUE (invariant_id, domain)`
(`supabase/migrations/20260703200000_invariant_substrate.sql`), which is what the assignment
upsert conflicts on. No table, column or constraint is added by this work.

### Step 0 — token (browser console on `https://dev-beta.aigentz.me`)

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const p = JSON.parse(localStorage.getItem(k));
  console.log(p?.access_token ?? p?.currentSession?.access_token);
})();
```

```bash
export HOST=https://dev-beta.aigentz.me && export TOKEN=<paste> && \
  export H="-H Authorization:Bearer\ $TOKEN -H Content-Type:application/json"
```

### Steps 1–4 — acquire and admit the corpus (Corpus Scout)

```bash
# 1. inspect the domain constitution (pillars must be RATIFIED before discovery)
curl -s "$HOST/api/corpus-scout/domain-constitution?domain=financial-services" -H "Authorization: Bearer $TOKEN" | jq . && \
# 2. run Agent B/C across every ratified institution in the domain
curl -s -X POST "$HOST/api/corpus-scout/institution-discovery/domain" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"domain":"financial-services"}' | jq . && \
# 3. list what came back, awaiting human review
curl -s "$HOST/api/corpus-scout/candidates?campaignDomain=financial-services&reviewWorkflowStatus=pending_review" -H "Authorization: Bearer $TOKEN" | jq '.candidates[] | {sourceId,title,canonicalUrl}'
```

Then, **per source**, the human decision (approval also runs the ingestion broker):

```bash
curl -s -X POST "$HOST/api/corpus-scout/candidates/<SOURCE_ID>/review" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"decision":"approve_exp_p1","provenanceClass":"external-established","notes":"<why this source is in boundary>"}' | jq .
```

### Steps 5–7 — extract, promote, classify

```bash
curl -s -X POST "$HOST/api/invariants/discovery" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"extract","domain":"financial-services"}' | jq . && \
curl -s "$HOST/api/invariants/discovery?domain=financial-services" -H "Authorization: Bearer $TOKEN" | jq '.candidates[] | {id,statement}'
```

```bash
# promote ONE candidate → lands `proposed`
curl -s -X POST "$HOST/api/invariants/discovery" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"promote","candidateId":"<CANDIDATE_ID>"}' | jq . && \
# record its EVIDENCE provenance — refused if the citations are all repo-internal
curl -s -X POST "$HOST/api/invariants/discovery" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"classify","invariantId":"<INVARIANT_ID>","to":"external-established","evidenceRefs":["<external URL or DOI>"],"rationale":"<why this evidence is externally authored>"}' | jq .
```

### Step 8 — validate

```bash
curl -s -X POST "$HOST/api/invariants/<INVARIANT_ID>/advance" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"validate"}' | jq '{ok,verdict}'
```

### Step 9 — relationships (BLOCKED — see §2.4)

No route exposes `addEdge`. Until one does, three readiness checks cannot be satisfied for
independently discovered invariants. **Do this before starting acquisition in earnest.**

### Step 10 — assign to the ratified crystal domain (NEW)

```bash
# dry run first — writes nothing, names every rule that refused
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/assign" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"invariantIds":["<ID1>","<ID2>"],"dryRun":true}' | jq '{admitted,refused,outcomes}'
```

```bash
# then, only if every outcome reads admitted:true
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/assign" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"invariantIds":["<ID1>","<ID2>"],"dryRun":false}' | jq '{admitted,written,outcomes}'
```

### Step 11 — readiness over the now-populated crystal

```bash
curl -s "$HOST/api/research/crystal/EXP-P1" -H "Authorization: Bearer $TOKEN" | jq '{assessability,milestone:.milestone.label,stage:.lifecycle.stageId,reviewStage:.reviewStage.state,ok:.readiness.ok,failing:[.readiness.checks[]|select(.passed==false)|.name]}'
```

### Step 12 — freeze preview (evidence AND substrate)

```bash
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/freeze-preview" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"operatorRef":"<T2-safe operator ref>","reviewerRef":null,"domainBoundary":"<paste the RATIFIED boundary verbatim>","freezeRationale":"<why now>","ratifiedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' | jq '{eligible:.package.eligibleForRatification,hash:.package.contentHash,execution}'
```

### Step 13 — provision the crystal-version artifact (NEW)

```bash
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/freeze" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"provision"}' | jq .
```

### Step 14 — independent pre-freeze review

Only once `reviewStage.state` reads `INDEPENDENT_REVIEW_OPEN`. Outside these routes.

### Step 15 — the freeze (the operator's own act)

```bash
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/freeze" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"action":"freeze","confirm":true,"contentHash":"<the hash you actually reviewed in step 12>","signedBy":["<operator T2 ref>","<reviewer T2 ref>"],"freezeRationale":"<the ratifying words>"}' | jq .
```

A `409` naming `currentContentHash` means the corpus moved since the package you read.
Rebuild the preview and ratify the hash you have actually reviewed — never the one the
server offers.

---

## 5. Verification

- `npm run type-check:research` — **10 errors, the same 10 pre-existing ones in the same
  seven files.** The scope was widened by one file (`tests/crystal-freeze-rehearsal.test.ts`,
  which contributes zero), and the baseline did not move.
- Targeted modules executed under Vitest; affected suites pass —
  `crystal-freeze-rehearsal` (25), `crystal-freeze-recommendation` (41),
  `crystal-freeze-ceremony` (9), `crystal-readiness-wire-contract` (11),
  `crystal-statistics` (5), `prd-epi-001-crystal-readiness` (14),
  `source-of-truth-parity` (72), `independent-review-capability` (86),
  `independent-review-record-remedy` (30), `evidence-provenance-populations` (75),
  `prd-epi-001-artifact-model` (4), `prd-epi-001-readiness-dashboard` (4).
- Authoritative build pending.

**One existing canary was tightened, not weakened.** `frozen is never inferred from
readiness on the wire` forbade the literal `frozen:` anywhere in the
`crystalLifecycleStage` call — which stopped the lie and also forbade the truth, making the
FROZEN rung unreachable. It now states the rule as itself: `frozen` must not be derived from
readiness/recommendation/`ok`, and if present must be read off the persisted artifact
lifecycle. `canonical:` remains forbidden outright, because it still has no producer.

**New parity canaries** (registered in `tests/source-of-truth-parity.test.ts`, per
inv.engineering.036/037): `CRYSTAL_ELIGIBLE_PROVENANCE` ↔ Population A as
`inPrimaryPopulation` computes it; `CRYSTAL_ELIGIBLE_STATUSES` ↔ the `listInvariants` status
filter in both crystal reports; the assignment route evaluates the rule rather than
restating it; a write to the crystal domain is opt-in; both freeze routes resolve the
declared domain; the freeze act recomputes and refuses a stale commitment.

---

## 6. Files

| File | Change |
|---|---|
| `services/research/crystalDomains.ts` | `evaluateCrystalAssignment()` — pure admission evaluator |
| `app/api/research/crystal/[experimentId]/assign/route.ts` | NEW — the crystal's door (dry-run by default) |
| `app/api/research/crystal/[experimentId]/freeze/route.ts` | NEW — provision + the operator's freeze, with the staleness guard |
| `services/research/crystalFreezeCeremony.ts` | `evaluateFreezeExecutionPreconditions()`; preview now reports `execution` |
| `app/api/research/crystal/[experimentId]/freeze-preview/route.ts` | ratified-domain resolution replaces the `constitutional-reasoning` fallback |
| `app/api/research/crystal/[experimentId]/route.ts` | `frozen` read from the persisted artifact — the FROZEN rung is reachable |
| `components/composer/IndependentReviewPanel.tsx` | renders the execution preconditions beside eligibility |
| `tests/crystal-freeze-rehearsal.test.ts` | NEW — the whole path over a populated sandbox crystal |
| `tests/crystal-freeze-recommendation.test.ts` | canary tightened to its actual rule; read-only guard added |
| `tests/crystal-readiness-wire-contract.test.ts` | `execution` must have a reader |
| `tests/source-of-truth-parity.test.ts` | crystal admission-rule parity canaries |
| `tsconfig.research.json` | rehearsal suite added to the scoped gate |

---

## 7. Open, and owned by the operator

1. **`addEdge` has no route** (§2.4) — blocks three readiness checks. Small change, outside
   this session's file scope.
2. **No publication act** (§2.5) — the CANONICAL rung has no producer.
3. **The freeze package's `domainBoundary` is retyped by the caller.** The ratified boundary
   is available server-side on the declaration; requiring the operator to retype it invites a
   paraphrase of a constitutional act into the package that commemorates it. Left as-is
   because defaulting it is a ruling, not a fix.
4. **Assignment writes no receipt.** The `invariant_contexts` row is the record. A dedicated
   receipt would need a new `ActivityActionType` and the matching SQL CHECK constraint, which
   is a schema change and an operator decision.
