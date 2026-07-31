# CFS-053 — Constitutional Binding

**Chrysalis Foundation Specification · v1.0 · Status: PROPOSED — deliberately held (operator ruling, 2026-07-27)**

> **Why this stays proposed.** The operator declined to ratify Law XVII now, and not for want of
> evidence: *"The specification appears mature. The evidence is compelling. But I'd deliberately
> wait until after the software expansion of P2."* Today's thirteen defects are all software
> engineering observations — enough to justify a specification, not enough to make Constitutional
> Binding an *experimentally supported* principle rather than an engineering lesson. It promotes
> when P2A exists, software consequence is formally in the programme, and at least one
> experimental result supports it. See §10.0.
**Constitutional anchor:** recommended as **CFS-009 Law XVII — Constitutional Binding** (§10.1). *Not added by this document — amending the constitution is an operator act under Law XI.*
**Composes:** CFS-009 (Laws XI, XII, XVI) · CFS-032 (Capability Registry) · CFS-049 / CCR-001 (Capability Briefs and Completion) ·
CS-001 (duplicate capability as constitutional drift) · the Companion Menu System invariants (MS-1…MS-10) ·
`inv.engineering.036/037/040/041`

> **The central law.** *A constitutional mechanism is not complete until it is bound to an observable
> event, produces an observable consequence, emits constitutional proof, and its absence is
> detectable through mutation.*
>
> Stated negatively, which is how it was discovered: **a mechanism that cannot fire is
> constitutionally indistinguishable from a mechanism that does not exist.**

---

## §0 AUDIT FIRST — what is already law under another name

Per CCR-001 §25's binding instruction (*do not create a parallel structure where a canonical
equivalent exists*), recorded before any of this text is treated as new. **Roughly half of the CB
family is already canon under other names.** What is genuinely new is the *binding chain* that
connects them and the mutation-detectability requirement (CB-5).

| CB clause | Already expressed as | Disposition |
|---|---|---|
| **CB-1** mechanisms bound to observable events | Nothing states it. The closest is CCR-INV-5 (*"Every ratified software invariant must be enforceable"*), which governs invariants, not mechanisms | **NEW** |
| **CB-2** events produce observable consequences | **MS-7** (`2026-07-27_companion-menu-system-invariants.md`) — *"An inert mechanism is a defect… a signal that can never fire is a bug even though nothing errors."* Component scope, canonical, regression-derived | **GENERALISES an existing canonical invariant.** See §6.1 — MS-7 is the *instance*, CB-2 is the *class*. The operator's reading paired MS-7 with CB-6; the evidence says CB-2 |
| **CB-3** consequences emit receipts | **`inv.engineering.040`** — *"Every state transition of record emits a receipt."* Already in the crystal (`proposed`) | **RESTATES an existing invariant at the mechanism layer.** CB-3 adds nothing except the scope boundary in §5.3, and MUST NOT be read more broadly than 040 |
| **CB-4** receipts must be attributable | **Law XI** (humans define semantics; ratification has a human behind it) + the DVN receipt taxonomy + `inv.engineering.041` (*a failure in the provenance chain is escalated, never silent*) | **RESTATES.** CB-4 is 041's attribution half at the mechanism layer |
| **CB-5** every constitutional canary must fail under mutation | Nothing. **No mutation-testing obligation, harness, or convention exists in this repo** (no Stryker, no mutation config, no prior rule) | **NEW — and it is the whole point of this specification** |
| **CB-6** unused constitutional mechanisms are defects | Partially: **CS-001** treats a duplicate capability as drift, and `inv.engineering.037` treats a parallel implementation as a defect. Neither covers the *unused* case | **NEW for the unused case** |
| **CB-7** definition without invocation is not implementation | **CCR-001's Completion Law** — *"Implementation without this artifact is not constitutionally complete"* — is the same sentence shape about a different object (the artifact, not the invocation) | **NEW as stated; PARALLEL in form to CCR-001, deliberately** |

**Two things this audit refuses to duplicate.** The completion ladder (`COMPLETION_LIFECYCLE`) and
the capability registry (CFS-032) already exist and already govern *whether a capability is
finished*. CB governs a different question — *whether a mechanism can fire at all* — and a
capability can be constitutionally complete under CCR-001 while containing a mechanism that is
constitutionally unbound under CB. They compose; neither is folded into the other.

---

## §1 The evidence base — eight defects, one day, one shape

Every clause below is traceable to one of these. A clause that is **not** is marked
**[extrapolation]** and carries no evidentiary weight until an incident supplies it.

Each defect had three properties in common: the mechanism was **present**, the intent was
**correct**, and the implementation **appeared complete**. None errored. None was found by reading.
**All eight were found by mutation testing** — by breaking the thing on purpose and observing that
nothing objected.

