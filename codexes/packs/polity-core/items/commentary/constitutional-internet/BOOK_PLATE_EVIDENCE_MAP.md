# Book Plate Evidence Map

**Project:** The Constitutional Internet — The Last Human Frontier (Dele Atanda)
**Artifact:** BOOK_PLATE_EVIDENCE_MAP.md
**Home:** Polity Core → Constitutional Internet → 07 Constitutional Plates
**Audit run:** 2026-08-02 · commit `23b012473`

Maps each Constitutional Plate to the **evidence state of the chapter it compresses**. A Plate
inherits its chapter's support finding: **a Plate cannot compress a claim more confidently than the
claim itself is supported.**

**Plate-count ruling still open (CR / Editorial Master §6):** the lock list records a **14-Plate
programme**; the author's closing guidance targets roughly **one plate per part (~12–14)**, suggesting
Plates 6+7 or 13+14 could combine. The matrix currently enumerates 14 slots.

**Asset status:** `tests/canonical-plates.test.ts` passes (12 tests) and
`components/representation/MetaVitruvian.tsx` exists as **Canonical Asset 002** — a role-driven SVG
line figure that "carries no identifiers", SSR-safe. Plates 3 and 4 are marked *Assets required*: the
**male/female canonical static expressions and the rotating 3D master do not exist as rendered
assets** in the repo.

---

## Plate → chapter → evidence

| Plate | Chapter(s) | Chapter support | Plate compression risk |
|---|---|---|---|
| Plate 1 — The Wave and the Order | Part I / Ch. 1 | Partially supported | **Medium** — compress only the supported half |
| Plate 2 — The Platform Settlement | Part I / Ch. 2 | Supported | Low — compress freely |
| Plate 3 — metaVitruvian: Person Visible | Ch. 3 | Supported | Low — compress freely |
| Plate 4 — metaVitruvian: Personhood Root | Ch. 4 | Supported | Low — compress freely |
| Plate 5 — From Inference to Consequence | Ch. 6 | Partially supported | **Medium** — compress only the supported half |
| Plate 6 — Constitutional Settlement | Ch. 9 | Supported | Low — compress freely |
| Plate 7 — Two Forms of Invariance | Ch. 11 | Supported | Low — compress freely |
| Plate 8 — Bounded Delegation | Ch. 15 | Supported | Low — compress freely |
| Plate 9 — Value, Time, Price and Repair | Ch. 14/18/19 | Conflicting | **HIGH** — do not render until ruled |
| Plate 10 — Standing Carries Consequence | Ch. 18 | Conflicting | **HIGH** — do not render until ruled |
| Plate 11 — Polity as Constitutional Institute | Ch. 21 | Partially supported | **Medium** — compress only the supported half |
| Plate 12 — Many Bridges, One Polity | Ch. 22 | Partially supported | **Medium** — compress only the supported half |
| Plate 13 — Constitutional Cybernetic Loop | Ch. 19 + Epilogue | Partially supported | **Medium** — compress only the supported half |
| Plate 14 — Crossing the Threshold | Ch. 23–24 | Partially supported | **Medium** — compress only the supported half |

---

## Plates carrying a contested claim — hold until ruled

### Plate 9 — Value, Time, Price and Repair · **HIGHEST RISK**
Compresses *"Action → Time to value → Value delivered / Action → Risk of repair → Time to repair /
False value → Repair exported elsewhere."*

Three of the four quantities **do not exist as measurements** (see discrepancy B-4): no user-time
instrumentation anywhere; `riskRepairHours` is an optional self-declared field; **"exported repair" has
no computational representation at all**. A Plate renders these as a working mechanism. **Do not
produce until R-15 is ruled** — a diagram is a stronger present-tense assertion than a sentence.

### Plate 10 — Standing Carries Consequence · **HIGH RISK**
The cycle *Action → Proof → Validation → Standing → Authority → Further Action* is **supported**. But if
the Plate depicts **decay** or a **challenge/dispute** arc, it renders a contradicted claim (A-2). Also
resolve **which `standing`** — persona standing has no decay and no challenge path; *invariant*
standing has both.

