# ISR-001 — Stage 0: Freeze & Invariant Discovery (pre-registration bundle)

**Chrysalis Foundation · Invariant Software Engineering · ISR-001 · Status: FROZEN — pre-registration v1 · 2026-07-21**
**Ratifies:** the ISR-001 charter (`README.md`, this directory), operator-ratified 2026-07-21.
**Target commit:** `03f4610e` (branch `claude/agentiq-onboarding-docs-jrbeha`).

> This is Stage 1 of the ISR-001 protocol (§Experimental protocol, README): **Freeze**
> the target + the preservation contract, and **discover** the invariant set that Arms
> C/D consume. No arm is built here. Nothing in production is mutated — the target
> modules are READ and hash-committed; when the experiment runs, arms build against a
> frozen COPY in an isolated workspace (§Risks & guardrails).

---

## 1. The frozen target — the Canonical Plate manifest workflow

The bounded, non-transactional capability selected in the charter (§Candidate selection).
Two pure modules + their deterministic canary, sealed at commit `03f4610e`:

| Artifact | Role | Lines | sha256 |
|---|---|---|---|
| `services/artifact/canonicalPlates.ts` | The capability core — 7 plate records (CP-001..CP-007), `PLATE_COMPOSITIONS`, and the pure helpers `plateByNumber` / `signaturePlates` / `platesForPublication` / `buildPlateManifest`. | 186 | `a5765665fe5859a366e48fc738e2d9ca5171297a8250e7c42ac1110c069fb45a` |
| `services/artifact/publicationRegistry.ts` | Sibling numbering core — `PUBLICATION_REGISTER`, `nextPublicationNumber` / `publicationByNumber` / `seriesByCode`. | 83 | `13ce0060efce1ff8016ec67bb0cb0ae61d0e8a3d6f21a03354724d6855906b82` |
| `tests/canonical-plates.test.ts` | The behavioural oracle (the plate + composition + publication-registry describe blocks). | 137 | `ca561d6896886b8d5770e769c2f766b65bb6bd94e426b881f20b85d42c8ebaa7` |

**Combined bundle hash** (`cat` of the three files, in the order above):
`b3f7e1354fce2f2b8968d336c6cffa5fab13f463a551a901e402b0497081465a`

**Boundary of the causal cone (the STRUCTURAL frozen set).** `canonicalPlates.ts`
imports exactly one thing — the *type* `CpsFigureType` from
`services/artifact/constitutionalPublishingSystem` (erased at runtime).
`publicationRegistry.ts` imports two runtime values from the same module —
`CPS_SERIES` and `cpsPaperNumber` — plus `PLATE_COMPOSITIONS` from `canonicalPlates.ts`.
**No DB, no network, no identity spine, no receipts, no money.** The cone is:

```
canonicalPlates.ts (full)
  └─ type CpsFigureType                         [constitutionalPublishingSystem — type only]
publicationRegistry.ts (full)
  ├─ PLATE_COMPOSITIONS                          [canonicalPlates.ts]
  ├─ CPS_SERIES : Record<string,string>          [constitutionalPublishingSystem — pure data]
  └─ cpsPaperNumber(seriesCode, n) : string      [constitutionalPublishingSystem — pure fn]
```

The `canonicalAssets` projection + `findForbiddenObjectKey` (T0-leak check) that the
canary *also* exercises are **oracle-adjacent**: a sibling projection over the plates,
not part of the plate/numbering core. They contribute one constitutional invariant
(C4 below) but are **out of the reduction scope** — Arms B/C/D reduce only the two
core modules; the projection is a fixed downstream consumer used to check C4 survives.

---

## 2. The four-class preservation contract (hash-committed)

The admissibility contract (README §"four invariant classes"). A reduced form is
admissible **only if it holds all four**; a single violated class tanks BPS (product form).

### 2.1 Behavioural invariants (B) — the observable I/O contract

Derived verbatim from the oracle. Every assertion below is a behavioural invariant;
the **hard-required contract core** (B := 0 / inadmissible if broken) is marked ★.

