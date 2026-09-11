# VL-CT-001 — six operator rulings applied, and the MoneyPenny simulation adapter

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Applies rulings to:** `codexes/packs/agentiq/updates/2026-07-29_vl-ct-001-venture-substrate.md`
**Charter:** `codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-constitutional-trading-venture-charter.md`
**Gap register:** `codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-gap-register.md`

Six rulings were returned against the venture substrate's five flagged items.
This doc records what each ruling changed, the one place a ruling's
qualification did **not** already hold, and the next slice built on top.

**Read this first if you only read one thing:** Ruling 3's qualification was the
only ruling that required new behaviour rather than new enforcement — the
bundled obligation really did flatten five services into one basis, and a reader
of a bundled `correct-refusal` had no way to know that four of the five services
inside it were completions.

---

## RULING 1 — R-8 stays receipt-carried; record the promotion boundary

**Approved as built. No behavioural change.** What was missing was not the
behaviour but the *condition under which the behaviour should stop* — written
where the next agent will read it rather than in a session summary.

`services/venture/trading/compensationExtension.ts:28-50` now carries the
boundary verbatim:

> Phase 1 may record compensation evidence inside the versioned receipt body. A
> top-level canister field requires a separate payload-shape review and explicit
> approval.

with the three named promotion triggers — **settlement indexing**, **public
verification**, **cross-runtime reconciliation** — each one a component that
must address compensation *independently of the containing receipt*. None exists
in Phase 1.

**Canary (`AC-14`, `tests/venture-trading-substrate.test.ts:1015-1096`)** — the
boundary is enforced, not remembered:

- the DVN canister payload's **top-level key set is pinned by hand** (13 keys),
  so promoting compensation under any name changes the set and fails the build.
  Changing that list is a payload-shape review;
- a name-level check for `compensation` / `obligationRef` / `amountMinorUnits` /
  `amountCommitment` / `settlementState` anywhere in the payload literal;
- a **behavioural** half one layer earlier: the extension's own fields are never
  hoisted onto the venture receipt either;
- a check that the module still documents the boundary.

---

## RULING 2 — fixture receipts stay unanchored, with a hard assertion

**Approved, and the assertion was the missing half.** Before this the 24 replays
were unanchored *by convention*: no code called the writer, and a comment said
why. That holds exactly until a refactor wires the live writer into the replay
path — at which point 24 copies of the same fixture enter the operational
provenance trail and are discovered months later, in an audit, as rows nobody
can explain.

### Four states, named separately wherever they are reported

Conflating any two of them **is** the defect. `services/venture/trading/receipts.ts:28-54`:

```
receipt object generated   — YES
receipt hash computed      — YES  (ventureReceiptHash, over a canonicalised body)
receipt persisted          — NO
receipt DVN-anchored       — NO
```

### The runtime guard

| What | Where |
|---|---|
| `VentureReceiptMode = 'fixture' \| 'live'` on the journal | `receipts.ts:129-152` |
| `VentureFixtureModeViolation` — a distinct error class | `receipts.ts:154-168` |
| `assertVentureJournalCanLeaveMemory(journal, op)` — **throws** | `receipts.ts:170-193` |
| `persistVentureReceipt` / `anchorVentureReceipt` — guard **before** the writer | `receipts.ts:195-224` |
| `runVentureScenario` creates the journal explicitly as `'fixture'` | `runScenario.ts:126-129` |

It throws. It does not warn, log, no-op, or return a boolean — a guard that
returns a boolean is a guard a caller can ignore.

### The artifacts are preserved, so refusing to persist costs no evidence

`ventureJournalArtifacts(journal)` returns every receipt with its
`ventureReceiptHash` (sha256 over a key-sorted canonicalisation, so structurally
identical receipts hash identically), plus the cost checkpoints, plus
`persisted: false` and `dvnAnchored: false` as **explicit falses**. Reported
rather than omitted: an absent field reads as "unknown", and "unknown" is how
"generated" becomes "anchored" one report downstream.