| # | Defect | Where | Shape | CB clause |
|---|---|---|---|---|
| **1** | 56 of the 92 icon names used across the codex config had never been registered in the icon map; `getIconComponent` fell through to a blank `Circle`. **More than half the platform's cartridge tab icons rendered as blank dots for months.** A blank icon reads as a design choice, so nothing was ever reported | `app/triad/components/codex/iconMap.ts` · `data/codex-configs.ts` | Mechanism invoked; **consequence absent** | **CB-2**, CB-5 |
| **2** | `CLAUDE.md` names `tests/persona-spine-fetch.test.ts` as the enforcement of a PARAMOUNT transport rule. **The file did not exist.** The rule was documented and unenforced, and violations accumulated behind it | `CLAUDE.md` → `tests/persona-spine-fetch.test.ts` (created 2026-07-27) | Rule **never bound** to any observable act | **CB-1**, CB-5 |
| **3** | `types/research.ts` states that `FINDING_LIFECYCLE`'s order is *"pinned by canary"*. **Nothing pinned it.** Constitutional data whose order is meaning was freely re-orderable | `types/research.ts:7` → now `tests/capability-completion.test.ts` | Claimed enforcement, **no binding** | **CB-1**, CB-5 |
| **4** | `createGovernanceReceipt` has existed since Chrysalis Phase 0A and maps to two DVN-anchorable action types. It had **ZERO call sites.** No constitutional amendment had ever produced a receipt to anchor — the provenance chain for governance was structurally empty | `services/governance/governanceReceiptHelper.ts` → now called by `app/api/governance/ratify/route.ts` | **Defined, never invoked**; consequence class (receipts) entirely absent | **CB-1, CB-3, CB-6, CB-7** |
| **5** | During mutation testing a `commitDocument(documentPath)` call was replaced with a literal. The helper stayed defined-but-unused, and **every canary asserting the helper was *present* still passed** while nothing was committed | `app/api/governance/ratify/route.ts` | Canary asserted **the symbol, not the call** | **CB-5, CB-7** |
| **6** | The same shape again, hours later: replacing `await resolveIdentity()` with a literal left the resolver defined-but-unused and **every "is the helper present" assertion still passed** while no identity was ever parsed | `app/api/ops/dvn/readiness/route.ts` | Canary asserted **the symbol, not the call** | **CB-5, CB-7** |
| **7** | A canary counted degrading conditions and required *"at least four"*. There were five. **Deleting one still passed.** A count is the wrong assertion when the property is "each of these conditions, individually, degrades" | `tests/anchoring-readiness.test.ts` | Canary that **survives its own mutation** | **CB-5** |
| **8** | A canary asserted a document section merely *contained* the word `Rejected`. **A table header row satisfied it** while the entire Rejected verdict section had been deleted | `tests/commercialisation-discovery.test.ts` | Canary that **survives its own mutation** | **CB-5** |

**Defects 5–8 are the ones that make CB-5 constitutional rather than advisory.** In each, a canary
existed, ran, and passed — while the property it named was gone. Ordinary coverage asks *did this
code execute?* Mutation asks *would the system notice if this mechanism stopped working?* Defects
5–8 are four independent proofs, in one day, that those are different questions.

---

## §2 The binding chain

```
Mechanism → Observable Event → Observable Consequence → Receipt / Proof
```

**If any arrow is missing, the mechanism is constitutionally incomplete.** Each defect above is a
missing arrow, and which arrow is missing determines which clause is violated:

| Missing arrow | Symptom | Defects |
|---|---|---|
| Mechanism ↛ Event | Defined, never invoked. Nothing errors because nothing runs | 2, 3, 4 |
| Event ↛ Consequence | Invoked, but the effect never lands. Reads as a design choice, not a bug | 1 |
| Consequence ↛ Receipt | The act happens and the record does not. Provenance chain is empty | 4 |
| (any arrow) ↛ detectable | The chain can be cut without anything objecting | 5, 6, 7, 8 |

The fourth row is the reason this specification exists at all. The first three arrows describe the
system; **the fourth describes our ability to know the first three are still there.**

---

## §3 Constitutional Binding — the definition

> Every constitutional mechanism shall be bound to at least one observable event.
>
> The event shall:
> - **invoke** the mechanism
> - produce a **consequential state transition**
> - **emit evidence**
> - be **mutation-testable**

More formally: *No constitutional mechanism may exist solely by definition. Every constitutional
mechanism must be bound to at least one observable event whose execution can be proven and whose
absence can be detected.*

---

## §4 The CB invariant family

