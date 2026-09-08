# DiDQube Canonical Resolver — Execution Plan

**Status:** Phase 0 COMPLETE (read-only inventory — see `2026-09-07_didqube-phase0-inventory.md`).
Phase 1 (additive supertype tables) IMPLEMENTED and verified against the live database. Phase 2 (the
canonical read-only resolver) IMPLEMENTED and behaviorally verified. Phases 2.5-5 remain PLAN ONLY — no
Passport code, consumer migration, or `personas.root_did` elimination has been implemented. This
document is the response to the operator's architectural
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

### 0.2 Second review — two Phase 0 corrections, Phase 1 approved (2026-09-07)

The operator marked Phase 0 **conditionally complete** (not fully closed) pending two factual
corrections, both now closed in the inventory doc:

1. The Agent Passport reconciliation had left 1 of 10 resolvable, approved applications
   unclassified (9 categorized, 1 dropped). Corrected: the 10th row is a **duplicate application for
   `aletheon`** (an agent that already has an issued Passport via a sibling application) — its own
   `passport_id` is NULL, and the resolved root's `bound_passport_id` correctly points at the *other*
   application's Passport. This is a distinct defect class from the 3 genuinely-missing back-references
   — a data-hygiene flag, not a missing binding, and not a case needing successor-credential issuance.
   Full row-by-row table in the inventory doc §3.3.
2. The `didqube` RLS finding understated severity. All five policies use `polroles = {0}` (Postgres's
   PUBLIC marker) — they apply to **every role**, not `service_role` specifically, despite the
   `service_full_*` naming. Missing grants are what currently prevent exposure; simply adding a
   `service_role` grant would not add row-level scoping on top of it, and if `anon`/`authenticated`
   ever got schema USAGE too (a plausible "quick fix" attempt), the existing policies would grant them
   full unrestricted access immediately. **The policies must be dropped and replaced with explicitly
   role-scoped ones (`CREATE POLICY ... TO service_role USING (true) WITH CHECK (true)`) before any
   grant is added — never after.** Full detail in the inventory doc §1.2.