**Canary (`AC-15`)** — all 24 runs journal in fixture mode; persisting and
anchoring both reject with `VentureFixtureModeViolation` **and the writer is
asserted never to have been called** (a guard placed *after* the write would
also throw, having already contaminated the trail); a `live` journal passes, so
the guard discriminates on mode rather than being inert; no substrate module
names `createActivityReceipt(` or `submitActivityReceiptToDvn(`; the artifacts
are complete, uniquely hashed, and reproduce across an independent replay.

---

## RULING 3 — bundled refusal basis, WITH the qualification

**The qualification did NOT already hold.** This is the one ruling that required
new behaviour.

**What was there:** `bundleBasis()` collapsed the pending services into a single
terminal basis and the obligation carried nothing else. A bundled S2 obligation
read `basis: 'correct-refusal'` — true as a terminal outcome, and misleading as
a description, because the discovery, analysis, risk review and reconciliation
inside that same bundle were **completed services**.

**What it is now:**

```
Bundle terminal basis: correct-refusal
Components:
  discovery: completed · analysis: completed · risk-review: completed
  refusal: refused · reconciliation: completed
```

| Change | Where |
|---|---|
| `ServiceObligationComponent { serviceType, basis, disposition }` | `types.ts:207-228` |
| `ServiceObligation.components` — never empty | `types.ts:244-252` |
| Populated for **both** pricing structures | `serviceLedger.ts:261-287` |
| `describeObligationOutcome()` — pairs the label with its work | `serviceLedger.ts:369-381` |
| Carried into the R-8 extension (copied, not aliased) | `compensationExtension.ts:117-122, 156-158` |
| Folded into `runFingerprint` | `replay.ts:176-181` |

`disposition` is **derived** from the basis, never asserted separately — two
fields that could disagree about the same fact are two sources of truth.

The terminal basis is **retained**, per the ruling: refusal is the load-bearing
outcome for H3 and "completed" would erase the distinction under test.

**No `mixed` classification**, per the ruling — and a canary greps the substrate
for one, so it cannot arrive later by habit. Revisit only when settlement or
reporting needs multiple simultaneous terminal bases.

**Two new reconciliation identities** (`replay.ts:105-118`), so the rule holds
across all 24 runs and not only where a canary looks:

- **Identity 11** — an obligation names the work it compensates (components
  non-empty). A liability for no identifiable service is an aggregate label with
  nothing behind it.
- **Identity 12** — a bundle terminal-labelled `correct-refusal` has a refused
  component to support it.

**Canary (`AC-16`)** — the bundle is one obligation with terminal basis
`correct-refusal`; the five components are asserted **hand-written in fixture
order** (deriving them would assert the projection equals itself and a bundle
that dropped components entirely would still pass); an *executed* bundle carries
no refused component, so the split carries information; per-service obligations
carry components too; the components travel into the extension, because the
receipt is what a verifier reads.

---

## RULING 4 — Standing weight is provisional and experiment-scoped

**`MAX_STANDING_SIGNAL_WEIGHT = 3` retained, not ratified.** Recorded at the
constant (`standingAdmission.ts:113-127`):

> Weight 3 is a provisional maximum for VL-CT-001 venture signals and does not
> amend the canonical Standing formula.

The 1–3 values are **ordinal experimental contribution weights, not Standing
points** (`standingAdmission.ts:64-95`). The load-bearing property is the
**ordering**:

```
correct evidenced refusal  >  profitable constitutionally incomplete execution
```

### The canary pins the property, not the number

`AC-17` asserts the three constitutional outputs the ruling names, in terms that
survive any re-scaling:

| Output | How it is asserted |
|---|---|
| incomplete action → inadmissible, weight 0 | three claim shapes — commercial, constitutional, and both — all land at 0 |
| correct complete refusal → admissible, positive weight | asserted as **`> 0`**, never `= 3` |
| weight never derives from profit or execution volume | identical constitutional bases with every commercial metric attached returns an **identical** weight |
| **the ordering** | `refusal > execution`, asserted as a comparison; and against the strongest possible execution claim (every permitted basis at once), which is 0 because the completeness clause fires before weight is computed |

**Verified with a control as well as a mutation.** Multiplying every weight and
the ceiling by ten leaves all tests green; dropping `correct-refusal` to 0.1 and
removing the completeness clause fails five. The canary measures the ordering
and not the magnitude the ruling left provisional.

