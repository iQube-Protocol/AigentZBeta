# DiDQube Canonical Resolver — Execution Plan

**Status:** Phase 0 COMPLETE (read-only inventory — see
`2026-09-07_didqube-phase0-inventory.md`). Phases 1-5 remain PLAN ONLY — no schema, resolver, or
Passport code has been implemented. This document is the response to the operator's architectural
brief (ruling: *"A DiDQube is the canonical constitutional container for an entity's identity
primitives..."*), corrected in place on 2026-09-07 per nine operator rulings issued after review (see
§0.1), and proposes how to execute it safely against the actual codebase audited in
`2026-09-07_didqube-passport-architecture-vs-code-report.md`.

### 0.1 Corrections applied from operator rulings (2026-09-07)

The operator reviewed the original plan and issued nine rulings, all incorporated below in place
rather than as a separate addendum:

1. **Correction, not a ruling on direction:** the `services/agentiq-wallet` `didqube` schema is NOT
   orphaned — it is read on the live Fastify auth path (`src/db/identity.ts`, `src/db/anonymous.ts`,
   `src/db/config.ts`, `src/server.ts`). Phase 0 (§1) inventoried its actual runtime/deployment/data
   usage. Ruling: **converge, do not delete/ignore/treat-as-independent-future-authority**; retirement
   is permitted only after readers/writers migrate and zero usage is proven.
2. A human DiDQube is established by **one `kybe_identity` row alone**, whether or not an active
   RootDID currently resolves — never conditioned on an existing RootDID. Agent DiDQubes remain
   anchored by `agent_root_identity` (agents have no KybeDID). Applied in Phase 1.
3. Phase 3 expanded to **reconcile existing Agent Passports** via dry-run resolution (read-only,
   performed in Phase 0 — see inventory doc §3), never rewriting ambiguous history; where a credential
   subject would change, design **successor credential issuance**, never mutate an issued credential.
4. Agent Passport issuance + RootDID binding must be **one atomic Postgres RPC**, not a sequence of
   Supabase client calls; receipt emission resumes idempotently after the committed DB act. Applied in
   Phase 3.
5. Elimination of authoritative `personas.root_did` reads is **moved ahead of Phase 3/4** (was Phase 5
   cleanup-only). `provisionAgentPersona.ts` in particular must move to principal-first resolution from
   the authenticated `auth_user_id`; persona membership becomes authorization-only. Phase 0's inventory
   (§2 of the inventory doc) found this pattern duplicated in a second file and confirmed 2 of 3 live
   `agent_persona` rows are already unanchored as a result.
6. The resolver must distinguish **internal DiDQube UUID, raw T0 DID, public commitment, and public VC
   subject URI** as four distinct values, and **version the public commitment scheme** — the existing
   16-hex `didPublicRef()` truncated-hash is not to be treated as inherently equivalent to a DID.
   Applied in Phase 2.
7. Resolver inputs carry **trust classes**: `auth_user_id`/other T0 identifiers are server-derived
   only; wallets require proven control; ERC-8004 identifiers are network-qualified and require
   verified binding; public Agent Cards/runtime IDs are discovery inputs only, never constitutional
   authority. Applied in Phase 2.
8. Every Phase 4 consumer must classify its own DiDQube resolution use as **descriptive,
   prepare-gating, approval-gating, or execution-gating** — consequential failure fails closed;
   informational resolution may report unresolved without manufacturing identity. Applied throughout
   Phase 4.
9. Aegis evidence lock must **hash the immutable identity-resolution snapshot**; a later identity
   change requires a **successor assessment**, never a mutation of the historical one. Applied in
   Phase 4 §2 (Aegis).

**Registration:** this plan is registered as a CFS-051 candidate architectural refinement in
`public.research_backlog_items` (slug `didqube-canonical-constitutional-container-refinement`) per the
operator's closing instruction — the ontology ruling is authoritative; implementation status remains
candidate until behaviorally validated.

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
- `services/agentiq-wallet`'s independent `didqube` Postgres schema is real, load-bearing code (not
  orphaned — corrected per ruling #1) that has never converged with the main identity spine. This plan
  must converge it via the canonical resolver (§1, Phase 0/1) rather than create a *third* identity
  schema alongside it — and must not delete or ignore it in the meantime.
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