### Plate 8 — Bounded Delegation · Medium
`Person → Intent → Authority → Mandate → Agent → Action → Proof → Consequence` and the
control/authority/mandate distinction are **real and tested**. If the digital expression promises
*"inspect a live mandate and receipt"*, note that delegation receipts are **enqueued, not confirmed
anchored** (A-3), and one-degree is architectural rather than guarded (B-7).

### Plate 11 — The Polity as Constitutional Institute · **HIGH RISK**
Depicts the institutional field around the polity — but the **Internet Foundation has zero repo
existence** (A-4) and the **Commons is not built** (A-5). A Plate placing seven peer institutions
around the polity asserts they exist as peers. **Consider re-basing on ratified Amendment G**'s
four-layer model (Public/Community → Venture Lab → Registry → Commons), which is more precise and
fully ratified.

### Plate 12 — Many Bridges, One Polity · Medium
"Multiple bridges converging on one shared constitutional order" — **no third-party bridge, fork or
independent deployment exists** (B-5). Render as invitation/architecture, not as observed plurality.

### Plate 5 — From Inference to Consequence · Medium
`Information → Inference → Decision → Action → Consequence → Proof → Learning or Repair` is genuinely
built and tested (`tests/consequence-pipeline.test.ts`, 11 passing, 13-stage
`CONSEQUENCE_PIPELINE`). Safe **except** the *repair* terminus — same caveat as Plate 9.

### Plate 13 — Constitutional Cybernetic Loop · Medium
Loop is doctrinally sound and largely implemented. The **Standing → Authority** edge is real
(`delegateStandingAllowsBand` gates trust bands). The **Proof** edge inherits A-3.

### Plates 3 & 4 — metaVitruvian · Assets required
Doctrine is **Supported** (`MetaVitruvian.tsx` is Canonical Asset 002, encoding minimum-disclosure and
composable-identity primitives). The **canon requires male and female as equally canonical static
expressions plus a rotating 3D master** — none exist as rendered assets. Also note the component is
**pure presentational SVG**: the Plate must not imply runtime behaviour it does not provide.

---

## Plates safe to produce now

| Plate | Why |
|---|---|
| **Plate 1 — The Wave and the Order** | Doctrinally grounded (`inv.polity.163/189/192/212/213`). ⚠ The *Volume I* side has **no internal source record** (G-1) — the Plate may map principles, but the book cannot cite them internally until deposited. |
| **Plate 2 — The Platform Settlement** | Ch2 is **Supported**; no internal code proof expected or needed. |
| **Plate 6 — The Constitutional Settlement** | Ch9 **Supported** — except the **remedy** terminus (B-6). Render remedy as constitutional requirement, not operating machinery. |
| **Plate 7 — Two Forms of Invariance** | **Strongest Plate in the programme.** `DiscoveryClass` is a live type; 373 invariants split canonical/proposed; 94 tests passing. Compress confidently. |
| **Plate 14 — Crossing the Threshold** | `User → Person → Constitutional Subject → Sovereign Actor → Participant → Citizen` — Ch23/24 steps 1–7 are **well-evidenced** (25-test crossing suite asserting boundaries). ⚠ Must **not** depict a symmetric two-way arrow: exit is 3 of 8 verbs (B-2). |

---

## Digital-expression dependency

Several Plates promise a live digital expansion ("inspect a live mandate and receipt", "live
consequence/standing feedback simulation", "adjust time-to-value and risk-of-repair scenarios"). Each
depends on a capability the audit found **unmeasured or unanchored**. Before commissioning
interactive masters, confirm:

1. **PoTS / risk-of-repair** have real measurement (currently: no) — Plates 5, 9, 13
2. **Receipt anchoring** is confirmed for the receipt class shown (currently: access-decision only) — Plates 8, 13
3. **Standing decay/challenge** ruling (R-2) — Plate 10
4. **Commons** operational state (currently: not built) — Plates 11, 12
5. **metaVitruvian** static + rotating masters exist as assets — Plates 3, 4

**Plate-use rule (Editorial Master §6) reaffirmed:** the printed Plate compresses · the digital Plate
expands · aigentMe contextualizes · **source lineage proves**. The fourth clause is the binding one —
a Plate whose source lineage resolves to an unbuilt capability should not ship.
