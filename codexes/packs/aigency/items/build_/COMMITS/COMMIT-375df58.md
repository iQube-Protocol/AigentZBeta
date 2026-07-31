# Commit Brief: `375df58` — intent chains commit 2: sanitizeReceiptMetadata + canary tests

| Field | Value |
|-------|-------|
| SHA | [`375df58`](https://github.com/iQube-Protocol/AigentZBeta/commit/375df582f384fe54f545dcdc9425dc593e945572) |
| Author | Claude |
| Date | 2026-06-02T00:49:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 2: sanitizeReceiptMetadata + canary tests

Per spec §6 DVN receipt content rules. Every chain-emitted event must
pass through this sanitizer before insert into orchestration_events so
no T0 field ever leaks to the cross-chain ledger.

services/orchestration/sanitizeReceiptMetadata.ts:
- Strips T0 keys at any depth (top-level, nested objects, array items):
  personaId / persona_id variants, initiated_by_persona_id,
  rated_by_persona_id, payee_persona_id, creator_persona_id,
  steward_persona_id, authProfileId, rootDid, kybeAttestation,
  fioHandle, recipient / recipient_email
- T1 transforms (presence/truncation, not strip):
  comment → comment_present bool (training corpus stays in DB)
  error_message → truncated to 200 chars
  description → truncated to 500 chars
- Recursive walk handles nested objects + array items
- stringTruncate option (default 500, hard-capped at 2000)
- extraStripKeys option for domain-specific T0 additions
- buildChainReceiptMetadata helper builds the canonical chain receipt
  skeleton with template_id / step_id / actor_alias_commitment +
  enforces a step's receipt_metadata_keys allowlist on extras

tests/sanitize-receipt-metadata.test.ts:
- T0 strip: every CLAUDE.md forbidden field at top level + nested +
  inside array items
- T1 transforms: comment → comment_present, error_message truncation,
  description truncation, empty comment → false
- stringTruncate respects bounds + hard cap
- extraStripKeys add stripping for caller domain keys
- Edge cases: null/undefined input, null values, numbers/booleans
  preserved untouched
- buildChainReceiptMetadata: skeleton fields populated, T0 leaks
  caught even when caller forgets, receipt_metadata_keys allowlist
  enforced

Verified inline with a quick canary (vitest not installed in sandbox;
CI runs the full suite on deploy).
```

## Body

Per spec §6 DVN receipt content rules. Every chain-emitted event must
pass through this sanitizer before insert into orchestration_events so
no T0 field ever leaks to the cross-chain ledger.

services/orchestration/sanitizeReceiptMetadata.ts:
- Strips T0 keys at any depth (top-level, nested objects, array items):
  personaId / persona_id variants, initiated_by_persona_id,
  rated_by_persona_id, payee_persona_id, creator_persona_id,
  steward_persona_id, authProfileId, rootDid, kybeAttestation,
  fioHandle, recipient / recipient_email
- T1 transforms (presence/truncation, not strip):
  comment → comment_present bool (training corpus stays in DB)
  error_message → truncated to 200 chars
  description → truncated to 500 chars
- Recursive walk handles nested objects + array items
- stringTruncate option (default 500, hard-capped at 2000)
- extraStripKeys option for domain-specific T0 additions
- buildChainReceiptMetadata helper builds the canonical chain receipt
  skeleton with template_id / step_id / actor_alias_commitment +
  enforces a step's receipt_metadata_keys allowlist on extras

tests/sanitize-receipt-metadata.test.ts:
- T0 strip: every CLAUDE.md forbidden field at top level + nested +
  inside array items
- T1 transforms: comment → comment_present, error_message truncation,
  description truncation, empty comment → false
- stringTruncate respects bounds + hard cap
- extraStripKeys add stripping for caller domain keys
- Edge cases: null/undefined input, null values, numbers/booleans
  preserved untouched
- buildChainReceiptMetadata: skeleton fields populated, T0 leaks
  caught even when caller forgets, receipt_metadata_keys allowlist
  enforced

Verified inline with a quick canary (vitest not installed in sandbox;
CI runs the full suite on deploy).

## Files Changed

| Change | File |
|--------|------|
| Added | `services/orchestration/sanitizeReceiptMetadata.ts` |
| Added | `tests/sanitize-receipt-metadata.test.ts` |

## Stats

 2 files changed, 430 insertions(+)
