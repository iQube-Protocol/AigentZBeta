# Governance Ratification as a real, persisted, anchored institutional act

**Operator ruling, 2026-07-27.** Implements items 1–4 of the ruling. Item 5 (canister /
Autonomys runtime verification and the local-only readiness canary) is a separate
workstream and is deliberately **not** done here.

---

## 0. The ruling, and the correction at its centre

> "Ratification must become an explicit authorised operator act. Editing a constitutional
> document does not constitute ratification and must not automatically emit a governance
> receipt. The ratification act must bind the decision to the exact document version and
> immutable content hash, invoke the existing governance receipt helper, and enter the DVN
> anchoring pipeline."

> "The platform cannot infer constitutional authority from a repository edit. A document
> edit may mean: drafting; typo correction; formatting; proposal; negotiation; amendment
> preparation; metadata maintenance; actual ratification."

```
Document edited           → proposed constitutional state
Explicit ratification act → authorised constitutional transition
                          → governance receipt → anchoring
```

---

## 1. Audit — what already satisfied the ruling, and what did not

| Ruling requirement | Before this change |
|---|---|
| The receipt helper exists and maps to anchorable action types | **PRESENT.** `createGovernanceReceipt` → `governance_decision_ratified` / `_amended`, both already in `ANCHORABLE_ACTION_TYPES` and in the `activity_receipts` CHECK constraint. **No DVN pipeline change was needed or made.** |
| An explicit ratification act | **PARTIAL.** `POST /api/governance/ratify` existed as a first cut: admin-gated, no ops-token branch, sha256 of the document, commitment passed to the helper. |
| A persisted ratification record | **ABSENT.** Nothing was stored. The act produced a receipt and vanished. |
| The full `GovernanceRatification` object (version, amendments, authority basis, effective date, supersession) | **ABSENT.** The receipt carried a path and a hash only. |
| `anchorStatus` | **ABSENT.** |
| Retrospective vs original distinction | **ABSENT.** |
| A publication registry the publisher consumes | **ABSENT.** `app/api/polity-core/publish/route.ts` held six hardwired framework imports. CFS-009 appeared **zero** times — the concrete blocker. |
| Decision log demoted from event source | **ABSENT.** `GOVERNANCE_DECISIONS` was still the only record of a ratification. |

### A defect the audit found in the first cut

The first cut hashed the document with `readFileSync(join(process.cwd(), path))`.
`next.config`'s tracing includes **pack JSON only** — *"The .md bodies are served by the
corpus store"* — so that read succeeds in the sandbox and returns **nothing on Lambda**.
Every ratification in production would have been refused as `document-not-ratifiable`,
with every canary green. All pack reads now go through `corpusReadPackFile`, and a canary
forbids `readFileSync` in both the act and the registry.

---

## 2. The persisted record

`governance_ratifications` (migration `20260825000000`) is the event source.
`services/governance/governanceRatification.ts` is its one home.

| Field group | Why it lives there |
|---|---|
| `document_id` · `document_title` · `document_version` · `document_path` · `framework_id` | The ruling: *"the event must attest to what was ratified, not merely the decision ID."* `framework_id` is text, not a FK — the registry is CODE, and a FK would force it to become a table. |
| `content_hash` **NOT NULL** | *"The immutable content hash is mandatory."* |
| `content_cid` · `published_at` (nullable) | *"Anchoring should not silently depend on publication succeeding."* Attached later by `attachPublication()`; `null` is a complete, valid state. |
| `content_hash_scope` | **The honesty field.** `as-ratified` (the bytes actually ratified) vs `as-recorded` (the document as it stands today). |
| `amendment_ids` · `supersedes` · `previous_content_hash` | The ruling's required receipt payload. |
| `ratified_by_ref` · `authority_basis` | T2 one-way commitment + the constitutional basis of the authority. |
| `ratified_at` **and** `recorded_at` | Two columns, because collapsing them is exactly how a historic ratification gets silently re-dated. |
| `historical_content_recoverable` · `anchoring_is_retrospective` | The ruling's two honesty questions, enforced by CHECK constraints. |
| `receipt_id` (nullable) | `null` means the act was recorded and the receipt failed — visible and retryable, never silently successful. |
| **no `anchor_status`** | Deliberately absent. See §3. |