Neither correction blocks Phase 1 (additive supertype design), per explicit operator ruling. **Phase 1
is approved for implementation**, subject to the non-negotiable invariants in §"Phase 1" below (all
incorporated from the operator's approval message, superseding the earlier, looser Phase 1 sketch).

**Classification (Prospective Evolution Capture, CLAUDE.md):** this is a **candidate architectural
refinement** — a real, substantial design change, not yet implemented, validated, or ratified. Per
CLAUDE.md's Resolution → Invariant Loop, an agent may propose and classify but must not unilaterally
promote a candidate to canonical status. Recommend registering the ruling above and this plan into the
CFS-051 research backlog under an architecture marker, pending explicit operator sign-off on the
phase-by-phase sequencing below — not a request to begin Phase 1 immediately without that sign-off.

### 0.3 Third review — Phase 1 closed, Phase 2 approved in principle with 8 requirements (2026-09-07)

The operator confirmed Phase 1 "closes... credibly" on the same evidence recorded in the implementation
record below, and separately noted the `didqube.*` (agentiq-wallet) RLS defect (§0.2 correction #2)
remains **unfixed and tracked separately** — it does not invalidate the new canonical tables, which
correctly have RLS with zero policies and explicit client-role revocation.

**Phase 2 is approved in principle**, scoped explicitly as **read-only and non-authoritative**: build
and prove the resolver only — do NOT migrate Factor, Aegis, Passport, CTP, DCIR, Standing,
Registry/Horizen, or DVN consumers yet (unchanged from the original Phase 2 scoping; restated by the
operator as a hard boundary for this round). The operator's canonical resolver vocabulary, **superseding
the five-state sketch in the original Phase 2 section below** (`resolved | unresolved | absent |
ambiguous | conflicted`):

- `resolved`
- `unresolved`
- `ambiguous`
- `conflicted`
- `unsupported_subject_class`

**`absent` is not a top-level state.** It is represented as `{ state: "unresolved", reason:
"anchor_absent" }` — a shape, not a fifth state. Implemented exactly this way in
`services/identity/didQubeResolver.ts` (see the implementation record after this section).

Eight non-negotiable requirements for the resolver (verbatim, operator ruling 2026-09-07):

1. No fallback to `personas.root_did`.
2. Keep constitutional anchor, current identity primitive, Passport credential and public commitment
   distinct.
3. Include provenance and trust classification for every primitive.
4. Treat public commitments as versioned records.
5. Test missing, duplicate, ambiguous, cross-class, conflicted, superseded and malformed bindings.
6. Do not migrate Passport, Factor, Aegis, CTP, DCIR, Standing, Registry/Horizen or DVN consumers yet.
7. Do not alter DVN payloads.
8. Report and stop after Phase 2 is implemented and verified (this round does not extend into Phase 2.5
   — that remains a separate, subsequent round, unchanged from the sequencing in §1 "Phase 2.5" below).

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
6. Existing Agent Passport reconciliation, read-only, all 10 resolvable rows individually classified
   (§0.2 correction #1): 0/13 records carry any RootDID anchor; via `agent_card_url` matching, 10/13
   resolve unambiguously, 0 ambiguous, 3 unresolvable; of the 10 resolvable+approved, 6 have a correct
   `bound_passport_id` back-reference, 3 genuinely lack one, and 1 is a duplicate application for an
   agent whose Passport was already issued via a sibling application (0 mismatches).
7. Confirmed no canonical `robot`/`organization` root table exists — `robot_didqubes`/
   `organization_didqubes` (Phase 1) are blocked on that prerequisite.
8. Resolution-record preflight against `CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001`,
   `CI-2026-08-15-EXPLICIT-ANCHOR-AUTHORITATIVE-001`, `CI-2026-08-03-ACTOR-SUBJECT-OWNER-001`.
9. CFS-051 registration (`research_backlog_items`, per §0.1 above).

**Exit check — met:** table-by-table row/usage inventory delivered; the agentiq-wallet decision is
recorded as "converge, don't delete" per operator ruling rather than left open. No schema change was
made.

### Phase 1 — Additive supertype + subtype bindings — IMPLEMENTED (brief §2-§3)
*Pure addition. Nothing existing changed shape or meaning. Approved by the operator 2026-09-07 subject
to the non-negotiable invariants below; implemented and verified the same day against the live project
`bsjhfvctmduxhohtllly`. See §"Phase 1 — implementation record" after this section for what actually
ran and what was verified.*

**Scope, exactly:**
1. Add only three tables: `didqubes`, `human_didqubes`, `agent_didqubes`. No `robot_didqubes`/
   `organization_didqubes` (blocked — no canonical robot/organization root table exists, per Phase 0).
2. Backfill **every** `kybe_identity` row and **every** `agent_root_identity` row — an active RootDID
   is never required for the human backfill (ruling #2, restated as non-negotiable).
3. Backfill is **idempotent** — re-running it must not create duplicate `didqubes` rows for an already-
   backfilled anchor. Use stable, deterministic IDs or conflict-safe unique-anchor constraints
   (`ON CONFLICT DO NOTHING`/`DO UPDATE` against the anchor FK's own unique constraint), not a
   check-then-insert race.
4. **Constraints enforced in the schema itself, not just application code:**
   - Exactly one anchor per DiDQube and one DiDQube per anchor — `human_didqubes.kybe_identity_id` and
     `agent_didqubes.agent_root_identity_id` both carry `UNIQUE` (already specified) — this is the
     one-to-one enforcement; verify with a real constraint-violation test (§ below), not just by
     inspection of the DDL.
   - `human_didqubes.didqube_id` must reference a `didqubes` row with `subject_class = 'natural_person'`;
     `agent_didqubes.didqube_id` must reference one with `subject_class = 'agent'`. Enforce via a
     `CHECK` against a denormalized `subject_class` column on the subtype table (kept in sync with the
     supertype at insert time, since a pure cross-table FK cannot express "the referenced row's own
     column equals X" as a `CHECK` constraint in Postgres) or an equivalent trigger — whichever is
     simpler to prove correct in a real migration test; state which was chosen and why in the actual
     migration file's own comment.
   - **One DiDQube must never hold both a `human_didqubes` and an `agent_didqubes` row.** Enforce this
     structurally — e.g. a shared unique index across both subtype tables on `didqube_id`, or a single
     subtype table with a `subject_class`-discriminated anchor column instead of two separate tables
     (state and justify whichever shape is chosen; either satisfies the requirement, but it must be
     verified with a real attempted-dual-binding test, not assumed from the DDL reading correctly).
5. **Server-side only, deny browser roles by default.** No `GRANT` to `anon`/`authenticated` on any of
   the three new tables; RLS enabled with no permissive policy (or a `service_role`-only, explicitly
   role-scoped policy — never the PUBLIC-scoped mistake found in `didqube.*`, per the corrected §0.2
   finding above). Verify with a real query attempted as `anon`/`authenticated`, not by reading the
   migration file and assuming it's correct.
6. **Report ambiguous/unanchored records — do not guess** (brief's own explicit rule). Any
   `kybe_identity`/`agent_root_identity` row that can't be bound unambiguously goes into a named
   exceptions list for operator review, never silently skipped or silently forced.
7. **Out of scope for this phase, explicitly** (non-negotiable): no consumer migration, no Passport
   behavior change, no DVN payload touch, no use of `personas.root_did` as authority anywhere in this
   phase's own code (the backfill must resolve anchors via the real FK chains — `kybe_identity`/
   `agent_root_identity` themselves — never via the deprecated column, even incidentally).

**Testing requirements (non-negotiable):**
- Tests must exercise the **actual PostgreSQL constraints** — run the real migration against a real
  (local or ephemeral) Postgres instance and assert that a constraint violation actually throws (dual
  binding attempt, duplicate anchor attempt, wrong-subject_class attempt, anon-role read attempt) —
  not a mocked Supabase client that can't reject anything the mock doesn't know to reject.
- Migration-count assertions must be **computed dynamically against the live pre-migration
  population** at test time (`SELECT count(*) FROM kybe_identity` etc., compared against
  `SELECT count(*) FROM human_didqubes` after backfill) — never a hardcoded expected count (e.g. "19"),
  since the real population changes over time and a hardcoded number silently stops testing anything
  the moment the population changes.

**Exit check:** every existing human and agent identity has (or is explicitly reported as lacking) a
`didqubes` row, verified against the live count at test time. All constraints above verified against a
real Postgres instance, not inferred from the DDL. Zero behavior change anywhere else in the app —
nothing outside this migration/backfill reads these tables yet.

#### Phase 1 — implementation record (2026-09-07)

**Migration:** `supabase/migrations/20260930270000_didqube_canonical_supertype.sql`. Applied to project
`bsjhfvctmduxhohtllly` via the Supabase migration tool. Creates exactly `didqubes`, `human_didqubes`,
`agent_didqubes` — nothing else. Subject-class matching and single-subtype exclusivity are enforced via
two trigger functions (`didqube_enforce_subject_class`, `didqube_enforce_single_subtype`), since
Postgres `CHECK` constraints cannot reference another table's column. One-anchor-per-DiDQube and
one-DiDQube-per-anchor are enforced via `UNIQUE` on `kybe_identity_id`/`agent_root_identity_id` and on
`didqube_id` in each subtype table. RLS is enabled on all three tables with zero policies (the same
pattern `kybe_identity` already uses in this project — verified before choosing it, not assumed), and
`REVOKE ALL ... FROM anon, authenticated` was added as defense-in-depth, since Phase 0 found
`kybe_identity` itself carries full anon/authenticated table grants by Supabase's public-schema
default, with RLS as the only actual protection — this migration does not rely on RLS alone.

**Backfill:** `scripts/didqube-phase1-backfill.mjs` (idempotent — checks existing bindings before
insert, deletes an orphaned `didqubes` row if its subtype insert fails, reports exceptions rather than
retrying with a relaxed check, computes pre/post counts dynamically at run time). Run once against the
live project: **19/19 `kybe_identity` rows → `human_didqubes`, 19/19 `agent_root_identity` rows →
`agent_didqubes`, 38 total `didqubes` rows (19 `natural_person` + 19 `agent`), zero exceptions.**
Re-running the same backfill logic a second time created zero new rows (idempotency verified against
the real database, not assumed from the code).

**Constraint verification (against the real Postgres instance, ruling's own requirement):**
`scripts/didqube-phase1-constraint-verification.mjs` documents the exact SQL run — five assertions,
each inside a transaction that is unconditionally rolled back, no residue left behind:

| # | Assertion | Result |
|---|---|---|
| 1 | A valid human bind (real `kybe_identity` anchor) succeeds | PASSED |
| 2 | A duplicate `kybe_identity_id` bind is rejected (`UNIQUE` violation) | PASSED |
| 3 | Binding a `natural_person` didqube into `agent_didqubes` is rejected | PASSED (rejected by the single-subtype trigger, which fired ahead of the subject-class trigger in practice — both are real, layered checks, not one redundant one, contrary to an initial assumption before running the test) |
| 4 | A valid agent bind (real `agent_root_identity` anchor) succeeds | PASSED |
| 5 | A duplicate `agent_root_identity_id` bind is rejected (`UNIQUE` violation) | PASSED |

**Access-control verification:** `SET LOCAL ROLE anon; SELECT count(*) FROM public.didqubes;` inside a
rolled-back transaction returned `permission denied for table didqubes` — confirmed empirically that
the `REVOKE` blocks `anon` at the grant layer (before RLS is even evaluated), not merely assumed from
the migration's own text.

**Testing-infrastructure gap, disclosed rather than papered over:** this repo has no existing
local-Postgres test harness (no docker-compose, no pg-mem/pglite, no `TEST_DATABASE_URL` convention —
checked, not assumed) and no `pg`/raw-connection dependency at the repo root (only within the isolated
`services/agentiq-wallet` sub-package). Building CI-integrated real-Postgres testing infrastructure from
scratch is a separate, larger undertaking outside this phase's scope. `didqube-phase1-constraint-
verification.mjs` prints the exact, reviewable SQL and how to run it against a real connection (`psql`,
the Supabase SQL editor, or an MCP `execute_sql` call) rather than pretending a mocked `supabase-js`
call could exercise a real trigger/constraint — the honest state is "verified once, by hand, against
the real database, with a re-runnable script capturing the exact statements," not "automated in CI."
Flagged for the operator as a real gap rather than silently built around.

### Phase 2 — The canonical resolver, additive and read-only (brief §5) — IMPLEMENTED
*The resolver exists and is testable, but nothing is migrated to depend on it yet. Approved in
principle by the operator 2026-09-07 (third review, §0.3) with 8 non-negotiable requirements;
implemented and verified the same day. See §"Phase 2 — implementation record" after this section.*

1. Implemented `resolveDiDQube(input): Promise<DiDQubeResolution>` in
   `services/identity/didQubeResolver.ts`, supporting `kybe_identity_id`, `agent_root_identity_id`,
   `auth_user_id`, `proven_wallet`, `agent_card_url`, `erc8004`, and `subject_class_hint` (robot/
   organization — always `unsupported_subject_class`, no DB call). Built by **composing** the existing
   walks (`passportPrincipal.ts`'s `resolveRootPrincipalForAuthUser` for `auth_user_id`,
   `resolvePassportPrincipal` for `proven_wallet`) rather than re-deriving them — direct application of
   `inv.engineering.036`/`037`. `resolveRootPrincipalForAuthUser` is Passport-independent (as its own
   doc comment states it was extracted for); `resolvePassportPrincipal` is not — it bundles a
   usable-Passport requirement into its own success condition, and its private `resolveAuthUserForKybe`
   step is not separately exported. Rather than re-deriving that private walk (which would be exactly
   the "second identity path" `inv.engineering.036`/`037` forbids), the resolver inherits this coupling
   for `proven_wallet` and documents it explicitly in the module header: a proven wallet with a
   resolvable kybe but no currently-usable Passport reports `unresolved`/`passport_gate_unmet` even
   though its DiDQube would resolve fine via the anchor-only paths. Flagged as a disclosed limitation
   with a named follow-up (a future Passport-independent wallet→root export), not silently worked
   around.
2. Implemented the operator's five-state vocabulary (§0.3): `resolved | unresolved | ambiguous |
   conflicted | unsupported_subject_class`, with `absent` represented as `{ state: 'unresolved',
   reason: 'anchor_absent' }` rather than a sixth state. `DiDQubePrimitive` is sourced from the real
   FK-backed Phase 1 tables (`didqubes`/`human_didqubes`/`agent_didqubes`) plus `kybe_identity`,
   `root_identity`, `agent_root_identity`, `polity_passport_records` — the resolver normalizes; it is
   not a second source of truth.
3. **Four distinct fields, never conflated** (ruling #6, requirement #2): every resolved primitive
   carries `constitutionalAnchor` (`kybe_identity` for humans, `agent_root_identity` for agents),
   `currentIdentityPrimitive` (the current `root_identity` for humans — the reissuable layer beneath
   personhood; for agents, Phase 1 has no separate reissuable layer, so this explicitly coincides with
   the anchor, marked `coincidesWithAnchor: true` rather than silently assumed to generalize),
   `passportCredential` (existence + usability only — never gates DiDQube resolution itself), and
   `publicCommitment` as four separate fields, never collapsed into one shape.
4. **Versioned public commitment** (ruling #6, requirement #4): `{ commitmentVersion: 'v1', value:
   <16-hex> }`, reusing the existing `didPublicRef()` (`services/passport/bureauIdentityService.ts`)
   rather than re-deriving a new hash function. `v1` is never treated as inherently equivalent to a DID;
   a future scheme is a new version value.
5. **Trust classes on every resolved primitive** (ruling #7, requirement #3): `server_derived`
   (`auth_user_id` and direct anchor-id inputs — server-internal callers only, documented as never
   accepted from a browser caller), `proven_control` (a wallet address the caller has already proven
   control of), `network_qualified` (ERC-8004 — see below), `discovery` (`agent_card_url` — locates a
   candidate row but is never constitutional authority alone; Phase 4 consumers classify their own
   consequential use per ruling #8, this resolver only tags the trust class).
6. **ERC-8004 handled honestly, not guessed at**: no ERC-8004 binding store exists yet anywhere in this
   codebase (verified against the Phase 0 inventory). The `erc8004` input kind is accepted for
   forward-compatible contract shape but always resolves `unresolved`/`unqualified_reference` — with or
   without a `verifiedBindingRef` — until a real verified-binding store exists to check it against. This
   follows CLAUDE.md's "No Guessing or Hallucinating" rule rather than inventing a schema to query.
7. **No fallback to `personas.root_did`** (requirement #1): the module never references the `personas`
   table anywhere; a dedicated test asserts a `.from('personas')` call would throw and confirms it is
   never reached on the `auth_user_id` path. The elimination of *existing* authoritative reads
   elsewhere in the tree remains Phase 2.5 (unchanged sequencing, ruling #5) — a separate, subsequent
   round per requirement #8, not started in this one.
8. **Fail-closed, defensively, even against Phase 1's own DB-enforced invariants** (requirement #5):
   the resolver does not trust the migration's triggers alone. At read time it re-checks (a)
   subject-class agreement between a subtype table and the `didqubes` row it points to — `conflicted`
   on mismatch (the **cross-class** scenario — a real gap, since `didqube_enforce_subject_class` only
   fires on subtype-table writes, never on a later out-of-band `UPDATE didqubes SET subject_class =
   ...`); (b) that a `didqube_id` is never bound in *both* `human_didqubes` and `agent_didqubes` —
   `conflicted` on violation (the **conflicted**/dual-subtype scenario); (c) `lifecycle_state =
   'superseded'` chains, followed via `superseded_by` to the active DiDQube with cycle detection and a
   bounded hop count — `conflicted` on a cycle or a superseded row with no successor recorded (the
   **superseded** and one **malformed** scenario); (d) a subtype row referencing a nonexistent
   `didqubes` row, or a constitutional anchor with no public DID material to commit to (`kybe_did`/
   `did_uri` null) — both `conflicted` (further **malformed** scenarios); (e) more than one row
   returned for what the schema's own `UNIQUE` constraints guarantee should be at most one — `ambiguous`
   (the **duplicate** scenario, defensive against the DB layer rather than trusting it blindly).

**Exit check — met:** `resolveDiDQube` is callable, tested, and correct against Phase 1's schema — no
existing route, CTP, DCIR, DVN, Passport, Factor, Aegis, or Standing code calls it yet (verified: zero
importers of `services/identity/didQubeResolver` outside its own test file). Zero externally-visible
behavior change; zero DVN payload change.

#### Phase 2 — implementation record (2026-09-07)

**Resolver:** `services/identity/didQubeResolver.ts`. No schema change, no migration — reads only.
Entry point `resolveDiDQube(input: DiDQubeResolverInput): Promise<DiDQubeResolution>`. Never imports or
references `personas`.

**Disclosed issue and correction — ROUND 1 (2026-09-07):** the original implementation of
`resolveActiveDiDQubeChain` traversed `lifecycle_state = 'superseded'` → `superseded_by` unconditionally
— any successor with a matching `subject_class` was trusted and resolved, with no check that it was
bound to the SAME constitutional anchor as the predecessor. The operator caught this on review: *"A
superseded DiDQube may resolve to its successor only when the successor is demonstrably bound to the
same constitutional anchor and subject class. Never carry the original anchor across `superseded_by`
merely because the successor exists."* Concretely, the original code would have resolved a chain like
predecessor (bound to kybe A, superseded) → successor (bound to kybe B, active, also `natural_person`)
as `resolved`, silently carrying kybe A's identity resolution onto a DiDQube that actually belongs to a
different person — exactly the "subject re-identification via correlated commitments" failure class
CLAUDE.md's HMS Identifier Isolation section exists to prevent, here via a code defect rather than a
data leak.

**Round 1's fix ("anchor-verified container replacement") — SUPERSEDED by round 2, kept here only as a
corrected historical record, not the shipped design:** the round 1 fix still walked from a `superseded`
didqube to its recorded successor whenever the successor could be shown, by an added query, to bind the
same constitutional anchor. The operator correctly identified, on the very next review, that this was
still container REPLACEMENT dressed up with a check — not the stable container the model is named for:
*"Complete the stable-container model literally... Remove successful DiDQube supersession traversal
from the resolver... A DiDQube encountered as `superseded` must return `conflicted` or a dedicated
unresolved reason until a separately designed constitutional reconciliation mechanism exists."* A
DiDQube's identity must never move to a *different* `didqube_id` at all — anchor-verified or not — so
"stable container" must not describe anchor-verified container replacement, even as an improvement over
the original defect.

**Round 2 — the shipped design, literal stable-container, no traversal at all:** `resolveActiveDiDQubeChain`
was removed entirely and replaced by `resolveDirectDiDQube`, which inspects EXACTLY the one `didqubes`
row the anchor's own subtype binding names — no successor lookup, no `superseded_by` dereference, no
loop, no cycle or depth concern (a single row can never cycle). An `active` row resolves in place. A
well-formed `superseded` row (one that does record a `superseded_by` successor) is
`unresolved`/`superseded_unreconciled` — a new, dedicated `UnresolvedReason` — never `conflicted`,
because a superseded container is a normal, expected constitutional state, not a data defect. A
`superseded` row that records NO successor at all remains `conflicted` (malformed historical data,
retained as a diagnostic signal per the operator's instruction, but never a path to a resolved
primitive). RootDID/VC/Passport/public-commitment rotation cannot supersede the container because the
resolver never looks past the one `didqubes` row the anchor is bound to in the first place — rotation is
visible only in `currentIdentityPrimitive` (e.g. `root_identity`), which the resolver already tracked
separately from `constitutionalAnchor`/`didqubeId`. No schema or migration change was needed for either
round; both were resolver-code-only. See the module header of `services/identity/didQubeResolver.ts` for
the full, corrected rationale — the round 1 "anchor-verified continuity" framing has been removed from
the header and replaced with the literal no-traversal description.

**The impossible test was removed, and its proof moved to the real database:** the "duplicate/ambiguous
bindings" test suite previously included a MOCKED scenario binding one unique `kybe_identity_id` to two
`human_didqubes` rows — a state the real database's own Phase 1 `UNIQUE` constraint makes impossible,
per operator instruction *"Remove the impossible test... Add a real-PostgreSQL test proving that state
is rejected by the Phase 1 unique constraint."* That mocked test is gone.
`scripts/didqube-phase1-constraint-verification.mjs` gained a 6th real-Postgres assertion
(`6_one_anchor_never_binds_two_didqubes`), run live (in a rolled-back transaction, zero residue) against
project `bsjhfvctmduxhohtllly` on 2026-09-07 against an ALREADY-bound, real, Phase-1-backfilled
`kybe_identity` row (not a freshly-created one) — **PASSED**, alongside a full re-run of all 6 assertions
together (also all **PASSED**). That live re-run also surfaced a genuine staleness in the script's
original setup: assertions 1/4 ("a valid bind succeeds") had assumed an unbound real anchor was
available to test against, which Phase 1's own full backfill had since made untrue for every real row —
the script now creates and rolls back fresh synthetic `kybe_identity`/`agent_root_identity` rows for
assertions 1-5, while assertion 6 deliberately still targets a real, already-bound row (see the script's
own comments).

New/removed tests in `tests/didqube-resolver.test.ts`: the impossible mocked duplicate-anchor test is
removed (comment left in its place explaining why, and pointing at the real-Postgres proof). The entire
supersession test suite was rewritten for the no-traversal design: an active didqube resolves normally;
a well-formed superseded didqube (human and agent) is `unresolved`/`superseded_unreconciled` with an
assertion that the `didqubes` table is queried EXACTLY ONCE (the successor is never looked up at all); a
dedicated test proves RootDID rotation never changes the resolved `didqubeId` for the same kybe across
two calls with two different current `root_identity` rows, while `currentIdentityPrimitive` correctly
reflects the rotation; and the malformed-superseded-with-no-successor case remains `conflicted` as a
diagnostic. The cycle/depth-guard tests from round 1 were removed along with the traversal code they
exercised — there is nothing left to cycle through.

**Tests:** `tests/didqube-resolver.test.ts` — 28 tests, all
passing. Every real dependency is mocked
(`getSupabaseServer`, `resolveRootPrincipalForAuthUser`, `resolvePassportPrincipal` — the latter two via
`vi.mock(..., { importOriginal })` so `isPassportUsable` stays the REAL implementation, not stubbed).
Coverage against the operator's 7 named scenarios:

| Scenario (operator's list) | Test(s) | Outcome asserted |
|---|---|---|
| **missing** | `kybe_identity_id`/`agent_root_identity_id`/`agent_card_url` with zero matching rows | `unresolved` / `anchor_absent` — the literal `{ state: 'unresolved', reason: 'anchor_absent' }` shape the operator specified for "absent" |
| **duplicate** | an `agent_card_url` matching two `agent_root_identity` rows (genuinely possible — no `UNIQUE` constraint on that column). The mocked "two `human_didqubes` rows for one `kybe_identity_id`" test was REMOVED — that state is impossible in the real database (Phase 1's own `UNIQUE` constraint), proven instead at the DB layer (`scripts/didqube-phase1-constraint-verification.mjs` assertion 6, live-run PASSED — see above) | `ambiguous` (resolver test) / real `unique_violation` (DB proof) |
| **ambiguous** | same `agent_card_url` test above | `ambiguous` with `candidateCount` |
| **cross-class** | a `human_didqubes`→`didqubes` row whose `subject_class` is `'agent'` (and the agent-side mirror) | `conflicted` — the `didqube_enforce_subject_class` trigger fires only on subtype-table writes, never on a later out-of-band `didqubes.subject_class` update, so this is a real gap the resolver closes at read time, not a contrived case |
| **conflicted** | a `didqube_id` bound in both `human_didqubes` and `agent_didqubes` | `conflicted` |
| **superseded** | LITERAL stable-container model (round 2): an active didqube resolves normally, no successor lookup ever performed; a well-formed superseded didqube (human and agent) never dereferences `superseded_by` at all; a dedicated RootDID-rotation test proves the resolved `didqubeId` is identical across two calls with two different current `root_identity` rows for the same kybe; a superseded row with no successor recorded is `conflicted` (malformed, diagnostic only) | `resolved` (active) / `unresolved`/`superseded_unreconciled` (well-formed superseded — NOT `conflicted`, NOT a successor lookup) / `conflicted` (malformed) — see the disclosed two-round correction above |
| **malformed** | a subtype row referencing a nonexistent `didqubes` row; a constitutional anchor with null `kybe_did`/`did_uri`; a superseded row with no successor recorded | `conflicted` in every case |

Additional coverage beyond the 7 named scenarios: `subject_class_hint` for `robot`/`organization` →
`unsupported_subject_class` with zero DB calls; `erc8004` (with and without `verifiedBindingRef`) →
`unresolved`/`unqualified_reference` in both cases (no binding store exists — see Phase 2 item 6 above);
resolved happy paths for direct `kybe_identity_id`/`agent_root_identity_id`/`agent_card_url` inputs,
asserting the four fields stay distinct, the commitment is versioned and one-way (asserted the output
never contains the raw `kybe_did`/`did_uri` string), and `trustClass` is tagged correctly per input kind
(`server_derived`/`discovery`); `auth_user_id` and `proven_wallet` composition tests, including the
`passport_gate_unmet`/`anchor_absent` failure-mapping for `proven_wallet` and a dedicated assertion that
a `.from('personas')` call would throw and is never reached on the `auth_user_id` path.

**Regression check:** full suite run (`npx vitest run`) immediately after the round-1 implementation —
19 failed files / 67 failed tests; re-run after round 1's fix — 17 failed files / 65 failed tests,
exactly matching the Phase 1 baseline (the 19/67 reading was transient, not a regression). After round
2 (the literal no-traversal correction), `tests/didqube-resolver.test.ts` passes 28/28 on its own; none
of the pre-existing baseline's failing files reference `didQubeResolver`/`didqube-resolver` in any round,
and the new test file is never among them. `npx tsc --noEmit` on the whole project reports pre-existing
errors unrelated to either new file (confirmed by grep — zero matches for
`didQubeResolver`/`didqube-resolver` in the tsc output).

**What Phase 2 deliberately did not do (per requirements #6/#7/#8):** no Passport/Factor/Aegis/CTP/
DCIR/Standing/Registry-Horizen/DVN code calls the resolver; `services/dvn/activityReceiptDvnPipeline.ts`
was not touched; no `personas.root_did` elimination was attempted (that is Phase 2.5, a separate,
subsequent round).

### Phase 2.5 — Eliminate authoritative `personas.root_did` reads (moved ahead per ruling #5) — IMPLEMENTED
*Not deferred to Phase 5 cleanup, as the original plan had it — this now runs before Phase 3/4, since
it gates a real, currently-live correctness gap (Phase 0 found 2 of 3 `agent_persona` rows already
unanchored because of it). Implemented and verified 2026-09-07 — see "Phase 2.5 — implementation
record" after this section.*

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

#### Phase 2.5 — implementation record (2026-09-07)

**Full inventory and classification, every site Phase 0 named plus one new discovery:**

| Site | Classification | Action taken |
|---|---|---|
| `services/agents/provisionAgentPersona.ts` | authoritative read (broken) | **Fixed** — principal-first via new `sponsorAuthUserId` param + `resolveRootPrincipalForAuthUser` (composed, not re-derived). `allowUnanchored` removed; a human-sponsored call that cannot resolve now fails closed (409). New `isPlatformAuthority` flag (mirrors `sponsorPolityAgent`'s own) covers the one case principal-first cannot: machine-to-machine sponsorship with no human auth session. |
| `app/api/homecoming/agent/stand-up/route.ts` POST | authoritative read (duplicated walk) + `allowUnanchored: true` | **Fixed** — resolves the caller's own `auth_user_id` via `getCallerIdentityContext`, passes it as `sponsorAuthUserId`; `allowUnanchored` removed. |
| `app/api/homecoming/agent/stand-up/route.ts` GET preflight | authoritative read, independently hand-rolled duplicate of the same broken walk | **Fixed** — now calls `resolveRootPrincipalForAuthUser` directly (the same walk POST uses), so the preview can never diverge from what POST actually does. |
| `app/api/identity/persona/agent/route.ts` | authoritative read (via `provisionAgentPersona` call) | **Fixed** — added `getCallerIdentityContext`, passes `sponsorAuthUserId`. |
| `app/api/ops/agents/provision-platform-agent/route.ts` | `allowUnanchored: true`, no human session (CRON_TRIGGER_TOKEN path) | **Fixed** — passes `isPlatformAuthority: true` instead. |
| `app/api/admin/identity/sync-persona-evm-addresses/route.ts` | write (synthetic `did:fio:<handle>` placeholder) | **Fixed** — write removed. It never produced a genuine `root_identity.did_uri` link and, once every authoritative reader above was fixed, was provably inert — pure dead weight perpetuating the column's ambiguity. |
| `services/standing/agentStandingPersona.ts` | flagged in Phase 0 as a write site requiring elimination | **Reclassified as already-safe, no change.** Close reading: `root_did` is used purely as a self-referential match key for an AGENT's OWN already-resolved `agent_root_identity.did_uri` (both read and write), to satisfy the existing `sync_persona_to_crm_persona` trigger's requirements for CRM Standing bridging — never to resolve a HUMAN sponsor's identity. Structurally distinct from the defect class being eliminated. Redesigning this CRM-bridge mechanism is Standing/reputation Phase 4 territory (its own dry-run reconciliation per the plan's own §Phase 4 item 5), not Phase 2.5. |
| `services/agents/provisionAigentMePersona.ts` / `provisionAgentWalletPersona.ts` | read (comparison) | **Already safe, no change.** Same self-referential agent-identity-match pattern as above. |
| `services/passport/bureauIdentityService.ts` — `lookupExistingBinding` inside `bindBureauIdentity` | read | **Already safe, no change.** A self-consistency read of its own prior write for the SAME auth account (idempotency check), not a resolution of an unrelated persona's identity. |
| `services/passport/bureauIdentityService.ts` — exported `resolveRootDidCommitment` | read, consumed by `services/constitutional/constitutionalAgreement.ts` for cross-persona agreement-authorization comparison | **NOT fixed — flagged as a new, more serious finding than Phase 0's original "Medium, needs confirmation" classification.** This is a genuinely consequential (execution-gating) use: equality of two personas' RootDID commitments is what lets a different persona under the same RootDID authorize an agreement a different persona formed. Fixing it needs a persona-id → principal walk that does not cleanly exist yet (unlike every other site above, which resolves the CURRENT caller's own `auth_user_id` — this consumer needs to resolve an ARBITRARY persona's principal). Recorded as an `unresolvedRisk` in the resolution record below; recommended as the immediate next follow-up, reviewed on its own. |
| `app/api/identity/persona/[id]/route.ts` | read (agent-rename propagation) | **Already safe, no change.** Same self-referential pattern; confirmed `root_did` is never serialized to the client (`toIdentitySafePersona`'s allowlist excludes it). |
| `app/api/wallet/identity/references/route.ts` | read (display grouping) | **Already safe, no change.** Informational grouping only (which list to render a persona card in), never an authority/ownership decision. |
| `services/agents/repairDelegationAnchor.ts` | the existing backfill mechanism for the 2 known unanchored rows | **Already correct, no change.** Resolves via `resolvePassportExplicitAnchor(sponsor_passport_id)`, never `personas.root_did`. |
| 2 existing unanchored `agent_persona` rows | data backfill | **Flagged, not backfilled this pass** — `repairDelegationAnchor.ts` already handles this exact case; running it requires live database access this environment doesn't have. Operator should invoke the existing `POST /api/homecoming/agent/repair-anchor` route. |

**Tests:** `tests/provision-agent-persona-principal-first.test.ts` (new, 7 tests) proves: a conflicting/
misleading `personas.root_did` cannot override resolution (the fake admin client throws if `personas`
is ever queried); a populated legacy value cannot rescue a missing canonical lineage (fails closed 409,
never silently unanchored); valid human-sponsor and platform-authority paths both resolve correctly;
missing `sponsorAuthUserId` is rejected before any DB read; idempotency short-circuits before principal
resolution. `tests/agent-homecoming.test.ts` (16 tests, existing file) updated with a
`getCallerIdentityContext` mock and passes unchanged otherwise — proves stand-up/provisioning/preflight
share the same resolver rather than duplicated walks. `tests/sync-persona-evm-addresses-no-root-did-write.test.ts`
(new) proves the admin backfill no longer writes `root_did`. `tests/legacy-passport-linkage-principal-first.test.ts`
(existing, unchanged) continues to pass, confirming the reference pattern this fix generalizes from is
undisturbed.

**Regression check:** full suite (`npx vitest run`) — **17 failed files / 65 failed tests, 644 passed
files / 10,595 passed tests** — matches the Phase 2 implementation record's own documented baseline
(17/65) exactly. Zero new failures; none of the 17 pre-existing failing files touch any file this pass
changed. `npx tsc --noEmit` on the whole project: zero new errors in any touched file (grepped the
full output for each modified filename — no matches).

**Resolution record:** `RES-2026-09-07-DIDQUBE-PHASE-2-5-ROOT-DID-ELIMINATION-001`, registered as a
second occurrence under the existing candidate invariant
`CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001` (per the Phase 0 doc's own instruction to
track this as a second occurrence of the same principle, not a freestanding new finding).

**What Phase 2.5 deliberately did not do (at the time):** did not touch
`services/constitutional/constitutionalAgreement.ts` (the newly-discovered consequential
`resolveRootDidCommitment` consumer — see table above); did not redesign
`services/standing/agentStandingPersona.ts`'s CRM-bridge mechanism (Phase 4 territory); did not backfill
the 2 live unanchored `agent_persona` rows (no live DB access from this environment); did not touch DVN
payloads; did not migrate Factor/Aegis/CTP/DCIR/Standing/Registry-Horizen consumers (Phase 4, unchanged
sequencing). **The `constitutionalAgreement.ts` gap is now closed — see the follow-up implementation
record immediately below. Phase 2.5 is now COMPLETE; the other deferrals above remain Phase 4/5
territory, unchanged.**

#### Phase 2.5 authority closure — implementation record (2026-09-07, follow-up)

Closes the one item Phase 2.5 deliberately deferred: `services/constitutional/constitutionalAgreement.ts`
and `app/api/constitutional/agreement/route.ts` consumed `resolveRootDidCommitment()`/`personas.root_did`
for the `authorityBinding: 'ROOT_DID'` cross-persona agreement-authorization comparison. Model applied,
per operator ruling: **DiDQube is the stable constitutional subject/container; RootDID is a rotatable
identity primitive WITHIN it.**

- `AgreementPayload` gained `principalDiDQubeCommitment` / `principalDiDQubeCommitmentVersion` — the
  versioned, stable DiDQube public commitment, pinned once at formation via
  `resolveDiDQube({ kind: 'auth_user_id', authUserId })` (composed from the Phase 2 canonical resolver,
  never re-derived). THE authority anchor for agreements formed after this closure. The pre-existing
  `principalRootDidCommitment` field is retained but is now informational only for new agreements —
  recorded from the resolved primitive's `currentIdentityPrimitive.didUri`, never from
  `personas.root_did`.
- `formAgreement`/`authorizeAgreement` gained a `callerAuthUserId` parameter (mirroring the
  `sponsorAuthUserId` pattern from the main Phase 2.5 pass), supplied by the route via the EXISTING
  `getCallerIdentityContext(request)` helper (`services/wallet/personaRepo.ts`) — never a client-supplied
  value, and only required when `authorityBinding === 'ROOT_DID'` (PERSONA-bound agreements, the
  overwhelming majority, are completely unaffected and need no auth_user_id at all).
  `authorizeAgreement`'s ROOT_DID branch now fails closed on any `resolveDiDQube` state other than
  `resolved` (unresolved/ambiguous/conflicted/unsupported), then compares DiDQube public commitments via
  the new shared `agreementPrincipalMatches` predicate.
- **Legacy compatibility verifier** (`legacyRootDidCommitmentBelongsToKybe`): for `ROOT_DID` agreements
  formed BEFORE this closure (no `principalDiDQubeCommitment` pinned, only the legacy
  `principalRootDidCommitment`), authorization proves the historical RootDID belonged to the SAME
  canonically-resolved DiDQube by enumerating every `root_identity` row ever issued under that DiDQube's
  own `kybe_identity` anchor (`root_identity.kybe_id`) and hash-comparing each `did_uri` — never by
  reading `personas.root_did`. This also gives legacy agreements RootDID-rotation tolerance they never
  had under the old literal-hash comparison.
- `agreementPrincipalMatches` is exported and shared between `authorizeAgreement` (execution-gating) and
  the `GET /api/constitutional/agreement` listing route's viewer-equivalence check (visibility only) —
  one predicate, so the two can never disagree about who counts as the same principal
  (inv.engineering.036/037).
- Existing signed agreements and their `termsCommitment`/payload content are never mutated by this
  closure — only the (pre-existing, unrelated) `lifecycle.state` and `provenance.receiptIds` change on
  authorize, exactly as before.
- Behavioral tests added/rewritten in `tests/constitutional-agreement-rootdid-authority.test.ts` (16
  tests, all passing), proving: RootDID rotation inside one DiDQube preserves authorized continuity; a
  copied RootDID string across a different DiDQube cannot authorize; conflicting/irrelevant
  `personas.root_did` values have no effect (plus a static-source proof the module never reads
  `personas.root_did` or imports `resolveRootDidCommitment`); unresolved/ambiguous/conflicted/unsupported
  resolution is refused on both form and authorize; and legacy agreement payloads/hashes remain
  byte-for-byte unchanged. Full targeted regression (this file + `financial-services-runtime.test.ts` +
  `moneypenny-runtime-authority-boundary.test.ts` + `companion-act.test.ts` + `onboarding-substrate.test.ts`
  + `homecoming.test.ts` + `agent-bench-read-model.test.ts` + `experiment-workspace.test.ts` +
  `didqube-resolver.test.ts`): 219/219 passing, zero regressions.
- `resolveRootDidCommitment` itself (`services/passport/bureauIdentityService.ts`) is left in place,
  unused — it was not deleted, since deleting an exported function is outside this closure's scope and
  it may still serve future reference; its only production consumer has now been migrated off it.

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

#### Phase 3 items 1-2 — implementation record (2026-09-07)

**Agent Passport atomic binding/issuance RPC + agent_card_url resolution — IMPLEMENTED and verified
against the live 'Aigent Z' Supabase project.**

- New Postgres function `issue_agent_participant_passport_atomic`
  (`supabase/migrations/20260930280000_agent_participant_passport_issuance_atomic.sql`): one plpgsql
  function performing the `polity_passport_records` insert, `passport_status_transitions` insert,
  `polity_passport_applications` update, AND the `agent_root_identity.bound_passport_id` bind
  (NULL-guarded, idempotent) as ONE transaction. Additive, reversible (`DROP FUNCTION`).
- `services/passport/issuanceService.ts`: new `resolveAgentRootIdentityForCard` resolves
  `agent_card_url` to EXACTLY ONE `agent_root_identity` at issuance time (`.limit(2)` + explicit
  0/1/>1 branching) — refuses (fail closed, no exceptions, per brief §7) on missing or ambiguous
  resolution. `applyReviewDecision`'s non-citizen approve branch now resolves + calls the atomic RPC
  instead of the prior 3 separate writes; the citizen branch is byte-for-byte unchanged.
- `services/homecoming/issueDelegatePassport.ts`: removed the now-redundant separate, best-effort
  bind step — binding happens atomically inside `applyReviewDecision` for EVERY caller now, including
  the manual Bureau review path that never bound at all before.
- Real-Postgres verification: a self-rolling-back transaction against `bsjhfvctmduxhohtllly` proved
  the RPC binds atomically on first call and the NULL-guard prevents a second call (different
  passport id) from clobbering the existing bind; zero residue left behind.
- Behavioral tests: `tests/agent-passport-atomic-issuance.test.ts` (4 tests) — successful atomic
  issuance, missing-resolution refusal, ambiguous-resolution refusal, and RPC-error surfacing.
  Targeted regression (this file + `tests/passport-bureau.test.ts` +
  `tests/admin-action-centre-citizen-auto-issuance.test.ts` + `tests/agent-homecoming.test.ts` +
  `tests/journey-admission-spine.test.ts`): 153/156 passing, the 3 failures pre-existing and
  unrelated (confirmed via `git stash` comparison).
- Resolution record:
  `codexes/packs/agentiq/resolution-records/records/RES-2026-09-07-DIDQUBE-PHASE-3-AGENT-PASSPORT-ATOMIC-ISSUANCE-001.json`.
- **Not done in this pass** (separate, subsequent vertical commits per the operator's own sequencing):
  item 3 (existing-Passport reconciliation — backfilling the 3 known-resolvable applications),
  item 4 (class-sensitive VC subject construction), item 5 (VC signing remains a stub), item 6 (the
  T0/T1 wallet-route tension — an unresolved constitutional choice requiring its own operator ruling,
  deliberately not touched).

#### Phase 3 item 4 — implementation record (2026-09-07)

**Class-sensitive VC subject construction — IMPLEMENTED.**

`services/passport/passportCredential.ts`'s `buildPassportCredential` anchored `credentialSubject.id`
on `kybe_did_public_ref` UNCONDITIONALLY, for every passport class. Citizens are kybe-anchored
(personhood, permanent) and this was correct for them — but agent/robot/organization participants
have NO `kybe_identity` at all, so every non-citizen credential's subject was silently `undefined`.

- New `resolveCredentialSubjectId(record)`: citizen → `kybe_did_public_ref`; every other class →
  `root_did_public_ref` (brief §8, exactly as specified). A small, surgical change — one function, one
  call site.
- `PassportRecordRow` gained `root_did_public_ref`; the two callers that select this shape
  (`app/api/polity-passport/credential/[passportId]/route.ts`, `app/api/polity-passport/wallet/route.ts`)
  now select the column too (both the current and legacy-fallback `SELECT_COLS` variants).
- Applied to NEW issuance / newly-built envelopes only — an already-issued credential is never rebuilt
  from updated columns; a subject change goes through successor issuance (Phase 3 item 3), untouched
  here.
- `tests/passport-credential.test.ts` extended (10 tests, was 6): proves citizen anchors on KybeDID and
  agent-participant anchors on RootDID even when BOTH refs are present on the row (no accidental
  cross-class fallback), and that a class with no anchor at all produces `undefined` rather than
  silently reading the wrong field.

#### Phase 3 item 3 — implementation record (2026-09-07)

**Successor-credential reconciliation, WITHOUT MUTATION — the mechanism IMPLEMENTED.**

`services/passport/issuanceService.ts`'s new `issueSuccessorPassport` is the "design successor
credential issuance" deliverable (brief §6): when a Passport's subject anchors need to change as a
result of reconciliation (e.g. the class-sensitive subject fix above would now resolve a different
value than what was originally issued), it issues a NEW `polity_passport_records` row carrying
`renewal_of_passport_id` back to the prior one — **the schema's existing renewal/supersession column**
(`renewed_at`/`renewal_of_passport_id`, present since the original migration but never previously
implemented in TypeScript), reused rather than inventing a parallel "superseded by" concept
(inv.engineering.036/037). The prior row is READ ONLY — no `UPDATE` is ever issued against it; every
field not explicitly reconciled is carried forward unchanged. A `passport_status_transitions` audit
row records the supersession with `evidence_type: 'successor_credential_reconciliation'` and the
caller-supplied reason.

- Refuses to issue a successor to an already-revoked passport, and errors (rather than silently
  orphaning a row) when the prior passport does not exist.
- Verified against the live 'Aigent Z' Supabase project in a self-rolling-back transaction: the exact
  INSERT shape the TypeScript function uses is schema-valid (no FK on `renewal_of_passport_id` —
  confirmed via `pg_constraint`), and the prior row's `root_did_public_ref` is provably unchanged
  after the successor insert.
- `tests/passport-successor-credential.test.ts` (6 tests): successor creation with
  `renewal_of_passport_id` set, zero `UPDATE` calls against `polity_passport_records`, unreconciled
  fields carried forward, the audit-row shape, revoked-prior refusal, and missing-prior refusal.
- **Not done in this pass**: the actual backfill of the 3 known-resolvable-but-unbound live
  applications from Phase 0's original inventory — that dry-run report and its named row IDs were not
  re-derived or re-verified in this pass (a live report this agent has not independently re-confirmed
  should not be acted on from memory); the mechanism built here is what that backfill would use once
  the operator confirms the specific rows. This is intentionally the same discipline the Phase 2.5
  root-did-elimination pass already applied to its own 2 known-unanchored `agent_persona` rows — the
  MECHANISM ships, the live write against specific named rows is a deliberate, separate operator-
  confirmed act.

### Phase 3 closure review (2026-09-07) — bounded, before item 5

Two verification passes over already-shipped Phase 3 work, requested explicitly rather than assumed
complete. Found and fixed four real gaps in item 1's RPC that its own original tests never exercised;
item 2's checks were already correct in code but had one real test gap, now closed.

#### Item 1 — atomic Passport issuance RPC: four real gaps found and fixed

`supabase/migrations/20260930290000_agent_participant_passport_issuance_hardening.sql` supersedes
`issue_agent_participant_passport_atomic` from the item-1 pass:

1. **GRANTS (critical).** The function was created with default privileges intact — `EXECUTE` was
   granted to `PUBLIC`, `anon`, AND `authenticated`. Confirmed live: `full_acl` showed
   `postgres=X/postgres, service_role=X/postgres, anon=X/postgres, authenticated=X/postgres`. Since
   PostgREST exposes every function in the `public` schema the calling role has `EXECUTE` on, **this
   function was callable directly by any client holding an anon or authenticated key, completely
   bypassing every TypeScript-side check** (steward gate, World-ID verification, application-status
   validation) `applyReviewDecision` performs before ever reaching it. Fixed: `REVOKE` from
   `PUBLIC`/`anon`/`authenticated`, `GRANT` to `service_role` only. Verified live: `SET LOCAL ROLE
   anon`/`authenticated` both now get `ERROR 42501: permission denied for function`.
2. **CONCURRENCY.** Nothing prevented two concurrent calls against the same `application_id` from
   both succeeding — each mints its own unique `passport_id`, so both `INSERT`s would succeed,
   producing two active Passports for one application. Fixed: the `application_status` `UPDATE` is
   now the FIRST statement and the concurrency gate (only transitions rows still in an open status);
   a losing call gets zero rows back and `RAISE`s, rolling back its entire attempted issuance.
   Verified live: a second call against an already-claimed application raises
   `... is not an open agent_participant application ...` and exactly one `polity_passport_records`
   row exists for the application afterward.
3. **CONFUSED DEPUTY.** The original signature accepted `passport_class`, `persona_id`, and (most
   seriously) `agent_root_identity_id` as caller-supplied parameters, with nothing forcing them to
   correspond to the application's own recorded data. Fixed: the function now re-derives every
   subject/binding field DIRECTLY from the claimed `polity_passport_applications` row and resolves
   `agent_root_identity` from THAT row's own `agent_card_url` internally (fail closed on 0 or >1
   matches) — the caller supplies only the passport id to mint and policy inputs (issued status,
   evidence/receipt type, actor) that legitimately come from the TypeScript status-machine decision.
   Verified live: an unrelated `agent_root_identity` row planted alongside the correct one is
   provably never touched.
4. **UNDEFINED SUBJECT ON ISSUE.** The original version propagated
   `polity_passport_applications.root_did_public_ref` as-is — but nothing in this codebase writes
   that column for an agent application, so it was always `null`, meaning the item-4 class-sensitive
   VC subject fix would resolve every freshly-issued agent Passport's `credentialSubject.id` to
   `undefined` in practice. Fixed: the RPC now COMPUTES the commitment from the resolved
   `agent_root_identity`'s own `did_uri` (`sha256`, first 16 hex chars via `pgcrypto`'s `digest()`) —
   verified live, byte-identical to `services/passport/bureauIdentityService.ts`'s `didPublicRef` for
   the same input, so every other commitment comparison in this codebase (the Constitutional
   Agreement legacy compatibility verifier included) stays consistent with what this RPC writes.

Also sets a fixed `search_path = public, extensions, pg_temp` (Postgres best practice for a
write-side-effect function; `extensions` is where this project's `pgcrypto` lives), and scopes the
claim to `passport_class = 'agent_participant'` exactly — a citizen, robot, or organization
application is refused by this RPC (verified live for citizen; robot/organization have no canonical
root table yet per the DiDQube resolver's own `UnsupportedSubjectClass`, so they must never silently
borrow this function's `agent_root_identity` resolution).

`services/passport/issuanceService.ts`'s `applyReviewDecision` updated to call the reduced signature;
the now-fully-superseded `resolveAgentRootIdentityForCard`/`AgentRootIdentityResolution` (added in the
item-1 pass, made redundant by the RPC's own internal resolution) removed —
`resolveAgentRefsForCard` (a DIFFERENT, deliberately best-effort function used only for receipt
attribution) is unaffected. `tests/agent-passport-atomic-issuance.test.ts` updated to the new call
shape; `tests/agent-passport-atomic-issuance-hardening.integration.test.ts` added (skipped without
live service-role credentials) to keep the grants/concurrency/scope proofs as a standing regression
check rather than a one-time manual verification.

#### Item 2 — canonical legacy agreement continuity by subject class: already correct, one test gap closed

All five checks were already true in shipped code (`services/identity/didQubeResolver.ts` +
`services/constitutional/constitutionalAgreement.ts`'s `agreementPrincipalMatches`):

- Natural-person history resolves through `human_didqubes`/`kybe_identity` — `buildHumanPrimitive`,
  covered by `tests/didqube-resolver.test.ts`'s "resolved happy paths" suite.
- Agent history resolves through `agent_root_identity`/`agent_didqubes` — `buildAgentPrimitive`, same
  file, plus now doubly proven by item 1's own confused-deputy-safe RPC resolution.
- **No agent RootDID is looked up through a citizen-only table** — `agreementPrincipalMatches`
  structurally refuses (`constitutionalAnchor.kind !== 'kybe_identity' → return false`) BEFORE it
  would ever call `legacyRootDidCommitmentBelongsToKybe` (which queries `root_identity`, a
  citizen-only table). This guard existed in shipped code but had **no test** — added
  `tests/constitutional-agreement-rootdid-authority.test.ts`'s "an AGENT-anchored acting primitive can
  never satisfy a legacy natural-person agreement" test, which plants a commitment that WOULD match
  if `root_identity` were queried against the wrong anchor kind, asserts refusal, AND asserts the
  `root_identity` query count stays at zero — proving the refusal is structural, not a lucky
  non-match.
- Robot and organization classes fail explicitly as `unsupported_subject_class` —
  `resolveDiDQube`'s `subject_class_hint` entry gate, covered both in `didqube-resolver.test.ts` and
  in `constitutional-agreement-rootdid-authority.test.ts`'s own non-`resolved`-state refusal tests.
- Discovery-only references cannot authorize — true, currently VACUOUSLY: grepped every production
  caller of `resolveDiDQube` and found exactly three (`constitutionalAgreement.ts`'s two branches +
  the agreement-listing route), all three using `kind: 'auth_user_id'` exclusively. No consequential
  consumer in this codebase resolves via `kind: 'agent_card_url'` (`trustClass: 'discovery'`) at all
  yet — that is Phase 4 territory (Factor/CTP), not yet started. The resolver's own tag
  (`didqube-resolver.test.ts`'s "tagged trustClass 'discovery' — never authoritative alone" test) is
  the correct and sufficient existing coverage until a discovery-consuming consumer exists to test
  against.

No refactor beyond the one added test — per instruction, code already correct is documented, not
touched.

#### Item 5 — asymmetric VC signing — IMPLEMENTED (2026-09-07)

Retires the Phase A HMAC stub (`PolityBureauHmacStub/v0`) for NEW issuance in favor of a real,
publicly-verifiable Ed25519 signature, mirroring the swappable-provider seam already established for
agreement acceptance (`services/constitutional/agreementProviders.ts`).

- **New files**: `services/passport/passportCredentialSigningProviders.ts` (canonical, sorted-key
  payload serialization; the `local-ed25519` provider using Node's native `crypto.sign`/`crypto.verify`
  — no new dependency; a small known-keys registry so a rotated-out key stays verifiable for what it
  already signed without being usable for new issuance) and
  `services/passport/passportCredentialVerification.ts` (a genuinely SEPARATE module from signing —
  shares no call chain or in-memory state — that dispatches on `proof.type` and handles every proof
  type this issuer has ever produced: the new Ed25519 suite, the legacy HMAC stub, and the legacy
  unsigned stub).
- **Canonical serialization**: `canonicalizeCredentialPayload` recursively sorts object keys (arrays
  keep position, which is meaningful) so the signed bytes never depend on incidental JS property
  insertion order — the fragility of the OLD stub's plain `JSON.stringify(credential)`.
- **Keys are server-side and provider-backed**: signing needs the private key
  (`PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64`, server-only); verification needs ONLY the matching public
  key from the known-keys registry (`PASSPORT_BUREAU_SIGNING_KEYS_JSON`) — a verifier never touches
  private key material, making verification genuinely independent of issuance. A future KMS/HSM-backed
  provider is a drop-in addition behind the same interface, exactly how `x409` sits beside `local` in
  the agreement-acceptance seam — not built here (no real KMS credentials exist to wire).
- **Proof metadata is bound into the signature**: `proof.created`/`proof.proofPurpose` are included in
  the signed payload (`buildSignablePayload`) alongside the credential body — `proof.type` and
  `proof.keyId` are already implicitly protected (a tampered type re-dispatches verification to the
  wrong/no branch; a tampered keyId selects the wrong public key for the original signature). This
  means every field in the proof, not just the credential body, is tamper-evident.
- **Legacy credentials are never re-signed or mutated**: `passportCredentialVerification.ts` verifies
  an old HMAC-stub credential using the EXACT historical algorithm (plain, non-canonicalized
  `JSON.stringify`) — never the new sorted-key canonicalization, which would never match a legacy
  signature. An old unsigned-stub credential is never treated as valid (`unsigned_stub` — it never
  claimed a signature).
- **Fails closed** on: unknown `proof.type` (`unknown_algorithm`), an unrecognised `keyId`
  (`unknown_key`), a malformed public key in the registry (`malformed_key`), a proof missing fields its
  own declared type requires (`malformed_proof`), an unrecognised `issuer.id` shape (`unknown_issuer`),
  and a legacy HMAC-stub credential when `PASSPORT_BUREAU_CREDENTIAL_SECRET` is unavailable
  (`legacy_secret_unavailable` — an inability to check is NEVER treated as valid).
- **Predecessor reference carried into the signed payload**: `PassportRecordRow` gained
  `renewal_of_passport_id` (threaded from the two credential-serving routes' `SELECT`s), surfaced as
  `credentialSubject.supersedesPassportId` when a Passport is a successor
  (`issueSuccessorPassport`, Phase 3 item 3) — part of the signed body, so tampering it is caught
  exactly like tampering any other claim.
- **Tamper matrix tested** (`tests/passport-credential-signing.test.ts`, 23 tests): subject, a claim
  (`passportGrade`), issuance time (`validFrom`), the predecessor reference
  (`supersedesPassportId`), and proof metadata (`proof.created`, `proof.proofPurpose`) each
  independently invalidate an Ed25519-signed credential. Plus: canonical-serialization determinism,
  the no-key-configured and key-not-in-registry fallback-to-unsigned-stub paths, every fail-closed
  reason above, and a T0 canary proving a signed credential never serialises the private key.
  Full targeted regression (this file + `passport-credential.test.ts` +
  `passport-successor-credential.test.ts` + `passport-bureau.test.ts` +
  `admin-action-centre-citizen-auto-issuance.test.ts` + `agent-passport-atomic-issuance.test.ts`):
  104/104 passing.

#### Item 6 — the T0/T1 wallet-vs-DiDQube authority ruling and passport_id's privacy classification — IMPLEMENTED (2026-09-07)

The brief (`2026-09-07_t0-t1-wallet-authority-decision-brief.md`) named `polity_passport_records.passport_id`'s
exposure via `/api/polity-passport/wallet` as the one unreconciled tension the prior architecture
audit flagged. The general §1 question — wallet-proof feeds a lookup, T1/DiDQube is the actual
authority, a wallet must never become the constitutional subject merely because it authenticated a
session — is **ratified as a general rule for all future identity-resolution code**: it already
matches what `resolvePassportPrincipal` and the DiDQube resolver do structurally (brief §2a), and no
code change was needed there. `issuePassportSession`'s session-minting SCOPE (brief §2b) remains a
separate, narrower open question the operator has not yet ruled on; it is not blocking.

The brief's own §2d/§3 recommendation (Option 3 — codify an owner-scoped exception plus a canary)
was **superseded before implementation** by the operator's ruling on `passport_id` specifically,
issued in three successive refinements in this same tranche:

1. First ruling: remove `passport_id` from the browser entirely, replace with a short-lived opaque
   capability reference. Implementation begun (`services/passport/passportWalletRef.ts`), then
   reverted before completion.
2. Correction: `passport_id` is public non-secret metadata, safe to retain verbatim in the browser
   provided every consuming route independently authenticates and checks ownership server-side.
3. Final correction, ratified: neither of the above is the right classification. `passport_id` is
   **holder-visible, privacy-sensitive credential metadata** — analogous to a private account/
   membership number, not a private key (disclosure does not grant control; it need not be rotated on
   exposure) and not a generally public identifier either (the platform must minimize its circulation
   and never let it become a routine public-correlation handle).

**What classification (3) requires, and what was found on audit:**

- Keep it visible and copyable in the authenticated wallet — **already true**: `LockerTab.tsx` and
  `SmartWalletDrawer.tsx` (both edited earlier in this tranche, before the final classification
  landed, to add an explicit reveal-toggle + copy-to-clipboard control for the full id) needed no
  further change.
- Never use it as authentication or proof of ownership — **already true everywhere**: every
  consequential route accepting `passportId` (`credential/[passportId]` POST, `verify-worldid` POST,
  `repair-legacy-linkage`, `attest/[type]`, `sponsored-agents`, `review/decide`,
  `applications/submit`, `homecoming/agent/issue-passport`, `venture/workspace/.../agent-claim`)
  independently calls `getActivePersona` and checks ownership or admin role server-side before
  acting; the two unauthenticated GET routes (`registry`, the credential preview) are intentionally
  public-projection or capability-URL by design. Proved behaviorally, not just by reading:
  `tests/passport-claim-ownership-boundary.test.ts` shows a real, valid `passportId` supplied by an
  authenticated caller who does not own it is refused (403) by both the claim route and the
  World-ID-verify route, and that an unauthenticated caller is refused (401) regardless of what
  `passportId` it supplies.
- Do NOT expose it in public profiles, URLs, analytics, logs, receipts, DVN payloads, or routine
  browser telemetry — **audit found three real, pre-existing violations, now fixed**:
  1. `/api/polity-passport/registry` — a fully unauthenticated public listing of every issued
     Passport — selected and returned every row's raw `passport_id`; `PassportRegistryTab.tsx`
     rendered it directly and used it as its own/not-own correlation key. Fixed: `passport_id`
     dropped from the route's SELECT and response; the client now correlates a public row to the
     caller's own holding via `(personaPublicRef, passportClass)` (personaPublicRef added to the
     wallet route's response for this purpose), and the claim/World-ID-upgrade actions now source the
     real id from the owner-scoped `own` match, never from the public row.
  2. Three DVN-anchorable activity-receipt call sites embedded the raw `passport_id` in the receipt
     `summary` string, which rides verbatim into the on-chain DVN payload
     (`services/dvn/activityReceiptDvnPipeline.ts`'s payload construction includes `summary:
     record.summary` unconditionally for any `ANCHORABLE_ACTION_TYPES` entry):
     `services/passport/issuanceService.ts`'s issuance receipt (`passport_issued`/
     `passport_status_changed` — the platform's highest-volume passport-issuance path),
     `app/api/polity-passport/verify-worldid/route.ts`'s sibling-demotion receipt (embedded TWO raw
     ids), and `services/passport/legacyPassportLinkageRepair.ts`'s reconciliation receipt (written
     under an inline comment asserting "public passport_id" — the now-superseded classification (2)
     above). All three summaries rewritten to carry the same auditable meaning (class, status,
     event) without the correlatable id; `actionInput.passport_record_id` in the linkage-repair
     receipt is retained (off-chain, holder-visible only — the receipt's `personaId` is the
     passport's own owning caller).
- Use a versioned public commitment / pairwise pseudonymous identifier for external continuity —
  **already the existing pattern** (`persona_public_ref` / `kybe_did_public_ref`), now also serving
  as the registry↔wallet correlation key above instead of `passport_id`.
- Zero-knowledge "holds a valid Passport of class X / meets standing threshold Y" presentation
  system — **explicitly backlogged** by the operator, not implemented now. This resolution fixes the
  already-identified concrete leaks; it is not a redesign of the credential-presentation model.

**Recorded as a privacy invariant, not self-promoted to ratified/canonical** per the Resolution →
Invariant Loop's ladder discipline:
`codexes/packs/agentiq/resolution-records/records/RES-2026-09-07-DIDQUBE-PHASE-3-PASSPORT-ID-PRIVACY-CLASSIFICATION-001.json`
and
`codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-07-PASSPORT-ID-PRIVACY-SENSITIVE-NOT-PUBLIC-001.json`.

**Full targeted regression** (`passport-credential.test.ts`, `passport-credential-signing.test.ts`,
`passport-successor-credential.test.ts`, `passport-status-machine.test.ts`, `passport-bureau.test.ts`,
`agent-passport-atomic-issuance.test.ts`, `constitutional-agreement-rootdid-authority.test.ts`, the new
`passport-claim-ownership-boundary.test.ts`, plus `legacy-passport-linkage-repair.test.ts` +
`legacy-passport-linkage-principal-first.test.ts` + `admin-action-centre-citizen-auto-issuance.test.ts`
+ `journey-admission-spine.test.ts` + `research-registry-access.test.ts` +
`agent-delegation-anchor-repair.test.ts`): all passing except the same pre-existing,
unrelated failures already present on this branch before this tranche (confirmed via `git stash`
comparison). **Full-suite phase-closure sweep**: 17 failed files / 65 failed tests — matches the
established baseline exactly; no new failures introduced.

**Phase 3 is closed.** Items 1-6 are all implemented and verified. `2026-09-07_t0-t1-wallet-authority-decision-brief.md`
remains as the pre-ruling analysis record; this section is the ratified outcome.

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
4. **DCIR — boundary-aligned / non-consuming (2026-09-07 finding, see item-4 closure below).**
   ~~Add `subjectDidQubeRef`/actor/principal DiDQube refs and resolution commitment to each
   consequential transition record. Additive columns on the decision record.~~ Superseded: DCIR
   carries no such record at all (see below) — this was never a deferred integration, it is DCIR's
   correct, permanent posture.
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

#### Item 4 — DCIR: boundary-aligned / non-consuming, not a deferred integration (2026-09-07)

This item's original description ("add `subjectDidQubeRef`/actor/principal DiDQube refs and resolution
commitment to each consequential transition record — additive columns on the decision record") assumed
DCIR persists a "decision record" analogous to Aegis's assessments or CTP's transition evidence. It does
not. `services/dcir/` (Dynamic Constitutional Interaction Runtime, CFS-020) is, by its own D0/D2
contract, explicitly **ephemeral and in-session-only** — `services/dcir/stateEngine.ts`'s own header:
"NO persistence, NO cross-session memory... Persisting patterns or mining across sessions builds
behavioural memory of the operator — that is its own ratification... not a rider on this module." There
is no `dcir_*` database table anywhere in this codebase to add columns to.

More load-bearing than the missing table: CFS-020 already carries its own **non-negotiable, ratified**
identifier-tier rule for the event stream (`types/dcir.ts`'s own doc comment): *"The event stream is
identifier-tier-disciplined from birth: T0 identifiers (personaId, authProfileId, rootDid) NEVER appear
in a DcirEvent — events carry T2-safe summaries and T1 display context only."* A `DiDQubePrimitive` is
T0 throughout by the resolver's own doc ("T0 throughout — every field is server-internal; never
serialize further than this object"). Adding a raw DiDQube ref to `DcirEvent` as originally described
would have meant either violating CFS-020's own ratified T0-exclusion rule, or inventing a persistence
layer DCIR was deliberately designed not to have — neither is a "migration," both are architectural
regressions dressed up as one.

**Ruling (operator, 2026-09-07):** DCIR is reclassified **boundary-aligned / non-consuming** — a
permanent, correct posture, not a postponed item. Canonical DiDQube resolution happens at DCIR's
**ingress/authority boundary**: whatever surface calls into DCIR (a route, a tab, a service) has already
resolved identity — via `resolveDiDQube`, `getActivePersona`, or the relevant Phase 4-migrated consumer
— *before* it ever touches the event stream. DCIR's own event constructors never re-resolve or carry
that identity; they take category-level labels only (capsule names, agent/specialist display names,
invariant refs, evidence summaries), exactly as CFS-020 already requires. No code change was made or is
needed for this item.

**Behavioral verification (not just the type contract) that no leak exists today:**
- Every `DcirEvent`-constructing function in `services/dcir/eventStream.ts` (grep-audited, all ~30
  constructors) accepts only category-level string parameters (capsule/stage/tool/specialist/asset
  labels, invariant refs, free-text evidence summaries) — none accept or interpolate a personaId,
  authProfileId, rootDid, `didqubeId`, `passport_id`, or any DiDQube `constitutionalAnchor` field.
- Every real call site (`AigentMeWelcomeSplitTab.tsx`, `DevCommandCenterTab.tsx`, `ComposerStudio.tsx`,
  `AssetDetailPanel.tsx`, `services/devCommandCenter/invariantEvidence.ts`) passes exactly the
  innocuous values those signatures expect (a specialist id, an affordance label, a skill kind, an
  asset name, an invariant ref + evidence string) — none pass a raw identity value.
- `services/dcir/affordances.ts` and `services/dcir/useDcirSeam.ts` contain no identity-field
  references beyond the same doc-comment restating the rule (verified via grep, not assumed from the
  comments alone).
- No other surface in `app/`/`components/` constructs a `DcirEvent` object directly, bypassing
  `emitDcirEvent` — the one canonical construction path is the only one in use.

**Conclusion:** no privacy fix was required. DCIR remains exactly as it is; this closure record is the
deliverable for Phase 4 item 4.

#### Item 7 — Registry/Horizen: external-presence records inside the agent DiDQube — IMPLEMENTED (2026-09-07)

New `services/horizen/agentDiDQubeExternalPresence.ts::resolveAgentExternalPresence` composes the
EXISTING `resolveAgentRegistrationState` (Horizen/ERC-8004) and `getAsset` (iQube Registry) reads —
never re-deriving either — behind one ordering rule that is this item's own testing-matrix line made
executable: **external identifiers cannot redefine constitutional identity.** `resolveDiDQube` is
called FIRST; Horizen/Registry are read only once it reaches `state: 'resolved'` — an unresolved,
conflicted, or ambiguous DiDQube short-circuits before either external read runs, so a Horizen tokenId
or Registry asset id can never stand in for a constitutional anchor that was never itself established.
5 new tests (`tests/agent-didqube-external-presence.test.ts`) prove the short-circuit on every
non-resolved DiDQube state, that both external facts are reported honestly (present or absent, never
fabricated) once the DiDQube resolves, and that a thrown Horizen read degrades to an honest unresolved
state rather than aborting the call. Not yet wired into any live route/UI surface — per this item's own
"lowest urgency... nothing else in the plan depends on it," the seam exists for the next real caller to
use, rather than forcing an unrelated refactor of Factor's own already-correct Horizen/Registry reads.

### Phase 4 — CLOSED (2026-09-07)

Items 1 (Factor), 2 (Aegis), 3 (CTP), 5 (Standing dry-run reconciliation), and 7 (Registry/Horizen) are
implemented and verified — full-suite regression after each held exactly at the established 17-failed-
file/65-failed-test baseline, with zero new failures. Item 4 (DCIR) closed as boundary-aligned/non-
consuming — a permanent correct posture, not a deferred integration (see above). Item 6 (DVN receipt
commitment fields) remains explicitly OUT OF SCOPE, unchanged, pending its own required standalone
operator approval per the DVN Pipeline Protection PARAMOUNT rule — nothing in this phase touched
`services/dvn/activityReceiptDvnPipeline.ts`'s payload shape.

`CI-2026-09-07-DIDQUBE-CONSUMER-RESOLVER-NOT-RAW-ANCHOR-001` reached `validated` (the agent ceiling)
after its second occurrence and now carries 5 recorded occurrences across genuinely different consumer
shapes — a readiness projection, an assessment table, a generic invocation runtime, a read-only
diagnostic tool, and an external-presence composition — confirming the resolver-consumption pattern
generalizes rather than being an artifact of the first migration.

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

Phase 0 is complete (conditionally-complete corrections closed per §0.2), Phase 1 is implemented and
verified against the live database (§"Phase 1 — implementation record"), Phase 2 (the canonical
read-only resolver) is implemented and behaviorally verified (§"Phase 2 — implementation record"), and
**Phase 2.5 (eliminating authoritative `personas.root_did` reads, INCLUDING the
`constitutionalAgreement.ts` authority closure) is implemented and verified — COMPLETE**
(§"Phase 2.5 — implementation record" + §"Phase 2.5 authority closure — implementation record"). CFS-051
registration is done.

1. **The DVN-payload go/no-go (Phase 4 step 6) remains explicitly unresolved and ungranted.** Per the
   operator's own scope for this round ("inventory and exact payload design only... return later with
   the precise versioned payload diff, compatibility plan and failing-before-fix canary for separate
   approval"), that separate return-and-approve step has not happened yet and is not part of this
   plan's current authorization.
2. Phase 2.5's one previously-deferred consequential finding (`resolveRootDidCommitment` consumed by
   `constitutionalAgreement.ts` for cross-persona agreement authorization) is now resolved — see
   "Phase 2.5 authority closure" above. Phase 3 (Passport corrections) proceeds next, per the operator's
   own explicit continuation instruction (2026-09-07); all DVN-payload work remains un-started, awaiting
   its own separate go-ahead per item 1 above.
3. The disclosed gaps from earlier rounds remain open, flagged, not silently resolved: (a) the
   `didqube.*` (agentiq-wallet) RLS policies still need replacing with explicitly role-scoped ones
   before any grant is added (§0.2 correction #2 — a fix to the OTHER schema, not the new one); (b) no
   CI-integrated real-Postgres test harness exists yet (Phase 1 implementation record). (The earlier
   19/67 full-suite reading was transient, not a real drift — the corrected re-run matches the Phase 1
   baseline exactly at 17/65; see the Phase 2 implementation record.)
4. A real defect in the initial Phase 2 supersession traversal (resolving through `superseded_by`
   without verifying the successor's constitutional anchor) was caught on operator review and corrected
   the same day — see the "Disclosed issue and correction" subsection of the Phase 2 implementation
   record above. `resolveActiveDiDQubeChain` now implements the stable-container model: a successor is
   honored only when independently verified to bind the identical anchor, never on subject_class match
   alone.