- ★ `CANONICAL_PLATE_COUNT === 7`; `CANONICAL_PLATES_V1.map(p=>p.number)` === `['CP-001'..'CP-007']` in order; `.map(p=>p.roman)` === `['I'..'VII']`.
- ★ `plateByNumber('CP-002')`: title contains "First Principles"; `structure.structuralInvariants` contains `'Compression'`; `structure.constitutionalInvariants` contains `'Standing'`; `structure.synthesis === 'Hybrid Intelligence'`; `signature === true`.
- `plateByNumber('CP-003')`: `structure.centre === 'Human Agency'`; `mechanisms` contains `'Knowledge'` and `'Delegation'`.
- ★ `plateByNumber('CP-099') === undefined` (miss returns undefined, never throws).
- ★ `platesForPublication('IRL-001').map(p=>p.number)` === all seven in order; `platesForPublication('investment-memorandum')` === `['CP-006','CP-007']`; `platesForPublication('some-unmapped-doc').length === 7` (unmapped → all).
- `signaturePlates().length >= 4` (the frozen set is exactly CP-002/003/004/005/007 = 5).
- `buildPlateManifest()` contains `'CP-001'` … `'CP-007'`; each line matches `"<number> (Plate <roman>) — <title> [<form>]: <k: v | …>. <message>"`.
- ★ `publicationByNumber('IRL-0001')`: `state === 'reserved'`; `plates.length === 7`. `seriesByCode('IRL').imprint` contains "Invariant Research Lab".
- ★ `nextPublicationNumber('IRL') === 'IRL-0002'`; `nextPublicationNumber('CCS') === 'CCS-0001'` (monotonic-in-series, fresh-for-unused).

**Golden-I/O freeze (deterministic).** `buildPlateManifest(CANONICAL_PLATES_V1)` is a
pure, deterministic string; `signaturePlates()`, `platesForPublication(*)`,
`nextPublicationNumber(*)` are pure. The harness (when built) captures their exact
outputs into `golden-io.json` and hashes it; because every function is side-effect-free
the golden set is a byte-stable oracle. (Capture is deferred to the harness run — deps
are not installed in this authoring sandbox; the derivation above is static and exact.)

### 2.2 Constitutional invariants (C) — deliberately light, by design

- **C1 — Order is meaning.** CP-001..CP-007 ordering AND roman I..VII ordering are
  load-bearing (`canonicalPlates.ts` header: "order is meaning; the canary pins it").
  Any arm that reorders or renumbers is **inadmissible** (C := 0).
- **C2 — Composition integrity ("no new diagrams, only new compositions").**
  `platesForPublication` only ever returns EXISTING plate numbers (via `plateByNumber(...).filter(Boolean)`); it may never fabricate a plate. Every publication is a composition of the frozen seven.
- **C3 — Numbering monotonicity.** Publication numbers are never reused or reordered; `nextPublicationNumber` = max-in-series + 1.
- **C4 — T2-safety (no T0 leak).** The plate → canonical-asset projection satisfies `findForbiddenObjectKey(asset) === null` (no personaId / T0 identifier in any plate structure). Checked against the fixed downstream projection.
- **C5 — Ratification band preserved.** Plates project as `standing.band === 'canonical'`, `lifecycle.state === 'canonized'`, `authority.ratificationRequired === true`. A reduction must not silently downgrade the plates' constitutional standing.

Paramount canaries here are **C1** and **C4** — a violation of either is a hard
inadmissibility, exactly as a paramount-canary violation is on a heavier target.

### 2.3 Structural invariants (S) — the minimum causal core (the ISR-H1 object)

- **S1 — The sufficient core is the DATA, not the prose.** The 7 plate records'
  *identity fields* (`number`, `roman`, `id`, `signature`) + `PLATE_COMPOSITIONS` +
  the four pure helpers are the minimum structure that satisfies the numbering /
  composition / signature behaviours. The `title`, `form`, `kind`, `structure`,
  and `message` fields are consumed ONLY by `buildPlateManifest` (and CP-002/003
  content assertions) — i.e. a subset of behaviours depends on them, a subset does not.
  This is the causal-cone partition ISR-H1 predicts: behaviour rides a small core;
  the rest is load-bearing only for the manifest sub-behaviour.
- **S2 — Zero-dependency purity.** The cone touches no runtime dependency beyond
  `CPS_SERIES` (data) + `cpsPaperNumber` (pure fn). No import of the identity spine,
  DB, network, or receipts is reachable under the oracle. (A reduction that INTRODUCES
  a dependency violates S2.)
- **S3 — Determinism & totality.** Every exported function is total and pure
  (`find`/`filter`/`map`/`reduce` over frozen arrays); no I/O, no `Date.now`, no
  randomness, no mutation of the frozen constants.

### 2.4 Evolution invariants (E) — pre-registered change scenarios

Each scenario is scored on the original (Arm A) and each arm for effort / blast-radius;
evolvability is preserved iff the arm makes the change **no harder** than Arm A.