| # | Invariant | Status | Provenance |
|---|---|---|---|
| **CB-1** | Mechanisms must be bound to observable events | proposed → recommended `canonical` (§10.2) | defects 2, 3, 4 |
| **CB-2** | Observable events must produce observable consequences | proposed → recommended `canonical` | defect 1; generalises MS-7 |
| **CB-3** | Observable consequences must emit receipts — **within the scope of §5.3** | proposed → recommended `canonical` | defect 4; restates `inv.engineering.040` |
| **CB-4** | Receipts must be attributable — **within the scope of §5.3** | proposed → recommended `canonical` | defect 4's remediation (admin-only ratification under Law XI; the receipt commits to document content). **Evidence-adjacent, not defect-derived** |
| **CB-5** | Every constitutional canary must fail under mutation | proposed → recommended `canonical` | defects 5, 6, 7, 8 |
| **CB-6** | Unused constitutional mechanisms are constitutional defects | proposed → recommended `canonical` | defect 4 |
| **CB-7** | Definition without invocation is not implementation | proposed → recommended `canonical` | defects 4, 5, 6 |

These are **governance/method rules**, not empirical claims about the world. Under CLAUDE.md's
hypothesis-vs-canon discipline that reserves them for `canonical` rather than `proposed` — but the
seed crystal is amended by the operator alone (Law XI), so §10.2 supplies the block and this
document changes nothing.

---

## §5 SCOPE — what is a "constitutional mechanism"

**This is the most important section in the document.** CB-3 and CB-4 overreach if read literally:
not every mechanism can emit a receipt. An icon map cannot. If the family is stated without a
boundary it becomes unfalsifiable, and an unfalsifiable rule is learned-ignored inside a week —
which would reproduce defect 2 at the level of the specification itself.

**The operator's ruling did not state this boundary. What follows is a recommendation, offered
plainly as such, not a quiet narrowing.**

### §5.1 The definition

> A **constitutional mechanism** is a mechanism that either
>
> **(a)** determines or records a constitutional consequence — an authority decision, an identity
> resolution, an access verdict, a governance or ratification act, an anchoring or provenance step,
> a Standing or entitlement change, or the enforcement of a canonical invariant; **or**
>
> **(b)** is *named in a constitutional document* as the enforcement of a constitutional rule.

Limb (b) is what makes defects 2 and 3 violations. A test file is not itself an authority decision
— but the moment a constitutional text points at it and says *"enforced by"*, that text has made a
constitutional claim, and the claim must be true.

**Not constitutional mechanisms:** rendering helpers, formatting utilities, layout code, caches,
copy, and any code whose failure produces a worse experience but no false constitutional assertion.
CB does not govern them. (The icon map is the instructive edge case — see §5.4.)

### §5.2 What binds every constitutional mechanism

**CB-1, CB-2, CB-5, CB-6 and CB-7 apply to every constitutional mechanism, without exception.**
They are cheap: each asks only that the mechanism can fire, that firing changes something
observable, that it has a caller, and that the check on it dies when the mechanism does.

### §5.3 The CB-3 / CB-4 boundary — RECOMMENDED

> **CB-3 and CB-4 bind only the subset of constitutional mechanisms that effect a *state transition
> of record*** — that is, a mechanism whose invocation changes what the platform will later assert
> to be true to a third party.