**T0/T2:** no `personaId`, `authProfileId`, `rootDid` or `caseId` in any column. The
ratifying authority is `sha256('governance:ratifier:' + personaId)` truncated to 16 hex —
the derivation `agreementOwnerCommitment` already established. RLS enabled, no client
policies (service role only), matching `constitutional_agreements`.

**Order:** persist → receipt → DVN. A receipt failure leaves a visible act; the reverse
order would produce a receipt for an act with no record.

---

## 3. `anchorStatus` is observed, not asserted

There is no `anchor_status` column and there must never be one. A value written at insert
time is a hope. `observeAnchorStatuses()` batch-reads the referenced `activity_receipts`
rows' real `receipt_status` at read time.

**Map, don't unify.** Both vocabularies are returned; neither is stored:

| `receipt_status` (pipeline) | `anchorStatus` (governance) |
|---|---|
| `local` | `local` |
| `dvn_pending` | `submitted` |
| `dvn_recorded` | `anchored` |
| `dvn_failed` | `failed` |
| *not found* | `null` — an unobserved anchor is reported as unobserved, never defaulted to `local` |

This does not duplicate the main session's runtime-readiness work in `app/api/ops/**`; it
reads a receipt row and maps a vocabulary, nothing more.

---

## 4. The decision log is now a projection

`GOVERNANCE_DECISIONS` is retained and annotated in place as **seed**. It is read by its
own module, its projection, and the barrel re-export — and by nothing else.
`tests/governance-ratification.test.ts` pins that set and fails the build when a new reader
appears.

`projectGovernanceDecisionLog()` derives the log from the persisted records and flags every
entry's provenance:

- `ratified` — a persisted record exists; an authorised act happened and was receipted.
- `seed` — the entry exists only in the array. Explicitly **not** evidence that a
  ratification occurred. Listing it any other way reproduces the inference the ruling forbids.

`GET /api/governance/ratify` returns the projection with both counts.

---

## 5. Retrospective attestations

Law XVI and the Horizen Amendments were ratified before any of this existed. They enter as
`ratificationKind: 'retrospective'` and must state `originalRatifiedAt` and
`historicalContentRecoverable`. The act refuses otherwise — **before any I/O**, so the rule
is enforceable and testable without a database. The inverse is also refused: an `original`
act carrying a historical date would backdate a ratification happening now.

**The "current hash ≠ ratified hash" problem is not papered over.** When the historical
bytes are unrecoverable, `content_hash_scope` is forced to `as-recorded`, the receipt
carries `hash-scope:as-recorded` and `anchoring:retrospective`, its summary is suffixed
`RETROSPECTIVE ATTESTATION`, and the ConstitutionalObject records
`provenance.source: 'attested'` rather than `'ratified'`. A consumer holding only the object
cannot mistake one for the other. A database CHECK constraint enforces it independently of
the service.

**The register rows were NOT edited to claim anchoring.** Law XVI and Horizen still read
"DVN anchoring outstanding", which remains true until the operator performs the act.

---

## 6. The Constitutional Framework Registry

`services/polity/constitutionalFrameworkRegistry.ts` — one list, `{ id, title,
sourceResolver, publicationPolicy, ratificationRequired }`. It now reaches ten documents,
including the two the ruling names:

- `development-constitution` — CFS-009, `codexes/packs/irl/foundation/` (markdown)
- `horizen-workspace-amendments` — the Phase 0 audit, `codexes/packs/agentiq/updates/` (markdown)

The publish route names **no document at all**; its set comes from `publishableFrameworks()`.
JSON serialisation is byte-for-byte the publisher's historic
`JSON.stringify(body, null, 2)`, so the CIDs already in `autodrive-cids.json` stay
reproducible. A framework withheld from publication carries a stated **reason** — an
unexplained absence is precisely how CFS-009 was lost.

A parity canary asserts the registry's declared version matches the Version column of that
document's row in `AMENDMENT_RECORDS.md`.

---

## 7. What was deliberately not done

- **No DVN pipeline change.** `activityReceiptDvnPipeline.ts`, `icAgent.ts` and the Candid
  IDL are untouched; both governance action types were already anchorable.
- **No environment/canister verification** (ruling item 5) — the main session owns it.
- **No historic ratifications recorded.** Recording them is an *authorised act*, not an
  agent editing a table. The operator performs them; the commands are in the handover.
- **No edits to `AMENDMENT_RECORDS.md`.** Its Horizen row is guarded by another
  workstream's canary and nothing here requires its shape to change.