- **E1 — Add an 8th plate (CP-008).** Append one record to `CANONICAL_PLATES_V1`.
  Expected blast radius on A: 1 array append (+ optional composition entries). Count → 8,
  ordering preserved, plate citable.
- **E2 — Register a new publication series (e.g. CCS).** `nextPublicationNumber('CCS')`
  already yields `CCS-0001` from `CPS_SERIES`; scenario adds a `PUBLICATION_REGISTER` entry.
- **E3 — Extend a composition.** Add a plate number to an existing `PLATE_COMPOSITIONS[...]`
  entry; `platesForPublication` reflects it with no other edit.
- **E4 — Advance a publication state.** `reserved → produced → published` on a
  `RegisteredPublication` (the honest-state field).

---

## 3. Perturbation battery (the R factor)

Probes whether a reduction removed defensive/total behaviour the contract relied on.
Each input must behave as A does (no throw; documented return):

| Input | Expected |
|---|---|
| `plateByNumber('')`, `plateByNumber('cp-002')` (wrong case), `plateByNumber('CP-99')` | `undefined` (no throw) |
| `platesForPublication('')`, `platesForPublication('🙂-doc')` (unmapped) | all seven (default), no throw |
| `buildPlateManifest([])` | `''` (empty string), no throw |
| `nextPublicationNumber('')`, `nextPublicationNumber('ZZZ')` (unused series) | a well-formed `-0001` number, no throw |
| `publicationByNumber('nope')`, `seriesByCode('nope')` | `undefined`, no throw |

R = arm pass-rate on this battery ÷ Arm A pass-rate.

---

## 4. Discovered invariant set (Arms C/D input) — hash-committed

The union of §2.1–2.4 IS the discovered invariant set for the capability. It was
derived from the frozen oracle (§1) + a static causal-cone reading of the two core
modules — **not** from a hand-authored external spec (the load-bearing control,
README §"the load-bearing control"). It is sealed at the bundle hash in §1.

**Independence Protocol note (honest):** the charter requires the invariant set be
discovered by **≥2 independent passes** with recorded convergence, so the set is
*discovered*, not *authored*. This document is **pass 1**. Before any arm is built,
an independent pass 2 (a second reader/agent, blind to this document) must reproduce
the four-class set and the S1 core/prose partition; convergence is recorded then. This
is the first unchecked box in §6.

---

## 5. What Stage 0 delivered vs. what execution needs next

**Delivered (this document):** the sealed pre-registration bundle — frozen target +
hashes, the four-class preservation contract, the perturbation battery, the four change
scenarios, and the discovered invariant set (pass 1).

**Next (execution — a separate, opt-in step):**
1. **Independent discovery pass 2** (convergence recorded) — unblocks arm construction.
2. **Build the harness** (in an isolated workspace, against a frozen COPY): the
   causal-cone extractor (static import/callgraph ∩ dynamic coverage), the
   `golden-io.json` freezer, the perturbation runner, the change-scenario harness, the
   compression meter (bundle-bytes / dep-count / LOC-complexity / cone-size), and the
   BPS / ISCR / Effective-Invariant-Compression scorer + bootstrap-CI stats module.
3. **Build Arms A/B/C/D**, score, adjudicate against the signed interpretation table.
4. **Publish** via CFS-042 — **prerequisite:** widen the `EXPERIMENTS` allow-list
   (`app/api/experiments/results/route.ts`) + the `publishResult` id union to include
   `ISR-001` (README §Result-submission path). Flagged so it is not hit at runtime.

**Operator decision gate:** execution (steps 1–4) is opt-in. Stage 0 changes nothing
in production; it only reads and seals. Say the word to proceed to the harness + arms.

---

## 6. Ratification / progress checklist (updated)

- [x] **DESIGN drafted 2026-07-21** (charter ratified by operator).
- [x] **Target selected + frozen** (Canonical Plate manifest workflow); behavioural
  oracle + constitutional canary + perturbation + change-scenario sets sealed and hashed
  (§1–§3, bundle `b3f7e135…`).
- [~] **Invariant set discovered + hash-committed** — pass 1 complete (§4);
  **independent pass 2 pending** before arms.
- [ ] Arms A/B/C/D built in an isolated workspace; scoring + bootstrap-CI module built.
- [ ] Predictions locked; interpretation table signed; pre-registration bundle published.
- [ ] `EXPERIMENTS` allow-list + `publishResult` union widened to include `ISR-001`.
- [ ] Runs executed; results published hash-consistent with the bundle.