### Phase 0 — Ground truth and inventory — COMPLETE, see `2026-09-07_didqube-phase0-inventory.md`
*Corresponds to brief §1-§3 (partial). Read-only; no DDL, no data writes to any identity/Passport
table, no resolver code, no DVN changes.*

Delivered (full detail in the inventory doc, summarized here):

1. Row counts for `kybe_identity` (19), `root_identity` (22), `agent_root_identity` (19, 13 sponsored),
   `agent_persona` (3, 2 unanchored), `polity_passport_records` (14 citizen / 13 agent_participant).
2. Corrected the "orphaned schema" characterization (ruling #1) and produced its real
   runtime/deployment/data inventory: real code reads it on the live auth path; the live database
   confirms the schema is deployed but every table is empty and lacks the `service_role` schema grant
   PostgREST needs, so its actual runtime success is unconfirmed rather than either working or dead.
   Operator ruling recorded: converge onto the canonical resolver, retire only after zero-usage is
   proven — never delete or ignore.
3. Namespace/semantic collision matrix between the main spine and `didqube.*` (no shared FKs anywhere;
   "kybe", "root", "persona" each name disjoint, non-corresponding structures in the two schemas).
4. RLS/grant assessment for `didqube.*`: 5 of 7 tables have RLS enabled with one intended-permissive
   `service_full_*` policy each; 2 tables have no RLS at all; the schema itself has zero `USAGE` grant
   for `anon`/`authenticated`/`service_role` — the schema is not reachable via Supabase's public REST
   API surface regardless of RLS content.
5. `personas.root_did` authoritative-read (and write) inventory across the whole tree — found beyond
   the two sites the operator named, including one active write site
   (`services/standing/agentStandingPersona.ts`) that must move in lockstep with the read-site fixes.
6. Existing Agent Passport reconciliation, read-only: 0/13 records carry any RootDID anchor; via
   `agent_card_url` matching, 10/13 resolve unambiguously, 0 ambiguous, 3 unresolvable; of the 10
   resolvable+approved, 6 have a correct `bound_passport_id` back-reference, 3 do not (0 mismatches).
7. Confirmed no canonical `robot`/`organization` root table exists — `robot_didqubes`/
   `organization_didqubes` (Phase 1) are blocked on that prerequisite.
8. Resolution-record preflight against `CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001`,
   `CI-2026-08-15-EXPLICIT-ANCHOR-AUTHORITATIVE-001`, `CI-2026-08-03-ACTOR-SUBJECT-OWNER-001`.
9. CFS-051 registration (`research_backlog_items`, per §0.1 above).

**Exit check — met:** table-by-table row/usage inventory delivered; the agentiq-wallet decision is
recorded as "converge, don't delete" per operator ruling rather than left open. No schema change was
made.

### Phase 1 — Additive supertype + subtype bindings (brief §2-§3)
*Pure addition. Nothing existing changes shape or meaning.*

1. Create `didqubes` (supertype: `didqube_id`, `subject_class`, `lifecycle_state`, `created_at`,
   `superseded_by`) exactly as specified.
2. Create `human_didqubes` (`didqube_id` FK, `kybe_identity_id` FK UNIQUE) and `agent_didqubes`
   (`didqube_id` FK, `agent_root_identity_id` FK UNIQUE). `robot_didqubes`/`organization_didqubes` are
   **blocked**: Phase 0 confirmed no canonical robot/organization root table exists anywhere in the
   schema today. Do not invent one implicitly here — surface to the operator as a prerequisite for
   whenever robot/organization subjects are actually needed; out of scope for this delivery.
3. Backfill `human_didqubes` from **every `kybe_identity` row unconditionally** (ruling #2): a human
   DiDQube is established by the kybe row alone, never conditioned on an existing/active RootDID —
   Phase 0 found every kybe today happens to have ≥1 root, but the backfill logic must not encode that
   as a requirement, since a kybe whose only RootDID is later revoked/superseded pending reissuance
   must still resolve as an established human DiDQube. Backfill `agent_didqubes` from every
   `agent_root_identity` row (agents remain anchored there — no kybe, by design).
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
3. **Four distinct value kinds, never conflated** (ruling #6): the internal `didqube_id` UUID, the raw
   T0 DID/kybe_id string, the public commitment (a truncated hash — e.g. the existing `didPublicRef()`
   16-hex pattern), and the public VC subject URI. **Version the commitment scheme explicitly** (e.g.
   `commitmentVersion: 'v1'` alongside the value) — the existing 16-hex `didPublicRef()` output is one
   possible commitment scheme, not something inherently equivalent to "a DID"; a future scheme change
   must not silently reinterpret old commitments as the new shape.
4. **Trust classes on every resolver input** (ruling #7): `auth_user_id` and other T0 identifiers are
   accepted only when server-derived (never caller-supplied — same posture `passportPrincipal.ts`
   already enforces); a wallet address requires a proven-control signature, matching
   `resolvePassportPrincipal`'s existing "pass the recovered signer" contract; an ERC-8004 identifier
   is network-qualified and requires a verified binding record, never bare trust of an on-chain lookup;
   a public Agent Card URL or runtime ID is a discovery input only — it may locate a candidate
   `agent_root_identity` row (as `provisionAgentPersona.ts` already does via `agent_card_url`), but
   never stands as constitutional authority on its own.
5. Explicitly port the existing fail-closed rules: never resolve by display name/partial match. The
   elimination of authoritative `personas.root_did` reads is tracked as its own priority item ahead of
   this phase (§1 Phase 2.5 below, per ruling #5) rather than folded in here as an afterthought — the
   resolver must simply never read it from day one, and the existing call sites must be fixed on their
   own schedule, not silently left for "later."
6. Unit tests against the acceptance criteria in brief §"Hard acceptance criteria" that are testable
   in isolation now: citizen resolves to exactly one DiDQube; agent resolves to exactly one DiDQube;
   ambiguous lineage returns `ambiguous` never a guess; RootDID reissuance does not create a new human
   DiDQube (supersession, not duplication).

**Exit check:** `resolveDiDQube` is callable, tested, and correct against Phase 1's backfilled data —
but no existing route, CTP, DCIR, DVN, or Factor code calls it yet. Still zero externally-visible
behavior change.

### Phase 2.5 — Eliminate authoritative `personas.root_did` reads (moved ahead per ruling #5)
*Not deferred to Phase 5 cleanup, as the original plan had it — this now runs before Phase 3/4, since
it gates a real, currently-live correctness gap (Phase 0 found 2 of 3 `agent_persona` rows already
unanchored because of it).*

1. `services/agents/provisionAgentPersona.ts` — replace the `personas.root_did → root_identity.did_uri`
   walk with principal-first resolution from the authenticated `auth_user_id`
   (`resolveRootPrincipalForAuthUser`-equivalent); persona membership (does this persona belong to this
   authenticated caller?) becomes an authorization check only, never the identity-resolution mechanism.
   Remove the `allowUnanchored` escape hatch once the principal-first walk succeeds unconditionally
   from an authenticated caller (it existed only to route around the old walk's failure mode).
2. `app/api/homecoming/agent/stand-up/route.ts` — Phase 0 found this route hand-rolls an independent
   copy of the same walk. Fix it to call the shared, now-corrected resolution path rather than leaving
   a second, unfixed copy of the same defect (`inv.engineering.036`/`037`).
3. `services/standing/agentStandingPersona.ts` — this is a **write** site for `personas.root_did`, not
   only a read site; it must stop writing the column in the same change that stops other files from
   reading it, or the column's data quality keeps degrading even as its readers are removed.
4. Backfill the 2 existing unanchored `agent_persona` rows found in Phase 0, or explicitly flag them
   for operator review — do not leave them silently unaddressed once the write path is fixed.
5. Other read sites found in Phase 0 (`bureauIdentityService.ts`, `provisionAigentMePersona.ts`,
   `app/api/identity/persona/[id]/route.ts`, `app/api/admin/identity/sync-persona-evm-addresses/route.ts`,
   `app/api/wallet/identity/references/route.ts`) get fixed on the same pass, each confirmed
   individually as either already-safe (informational/display use) or migrated to the corrected walk.

**Exit check:** zero remaining authoritative reads or writes of `personas.root_did` anywhere in the
tree (grep + a canary added under the existing `CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001`
candidate invariant, as a second recorded occurrence in the same file class). Both existing unanchored
`agent_persona` rows are backfilled or explicitly flagged.

### Phase 3 — Passport corrections + existing-Passport reconciliation (brief §6-§8, expanded per rulings #3/#4)
*First phase that changes observable behavior — Passport issuance and VC shape.*

1. **Atomic issuance RPC** (ruling #4): implement Agent Passport issuance + RootDID binding as **one
   Postgres RPC** (`plpgsql` function, called via `supabase.rpc(...)`), not a sequence of separate
   Supabase client calls — a sequence of client calls is not a transaction, and a partial failure
   between "Passport row created" and "`agent_root_identity.bound_passport_id` written" is exactly the
   gap Phase 0 found live (3 of 10 resolvable, approved applications already have this exact gap).
   Receipt emission resumes idempotently after the committed DB act — the RPC's own return value
   carries enough information (passport_id, root_id, already-existed flag) for the caller to emit the
   receipt safely even after a retry.
2. **Agent Passport binding fix** (brief §7): resolve `agent_card_url`/`runtime_id` to exactly one
   `agent_root_identity` at application time, inside the same RPC as above; persist the agent DiDQube +
   RootDID binding on the application row; populate `root_did_public_ref`; refuse issuance on
   missing/ambiguous/conflicted resolution (fail closed, no exceptions) — this generalizes the pattern
   `services/homecoming/issueDelegatePassport.ts` already approximates for its one automated path to
   the manual Bureau path too.
3. **Existing-Passport reconciliation, read-only report already delivered in Phase 0** (ruling #3): the
   dry-run resolution (`Passport → application → agent_card_url → agent_root_identity`) found 10/13
   resolvable, 3/13 unresolvable, 0 ambiguous; of the 10 resolvable, 3 have a missing
   `bound_passport_id` back-reference. **Do not rewrite this history.** For the 3 with a missing
   back-reference: write the back-reference now that it's resolvable (this is filling in an always-true
   fact the issuance RPC would have written had it existed, not altering what was issued). For the 3
   unresolvable applications: no forced binding — surface them to the operator as a named exceptions
   list. Where a Passport's credential *subject* would need to change as a result of this
   reconciliation (i.e., a case where the class-sensitive subject fix below would produce a different
   subject than what was originally issued), **design successor credential issuance** — a new VC that
   supersedes the old one, carrying a reference back to it — never mutate the historically-issued
   credential object.
4. **Class-sensitive VC subject** (brief §8): `resolveCredentialSubject()` — citizen → `kybe_did_public_ref`,
   everything else → `root_did_public_ref`. This is a small, surgical change to
   `services/passport/passportCredential.ts`, applied to new issuance; existing credentials follow the
   successor-issuance path above rather than being mutated in place.
5. **VC signing remains explicitly a stub** until Phase 3 ends — do not silently upgrade the trust
   claims of the credential while still using HMAC. Keep the existing "Phase A stub" self-identification
   in the envelope; asymmetric signing is its own phase (below), not bundled in here.
6. Resolve the T0/T1 tension the prior audit flagged (`polity_passport_records.passport_id` exposed via
   `/api/polity-passport/wallet`) as part of this pass, since the wallet route is being touched anyway
   — get the explicit operator ruling the audit recommended (codify as an owner-self-view exception,
   or tighten the response) rather than let it ride further un-adjudicated.

**Exit check:** every Passport issued from this point forward goes through the atomic RPC, has a
correctly class-typed subject, and (for agents) a resolved, non-ambiguous RootDID binding recorded in
the same transaction. The 3 existing unbound-but-resolvable applications have their back-reference
filled in; the 3 unresolvable applications are named for the operator, not silently forced. No issued
credential is mutated — any subject change goes through successor issuance.

### Phase 4 — Consumer migration, one subsystem at a time (brief §9-§11, §"Registry and Horizen")
*Each subsystem migrates independently; none blocks the others. This is where "CTP, DCIR, Factor,
Aegis, Standing and DVN consume the same resolver" actually happens — but sequenced, not simultaneous.*

**Classification requirement (ruling #8):** before integrating, each consumer below must state which
of four classes its own use of `resolveDiDQube` falls into — **descriptive** (informational display;
an `unresolved` result may simply be shown as such, never manufactured), **prepare-gating** (blocks
entry into a preparatory flow but not a consequential act), **approval-gating** (blocks a
human/steward approval decision), or **execution-gating** (blocks an actual consequential
action — a Passport issuance, a fund movement, a delegation grant). Consequential classes
(approval-gating, execution-gating) **must fail closed** on anything but a clean `resolved` state;
descriptive/prepare-gating classes may report `unresolved`/`ambiguous` without blocking, as long as
they never silently upgrade that report into an assumed identity.

Recommended order, easiest/lowest-risk first:

1. **Factor** (§9) — new subject/candidate flow (`candidate_didqube_id`, `candidate_subject_class`,
   `candidate_resolution_state`) for both "bring your own agent" and "create my agent." Lowest risk:
   Factor is a narrower, more contained surface than CTP/DVN. Classification: prepare-gating (a
   candidate not yet resolved may continue exploring Factor's own intake, but may not progress into
   Aegis/Passport/wallet provisioning until resolved).
2. **Aegis** (§10) — add `subjectDidQubeId`/`subjectClass`/`subjectResolutionCommitment`/
   `subjectResolutionVersion` fields and the evidence-lock resolution snapshot. Additive fields on an
   assessment record; does not require changing the assessment's own business-subject reference.
   Classification: approval-gating (the assessment's own PASS/FAIL determination is what gates
   downstream approval, but ruling #9 governs the snapshot itself specifically): **at evidence lock,
   hash the immutable identity-resolution snapshot** (constitutional anchor commitment, active
   Passport VC, authority/delegation bindings, wallet-control proof status, registry/Horizen bindings,
   declared capabilities, relevant Standing/DVN evidence, conflicts/unresolved identifiers) and store
   the hash alongside the assessment. **A later identity change never mutates the historical
   assessment** — it requires a new, successor assessment referencing the prior one, exactly
   mirroring the successor-credential pattern in Phase 3. This is what prevents an assessment from
   silently transferring to a different agent because a runtime ID, card URL, or wallet changed after
   the fact.
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
2. Verify zero remaining authoritative reads/writes of `personas.root_did` — this was moved ahead to
   Phase 2.5 per ruling #5 (not left as Phase 5 cleanup); this step is verification only (grep + the
   canary added in Phase 2.5), confirming no regression crept back in during Phases 3-4.
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
| No authoritative resolver reads `personas.root_did` | Phase 2.5 (elimination, moved ahead per ruling #5) + Phase 5 (regression verification) |
| No fuzzy matching anywhere in identity resolution | Phase 2 (resolver design + test) |
| CTP, DCIR, Factor, Aegis, Standing, DVN consume the same resolver | Phase 4 (per sub-item) |
| External identifiers cannot redefine constitutional identity | Phase 4 (Registry/Horizen sub-item) |
| Browser/receipt/chain projections contain no T0 identifiers | Phase 2 (`DiDQubePrimitive.privateRef` T0-only by construction) + Phase 4 (DVN sub-item, under separate approval) |
| Resolution failure is explicit and blocks consequential action | Phase 2 (five-state model) + every Phase 4 consumer's own tests |
| Cross-agent isolation, ambiguity, supersession scenarios | Phase 2 + Phase 4, per subsystem |

## 4. Immediate next step

Phase 0 is complete (§ above, full detail in `2026-09-07_didqube-phase0-inventory.md`) and CFS-051
registration is done. Remaining open decision before Phase 1 begins:

1. **The DVN-payload go/no-go (Phase 4 step 6) remains explicitly unresolved and ungranted.** Per the
   operator's own scope for this round ("inventory and exact payload design only... return later with
   the precise versioned payload diff, compatibility plan and failing-before-fix canary for separate
   approval"), that separate return-and-approve step has not happened yet and is not part of this
   plan's current authorization.
2. Everything else in Phases 1-2.5 is additive/read-only-composing and does not touch a
   CLAUDE.md-protected file directly — awaiting operator confirmation to begin Phase 1 (the `didqubes`
   supertype + subtype bindings) on `dev`.
