# IRL-REVIEW-001 — Batching Parameter Amendment (2026-07-30)

**Disposition:** ratified by the operator/Aletheon, 2026-07-30.
**Effective commit:** `716ff802d` (branch `claude/tokenqube-minting-integration-ms2yjd`).
**Test status:** targeted (`tests/independent-review-batching.test.ts`, 20/20) and full suite
(185 files / 3335 tests) green at the effective commit.

## The amendment

> The initial 32-subject batch size specified in rulings §1 was a preregistered starting
> parameter, not an immutable constitutional invariant. Live execution showed that 32-subject
> adjudications could exceed the provider's practical completion window. The default is
> therefore amended to 16 subjects per batch, with up to three fresh attempts per batch.
> Deterministic partitioning, manifest commitment, reviewer isolation, canonical merge order,
> and fail-closed completeness remain unchanged.

| Field | Value |
|---|---|
| Prior batch size | 32 |
| Revised batch size | **16** |
| Prior max attempts per batch | 2 |
| Revised max attempts per batch | **3** |
| Expected batch count (464 subjects) | 29 (was 15) |
| Per-batch timeout | 300s — unchanged by this amendment |
| Evidence | Live run against the real 464-subject corpus: batch-000 timed out on attempt 1, then completed (32/32 decisions, 0 unanswered) on a fresh attempt 2 — the work itself was not consistently over budget. batch-001 timed out on BOTH attempts and correctly refused the whole run rather than completing partially. |
| Effective commit | `716ff802d` |

## What did not change

Deterministic partitioning, manifest commitment (`packageHash`, `pre-run-manifest` hash),
reviewer isolation, canonical merge order, and fail-closed completeness (a batch that cannot
complete within `maxAttemptsPerBatch` still refuses the entire run — it is never recorded as
partial). This is a parameter retuning, not an architecture change.

The ratified invariant was never "32 subjects per batch." It is: *large adjudication packages
must be deterministically batched, independently reviewed, canonically reconstructed, and
refused when incomplete.* The revised settings preserve that invariant and better satisfy it
under the observed provider constraints.

## Guardrails for the next run

Bind into the run manifest:

```text
batchSize: 16
maxAttemptsPerBatch: 3
expectedBatchCount: 29
timeoutSeconds: 300
```

Retries are fresh attempts against the identical frozen batch, prompt, model, and determinism
settings — they never alter batch membership or merge multiple partial responses (unchanged from
the original batching design; `services/research/review/batching.ts`).

**Before launching all 29 batches, run one real 16-subject canary and confirm:**

- 16 of 16 decisions returned;
- no duplicates or unknown references;
- output did not approach the token ceiling;
- latency is comfortably below 300 seconds;
- reasons remain sufficiently substantive;
- the provider reports a normal completion rather than truncation.

If the canary is clean, proceed with the full run. **If 16 still repeatedly times out, reduce
the batch size again rather than raising the timeout or allowing additional retries
indefinitely** — the same reasoning that motivated this amendment (address the causal risk,
generation length and processing time, rather than inflating the timeout or the retry budget).

## Where this lives in code

- `services/research/review/batching.ts` — `DEFAULT_BATCH_SIZE`, `DEFAULT_MAX_ATTEMPTS_PER_BATCH`,
  both with inline comments recording this same evidence and pointing back to rulings §1 as the
  prior value being amended.
- `tests/independent-review-batching.test.ts` — the 464/16→29-batch canary.