A second canary walks `services/`, `app/`, `components/`, `utils/` and fails if
anything **outside** `services/venture/trading/` reads
`MAX_STANDING_SIGNAL_WEIGHT`. That is how a provisional constant gets ratified
by accident: one module imports it, and the next treats that as precedent.

**Accrual is deferred.** These signals reach the existing Standing accrual
service **only after Slice C** defines how an admitted signal maps into
Personal / Delegated / Stewardship / Capability Standing. Until then an admitted
decision is an experimental observation. The MoneyPenny adapter reports it as
`accrualDeferredUntil: 'slice-c'` so the distinction survives the projection.

---

## RULING 5 — the migration must not fail quietly

> Relying on an insert failure is too quiet for a consequential pipeline.

**What was too quiet.** With the action-type migration unapplied, everything
typechecks, every canary passes, the deploy is green — and the first live
receipt fails a CHECK violation deep inside a write that several call sites in
this repo wrap in an empty catch. The row is lost, the DVN anchor with it, and
the deployment is broken with nothing saying so. The symptom surfaces later as
an unexplained gap in the provenance trail, which is the evidence needed to
diagnose it.

### The check

`services/venture/trading/receiptCompatibility.ts` (new) +
`supabase/migrations/20260929000100_venture_receipt_constraint_probe.sql` (new).

A probe function in the database returns the constraint's definition. **Its
presence is the version marker; its return value is the vocabulary.**

| Failure mode | Reason code | Result |
|---|---|---|
| probe function missing / unreadable | `probe-unavailable` | **refuse** |
| probe throws (no client, network) | `probe-unavailable` | **refuse** |
| constraint does not exist | `constraint-absent` | **refuse** |
| constraint short of the nine types | `action-types-missing` (names which) | **refuse** |
| all nine present as quoted values | — | proceed |

**Fail closed on every branch.** A compatibility check that proceeds on
"couldn't tell" is the quiet failure again, one layer up.

**Where it runs:** `persistVentureReceipt` and `anchorVentureReceipt` call
`assertVentureReceiptConstraintCompatible()` **before the writer**
(`receipts.ts:195-224`), so no live emission path can skip it.
`ventureReceiptDeploymentCheck()` is the same evaluation without the throw, for
a deploy step or ops route that wants the diagnosis rather than the exception.
The throw logs at `console.error` with a `[VENTURE RECEIPT COMPATIBILITY]`
prefix, so it is findable in CloudWatch alongside the DVN escalations it would
otherwise silently precede.

Phase 1 emits nothing live — the fixture guard refuses first — so today this is
a gate in front of a door nobody opens. That is the point: it is in place
**before** Phase 2 opens the door, not added after the first silent loss.

**Canary (`AC-18`)** — each of the four refusal branches driven directly; one
missing type is enough to refuse; the type is matched as a **quoted value**, not
a substring (a comment naming the action type is not the database accepting it);
a fully applied constraint IS compatible, guarding against a canary that always
refuses; a throwing probe fails closed; and a live emission is refused **before
the writer runs**, with the writer asserted uncalled.

### A latent defect this exposed, and fixed

`tests/activity-receipts-action-type-parity.test.ts` selected "the latest CHECK
constraint rebuild" by a **mention** of the constraint's name. The new probe
migration legitimately *reads* the constraint without rebuilding it, so it was
chosen as "the latest rebuild", matched no `CHECK (action_type IN (...))` block,
and failed with a null — reporting a drift that did not exist. It now selects on
`ADD CONSTRAINT`. A canary that cries wolf gets ignored, and that one guards a
failure mode that loses receipts without a log.

---

## RULING 6 — the thin MoneyPenny simulation adapter

`services/venture/trading/moneyPennyAdapter.ts` (new).

### Surface

