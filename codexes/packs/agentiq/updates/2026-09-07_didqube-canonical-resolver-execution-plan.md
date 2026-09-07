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
