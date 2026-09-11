# CI-CORPUS-EXTERNALIZATION-001 — the Constitutional Internet working corpus leaves the repo

**Status:** registered, not started. Durable follow-up.
**Registered:** 2026-08-02, on operator direction.

---

## The governing rule

> Production Lambdas carry constitutional runtime knowledge and corpus pointers — not the book's
> entire working archive.

Correct as architecture, and it is the target state below. **It is not, however, the cause of the
current Amplify overage** — see the finding, which must be read before anyone acts on the size
motivation.

## Finding that reshapes the immediate lever (2026-08-02, from the build log itself)

The directive assumed the book's working corpus is traced into the shared copilot Lambda. **It is
not.** Three independent pieces of evidence, all from the deploy that failed at 20:40:

1. **`du -sb … .next/standalone/codexes` printed nothing.** The path does not exist in the built
   artifact. Every other path in that same command reported a size.
2. **`amplify.yml`'s postBuild already sweeps it.** When `PACK_CORPUS_URL` is pinned in
   `.env.production`, it deletes every pack `*.md` (except the two sync-context reads) and every
   non-manifest pack `*.json` from `.next/standalone`.
3. **The tracing include is JSON-only** — `"/api/codex/packs/[packId]/file": ["./codexes/packs/**/*.json"]`.
   No glob pulls `.md` into the bundle at all, so manuscripts, editorial registers, discrepancy
   logs and research notes were never traced.

**Consequence:** excluding "unpublished manuscripts / editorial registers / discrepancy logs /
research notes" from the Lambda trace would remove **zero bytes**. Shipping it would look like a
fix and be a no-op — the failure mode this codebase has spent the day eliminating everywhere else.

The one book artifact that WAS traced — `02-source-and-evidence-matrix.json`, 125 KB, JSON and
therefore caught by the glob, and confirmed absent from `polity-core/collections.json` — is
excluded as of commit `477c46704`. That exhausts the book-corpus lever. The overage moved
182,408 → 97,386 bytes across that build.

## Where the 230 MB actually is

| Component | Size |
|---|---|
| `.next/standalone` | 188.3 MB |
| ├─ `node_modules` (≈) | 89 MB — `@napi-rs` 32, `next` 29, `@img` 17, `pdf-parse` 9 |
| └─ Next server build (≈) | 99 MB |
| `.next/static` | 36.5 MB (`chunks` 37) |

`@napi-rs/canvas` is the largest single package and is **not** removable: it is loaded by
`/api/content/pdf-page/[cid]` and `/api/content/pdf-page-by-master/[masterId]`, the page-by-page
renderer CLAUDE.md marks as *required* for large Autonomys-hosted PDFs. `pdf-parse` is used by
Corpus Scout's own inspection path. `@img`/sharp backs Next image optimisation.

## The open question that could be worth 17 MB

The postBuild pack sweep is **conditional**. The build log prints exactly one of:

```
Corpus blob live — removing bundled pack .md + non-manifest .json from standalone …
PACK_CORPUS_URL not pinned — keeping bundled pack corpus (corpus store falls back to FS)
```

If the second line is printing on `dev`, the entire 17 MB pack corpus is sitting in the bundle and
**pinning `PACK_CORPUS_URL` is a ~17 MB reclaim** — 170× the target headroom, with no capability
loss, because the corpus store already serves packs remotely when it is set. Check that line before
pursuing any smaller lever.

---

## Target state (unchanged by the finding — this is right on its own merits)

| Material | Home | Repo carries |
|---|---|---|
| Working manuscripts, evidence matrices, editorial registers, discrepancy logs, research notes | **Supabase Storage** | storage path |
| Ratified volume | **Autonomys Auto Drive** | **CID** + metadata |
| Everything else | the pack | pointers + a compact published overview |

### Preserved in the pack

- a compact constitutional overview
- collection / index metadata
- a corpus-pointer manifest
- the published-volume pointer

### The compact overview MUST retain at least

- Sovereign personhood precedes identity
- The person is the constitutional subject
- Control ∩ Authority ∩ Mandate = Consequential Authority
- Quantum entropy strengthens randomness and privacy
- The Constitutional Internet is an operational present, not a hypothetical future

### Never touched

`codexes/packs/aigency/index.json` is runtime registry metadata. Breaking it is not an acceptable
build optimisation, and it is excluded from every sweep and every exclusion list.

## Preconditions before any local working file is deleted or relocated

All five, in order. No step may be assumed from the one before it:

1. upload succeeds
2. hashes are verified
3. retrieval is tested
4. pointer records resolve
5. a rollback copy exists

## Verification required on completion

- clean production build
- inspect `.next` artifact size
- confirm margin below the 230,686,720-byte cap
- confirm the pack registry still loads
- confirm the book overview remains browsable
- confirm no missing-module / runtime-file errors

## Related

- `next.config.js` — `outputFileTracingExcludes` / `outputFileTracingIncludes`, with the full
  incident history of this cap
- `amplify.yml` postBuild — the conditional pack sweep
- `tests/repo-weight.test.ts` — bounds what the REPO carries; deliberately does not claim to
  predict artifact size
- CLAUDE.md → *Dense Materials — Supabase and Auto Drive, NEVER the Repo*
