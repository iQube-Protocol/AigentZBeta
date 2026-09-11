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
| 6 | Intra-crystal relationships recorded | `addEdge` (`services/invariants/lifecycle.ts`) | **GAP — no caller anywhere.** §2.4 · CLOSED §9.1 |
| 7 | **Assigned to the crystal domain** | — | **GAP — no path existed at all.** §2.1 · CLOSED |
| 8 | Readiness assesses | `runCrystalReadinessReport`; `GET /api/research/crystal/[experimentId]` | **works** |
| 9 | Freeze package built | `runFreezeCeremonyPreview`; `POST …/freeze-preview` | **worked, over the WRONG DOMAIN.** §2.2 |
| 10 | Operator freeze | `freezeArtifact` | **GAP — no caller, and no artifact to freeze.** §2.3 |
| 11 | Published as canonical | — | **GAP — no mechanism exists.** §2.5 · OUT OF SCOPE by ruling |

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

### 2.4 No way to record a relationship — NOW BUILT (step 6); see §9

Three of the nine readiness checks (relationship-density, graph-connectivity,
orphan-detection) read `invariant_edges`. `addEdge()` — the cycle-guarded writer, exported
from `services/invariants/index.ts` — had **zero callers**.

**Precision, corrected in §9.1:** edges were not *uncreatable*. `promoteCandidate`'s parent
linking and `linkPromotedParents` do reach `addEdge` — but write `specializes` ONLY, keyed
by a discovery-**candidate** id, with no relation type, rationale or evidence. For a crystal
assembled across independently discovered invariants that path is unusable, so the practical
conclusion stands: the crystal would have been all orphans.

Built under the 2026-08-02 ruling — `POST /api/invariants/[id]/edges` plus the relationship
editor on the invariant detail surface. §9.1.

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

**Use the UI first.** Experiments → **Track 2 Programme** renders these eleven stages with
live status, the remedy for every failing check, and inline controls for assignment,
provisioning and the freeze. The commands below are the same acts, for scripting or
diagnosis — they are no longer the only way to perform them.

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

### Step 9 — relationships

**Use the UI**: Experiments → Invariant Registry → open an invariant → **Add relationship**
(relation type, target search, rationale, evidence, preview, confirm). The API, if needed:

```bash
curl -s -X POST "$HOST/api/invariants/<FROM_ID>/edges" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"toInvariantId":"<TO_ID>","relation":"supports","rationale":"<why this holds>","evidenceRefs":["<url or doi>"],"preview":true}' | jq .
```

Drop `"preview": true` to record it. Record only relationships that are genuinely there —
the readiness remedies say the fix is annotation, never invention.

### Step 10 — assign to the ratified crystal domain (NEW)

```bash
# dry run first — writes nothing, names every rule that refused
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/assign" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"invariantIds":["<ID1>","<ID2>"],"dryRun":true}' | jq '{admitted,refused,outcomes}'
```

```bash
# then, only if every outcome reads admitted:true — rationale is REQUIRED to write
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/assign" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"invariantIds":["<ID1>","<ID2>"],"dryRun":false,"rationale":"<why these are admitted>"}' | jq '{admitted,written,receiptWritten,declarationHash,outcomes}'
```

### Step 11 — readiness over the now-populated crystal

```bash
curl -s "$HOST/api/research/crystal/EXP-P1" -H "Authorization: Bearer $TOKEN" | jq '{assessability,milestone:.milestone.label,stage:.lifecycle.stageId,reviewStage:.reviewStage.state,ok:.readiness.ok,failing:[.readiness.checks[]|select(.passed==false)|.name]}'
```

### Step 12 — freeze preview (evidence AND substrate)

