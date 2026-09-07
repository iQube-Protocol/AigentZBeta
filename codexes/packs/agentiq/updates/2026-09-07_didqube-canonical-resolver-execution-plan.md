# DiDQube Canonical Resolver — Execution Plan

**Status:** PLAN ONLY — no implementation has started. This document is the response to the operator's
architectural brief (ruling: *"A DiDQube is the canonical constitutional container for an entity's
identity primitives..."*) and proposes how to execute it safely against the actual codebase audited in
`2026-09-07_didqube-passport-architecture-vs-code-report.md`. Nothing below is committed code.

**Classification (Prospective Evolution Capture, CLAUDE.md):** this is a **candidate architectural
refinement** — a real, substantial design change, not yet implemented, validated, or ratified. Per
CLAUDE.md's Resolution → Invariant Loop, an agent may propose and classify but must not unilaterally
promote a candidate to canonical status. Recommend registering the ruling above and this plan into the
CFS-051 research backlog under an architecture marker, pending explicit operator sign-off on the
phase-by-phase sequencing below — not a request to begin Phase 1 immediately without that sign-off.

---

## 0. Preflight — what this touches that's already governed

Before any implementation, per CLAUDE.md's mandatory resolution/invariant preflight:

**Protected files this plan would eventually touch, requiring explicit operator approval before
editing (CLAUDE.md "Identity & Access Spine" and "DVN Pipeline Protection" — PARAMOUNT):**
- `services/identity/getActivePersona.ts` — the plan's CTP/DCIR integration (§9) and the existing
  identifiability-clamping extension point (found unimplemented in the prior audit) both touch this.
- `services/access/evaluateAccess.ts`, `services/access/policyResolvers.ts` — CTP's proposed
  disclosure-tier evaluation depends on these.
- `services/dvn/activityReceiptDvnPipeline.ts` (DVN Pipeline Protection: the ONLY permitted
  unilateral change is adding a new action type to `ANCHORABLE_ACTION_TYPES`) — §7's DVN receipt
  commitment-field change is explicitly NOT the permitted change; it needs operator approval BEFORE
  coding, not after.
- `types/access.ts`, `services/content/getContentDescriptor.ts` — extend by composition only.

**Existing invariants this plan must not regress (from the prior audit and CLAUDE.md):**
- `inv.engineering.036`/`037` — one authoritative location per concern; a parallel implementation is a
  defect. The plan's own §3/§7 already anticipate this ("existing tables remain authoritative," "the
  DiDQube becomes the stable connective container") — good; the execution must hold that line under
  schedule pressure, not introduce a second identity-resolution path alongside the new resolver.
  The audit found `personas.root_did` is exactly this kind of drifted duplicate today — this plan is
  partly a formal fix for that already-diagnosed defect class, not a new one.
- The audit's finding that `services/agentiq-wallet`'s orphaned `didqube` Postgres schema exists and
  converged with nothing — this plan must decide its fate explicitly (§1, phase 0) rather than create
  a *third* identity schema alongside it.
- Passport-native access discipline (`passportPrincipal.ts`'s "fail closed, every branch," "binding by
  lineage never by email," "never accept personaId as input") — the new resolver must inherit these
  postures, not relax them for convenience.

**What the brief gets right that the codebase already independently arrived at** (worth stating so
the team doesn't think this is a green-field redesign): the audit already found `kybe_id` is the real
binding key in `passportPrincipal.ts`, that agents deliberately carry no kybe, and that Passport
issuance is already structurally separated from delegation. The brief's ruling formalizes and extends
that existing direction — it does not contradict it. This lowers execution risk materially: most of
Phase 1-3 below is *modeling what's already true*, not inventing new behavior.

---

## 1. Phased delivery — restructured from the brief's 13-step sequence into gated increments

The brief's own delivery sequence is directionally right but treats 13 steps as one line; several of
them span weeks and touch protected subsystems. This plan regroups them into **five gated phases**,
each independently shippable, each with its own acceptance check, so no phase depends on
finishing the whole plan to deliver value — and so a stop after any phase leaves the system in a
strictly better, never worse, state than before it (additive-only until Phase 4).

### Phase 0 — Ground truth and decision on the orphaned schema (days, not weeks)
*Corresponds to brief §1-§3 (partial), plus a decision the brief doesn't address.*

1. Confirm current row counts / usage for every table the plan's supertype will bind to:
   `kybe_identity`, `root_identity`, `did_persona`, `agent_root_identity`, `agent_persona`,
   `polity_passport_records`, `polity_passport_applications`. (No guessing — CLAUDE.md.)
2. **Operator decision required**: what happens to the orphaned `services/agentiq-wallet` `didqube`
   Postgres schema (found in the prior audit, read by nothing in the main app)? Options: (a) migrate
   its rows into the new canonical `didqubes` supertype and retire the schema, (b) leave it isolated
   and out of scope (it's a separate sub-package), (c) delete it if it holds no live data. This must be
   decided before Phase 1 so the new supertype isn't built next to a second unconverged relic.
3. Write the resolution-record preflight required by CLAUDE.md's Resolution → Invariant Loop before
   any schema DDL: which existing invariants apply (above), which canaries protect them today (none
   yet — this plan is what adds them), what could regress.

**Exit check:** a short written decision on the orphaned schema, and a table-by-table row/usage
inventory. No schema change yet.

### Phase 1 — Additive supertype + subtype bindings (brief §2-§3)
*Pure addition. Nothing existing changes shape or meaning.*

1. Create `didqubes` (supertype: `didqube_id`, `subject_class`, `lifecycle_state`, `created_at`,
   `superseded_by`) exactly as specified.
2. Create `human_didqubes` (`didqube_id` FK, `kybe_identity_id` FK UNIQUE) and `agent_didqubes`
   (`didqube_id` FK, `agent_root_identity_id` FK UNIQUE). Add `robot_didqubes`/`organization_didqubes`
   only when a canonical robot/organization root table actually exists — the brief's table implies
   these exist today; the prior audit did not confirm them. **Verify before assuming**, per CLAUDE.md's
   no-guessing rule — if no canonical robot/org root exists yet, that's a prerequisite to surface to
   the operator, not something to invent here.
3. Backfill: for every `kybe_identity` row with an unambiguous, already-resolved root
   (`resolveRootPrincipalForAuthUser`-shape logic, reused not re-derived), insert a `didqubes` +
   `human_didqubes` pair. Same for every `agent_root_identity` row.
4. **Report ambiguous/unanchored records — do not guess** (brief's own explicit rule, §"Delivery
   sequence" step 4). Any `kybe_identity`/`agent_root_identity` row that can't be bound unambiguously
   goes into a named exceptions list for operator review, never silently skipped or silently forced.

**Exit check:** every existing human and agent identity has (or is explicitly reported as lacking) a
`didqubes` row. Zero behavior change anywhere else in the app — nothing reads these tables yet.

### Phase 2 — The canonical resolver, additive and read-only (brief §5)
*The resolver exists and is testable, but nothing is migrated to depend on it yet.*

1. Implement `resolveDiDQube(input): Promise<DiDQubeResolution>` in
   `services/identity/didQubeResolver.ts` (new file — first real DIDQube-service-pattern file the
   prior audit found missing), supporting the entry identifiers the brief lists, built by **composing**
   the existing walks (`passportPrincipal.ts`'s `resolveRootPrincipalForAuthUser`,
   `resolvePassportPrincipal`, etc.) rather than re-deriving them — this is the direct application of
   `inv.engineering.036`/`037`.
2. Implement the five-state model (`resolved | unresolved | absent | ambiguous | conflicted`) and the
   `DiDQubePrimitive` projection, sourced from the real FK-backed tables the brief names — the
   resolver normalizes; it does not become a second source of truth.
3. Explicitly port the existing fail-closed rules: never resolve by display name/partial match, never
   treat `personas.root_did` as authoritative (this is already-documented dead code per the audit —
   the resolver formalizes not reading it, it doesn't need to "stop" anything new), never manufacture
   an identifier.
4. Unit tests against the acceptance criteria in brief §"Hard acceptance criteria" that are testable
   in isolation now: citizen resolves to exactly one DiDQube; agent resolves to exactly one DiDQube;
   ambiguous lineage returns `ambiguous` never a guess; RootDID reissuance does not create a new human
   DiDQube (supersession, not duplication).

**Exit check:** `resolveDiDQube` is callable, tested, and correct against Phase 1's backfilled data —
but no existing route, CTP, DCIR, DVN, or Factor code calls it yet. Still zero externally-visible
behavior change.

### Phase 3 — Passport corrections (brief §6-§8)
*First phase that changes observable behavior — Passport issuance and VC shape.*

1. **Agent Passport binding fix** (brief §7): resolve `agent_card_url`/`runtime_id` to exactly one
   `agent_root_identity` at application time; persist the agent DiDQube + RootDID binding on the
   application row; populate `root_did_public_ref`; refuse issuance on missing/ambiguous/conflicted
   resolution; make `agent_root_identity.bound_passport_id` a write inside the same issuance
   transaction as `applyReviewDecision`, not a best-effort afterthought (the prior audit found
   `services/homecoming/issueDelegatePassport.ts` already does something close to this for its one
   automated path — generalize that pattern to the manual Bureau path too).
2. **Class-sensitive VC subject** (brief §8): `resolveCredentialSubject()` — citizen → `kybe_did_public_ref`,
   everything else → `root_did_public_ref`. This is a small, surgical change to
   `services/passport/passportCredential.ts`.
3. **VC signing remains explicitly a stub** until Phase 3 ends — do not silently upgrade the trust
   claims of the credential while still using HMAC. Keep the existing "Phase A stub" self-identification
   in the envelope; asymmetric signing is its own phase (below), not bundled in here.
4. Resolve the T0/T1 tension the prior audit flagged (`polity_passport_records.passport_id` exposed via
   `/api/polity-passport/wallet`) as part of this pass, since the wallet route is being touched anyway
   — get the explicit operator ruling the audit recommended (codify as an owner-self-view exception,
   or tighten the response) rather than let it ride further un-adjudicated.

**Exit check:** every Passport issued from this point forward has a correctly class-typed subject and
(for agents) a resolved, non-ambiguous RootDID binding recorded transactionally. Existing issued
Passports are unaffected (no retroactive rewrite in this phase).

### Phase 4 — Consumer migration, one subsystem at a time (brief §9-§11, §"Registry and Horizen")
*Each subsystem migrates independently; none blocks the others. This is where "CTP, DCIR, Factor,
Aegis, Standing and DVN consume the same resolver" actually happens — but sequenced, not simultaneous.*

Recommended order, easiest/lowest-risk first:

1. **Factor** (§9) — new subject/candidate flow (`candidate_didqube_id`, `candidate_subject_class`,
   `candidate_resolution_state`) for both "bring your own agent" and "create my agent." Lowest risk:
   Factor is a narrower, more contained surface than CTP/DVN.
2. **Aegis** (§10) — add `subjectDidQubeId`/`subjectClass`/`subjectResolutionCommitment`/
   `subjectResolutionVersion` fields and the evidence-lock resolution snapshot. Additive fields on an
   assessment record; does not require changing the assessment's own business-subject reference.
3. **CTP** — consume the resolver for "who is the subject / which anchor / which Passport" questions.
   Requires read access to `getActivePersona`/`evaluateAccess` outputs — coordinate with the protected-file
   owners rather than editing those files directly; extend by composition per CLAUDE.md's existing rule
   for that subsystem.
4. **DCIR** — add `subjectDidQubeRef`/actor/principal DiDQube refs and resolution commitment to each
   consequential transition record. Additive columns on the decision record.
5. **Standing/reputation** reconciliation (§"Standing and reputation") — the highest-care item in this
   phase: must preserve existing attribution exactly (supersession preserves history, never rewrites
   past attribution). Build and run a dry-run reconciliation report before writing anything, and get
   explicit operator sign-off on any row where the report shows a discrepancy.
6. **DVN receipt commitment fields** (§"DVN") — per Phase 0's preflight, this is the one item in the
   whole plan that hits the DVN Pipeline Protection PARAMOUNT rule: it is "adding/removing/reordering
   fields in the DVN JSON payload," explicitly listed as requiring operator approval BEFORE coding, not
   the one permitted unilateral change (adding an action type). **Do not implement this sub-item
   without a separate, explicit go-ahead**, even after this overall plan is approved.
7. **Registry/Horizen bindings** as external-presence records inside the agent DiDQube — lowest urgency,
   do last; nothing else in the plan depends on it.

**Exit check per sub-item:** each subsystem independently reads from `resolveDiDQube` for the specific
question it needs, with its own tests proving the relevant acceptance criteria (cross-agent isolation,
no silent Standing transfer on wallet/token change, etc.).

### Phase 5 — Trust hardening and cleanup (brief §12-§13)
*Only after Phase 3's behavior has been live and stable.*

1. Public asymmetric VC verification (stable Bureau issuer DID, versioned verification method,
   canonicalized-data signature, public verification endpoint, revocation/supersession resolution, key
   rotation without invalidating historical credentials) — this is a real cryptographic subsystem, not
   a schema change; treat it as its own sub-plan with its own review, not a checklist line.
2. Remove remaining authoritative reads of `personas.root_did` — by Phase 5 this should already be
   zero live reads per Phase 2's resolver-composition discipline; this step is verification (grep +
   canary), not new removal work.
3. Normalize old schemas / retire legacy fields — **last**, and only after every consumer in Phase 4
   has migrated and been observed correct in production for a real stabilization window. Never remove
   a legacy field a Phase 4 consumer might still fall back to.

---

## 2. What this plan deliberately does NOT do without a separate go-ahead

- Does not touch `services/dvn/activityReceiptDvnPipeline.ts`'s payload shape without the explicit,
  separate operator approval CLAUDE.md's DVN Pipeline Protection section requires — flagged again in
  Phase 4 step 6 above so it isn't missed under momentum.
- Does not edit `services/identity/getActivePersona.ts`, `services/access/evaluateAccess.ts`, or
  `services/access/policyResolvers.ts` directly — CTP integration (Phase 4 step 3) is scoped as
  composition/extension, coordinated with whoever owns sign-off on those files, not a unilateral edit.
- Does not assume canonical robot/organization root tables exist (Phase 1 step 2) — verifies first.
- Does not attempt the public asymmetric VC signing scheme as a byproduct of the class-sensitive-subject
  fix in Phase 3 — kept as its own Phase 5 workstream so a large cryptographic build doesn't block a
  small, high-value correctness fix.
- Does not rewrite or delete any legacy table/column before its Phase 4 consumers have been live and
  observed correct — Phase 5's cleanup is explicitly last and explicitly conditioned on that.

## 3. Testing strategy mapped to the brief's acceptance criteria

Each bullet in the brief's "Hard acceptance criteria" becomes a canary, added at the phase where it
first becomes meaningful (not all at the end):

| Acceptance criterion | Proven at |
|---|---|
| Every Factor/Aegis agent resolves to exactly one agent DiDQube | Phase 2 (resolver unit tests) + Phase 4 (Factor/Aegis integration tests) |
| Every issued Agent Passport resolves to exactly one Agent RootDID; issuance refused without one | Phase 3 |
| Citizen credentials use KybeDID commitments; Agent credentials use Agent RootDID commitments | Phase 3 |
| Agents never receive KybeDIDs | Phase 1 (schema — `agent_didqubes` has no kybe FK at all) + Phase 2 (resolver test) |
| RootDID reissuance does not create a new human DiDQube | Phase 2 (supersession test) |
| No authoritative resolver reads `personas.root_did` | Phase 2 (built this way from the start) + Phase 5 (verification canary) |
| No fuzzy matching anywhere in identity resolution | Phase 2 (resolver design + test) |
| CTP, DCIR, Factor, Aegis, Standing, DVN consume the same resolver | Phase 4 (per sub-item) |
| External identifiers cannot redefine constitutional identity | Phase 4 (Registry/Horizen sub-item) |
| Browser/receipt/chain projections contain no T0 identifiers | Phase 2 (`DiDQubePrimitive.privateRef` T0-only by construction) + Phase 4 (DVN sub-item, under separate approval) |
| Resolution failure is explicit and blocks consequential action | Phase 2 (five-state model) + every Phase 4 consumer's own tests |
| Cross-agent isolation, ambiguity, supersession scenarios | Phase 2 + Phase 4, per subsystem |

## 4. Immediate next step

This plan is ready for review. Before Phase 0 begins, I'd like explicit confirmation on:

1. Whether to proceed with Phase 0 (ground-truth inventory + the orphaned-schema decision) now, or
   hold this as a reviewed-but-not-started plan.
2. Who makes the orphaned-`didqube`-schema call (Phase 0.2) and the DVN-payload go/no-go (Phase 4.6) —
   both are explicitly gated on operator judgment, not something this plan resolves on its own.
3. Whether this should also be registered as a CFS-051 candidate architectural refinement now, per
   Prospective Evolution Capture, or whether the operator considers the ruling already
   authoritative enough to skip that intermediate step.
