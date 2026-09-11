# CI-CORPUS-EXTERNALIZATION-001 — Constitutional Internet corpus externalization

**Status:** **Registered — durable follow-up. Not started.**
**Registered:** 2026-08-02 (operator-directed)
**Home:** Polity Core → Constitutional Internet → 00 Project Governance
**Governing rule:** CLAUDE.md → *Dense Materials*

> **Production Lambdas carry constitutional runtime knowledge and corpus pointers — not the book's
> entire working archive.**

---

## Target architecture

| Material | Destination | Repo carries |
|---|---|---|
| **Working corpus** — unpublished manuscripts, working evidence matrices, editorial registers, discrepancy logs, research notes, other book-development artifacts | **Supabase Storage** | storage path |
| **Ratified volume** | **Autonomys Auto Drive** | **CID** + metadata |
| **Pack** | — | pointers + compact published overview **only** |

### Preserved in the pack

1. a compact constitutional overview;
2. collection / index metadata;
3. a corpus-pointer manifest;
4. the published-volume pointer.

### Do NOT touch

**`aigency/index.json` is runtime registry metadata.** Excluding or altering it breaks the registry
and is **not an acceptable build optimization.**

---

## Required content of the compact overview

The overview must retain **at least** the following. Two are constrained by rulings already made and
**must be rendered in ruling-compliant form** — stating them in bare present tense would reintroduce
the exact overclaims CR-9 and CR-11/CR-12 corrected.

| # | Required content | Rendering constraint |
|---|---|---|
| 1 | Sovereign personhood precedes identity | — none |
| 2 | The person is the constitutional subject | — none |
| 3 | Control ∩ Authority ∩ Mandate = Consequential Authority | — none |
| 4 | Quantum entropy strengthens randomness and privacy | ⚠ **CR-9**: this is **Projected**. Use *"is **specified to integrate** quantum entropy to strengthen the randomness upon which keys, identifiers, privacy and constitutional randomization processes depend."* **Not** *"uses"*, **not** *"is integrating"*. Retain verbatim: *"We have not attempted to defeat quantum cryptography. We use quantum mechanics to strengthen randomness and, through randomness, privacy."* |
| 5 | The Constitutional Internet is an operational present, not a hypothetical future | ⚠ **CR-11 + CR-12**: true of the **constitutional order**, but *not* of every component. Governance-receipt anchoring is **not operationally anchored** (CR-11) and the Commons is **ratified but not operational** (CR-12). State it as a claim about the **order**, never as a blanket component claim. |

---

## Preconditions — do NOT delete or relocate local working files until ALL are met

1. upload succeeds;
2. hashes are verified;
3. retrieval is tested;
4. pointer records resolve;
5. a rollback copy exists.

This mirrors the pattern already proven on `SRC-IF-IAPP-2017-001` (published to Auto Drive
`bafkr6igp5rhkahrf6iq7qestbz7edr67yj7g4bnhjotafszmnninbzx3uq`, CID written back into the record's
front-matter) and on `data/investors/consolidated_investors.json` (untracked, sha256 recorded,
`storage_path` left explicitly `null` and marked PENDING rather than fabricated).

**Do not fabricate a CID or storage path.** CLAUDE.md → *No Guessing or Hallucinating*.

---

## Verification

1. clean production build;
2. inspect `.next` artifact size;
3. confirm margin below the Amplify cap (**230,686,720 bytes**);
4. confirm the pack registry still loads;
5. confirm the book overview remains browsable;
6. confirm no missing-module / runtime-file errors.

---

## Trace facts of record (verified 2026-08-02, HEAD)

Recorded so this item is pursued for the **right reason**. It is the correct long-term architecture —
but it is **not** an emergency byte lever, and treating it as one would waste effort.

**The book's Markdown is NOT traced into the deploy artifact.** The Phase B pack-corpus split
(2026-07-21) moved all pack `.md` bodies out of the trace to the remote corpus store
(`services/knowledge/packCorpusStore.ts`); only pack **JSON** stays bundled.

Verified against the `outputFileTracingIncludes` key itself:

| Artifact | Size | Traced? |
|---|---:|---|
| 12 book `.md` files (manuscript, registers, logs, source lineage) | 1,036 KB | **No** |
| `02-source-and-evidence-matrix.json` | 139 KB | Yes — via `./codexes/packs/**/*.json`; **already excluded** |

Include globs touching `codexes/`: `./codexes/packs/**/*.json` ·
`./codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/*.md` ·
`./codexes/packs/irl/foundation/constitutional-glossary.md`.

**Consequences:**

- The book's current traced footprint is **effectively zero**. A directive to remove ≥500 KB of
  *traced* book material **cannot be satisfied** — the matrix JSON was the only traced item, and
  excluding it moved the overage 182,408 → **97,386 bytes**.
- The remaining **95.1 KB overage originates elsewhere.** Build log: `.next/standalone` 188,345,601 ·
  `.next/static` 36,497,977 — ~225 MB of the 230.8 MB is `node_modules` and chunks
  (`@napi-rs` 32 MB · `next` 29 MB · `@img` 17 MB · `pdf-parse` 9 MB).
- **The standing risk this item removes is real and different:** `codexes/packs/**/*.json` is globbed
  wholesale, so **the next `.json` anyone adds under the pack silently re-enters the Lambda bundle**.
  That already happened once — a `SRC-*.json` sidecar was added and removed on 2026-08-02. Metadata
  now lives in `.md` front-matter for exactly this reason.

**Rule for anyone working this project:** never add a `.json` data artifact under `codexes/packs/`.
Record metadata in Markdown front-matter instead.

---

## Current corpus inventory

| File | Size | Class |
|---|---:|---|
| `01-working-manuscript.md` | 390 KB | working corpus → Supabase |
| `03-volume-i-digitterian-tsunami.md` | 345 KB | published volume (2009/2013) → **Auto Drive** |
| `00-editorial-master.md` | 130 KB | working corpus → Supabase |
| `02-source-and-evidence-matrix.json` | 139 KB | working corpus → Supabase |
| `BOOK_IMPLEMENTATION_RECONCILIATION.md` | 66 KB | working corpus → Supabase |
| `BOOK_DISCREPANCY_REGISTER.md` | 26 KB | working corpus → Supabase |
| `00-editorial-register.md` | ~30 KB | working corpus → Supabase |
| `BOOK_DOCTRINE_LINEAGE.md` | ~23 KB | working corpus → Supabase |
| `BOOK_PLATE_EVIDENCE_MAP.md` | ~10 KB | working corpus → Supabase |
| `03-volume-i-verification-notes.md` | 9 KB | working corpus → Supabase |
| `SRC-IF-IAPP-2017-001.md` | ~9 KB | **already Auto Drive-published**; keep as pointer |
| `00-project-structure.md` | 4 KB | keep — pack structure metadata |
| `ci-cc-001-book-constitution.md` | 3 KB | keep — compact constitutional record |
| *this file* | — | keep — governance record |

**Total: ~1,175 KB.** Sizes are indicative and drift as the audit proceeds.

---

## Blocking dependency

Supabase Storage upload is **not available from the agent sandbox** (outbound HTTPS is blocked —
the same constraint documented in `scripts/publish-polity-core.mjs`). Auto Drive publication is
already proven as an operator-run step. Externalization therefore needs either an operator-run
upload or credentials reaching the sandbox.

**Until then the working files stay where they are** — the preconditions above forbid relocating
before upload, hash verification, retrieval test, pointer resolution and a rollback copy.