```bash
# domainBoundary is NOT sent — the route refuses it and returns the ratified one
curl -s -X POST "$HOST/api/research/crystal/EXP-P1/freeze-preview" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"operatorRef":"<T2-safe operator ref>","reviewerRef":null,"freezeRationale":"<why now>","ratifiedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' | jq '{eligible:.package.eligibleForRatification,hash:.package.contentHash,ratifiedBoundary,execution}'
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
  `source-of-truth-parity` (80), `independent-review-capability` (86),
  `independent-review-record-remedy` (30), `evidence-provenance-populations` (75),
  `prd-epi-001-artifact-model` (4), `prd-epi-001-readiness-dashboard` (4),
  `invariant-substrate`, `invariant-discovery`, `constitutional-contracts` — 473 tests
  across 15 files, all passing.
- **Scope widened twice, baseline unmoved.** `tsconfig.research.json` now also covers
  `tests/crystal-freeze-rehearsal.test.ts`, `app/api/invariants/**` and
  `app/triad/components/codex/tabs/InvariantDetailModal.tsx`. Those newly covered files
  carried **zero** pre-existing errors, so the baseline is still exactly 10 in the same
  seven files.
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
| `tsconfig.research.json` | rehearsal suite, `app/api/invariants/**` and the invariant detail modal added to the scoped gate |
| **— the 2026-08-02 operator ruling —** | |
| `app/api/invariants/[id]/edges/route.ts` | NEW — the relationship API; calls `addEdge`, restates none of its rules |
| `app/triad/components/codex/tabs/InvariantDetailModal.tsx` | Related invariants + Add relationship (preview, confirm) |
| `services/research/track2Programme.ts` | NEW — the eleven stages, as a pure projection |
| `app/api/research/track2/[experimentId]/route.ts` | NEW — composes the live signals |
| `components/research/Track2ProgrammePanel.tsx` | NEW — the guided workflow; assignment, provisioning, freeze |
| `components/composer/InvariantExperimentLab.tsx` | mounts the programme beside Independent Review |
| `services/research/crystalReadiness.ts` | `remedy` on every check |
| `services/research/crystalDomains.ts` | `crystalDeclarationHash()` |

---

## 7. Open at first audit — and what the ruling did with each

1. **`addEdge` has no route** → **CLOSED**, §9.1. It was the right call and the ruling made
   it top priority.
2. **No publication act** (§2.5) → **STAYS OPEN, by ruling.** Candidate → Reviewed → Ready
   for Freeze → Frozen is the required sequence for EXP-P1; canonicalisation is a separate
   operator ruling and must not delay Track 2. The CANONICAL rung remains unreachable, and
   `canonical:` is still never passed on the wire.
3. **The freeze package's `domainBoundary` is retyped by the caller** → **CLOSED**, §9.3.
   The operator's verdict: *"That is unnecessary and dangerous."*
4. **Assignment writes no receipt** → **CLOSED**, §9.4, without a schema change.

---

## 8. Operator verdict on the rehearsal

> "…proved the scientific pipeline was not blocked by the readiness engine, but by missing
> operational seams."

Both flagged gaps were accepted as correct calls. The governing instruction: complete the
minimum front-end Track 2 workflow **before** corpus acquisition begins; the operator must
not need to run curl commands; preserve every fail-closed policy.

---

## 9. The operator seams, built

### 9.1 The relationship editor — the blocker, with one correction

`POST /api/invariants/[id]/edges` (GET lists; POST creates, or previews with
`{ preview: true }`) and an **Add relationship** control on `InvariantDetailModal` —
relation type, target-invariant search, rationale, evidence references, preview, confirm.
An invariant with no edges now says so, and says why that is expected rather than defective.

**The route holds no rule of its own.** The cycle guard (CFS-003 §3) and the contradiction
quarantine (CFS-003a §2.6) live in `addEdge`; the route validates shape only — ids present
and distinct, a declared relation type, a stated rationale — and calls the service. The
preview consults the **same exported `wouldCreateCycle`** rather than re-deriving an answer,
and is explicitly advisory: `addEdge` re-checks at write time, so a corpus that changed
between preview and confirm cannot slip an edge through. Attribution is `personaPublicRef`,
never a raw personaId — `invariant_edges.provenance` is durable and widely read.

**Where I disagree, slightly, with my own earlier report.** I wrote that `addEdge` had zero
callers and let that imply no edge could be created. The first half is true; the implication
is too strong. `promoteCandidate` → `createSpecializesEdges` and `linkPromotedParents` do
reach `addEdge`, so an operator *could* have produced edges — but only `specializes`, only
via a discovery-**candidate** id (not an invariant id), with no relation type, no rationale
and no evidence. For a crystal drawn from independently discovered invariants that path is
unusable, and using it anyway would have recorded a specialisation claim wherever a support
or constraint relationship actually held. **So the ruling's conclusion is right and the
priority is right; my statement of the reason was imprecise, and the correction makes the
gap narrower but not smaller in consequence.**

### 9.2 The guided Track 2 programme

`services/research/track2Programme.ts` (pure) + `GET /api/research/track2/[experimentId]` +
`components/research/Track2ProgrammePanel.tsx`, mounted in the Experiments navigator beside
Independent Review — a panel nobody can reach is an inert mechanism.

Eleven stages: Discover Sources · Review & Admit · Extract Candidates · Review & Promote ·
Classify Provenance · Validate · Add Relationships · Assign to Crystal · Run Readiness ·
Prepare Independent Review · Freeze.

**It is a projection, not a workflow engine.** Every status is derived at request time from
signals the platform already computes — candidate-source rows, discovery candidates, the
readiness report's own checks, the crystal lifecycle ladder, the persisted artifact. Nothing
stores progress. A stored `currentStage` would be a second source of truth for a fact the
substrate already answers and would go stale the moment anyone acted through an underlying
surface directly.

**Each stage ROUTES.** Only the five pieces with no front end are controls here: guided
crystal assignment (dry run, then admit with a rationale), artifact provisioning, the freeze
act, and readiness remedies. Relationship creation deliberately lives on the invariant detail
surface, where the invariant is. Re-implementing Corpus Scout review or candidate promotion
inside a workflow panel would be the parallel-implementation defect this programme exists to
avoid — and the second copy would be the stale one.

**`unknown` is a first-class status.** An unreadable upstream signal reports `unknown`, never
`complete` and never `blocked`. Guessing "done" would advance an operator past work that has
not happened; guessing "blocked" would send them to fix something that is not broken. Both
errors have already been made on this programme.

### 9.3 Readiness remedies

`CrystalReadinessCheck` now carries `remedy: string | null` — **null when the check passed**
(a remedy for a satisfied condition is noise), computed beside the measurement that produced
it so the two can never describe different situations.

Each remedy says what fixes it, names the real route, and states the kind of work. The
empty-domain case shares one remedy, in the ladder's register: *"Nothing here has failed…"* —
and a canary asserts the words that made an absence read as a defect do not appear in it.

Two remedies exist specifically to close a shortcut: `provenance-eligibility` says **never
widen eligibility**; `relationship-density` says the fix is *"annotation, never invention"*
and `graph-connectivity` says *"do not bridge it with an invented edge."* A remedy that could
be satisfied by fabricating structure would be worse than no remedy.

### 9.4 The domain boundary is read, never retyped

`domainBoundary` is **no longer an input**. The freeze-preview route reads the ratified
boundary from the declaration and returns it as `ratifiedBoundary` — with exclusions, the
ratifying text, who ratified it and when, and a `declarationHash` — for rendering as
**immutable text**. The panel shows it and the operator ticks *"I ratify this exact
boundary."* There is no field that can change it.

A caller that still sends `domainBoundary` is **refused, not ignored**: silently discarding
it would let an operator believe they had amended the boundary. A different boundary is
reachable only by amending the domain declaration — a separate constitutional act with its
own record.

### 9.5 The assignment receipt

A real assignment now writes a receipt carrying all eight facts: invariant, crystal domain,
**prior domains** (read *before* the upsert — unanswerable afterwards), the eligibility
decision, the steward as `personaPublicRef`, the timestamp, the rationale (now **required**
for a write; a dry run needs none), and the `declarationHash`.

**Which mechanism this relies on, stated plainly** — as the ruling asked. It rides the
**existing `research_lifecycle_transition` receipt** via `writeLifecycleReceipt`, already in
`ANCHORABLE_ACTION_TYPES` and already passing the SQL CHECK constraint. **No new
`ActivityActionType`, no migration.** The trade-off, named rather than hidden: the eight
facts live in the receipt's `summary` text, so they are auditable by reading and not
queryable by field. If a typed assignment receipt is wanted later, that is one action-type
addition plus a CHECK-constraint migration — the facts recorded now are already the right
ones.

A receipt failure **never rolls back an admission** and is never silent: `receiptWritten:
false` plus a `[CRYSTAL ASSIGNMENT]` error log plus a warning on the response. Re-running the
same assignment is idempotent (the context upsert conflicts on `invariant_id, domain`) and
re-attempts the receipt.

### 9.6 Every fail-closed policy preserved

| Policy | Still in force |
|---|---|
| `dryRun` defaults **true** | yes — and the panel's Admit button is disabled until a dry run has been seen |
| `confirm: true` on freeze | yes |
| UUID-shaped signatory refused | yes |
| Staleness guard names both hashes, substitutes neither | yes — and the panel posts the hash it was shown |
| Freeze never self-executes | yes — provision and freeze are separate explicit acts |
| Eligibility never widened | yes — plus a remedy that says so in words |

---

## 10. Still open

1. **Publication / canonicalisation** — out of scope by ruling (§7.2).
2. **`unclassifiedPromoted` is scoped to the acquisition domain**, not to a global
   classification queue. It is a convenience signal and fails soft to `unknown`; it is not
   the authority for any gate.
3. **Corpus Scout and Discovery keep their own surfaces.** The programme names and links them
   rather than embedding them. If the operator wants those two stages inline, that is a
   deliberate second decision — embedding them would put a second copy of a review workflow
   in a panel whose job is to route.