| Export | What it is |
|---|---|
| `MONEYPENNY_ADAPTER_VERSION` | `'moneypenny-simulation/1'` — a later, wider adapter is a new version, not a silent change |
| `MONEYPENNY_SPECIALIST_ID` | `'moneypenny'` — the id `services/agents/specialistRouter.ts` already dispatches on |
| `MONEYPENNY_CARTRIDGE_SLUG` | `'moneypenny'` — the slug `MONEYPENNY_CARTRIDGE` registers in `data/codex-configs.ts` |
| `MONEYPENNY_FIXED_OPPORTUNITY` | `'mp-sim-001-suitability-refusal'` |
| `MONEYPENNY_DEFAULT_CELL_ID` | `'USDC-SERVICE-COMPLETE'`, resolved through `parseVentureExperimentCellId` rather than written out twice |
| `submitMoneyPennyOpportunity(submission?)` | submit → run → reconcile → project |
| `summariseMoneyPennySimulation(outcome)` | T1-safe lines an agent can say |

### One fixed opportunity, literally

**There is no opportunity parameter.** MoneyPenny submits THE fixed opportunity
or nothing — an adapter that accepted an arbitrary opportunity would be the
production intake surface under a different name. The fixed opportunity is the
correct-refusal one, because refusal is the load-bearing outcome for H3 and it
is the branch a commission-led system cannot express at all.

The **cell** is a parameter, because it is a parameter of the engine. The same
submission in `USDC-SERVICE-EXEC` yields the same correct refusal and **no
obligation** — the experimental effect, visible through the adapter rather than
only through the 24-run matrix. All eight cells run and reconcile.

### The chain it exercises, end to end

```
opportunity          opportunityRef (commitment), requested service, status
      ↓
preparation events   5 events, 355 000 ms elapsed, evidence count
      ↓
completeness verdict refused-complete, 7/7 links, no missing checks
      ↓
correct refusal      terminal disposition — never a "failed trade"
      ↓
obligation           terminal basis + components (RULING 3)
      ↓
simulated settlement ledger state transition; liveFunds: false
      ↓
DVN receipt artifact generated + hashed; persisted: false, anchored: false
      ↓
Standing admission   admitted ≠ accrued; accrualDeferredUntil: 'slice-c'
      ↓
reconciliation       violations: []
```

### Out of scope, and shaped so it cannot arrive by accident

Live settlement, multi-agent orchestration, external agents, real funds,
dashboards. `AC-19` greps the module for the engine functions it must **not**
have re-implemented (`applyLiabilityEvent`, `assessConstitutionalCompletion`,
`evaluateTradingStandingSignal`, `emitVentureReceipt`, `createLedger`,
`liabilityArisesAt`) and for `fetch(`, `settlementExecutor`, `getSupabaseServer`,
`wallet`, `transfer(` — which is what production orchestration would look like
arriving by degrees.

### Every claim carries its qualification in the line

A summary is the surface most likely to be quoted out of context, so
`summariseMoneyPennySimulation` writes "simulated", "NOT DVN-anchored" and
"an admission, not an accrual" **into the line itself**, and `AC-19` asserts
they are there.

---

## Mutation table

Every canary added by these rulings was mutation-tested: mutation applied → the
edit verified present in the file → suite run → restored → restore verified and
suite re-run green.

| # | Mutation | Ruling | Result | Caught by |
|---|---|---|---|---|
| M19 | `compensation` promoted to a top-level canister payload field | 1 | **CAUGHT (2)** | AC-14 key set, AC-14 name check |
| M20a | the fixture-mode guard no longer throws | 2 | **CAUGHT (3)** | AC-15 persist, anchor, guard |
| M20b | `runVentureScenario` creates a `'live'` journal | 2 | **CAUGHT (4)** | AC-15 ×4 |
| M21 | a bundle keeps only its terminal component | 3 | **CAUGHT (5)** | AC-16 ×4, AC-12 identity 12 |
| M22 | Standing ordering inverted (`correct-refusal` → 0.1, completeness clause removed) | 4 | **CAUGHT (5)** | AC-3 ×2, AC-5, AC-17 ×2 |
| **C1** | **control** — every weight and the ceiling multiplied by ten | 4 | **SURVIVED, as required** | ordering preserved; the canary pins ordering, not magnitude |
| M23 | the runtime constraint check removed from the emission path | 5 | **CAUGHT (1)** | AC-18 live emission |
| M24 | the adapter pins the cell instead of passing it through | 6 | **CAUGHT (1)** | AC-19 cell-is-a-parameter |

**C1 is the point of Ruling 4** and is reported as a survivor deliberately: a
pure re-scale must NOT fail, or the canary would be pinning the magnitude the
ruling explicitly left provisional. It was run as a mutation and confirmed green
at 79/79 before being reverted.