This is not a new test. It is **`inv.engineering.040`** (*"Every state transition of record emits a
receipt"*) applied at the mechanism layer, and it is deliberately identical so that CB-3 cannot be
read more broadly than the invariant it restates. A mechanism that computes, resolves, renders or
validates *without changing the record* satisfies CB-1, CB-2, CB-5, CB-6 and CB-7 and is untouched
by CB-3 and CB-4.

**Worked, so the boundary is not theoretical:**

| Mechanism | State transition of record? | Bound by |
|---|---|---|
| `createGovernanceReceipt` (defect 4) | **Yes** — a ratification the platform will assert to a third party, DVN-anchorable | CB-1…CB-7 |
| `commitDocument` (defect 5) | **Yes** — it is the content commitment the receipt attests to | CB-1…CB-7 |
| `resolveIdentity` in the DVN readiness route (defect 6) | **No** — it reports; it writes nothing. A readiness check that wrote would not be a check | CB-1, CB-2, CB-5, CB-6, CB-7 |
| `getIconComponent` (defect 1) | **No** — no record, no assertion, no third party | CB-1, CB-2, CB-5, CB-6, CB-7 |
| `personaFetch` (defect 2's rule) | **No** by itself — but it is limb (b): a constitutional text names its enforcement | CB-1, CB-2, CB-5, CB-6, CB-7 |

Without §5.3, CB-3 would demand a receipt from the icon map. **With it, defect 1 is still a CB
violation — of CB-2 — and the family stays falsifiable.** That is the test of a good boundary: it
excludes nothing the evidence includes.

### §5.4 Why the icon map is in scope at all

It renders no receipt and decides no authority, so limb (a) does not reach it. It is in scope
because the platform's constitutional surfaces — every cartridge tab in the codex registry — are
addressed *through* it, and a silent fallback made half of them unreadable while every registry
record claimed they were fine. **The mechanism did not lie; the surface did.** Where a
presentation mechanism silently substitutes a default for a value a constitutional record asserts
exists, it is a constitutional mechanism under limb (a)'s *"enforcement of a canonical invariant"*
clause, because what it silently breaks is the correspondence between the registry and what a
citizen can see. **[extrapolation]** — this reading is derived from defect 1 rather than stated by
the ruling, and a future incident should either confirm it or force a narrower one.

---

## §6 Relationship to existing canon

### §6.1 MS-7 — the operator's reading, checked

The ruling's framing (paraphrased in commission): *MS-7 is the instance, CB-6 is the class.*

**Confirmed as to instance-of-a-class; refined as to which class.** MS-7's defect was
`workspace: ['mycluster']` — a needle that matched nothing because ranking read the visible label
and `myCluster` is a tab *group*. That mechanism **was invoked** on every ranking pass. It had
callers. It satisfied CB-1, CB-6 and CB-7 completely. What it never produced was an **effect** —
which is **CB-2**.

So: **MS-7 is an instance of the CB family, and its class is CB-2, not CB-6.** The distinction is
load-bearing rather than pedantic, because the two inert modes need different detection. CB-6's
mode (*no caller*) is statically checkable — a call-site scan finds it, which is exactly the canary
§8.1 builds and exactly what would have caught defect 4 without anyone reading a line. CB-2's mode
(*a caller that can never succeed*) is **not** statically checkable; it needs the mechanism run
against real data, which is what the MS-7 canary and the icon canary each do in their own domain.
Collapsing the two would have produced one canary that catches neither well.

### §6.2 The rest

- **`inv.engineering.036/037`** (one authoritative location; a parallel implementation is a defect)
  are **adjacent but different**: they govern *duplication*, CB governs *inertness*. A duplicate
  mechanism fires twice; an unbound one never fires. Both are defects; neither implies the other.
  `tests/source-of-truth-parity.test.ts` is 036/037's enforcement home and indexes CB's canaries
  rather than absorbing them.
- **`inv.engineering.040/041`** are CB-3 and CB-4's source. CB restates them at the mechanism layer
  and adds nothing.
- **CCR-001 / CFS-049** govern capability *completion* — whether a capability concludes in an
  artifact recording what must remain true. CB governs whether the mechanisms inside it can fire.
  **A capability can pass CCR-001's completion gate while containing a CB-unbound mechanism**; that
  is precisely what happened to `createGovernanceReceipt`, which shipped inside a completed phase.
- **CS-001** (duplicate capability as drift) shares CB's diagnostic posture — a defect class named
  so it stops recurring — and governs a different class.
- **Law XVI (CFS-052)** supplies the vocabulary CB depends on: a receipt regenerates a transaction
  and a proof regenerates an evidence suite. CB-3's *"emit receipts"* means Law XVI's receipt, not a
  log line.

---

## §7 Mutation testing becomes constitutional

CB-5 is the clause with no prior expression anywhere in this repo, and the four defects behind it
(5, 6, 7, 8) are all of the same shape: **a canary that passed while the property it named was
gone.**

Four failure modes are now on the record, each with its correction:

| Mode | Example | Correction |
|---|---|---|
| Asserting the **symbol** rather than the **call** | `commitDocument` present but never called (5); `resolveIdentity` present but never called (6) | Assert the call site: `/const doc = commitDocument\(documentPath\);/` |
| Asserting a **count** where the property is **per-item** | *"at least four degrading conditions"* with five present (7) | Iterate the conditions; assert each one individually sets the verdict |
| Asserting **containment** where the property is **structure** | `toContain('Rejected')` satisfied by a table header (8) | Assert the declared heading and its count: `/^### Rejected \((\d+)\)/m` |
| Asserting a **claim** rather than its **referent** | a named enforcement file that does not exist (2, 3) | Resolve the reference; fail if it does not exist (§8.2) |

**The obligation.** Any change that adds or edits a canary over a constitutional mechanism must
report a mutation table: for each canary, the mutation applied to the *guarded artifact* (never to
the test), and whether the canary failed. **A canary that survives its mutation is not evidence;
it is decoration, and it must be corrected in the same change.** Three canaries were corrected this
way on 2026-07-27 (defects 5, 6, 7) and a fourth (8) in the same session; reporting a survival
honestly is more valuable than a clean-looking table.

**No mutation harness is introduced here.** The repo has none, and adding one is a separate,
larger decision (§9). The obligation is a discipline with a reporting requirement, plus the two
static canaries in §8 that make the two commonest modes fail the build without any harness at all.

---

## §8 Enforcement

`tests/constitutional-binding.test.ts`. Indexed in `tests/source-of-truth-parity.test.ts`.

### §8.1 The mechanism-binding registry (CB-1, CB-6, CB-7)

A registry of constitutional mechanisms, each with the file that declares it and the canary that
binds it. For every entry the canary asserts:

1. the declaring file **declares** the symbol;
2. the symbol appears in **call position** at least once outside its own declaration — repo-wide
   for exported mechanisms, module-local for module-private ones, with re-export barrels excluded
   so `export { x }` cannot masquerade as use;
3. the named canary file **exists** and **mentions** the symbol.

Requirement 2 is the one that would have caught defect 4 directly, with no reading and no runtime,
and it is the check that fails the moment a mutation replaces a call with a literal (defects 5, 6).

**Admission rule for the registry.** An entry is added when a mechanism meets §5.1 *and* an
incident, a review, or a new binding names it. It is deliberately hand-maintained and deliberately
small; a registry that tried to enumerate every mechanism in the tree would be a stale duplicate of
the tree (`inv.engineering.036`). Its parity with §8.4's table is canary-checked so the two cannot
drift.

Registered at v1.0 — four entries, each from an incident above:

| Mechanism | Declared in | Scope | Bound by | Defect |
|---|---|---|---|---|
| `createGovernanceReceipt` | `services/governance/governanceReceiptHelper.ts` | exported | `tests/governance-ratification.test.ts` | 4 |
| `resolveIdentity` | `app/api/ops/dvn/readiness/route.ts` | module-private | `tests/anchoring-readiness.test.ts` | 6 |
| `getIconComponent` | `app/triad/components/codex/iconMap.ts` | exported | `tests/capability-artefact-home.test.ts` | 1 |
| `personaFetch` | `utils/personaSpine.tsx` | exported | `tests/persona-spine-fetch.test.ts` | 2 |

**Why defect 5's mechanism is absent, recorded rather than quietly dropped.** `commitDocument` was
being removed from the ratify route by a concurrent refactor of the ratification path *while this
document was being written*, and no longer exists in the tree. Registering a symbol mid-move would
produce a red build attributable to neither workstream. Its **class** is nonetheless covered: the
call-position requirement in (2) is exactly the check that catches a call replaced by a literal,
and it is applied to the three call-site mechanisms that do exist. If the refactored path
reintroduces a content-commitment helper, it belongs in this registry.

**Deliberately weaker than the canaries it composes with.** Requirement (2) asks for *at least one*
call site, not a specific one. `tests/governance-ratification.test.ts` pins the exact caller and is
the stronger check; this registry survives a legitimate refactor that moves a caller, and fails only
when a mechanism has **no** caller at all. Two canaries, two strengths, deliberately — the strict one
guards the current design, the loose one guards the constitutional property.

### §8.2 Named enforcement must exist (CB-1, limb (b))

Every `tests/*.test.ts` path named in the **constitutional corpus** (`codexes/packs/irl/foundation/*.md`),
in `CLAUDE.md`, or in `types/*.ts` must resolve to a file that exists.

This is defect 2 and defect 3 closed as a **class**: a constitutional text may no longer name an
enforcement it does not have. Unchecked checklist lines (`- [ ]`) are excluded, because a plan that
says *"add this test"* is a plan, not a claim.

**Found by this canary on first run:** `CFS-021_constitutional-civic-futurism.md` named a
`ccrl-dashboard-adoption` canary twice. That file had been renamed to
`tests/irl-dashboard-adoption.test.ts` in the CCRL → IRL rename and the constitutional text was
never updated — a live instance of defect 2's class, sitting in the corpus, found by writing the
canary rather than by reading. Corrected in the same change. *(The stale name is written without
its `tests/…test.ts` form above, deliberately: spelling it in full would make this document itself
fail §8.2 — the first thing the canary taught was that a constitutional text cannot quote a broken
enforcement reference without making the claim again.)*

**Deliberately out of scope:** `codexes/packs/agentiq/updates/**`. Those are dated session records
and forward-looking plans; four name tests that do not exist, and all four are unchecked plan items
rather than enforcement claims. Widening the scan to them would produce exactly the false-red that
teaches people to ignore a canary.

### §8.3 CB-5 recorded and resolvable

The mutation table in §8.5 must name, for every registered mechanism, a mutation and the canary
that catches it; every canary it names must exist.

### §8.4 Docs-mirror parity and reachability

The seven CB statements are mirrored in three places that cannot be derived from one another (this
document, the canary, and — once the operator ratifies — the crystal). The canary pins this
document against its own copy of the seven, in order, and asserts that CFS-053 is registered in
`codexes/packs/irl/collections.json` and recorded in `AMENDMENT_RECORDS.md`. An unregistered
constitutional document is unreachable, which is CB-1 performed on the specification itself.

### §8.5 Mutation table (v1.0)

Every row was applied to the guarded artifact — never to the test — and reverted.

Every mutation was applied to the **guarded artifact** — never to the assertion — run, and reverted
byte-for-byte.

| # | Mutation (applied to the guarded artifact) | Canary that must fail | Result |
|---|---|---|---|
| M1 | Replace the `createGovernanceReceipt(...)` call with a literal | §8.1 — call-site absence | killed |
| M2 | Replace `await resolveIdentity()` in the readiness route with a literal | §8.1 — call-site absence, module scope | killed |
| M3 | Remove a registered mechanism's declaration | §8.1 — declaration absence | killed |
| M4 | Point a registered mechanism's canary at a file that does not exist | §8.1 — the named canary must resolve | killed |
| M5 | Point a constitutional doc's `tests/…` reference at a nonexistent file | §8.2 — named enforcement must exist | killed |
| M6 | Drift a CB clause statement in §4 | §8.4 — docs-mirror parity | killed |
| M7 | Remove CFS-053 from `collections.json` | §8.4 — registration | killed |
| M8 | Remove the CFS-053 row from `AMENDMENT_RECORDS.md` | §8.4 — the ledger | killed |
| M9 | Empty the mechanism registry | §8.1 — vacuity guard | killed |
| M10 | Drop a row from the §8.1 registry table in this document | §8.1 — registry ↔ docs parity | killed |
| M11 | Delete the "a surviving canary is a defect" sentence | §8.3 — the CB-5 standard | killed |
| M12 | Restate §5's agent-authored boundary as settled constitutional text | §8.4 — epistemic honesty | killed |
| M13 | Drop an evidence row from §1's eight worked defects | §8.4 — evidence traceability | killed |
| M14 | **Keep the declaration, remove every call site** — defect 4's exact shape | §8.1 — *defined but never called* | killed |

**M14 is the row that matters.** It reproduces defect 4 exactly — a mechanism that is declared,
exported, imported, documented, and never invoked — and it dies. That single check is the thing a
reading of `createGovernanceReceipt` failed to notice for an entire phase.

**Any row that does not fail is a defect in the canary, not a pass** — CB-5 applied to CB-5's own
enforcement. Three canaries elsewhere in the repo were corrected this way on the same day (defects
5, 6, 7); reporting a survival honestly is worth more than a clean-looking table.

**One mutation was initially recorded as inapplicable rather than as a kill (M11),** because the
sentence it targeted is hard-wrapped and the mutation script matched a single line. That is the
same class as defect 8 — a check that reads a substring where the property spans a structure — in
the *mutation harness* rather than in a canary. Re-applied wrap-aware, it killed. Recorded because
a mutation that does not apply must never be silently read as a mutation that was survived, or
mutation testing acquires the exact blind spot it exists to remove.

---

## §9 What this document does NOT do

Recorded explicitly, because a constitutional text that reads as a shipped system is the CS-001
drift defect — and a specification about unbound mechanisms that overstated its own bindings would
be the defect performing itself.

- **No mutation-testing harness.** No Stryker, no mutation runner, no CI mutation stage. CB-5 is a
  reporting obligation plus two static canaries that catch its two commonest modes. A harness is a
  separate operator decision with a real cost (§10.3).
- **No Law XVII.** The Law's elevation is prepared in §10.1 and **not applied** — Law XI reserves
  constitutional amendment to the operator.
- **No change to `canonical-invariants.seed.json`.** §10.2 supplies the exact block. The crystal is
  being edited by another workstream concurrently; touching it here would be both a Law XI breach
  and a merge hazard.
- **No new registry service, type module, or API route.** The mechanism registry lives in the canary
  that consumes it, because it has exactly one consumer. A service module read by nobody would be a
  CB-6 violation in a document that defines CB-6.
- **No re-litigation of MS-1…MS-10, CCR-INV-1…12, or `inv.engineering.036/037/040/041`.** CB
  composes with them (§6); it replaces none of them.
- **No claim that the eight defects are exhaustive.** They are one session. The family should be
  expected to grow a CB-8 the first time a defect fits none of the seven — and, per the MS
  precedent, it must arrive with its canary in the same change.

---

## §10 Operator actions outstanding

### §10.0 OPERATOR RULINGS, 2026-07-27 (received after this document was drafted)

Two rulings settle two of the questions §10 raised. Both are recorded here verbatim because they
change what this document is *for*, not merely what it says.

#### RATIFIED — the CB-3 scope wording

The operator ratified the §5.3 boundary in these words, and this wording is now canonical for the
clause:

> "Earlier we spoke about *every constitutional mechanism emits a receipt.* That was too broad. The
> better constitutional definition is: **Every constitutional mechanism that effects a state
> transition of record must produce observable evidence of that transition.** That excludes icon
> maps, static lookup tables, presentation metadata, while including governance ratification,
> delegation, standing changes, receipts, constitutional state, anchoring. I would ratify exactly
> that wording."

Note the ratified form says **"produce observable evidence of that transition"**, not "emit a
receipt". That is a deliberate widening of the *consequence* while keeping the *scope* narrow: a
receipt is the canonical evidence form (`inv.engineering.040`), but the clause binds on evidence,
not on one implementation of it. The narrower reading would have made CB-3 unsatisfiable by any
mechanism whose evidence is a durable record rather than a receipt row.

#### DEFERRED — Law XVII waits for experimental support, deliberately

The operator declined to ratify Law XVII now, and the reasoning is a methodological improvement
rather than a delay:

> "The specification appears mature. The evidence is compelling. But I'd deliberately wait until
> after the software expansion of P2… Today's twelve or thirteen examples are all software
> engineering observations. That's already enough to justify a specification. But if P2A becomes an
> explicit experiment, then Constitutional Binding ceases to be *an engineering lesson* and instead
> becomes **an experimentally supported constitutional principle.** That is much stronger."

**CFS-053 therefore stays `PROPOSED`** until all three hold: P2A exists; software consequence is
formally in the programme; at least one experimental result supports the principle. Only then does
Law XVII become "grounded not merely in architectural observation, but in experimental evidence."

This is the hypothesis-vs-canon discipline (CLAUDE.md) applied to the platform's own doctrine, and
it is worth naming as such: the specification is a claim about how systems fail, which is an
empirical claim, and empirical claims wait for evidence. A document arguing that mechanisms must be
bound to observable events would be poorly served by being ratified on assertion alone.

#### §10.0a The representation reading — recorded for the P3 team

The operator identified something this document did not: **the latent-mechanism class is also a
representation invariant.**

```
Intent → Mechanism → Invocation → Effect → Evidence
```

> "What today demonstrated is that representation can preserve intent, mechanism, and
> implementation, while losing **invocation**. That is a representational failure… **A
> representation is incomplete if it preserves structure while failing to preserve activation.**"

That links Constitutional Binding to Representation (EXP-P3) and to Consequence (EXP-P2) directly:
every one of the eight defects in §1 is a representation that survived review because everything
*except* its activation was intact. A reviewer reading the icon map, the lifecycle comment, or the
governance helper would have found each one complete — because the missing element is not part of
what the representation shows.

**Recorded here rather than acted on.** EXP-P3 is not this document's to design, and the claim
"a representation is incomplete if it preserves structure while failing to preserve activation"
is a *hypothesis* about representation, not a governance rule — so it enters at `proposed` if it
enters at all, and belongs to the P3 charter.

#### §10.0b The programme is cybernetic, not sequential — recorded for the P-series

Also recorded, because it reframes the experiment series and should not be lost in a chat log:

> "Originally the programme looked like P1 → P2 → P3 → P4. I don't think that's the right mental
> model anymore… **P3 doesn't come after P2. P3 continually refines the representation used by P1
> and P2. P4 continually studies interactions among those represented fields.** That makes the
> programme genuinely cybernetic rather than sequential."

```
                    P4  Interaction Fields
                          ▲
                          │
        P1 ─────► P2 ─────► Reality
         ▲         │
         │         ▼
         └──── P3 Representation
```

> "Inference isn't the subject. It is simply **the least consequential substrate on which invariant
> discovery begins.** Everything after that is about increasing consequence, improving
> representation, and understanding interaction."

This bears on EXP-P4, which is currently RESERVED and undesigned (`types/research.ts`,
`codexes/packs/irl/foundation/experiments/exp-p4-invariant-interaction/`). It is narrative and
architecture, not a change to any experiment definition, and **nothing in the P-series has been
modified here.**

### §10.1 RECOMMENDED — CFS-009 Law XVII — Constitutional Binding

The ruling's central law is a statement about how every future feature is built, which is the
weight of a numbered Law rather than a specification clause. **Prepared, not applied.** If the
operator ratifies, insert after Law XVI in
`codexes/packs/irl/foundation/CFS-009_development-constitution.md`:

```markdown
## Law XVII — Constitutional Binding
*(Amendment, ratified by operator direction 2026-07-27. Full specification: CFS-053 — Constitutional Binding.)*

> **A constitutional mechanism is not complete until it is bound to an observable event,**
> **produces an observable consequence, emits constitutional proof, and its absence is**
> **detectable through mutation.**

A mechanism that cannot fire is constitutionally indistinguishable from a mechanism that does not exist.

**Bound to an observable event.** No constitutional mechanism may exist solely by definition. Definition without invocation is not implementation: a helper with no caller, a rule with no enforcement, a claimed canary that was never written are all the same defect wearing three faces. Each was found in this platform on a single day, and none was found by reading.

**Produces an observable consequence.** Invocation is not enough. A mechanism that runs and whose effect never lands is inert, and inertness reads as a design choice rather than a fault — which is why it survives for months. This is MS-7 raised from component scope to constitutional scope.

**Emits constitutional proof.** RATIFIED WORDING (operator, 2026-07-27): *every constitutional mechanism that effects a state transition of record must produce observable evidence of that transition.* Where the consequence is a state transition of record — a change in what the platform will later assert to be true to a third party — it emits a receipt, and that receipt is attributable (`inv.engineering.040/041`, Law XVI). Where it is not, this clause does not bind: an icon map owes no receipt, and a law that demanded one would be ignored rather than obeyed.

**Its absence is detectable through mutation.** Coverage asks whether code executed. Mutation asks whether the system would notice if the mechanism stopped working. Those are different questions, and only the second is constitutional. A canary that survives the deletion of the property it names is not evidence; it is decoration.

The four clauses are one chain — mechanism → event → consequence → proof — and a missing arrow is not a partial implementation. It is an absence that every other signal reports as presence.
```

Then: record in `AMENDMENT_RECORDS.md` (this document's row is already present and should be
amended from *specification* to *Law XVII* on ratification) → DVN anchoring, per CFS-009's
amendment process.

### §10.2 Seed-crystal block

The CB family are governance/method rules, which CLAUDE.md's hypothesis-vs-canon discipline
reserves for `canonical`. **They nonetheless enter at `proposed`, and the reason matters.** The
Laws-promotion ruling of the same day established that `canonical` in the crystal requires a
`canonical_basis` naming a ratified constitutional source — *"the crystal is REFLECTING
constitutional canon, not creating it"* — which is why `inv.engineering.036` and `037` sit at
`proposed` today despite being method rules of exactly this class. CB has no such basis **until
Law XVII is ratified**. Seeding it at `canonical` first would be the crystal creating canon rather
than reflecting it.

**Do not paste this until the concurrent edit to the crystal has landed**, and replace `NNN` with
the next free number in the `engineering` namespace (append-only; do not renumber — the highest in
use is 098). Mirror the statement into `appendix-a_canonical-invariants.md`.

```json
    {
      "id": "inv.engineering.NNN",
      "namespace": "engineering",
      "semantic_type": "principle",
      "statement": "Every constitutional mechanism must be bound to at least one observable event whose execution can be proven and whose absence can be detected. CB-1 mechanisms must be bound to observable events. CB-2 observable events must produce observable consequences. CB-3 observable consequences that effect a state transition of record must emit receipts. CB-4 those receipts must be attributable. CB-5 every constitutional canary must fail under mutation. CB-6 unused constitutional mechanisms are constitutional defects. CB-7 definition without invocation is not implementation. A mechanism that cannot fire is constitutionally indistinguishable from a mechanism that does not exist.",
      "status": "proposed",
      "contexts": [
        "governance",
        "engineering",
        "verification"
      ],
      "provenance": {
        "source": "CFS-053 — Constitutional Binding; proposed as CFS-009 Law XVII; operator ruling 2026-07-27, generalising eight same-shape defects found by mutation testing in one session"
      }
    },
```

**On ratification of Law XVII** — and only then — promote it in the same idiom the Laws promotion
used, so the basis is explicit rather than assumed:

```json
      "status": "canonical",
      "provenance": {
        "source": "CFS-009 Law XVII",
        "canonical_basis": { "source": "CFS-009", "ratified": true },
        "derived_from": { "law": "XVII" }
      }
```

### §10.3 Open — should a mutation harness be adopted?

CB-5 is currently a discipline with two static canaries behind it. A real harness (Stryker or
equivalent) would make it mechanical, at the cost of a slow CI stage and a mutation-score
convention nobody in this repo has yet. **Recommendation: not yet.** Four of the eight defects were
found by *manual, targeted* mutation of exactly the mechanism under review, which is cheap and
already working. Revisit if a CB-5-class defect ships despite the obligation — that would be the
evidence a harness needs.

### §10.4 Open — does CB bind agents as well as code?

An agent that reports work it did not do is the same defect at the level of the workforce: a
mechanism (the report) unbound from an observable event (the work). CB says nothing about this and
this document does not extend it. **[extrapolation]** — raised because the shape is identical, not
because evidence supports it.
