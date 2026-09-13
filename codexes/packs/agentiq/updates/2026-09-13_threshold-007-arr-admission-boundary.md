# Threshold Research Publication — ARR Admission Boundary v0.1

**Date:** 2026-09-13
**Status:** Mechanism implemented and verified. **Threshold 007 has NOT been published, and its
`arr_disposition` remains `null`.** Per the operator's explicit instruction, this task stopped once
the admission mechanism was implemented and verified — it did not proceed to admit a review for 007
or advance its gate.

## 1. Architecture chosen

The prior state (see `2026-09-13`'s read-only diagnostic) was that `content_publication_gates` had
no reviewer-identity binding at all: any `service_role` write could set `arr_disposition` to
anything, with no verification of who wrote it or what they reviewed.

This is fixed with two new tables plus one function that is now the ONLY writer of
`arr_disposition`:

- **`research_reviewer_authorities`** — a human (operator)-minted record of *who* holds ARR-review
  authority under *which* role (`adversary | evidence_agent | author | publication_gate`),
  optionally scoped to one piece of content. There is no agent-callable path to create one of these
  rows — minting one is a human act performed directly against the database. This mirrors the
  platform's existing `reviewer_agreement_authorizations` pattern (consent-to-terms, content-hashed,
  never deleted, status-tracked) and the standing rule "only the human authorizes changes of
  authority," rather than inventing an unrelated new primitive.
- **`research_review_records`** — an append-only ledger of ARR review artifacts
  (`ORIGINAL_ARR | ARR_ADDENDUM | CANDIDATE_DELTA_CONFIRMATION`), one row per review act, linked into
  a lineage via `parent_review_id` / `lineage_relation`. A `BEFORE INSERT` trigger derives
  `candidate_sha256`, `reviewer_role_at_review` and `reviewer_principal_ref` **server-side**, from
  the live `content_publication_gates` row and the referenced authority row — none of these three
  fields can be supplied or spoofed by the caller. A `BEFORE UPDATE OR DELETE` trigger makes the
  table unconditionally append-only, including against `service_role` (RLS bypass does not bypass
  triggers — this was proven live, see §5).
- **`admit_research_review(review_record_id uuid) returns jsonb`** — the only function permitted to
  write `content_publication_gates.arr_disposition` / `.arr_review_record_id`. A
  `BEFORE UPDATE` trigger on the gate table (`content_publication_gates_guard_arr_write`) refuses any
  write to those two columns unless a local, transaction-scoped `research.admission_in_progress`
  config flag is set — which only `admit_research_review()` sets.

## 2. Migrations

- `supabase/migrations/20260913200000_research_review_arr_admission_boundary.sql` (repo copy of the
  migration applied live to project `bsjhfvctmduxhohtllly` on 2026-09-13 — verbatim, per the
  repo/DB-drift discipline this session already follows for `content_publication_gates`).

## 3. Functions / RPCs

- `research_review_records_derive_fields()` — `BEFORE INSERT` trigger function; server-derives
  `candidate_sha256`, `reviewer_role_at_review`, `reviewer_principal_ref`.
- `research_review_records_block_mutation()` — `BEFORE UPDATE OR DELETE` trigger function; always
  raises, enforcing append-only.
- `content_publication_gates_guard_arr_write()` — `BEFORE UPDATE` trigger function on the gate table;
  refuses direct writes to `arr_disposition` / `arr_review_record_id`.
- `admit_research_review(uuid) returns jsonb` — the admission function, `SECURITY DEFINER`. Checks,
  in order: record exists → gate exists → candidate SHA still matches (catches both "reviewed the
  wrong candidate" and "candidate mutated after review") → reviewer authority exists, is unrevoked,
  holds role `adversary`, is in scope, and is not the content's own author (self-certification
  refusal) → no material evidence regression reported → review-type lineage present
  (`ORIGINAL_ARR` has no parent; `ARR_ADDENDUM` / `CANDIDATE_DELTA_CONFIRMATION` require one, and the
  parent must belong to the same content) → not already admitted (idempotent no-op) → writes.

## 4. RLS / authority model — and the honestly disclosed gap

Both new tables have RLS **enabled with zero policies**, matching `content_publication_gates`'s own
pattern: only `service_role` / `postgres` can reach them at all.

**The disclosed gap, exactly as the diagnostic required it be named rather than glossed over:**
today there is still no session-level, cryptographic mechanism that distinguishes an "Adversary"
MCP/agent session from an "Evidence Agent" session — both act through the same `service_role`
credential. This migration does **not** manufacture a fake solution to that. Instead:

- Minting a `research_reviewer_authorities` row is a **human (operator) act**, performed directly
  against the database — never exposed as an agent-callable RPC. This is the same posture the
  platform already takes everywhere else authority changes ("only the human authorizes changes of
  authority" — the Threshold MCP gateway's own standing rule).
- `admit_research_review()` then checks structural facts derivable from that human-minted row (role,
  scope, non-self-certification) — it cannot verify that the reviewing *session* was truly
  independent, only that a human explicitly attested a specific principal to hold `adversary`-class
  authority for this content, separately from the row attesting who the *author* is.
- **This remains a real, further boundary to build**, not a solved problem: a genuine uplift would
  bind reviewer identity to something session-specific and unforgeable (e.g. a per-session signing
  key, or routing "Adversary" reviews through a distinct, narrowly-scoped credential rather than the
  same `service_role` used everywhere else). That work is out of scope for this task and is not
  claimed as done.

## 5. Tests and results

All ten required tests were run against a **synthetic, throwaway content/gate fixture**
(`content_id = 59a524a2-…`, deleted afterward) — never against Threshold 007's real gate row, per the
explicit instruction not to touch it in this task.

| # | Test | Result |
|---|---|---|
| 1 | Evidence Agent cannot self-create an Adversary-authorized review | **PASS** — `reviewer_authority_role_insufficient` |
| 2 | Adversary cannot directly approve publication | **PASS** (two-fold) — (a) a reviewer authority sharing the content's `author_principal_ref` is refused (`reviewer_is_author_principal_self_certification_refused`); (b) even a *successful* admission only ever writes `arr_disposition`/`arr_review_record_id` — `admit_research_review()` has no code path that writes `gate_status`, so `threshold_research_gate_is_publishable()` returned `false` immediately after a successful `PASS_WITH_DISCLOSED_GAPS` admission, until `gate_status` was separately set to `approved` |
| 3 | Review against SHA A cannot authorize SHA B | **PASS** — after mutating the gate's `candidate_text_sha256`, admission of a review bound to the prior SHA returned `candidate_mutated_or_mismatched_since_review` |
| 4 | Mutating candidate after review invalidates/blocks the review | **PASS** — same mechanism/result as #3 (one mutation exercises both) |
| 5 | `PASS_WITH_DISCLOSED_GAPS` can be admitted | **PASS** — admitted successfully, gate's `arr_disposition` set |
| 6 | `REVISION_REQUIRED` cannot pass publication | **PASS** — a `REVISION_REQUIRED` `ARR_ADDENDUM` was admitted (recorded), but `threshold_research_gate_is_publishable()` still returned `false`, since it requires `arr_disposition IN ('PASS','PASS_WITH_DISCLOSED_GAPS')` |
| 7 | Duplicate admission is idempotent/refused safely | **PASS** — re-admitting the same `review_record_id` returned `already_admitted: true` with no further write |
| 8 | Review records are append-only | **PASS** — a direct `UPDATE` on an existing review row raised `research_review_records is append-only`; the row's `disposition` was confirmed unchanged afterward. (Fixture cleanup at the end of testing required temporarily `DISABLE TRIGGER`/`ENABLE TRIGGER` to delete the synthetic rows — this is exactly the kind of privileged bypass that must never be used against real ARR data, and was not.) |
| 9 | Gate remains blocked without an admitted review | **PASS** — `threshold_research_gate_is_publishable()` returned `false` on the fresh fixture before any admission |
| 10 | Valid admitted review + `evidence_resolved` + `no_evidence_regression` satisfies the existing deterministic predicate | **PASS** — after admitting a `PASS_WITH_DISCLOSED_GAPS` review and separately setting `gate_status = 'approved'`, `threshold_research_gate_is_publishable()` returned `true` |

Two additional structural checks (not in the required list, but load-bearing for the design) were
also verified: a reviewer authority scoped to a *different* content_id is refused
(`reviewer_authority_out_of_scope`), and a review reporting `material_evidence_regression = true` is
refused (`material_evidence_regression_reported`).

All synthetic fixtures (content rows, gate row, review records, reviewer authorities) were deleted
after testing. Threshold 007's real gate row was re-queried immediately afterward and confirmed
untouched (see §6).

## 6. Bootstrap treatment of the existing 007 review chain

Two constitutional facts were recorded for the real Threshold 007 content
(`content_id = a61343cb-d000-4359-a307-e9d380740eaa`):

- `content_publication_gates.author_principal_ref` set to `'operator-aletheon-dyad'` (metadata only —
  the guard trigger only restricts `arr_disposition`/`arr_review_record_id`, so this write was
  unaffected by it and required no admission).
- Two `research_reviewer_authorities` rows: one `role='author'` for `'operator-aletheon-dyad'`
  (`legacy_authorization=false` — a live, ongoing fact, not an imported historical artifact), and one
  `role='adversary'` for `'the-adversary-2026-09-13-review-chain'`
  (`legacy_authorization=true`), both scoped to the 007 content_id, both `authorized_by =
  'operator:dele@metame.com'`. The adversary row's `authorization_note` states in full that it is
  **not** evidence of a cryptographically authenticated reviewer session — see §4.

Of the three historical review artifacts this session has been tracking (Original ARR against
007.1; two Post-ARR Addendum chat passes, the second reviewing `candidate_text_sha256 =
824dd19d…`; and a "Candidate-Delta Confirmation" chat message claiming to review the current
`6648f21f…`), **only the third was bootstrap-imported as a `research_review_records` row** in this
task:

- `review_type = 'CANDIDATE_DELTA_CONFIRMATION'`, bound to the live 007.2 gate
  (`candidate_sha256` server-derived as `6648f21f…`, confirming it does match the current candidate),
  `legacy_review_import = true`, with `legacy_provenance` disclosing in full: the original artifact
  was an operator-relayed chat message with no independently verifiable database artifact at time of
  relay; `independently_cryptographically_authenticated: false`; the import actor, timestamp, and
  reason for bootstrap (the operator's explicit instruction not to misrepresent authentication
  level).
- **This row was NOT passed to `admit_research_review()`.** It cannot yet be honestly admitted: its
  own review-type lineage requires a `parent_review_id` pointing to a prior `ORIGINAL_ARR` /
  `ARR_ADDENDUM` row, and neither of those was imported in this pass (see below) — so
  `admit_research_review()` would correctly refuse it today with `missing_required_parent_lineage`,
  which is the honest state of the evidence, not a bug to route around.

**The Original ARR and the two Post-ARR Addendum passes were deliberately NOT imported in this task.**
They reviewed different candidates than the live 007.2 gate (007.1's original text, and
`824dd19d…` respectively) — `research_review_records` binds `candidate_sha256` to whatever
`content_publication_gates` row exists for a given `(content_id, candidate_version)` at insert time,
and no historical gate row exists for 007.1 in this schema. Fabricating one, or forcing those
artifacts' `candidate_sha256` onto the live 007.2 SHA, would violate the operator's explicit
instruction to preserve "exact candidate binding" for each artifact — it would misrepresent what was
actually reviewed. This is named here as unfinished bootstrap work, not silently omitted.

## 7. The exact remaining step required before 007 can enter the Publication Gate

Three things, in order, none of which this task performed:

1. **Complete the legacy import honestly.** Either (a) create historical, `gate_status='superseded'`
   `content_publication_gates` rows for `candidate_version='007.1'` (and, if its own SHA is
   independently known, one for the `824dd19d…` addendum pass) so the Original ARR and both Addendum
   passes can be imported as `research_review_records` rows bound to their *actual* reviewed
   candidates, each linked via `parent_review_id` into a single lineage ending at the
   already-imported Candidate-Delta Confirmation; or (b) treat the Candidate-Delta Confirmation as
   itself the root of record (set its `parent_review_id` to `null` and reclassify it as
   `ORIGINAL_ARR` for bootstrap purposes) — this is a scientific/provenance judgment call for the
   operator, not a technical one, and was intentionally left to the operator rather than decided
   silently here.
2. **Have the operator (human) authorize, in fact, that `the-adversary-2026-09-13-review-chain`
   authority row correctly represents an actually-independent review** — i.e., confirm explicitly
   that the reviewing chat sessions had no authoring context on the 007 manuscript, since that is the
   entire substance of what this mechanism cannot verify cryptographically today (§4).
3. **Call `admit_research_review()`** on whichever review record ends up at the head of the completed
   lineage. If it returns `admitted: true`, `content_publication_gates.arr_disposition` will be set
   to `PASS_WITH_DISCLOSED_GAPS` — but the gate will **still** not be publishable until `gate_status`
   is separately advanced to `'approved'` (a distinct, deliberately separate act this mechanism does
   not automate).

**No scientific state for Threshold 007 has changed.** Its ARR disposition target remains
`PASS_WITH_DISCLOSED_GAPS`, publication blockers 0, evidentiary maturity B, conceptual ceiling C,
H1b/H3d/H4 unvalidated — this task built provenance/authority plumbing only.