**On verifying that a mutation actually applied.** The previous pass on this
substrate produced two false survivors — one edit touched a TypeScript interface
only (Vitest does not typecheck, so the runtime object was unchanged: a genuine
no-op indistinguishable from a surviving canary), and one threw at module
collection, emitting zero per-test failure markers, which a detector counting
them read as a clean run. Every mutation above was therefore confirmed present
in the file by grep after writing it, and every result was read from the
`Tests N failed` line rather than from a marker count.

---

## Verification

- **Full suite:** 180 files / **2978 tests** passed (baseline 180 / 2933; **+45
  tests**, no new files — the canaries extend
  `tests/venture-trading-substrate.test.ts` rather than forking a second suite).
- **`npx tsc --noEmit`:** the two pre-existing config errors only
  (`Cannot find type definition file for 'iqube'`; `Invalid value for
  '--ignoreDeprecations'`). **No new errors.**

---

## Operator SQL — run this in the Supabase SQL editor

Ruling 5's probe. Run it **after**
`20260929000000_venture_substrate_receipt_types.sql` (the nine action types —
that SQL is in the substrate doc and unchanged). Running it before is harmless:
the probe simply reports the constraint as incompatible, which is the true
answer.

```sql
CREATE OR REPLACE FUNCTION public.venture_receipt_action_type_constraint()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.venture_receipt_action_type_constraint() IS
  'VL-CT-001 deployment compatibility probe. Returns the activity_receipts action_type CHECK definition so the application can refuse live venture receipt emission when the action-type migration is absent, instead of discovering it as a failed insert. See services/venture/trading/receiptCompatibility.ts.';

GRANT EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() TO anon, authenticated, service_role;
```

**Verify it applied** — this should return the constraint definition containing
all nine `venture_*` types:

```sql
SELECT public.venture_receipt_action_type_constraint();
```

`SECURITY DEFINER` with a fixed `search_path`: reading a constraint definition
is a catalogue read with no data exposure, and the pinned `search_path` closes
the usual definer-function hijack.

---

## Flagged, not decided

1. **The execution branch is not reachable through the MoneyPenny adapter.**
   Ruling 6 says "one fixed opportunity", and the fixed one is the correct
   refusal. The engine exercises the executed branch (S1, all eight cells, in
   the 24-run matrix) and the adapter exercises refusal in all eight. Widening
   the adapter's catalogue to a second fixed opportunity is a scope decision,
   not something to take unilaterally against an explicit "one".

2. **Ruling 5's check gates receipt EMISSION, not process startup.** The ruling
   permits either ("refuses startup **or** receipt emission"). Emission was
   chosen because Next.js has no single safe startup hook and a module-init
   database call would run in every Lambda cold start including ones that never
   emit a receipt. `ventureReceiptDeploymentCheck()` is exported for a deploy
   step or health route; **wiring it into the Amplify deploy pipeline is an
   operator decision** and has not been done.

3. **`SECURITY DEFINER` on the probe function.** It reads `pg_constraint` only
   and is granted to `anon`. That is deliberate — a health check should not
   require a session — but it is a new publicly-callable function and worth a
   line of operator sign-off.

4. **Slice C is now a named dependency in code**, not only in planning.
   `standingAdmission.ts` and the adapter both defer accrual to it by name. When
   Slice C lands, the mapping from an admitted signal to a Standing lane is the
   thing to build; nothing in this substrate should be changed to anticipate it.

5. **The pilot's own `finance` invariant namespace is still empty** (S-1 in the
   gap register), unchanged by these rulings. This substrate is instrumentation;
   it does not discover trading invariants and does not claim to.

---

## Where to read this

| Surface | Link |
|---|---|
| In-app | `https://dev-beta.aigentz.me/triad/embed/codex/agentiq?tab=updates` (AgentiQ cartridge → Updates) |
| Repo | `codexes/packs/agentiq/updates/2026-07-29_vl-ct-001-operator-rulings-and-moneypenny-adapter.md` |
| Substrate doc it amends | `codexes/packs/agentiq/updates/2026-07-29_vl-ct-001-venture-substrate.md` |
