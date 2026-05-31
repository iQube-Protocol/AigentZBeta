# Stage 1 → Stage 2 transition: operator answers + Stage 3 substate-mapping clarification

**Date:** 2026-05-30
**Branch:** `claude/dreamy-gates-mMqNv`
**Reads with:** Stage 1 Close Report.

Records operator decisions on the Stage 1 close-report checklist and clarifies the open question on ContentQube-internal → universal-internal substate mapping (Stage 3 input).

---

## Operator decisions (closes 5 of 6 open items)

| # | Item | Operator answer | Stage 2 action |
|---|---|---|---|
| 1 | Apply migration to dev Supabase | **Done** | Stage 2 resolver assumes the 7 new tables + additive columns are live. |
| 2 | Finding F orphan triad meta disposition | **Test fixtures, not canonical** — don't worry about them | Stage 2 backfill writes `iqube_id_map` rows for the 4 records with `notes='legacy_test_fixture'`; flagged but not blocking. |
| 3 | Cartridge migration priority (Stage 4 vs Stage 8) | **Stage 8 first** | Stage 8 (cartridge UI + resolver consumers) builds out the `iqube-registry` cartridge tabs before Stage 4 (legacy `useOwnedEntitlements` migration completion). Operator-facing tooling lands earlier. |
| 4 | `app/api/iqube/persona/qripto/mint/route.ts` | **Defer to recommendation** | Stage 2 marks the route `@deprecated` alongside the `app/api/registry/iqube/route.ts` mock replacement. Removal after observation window. |
| 5 | `bridge-core/dvnReceiptService.ts` retain-with-mirror | **Defer to recommendation** | Stage 6 keeps the file (clawhack-internal); adds a one-line mirror into `orchestration_events` from the clawhack receipt emitter path. No deprecation of `bridge-core/dvnReceiptService.ts`. |
| 6 | ContentQube-internal substate mapping | **"What's the question"** | See §Stage 3 clarification below. Stage 2 proceeds with my recommended default; Stage 3 implements with the operator-confirmed mapping. |

---

## Stage 3 clarification — ContentQube-internal substate mapping

### The question

PRD v1.0 §4.2 defines a **universal internal lifecycle** with 9 states. ContentQube has its own table-level `lifecycle_state` enum with 8 states (per migration `20260513010000`):

| ContentQube `lifecycle_state` | Today's meaning |
|---|---|
| `draft` | Just created; no payload yet. |
| `semi_minted` | Payload uploaded but not chain-anchored. |
| `review_ready` | Eligible for operator canonization review. |
| `canon_pending` | Operator has approved; chain action in flight. |
| `canonized` | Operator-approved + registry-locked. Not necessarily on-chain. |
| `chain_minted` | Canonized AND has an on-chain anchor (ERC-721/1155 master mint). |
| `superseded` | Replaced by a newer version. |
| `archived` | Terminal soft-delete. |

The universal internal lifecycle (PRD v1.0 §4.2):

| Universal `internal_lifecycle` | Meaning |
|---|---|
| `draft` | |
| `wip` | |
| `review_pending` | |
| `published` | Ready for agent consumption, not yet operator-canonized. |
| `canonized` | Operator-approved, governance-locked, version-permanent. |
| `deprecated` | |
| `revoked` | |
| `new_version_pending` | |
| `abandoned` | Terminal. |

### My recommended default mapping

| ContentQube | → Universal | Reasoning |
|---|---|---|
| `draft` | `draft` | Direct match. |
| `semi_minted` | `wip` | Mint in progress = work in progress. |
| `review_ready` | `review_pending` | Direct match (different name, same meaning). |
| `canon_pending` | `review_pending` | Awaiting operator approval = review_pending. |
| `canonized` | `canonized` | Direct match. |
| `chain_minted` | `canonized` | On-chain is a stronger form of canonized; surface enum doesn't distinguish. The `chain_anchor` field on the canonical record surfaces the on-chain fact. |
| `superseded` | `deprecated` | A superseded version is no longer the recommended path; `deprecated` is the surface concept. (Alternative: `new_version_pending` if the new version isn't yet canonized — but `superseded` implies the replacement IS canonized.) |
| `archived` | `abandoned` | Both terminal soft-deletes. Surface enum has no `archived` — the legibility surface maps universal `abandoned` to surface `archived` per PRD v1.0 §4.3. |

### The two judgment calls

The mapping above is mechanical except for two cases worth confirming:

**(a) `chain_minted` → `canonized` (collapses).** This means the universal `internal_lifecycle` does NOT preserve the on-chain-vs-not distinction. The distinction lives on the `chain_anchor` field of the canonical record (`{ chain_id, contract, token_id, tx_hash }` populated when chain mint completes). The lifecycle state machine and the legibility surface treat chain_minted as a special case of canonized.

**Alternative:** introduce a 10th universal state `'chain_anchored'` for ContentQube parity. Recommendation: don't — adds complexity without behavioral payoff (the chain anchor field is the source of truth).

**(b) `superseded` → `deprecated` vs `new_version_pending`.** `superseded` in ContentQube means "replaced by a newer canonized version." The universal `new_version_pending` means "we're working on a new version but it isn't published yet." So once the new version IS published, the old becomes `deprecated`. The mapping `superseded → deprecated` assumes the supersession is complete; if it's mid-flight (new version still in `review_pending`), the old should map to `new_version_pending`.

**Recommendation:** `superseded → deprecated` as the default (the typical case), with `new_version_pending` reserved for when the lifecycle state machine explicitly enters that state during a version-bump transition. The state machine (Stage 3) decides which to use based on the new version's status.

### What I need from operator

Either:

- **"Proceed with recommended mapping"** — Stage 3 codifies the table above as `services/registry/lifecycle.ts::CONTENT_QUBE_TO_UNIVERSAL_MAP`.
- **Specific overrides** — name the row(s) you want to change and I'll update.

Stage 2 (resolver) doesn't strictly depend on the mapping — it reads/writes `internal_lifecycle` as a string. Stage 3 (state machine) needs the mapping codified. So Stage 2 can proceed in parallel with this clarification.

---

## Status going into Stage 2

**Closed:** items 1, 2, 3, 4, 5 + items 4 and 5 of the original v1.0 §14 (those were already confirmed via v1.1).

**Open (non-blocking for Stage 2):** item 6 (substate mapping) — operator answer above feeds Stage 3 only.

**Stage 2 begins now.**
