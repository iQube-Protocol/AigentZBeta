# ISR-001 — Stage 0b: Independent discovery convergence (Independence Protocol)

**Chrysalis Foundation · Invariant Software Engineering · ISR-001 · 2026-07-21**
**Gate satisfied:** the charter (README §4, "≥2 independent passes with recorded convergence")
requires the invariant set be *discovered*, not *authored*. This records **pass 2** (a blind,
independent reader that did NOT see `STAGE-0_…`) against **pass 1** (`STAGE-0_freeze-…`).

## Method

Pass 2 was run by an independent agent given ONLY the target code
(`canonicalPlates.ts`, `publicationRegistry.ts`), the oracle (`canonical-plates.test.ts`),
and the ISR-001 charter README — and explicitly **forbidden** from opening the Stage-0
pass-1 file. It derived the four-class set + causal core + perturbation battery from first
principles. This document compares the two.

## Convergence result — HIGH, with one refinement and one oracle correction

| Class | Convergence | Notes |
|---|---|---|
| **Behavioural (B)** | Full | Both derived the 7-plate ordering, `plateByNumber` exact/undefined, `platesForPublication` (unmapped → all 7), `signaturePlates` (5, ≥4), `buildPlateManifest` shape, and the publication numbering/lookup contract. Same hard-required core. |
| **Constitutional (C)** | Full + additions | Both independently found: order-is-meaning (paramount), composition integrity ("no new diagrams"), T2-safety / no-T0-leak (paramount), numbering monotonicity, ratification band, state honesty. Pass 2 added two refinements — **seven-not-twelve as a constitutional cardinality** and **isomorphism (structure order is meaning)** — adopted. |
| **Structural (S)** | Convergent **with a sharper partition** | See below — pass 2 corrected pass 1's core/prose split. |
| **Evolution (E)** | Full | Same E1–E4 scenarios (add plate / add series / extend composition / advance state) and blast radii. Pass 2 noted E2 (add series) has **zero** blast radius in the two target files (series live in `CPS_SERIES`). |
| **Perturbation (R)** | Full | Same battery; both confirmed every helper is **total** (no throw path). |

### The refinement (sharper S1 — the ISR-H1 object)

Pass 1 lumped `title/form/structure/message` with the "prose." Pass 2 traced **actual
consumers** and corrected this: those fields **are** core — `buildPlateManifest` consumes
them. The genuinely inert set is smaller and sharper:

- **`kind`** — no consumer anywhere in the two modules (declared for a *future* SVG
  renderer). **Fully inert.**
- **`id`** — no consumer *inside* the two modules, but pinned *externally* by the
  `canonicalAssets` projection (`plate:cp-001`), which the frozen oracle transitively
  exercises. **Inert locally; oracle-load-bearing under the full test file.**

This is a **more precise** statement of the ISR-H1 causal core than pass 1, and it names a
real scope boundary: an Arm-C flatten could drop `kind` outright, but `id` only if the
oracle is scoped to the two modules (not the `canonicalAssets` projection). Adopted as the
authoritative S1.

### The oracle correction (why independence paid off)

Pass 2 caught that the behavioural oracle contained a **stale, currently-failing
assertion**: `PUBLICATION_REGISTER` holds both `IRL-0001` and `IRL-0002`, so
`nextPublicationNumber('IRL')` returns **`IRL-0003`**, but the canary asserted `'IRL-0002'`.
The true invariant is the **max-in-series + 1 rule**, not the frozen literal. Pass 1 (and the
original Stage-0 freeze) inherited this literal uncritically.

**Action taken:** `tests/canonical-plates.test.ts` was corrected to pin the *rule*
(derive `maxIrl` from the register, expect `IRL-${maxIrl+1}`), so the oracle is green and
stays correct as the register grows. The freeze bundle was re-hashed (below). This is exactly
the protocol's reason for confirming "Arm A passes the oracle at 100% on untouched code"
*before* building arms — a broken oracle would have invalidated every downstream score.

## Re-frozen bundle (oracle corrected)

| Artifact | sha256 |
|---|---|
| `services/artifact/canonicalPlates.ts` | `a5765665fe5859a366e48fc738e2d9ca5171297a8250e7c42ac1110c069fb45a` (unchanged) |
| `services/artifact/publicationRegistry.ts` | `13ce0060efce1ff8016ec67bb0cb0ae61d0e8a3d6f21a03354724d6855906b82` (unchanged) |
| `tests/canonical-plates.test.ts` | `42ad4e92289fb2aee588473c897a2309a59e51f0385157833a1b45da93a6f47a` (corrected) |
| **Combined bundle** | **`7f8d084305c68cc2db827d6e60b3393deb4c6ae7705d4fb738aac8e68e861850`** |

## Verdict

The four-class invariant set is **discovered, not authored** — two independent derivations
converged, the second sharpening the structural core and correcting a stale oracle. The
Independence Protocol gate (README §4) is **satisfied**. ISR-001 may proceed to arm
construction against the re-frozen bundle — noting that arm execution (build + measure the
four arms) runs in a deps-enabled environment; this sandbox has no installed test deps.
