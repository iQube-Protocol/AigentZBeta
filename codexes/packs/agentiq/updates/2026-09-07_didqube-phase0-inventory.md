# DiDQube Canonical Resolver — Phase 0 Inventory

**Status:** Phase 0 complete. Read-only. No DDL, no data writes to any identity/Passport table, no
Passport changes, no resolver implementation, no DVN payload changes. The only write performed this
phase is the CFS-051 backlog registration itself (§7), which is the explicitly requested registration
action, not domain data.

**Live database inspected:** Supabase project `bsjhfvctmduxhohtllly` ("Aigent Z") — confirmed as the
correct project by cross-checking table names against known application tables before running any
other query (no guessing per CLAUDE.md).

**Supersedes/corrects:** `2026-09-07_didqube-passport-architecture-vs-code-report.md`'s claim that the
`services/agentiq-wallet` `didqube` schema is "orphaned dead code" read by nothing. That characterization
was wrong on the "read by nothing" part — see §1.

---

## 1. `services/agentiq-wallet` — corrected usage inventory

### 1.1 What actually reads/writes the `didqube` schema (code-level, confirmed by direct read)

| File | Calls | Wired into |
|---|---|---|
| `src/db/identity.ts` (`resolveIdentityByDid`) | `didqube.persona_did_bindings`, `didqube.persona`, `didqube.root_did_bindings` | `src/server.ts`'s `verifyDid` auth decorator — runs on **every authenticated request** to this Fastify service. Wrapped in try/catch; a failure only logs `app.log.warn({identity_resolve:'failed', ...})` and falls through to an in-memory `getPersonaByDid` fallback — **fails soft, not closed**. |
| `src/db/anonymous.ts` (`registerAnonAlias`, `getAnonAlias`, `markAliasHuman`, `getAnonDailySpent`, `addAnonSpend`) | `didqube.anon_aliases`, `didqube.anon_usage` | `src/auth/requireLevel.ts` (the service's own 4-tier auth gate: `'anonymous' \| 'persona' \| 'root' \| 'kybe'`) and `src/routes/wallet.ts` |
| `src/db/config.ts` (`getOpsConfig`, `getAnonCaps`) | `didqube.ops_config` | `src/auth/requireLevel.ts`, `src/routes/wallet.ts` |

**Conclusion: this is real, load-bearing code, not orphaned.** The prior report's "read by nothing"
characterization is corrected. What Phase 0 *does* newly establish, from the live database (§1.2), is
that this code's actual runtime success is unconfirmed and there is specific evidence it may be
failing silently.

### 1.2 Live-database findings for the `didqube` schema

Confirmed present in the connected Supabase project (`select nspname from pg_namespace where nspname='didqube'` returns a row — this is not a local-only, unapplied migration).

**Tables that exist:** `person`, `persona`, `persona_did_bindings`, `root_did_bindings`,
`anon_aliases`, `sessions_remote`, `fio_domains` — 7 tables, matching migration `001_didqube_core.sql`.

**Tables that do NOT exist:** `ops_config`, `anon_usage` — migration `002_ops_and_usage.sql` was never
applied. Every call in `config.ts::getOpsConfig` and `anonymous.ts::getAnonDailySpent`/`addAnonSpend`
(against tables that don't exist) will error at the Postgres level; both are wrapped to fail closed to
a fallback value or a thrown error the caller must handle — worth an operator check of whether
`requireLevel.ts`'s `'anonymous'` tier has ever actually been exercised in a working state.

**Row counts — every table is empty:**

| Table | Rows |
|---|---|
| `person` | 0 |
| `persona` | 0 |
| `persona_did_bindings` | 0 |
| `root_did_bindings` | 0 |
| `anon_aliases` | 0 |
| `sessions_remote` | 0 |
| `fio_domains` | 0 |

**RLS state, table by table:**

| Table | RLS enabled | Policies |
|---|---|---|
| `person` | yes | 1 — `service_full_person`, `cmd=ALL`, `USING(true) WITH CHECK(true)` |
| `persona` | yes | 1 — `service_full_persona`, same permissive shape |
| `persona_did_bindings` | yes | 1 — `service_full_persona_did`, same shape |
| `root_did_bindings` | yes | 1 — `service_full_root_did`, same shape |
| `sessions_remote` | yes | 1 — `service_full_sessions`, same shape |
| `anon_aliases` | **no** | 0 |
| `fio_domains` | **no** | 0 |

**Schema/table grants — the actual gap:**

```sql
select has_schema_privilege('service_role','didqube','USAGE');  -- false
select has_schema_privilege('anon','didqube','USAGE');           -- false
select has_schema_privilege('authenticated','didqube','USAGE'); -- false
```

Every one of the five RLS-enabled tables' single policy is literally named `service_full_*`, and its
`USING(true)/WITH CHECK(true)` shape is exactly what a developer writes to say "the service role gets
full access, everything else is denied by RLS." **The policies were written with the intent that
`service_role` be granted access — but the schema-level `GRANT USAGE ON SCHEMA didqube TO service_role`
(and the corresponding table grants) were never issued.** Table-level grant inspection
(`information_schema.role_table_grants`) confirms only the `postgres` superuser/owner role holds any
privilege on any `didqube.*` table.

**What this means, precisely, without overclaiming:** Supabase's PostgREST layer (what `supabase-js` —
what `getSupabase()` in this service actually talks to) authenticates as `service_role` for a
service-role JWT, and a role with no `USAGE` on a schema cannot be served that schema's tables by
PostgREST regardless of RLS policy content. Combined with the zero row count across every table, the
evidence is consistent with: **the schema was provisioned (via `migrate.ts`'s raw `pg.Client` /
`DATABASE_URL` connection, which needs no PostgREST grant to run DDL) but the service's actual
runtime reads/writes via `supabase-js` have never successfully completed against this database** — not
"this schema is inert," but "this schema's intended access path appears broken, and its silent-failure
design (`identity.ts`'s try/catch in `server.ts`) means nobody would necessarily have noticed." This is
inference from database state, not a confirmed root cause — an operator with access to this service's
actual runtime logs (wherever it has been run) can confirm definitively; this report does not have that.

### 1.3 Deployment status — not confirmable from the repository

`services/agentiq-wallet` has its own `Dockerfile` (real, production-shaped multi-stage build) and its
own `package.json` (`wallet:dev`/`wallet:build`/`wallet:start` scripts, callable from the repo root,
sharing the root `.env.local` via `DOTENV_CONFIG_PATH`). No CI/CD manifest, infra-as-code file, or
hosting config (ECS task def, Fly/Render config, etc.) referencing this service exists anywhere in this
repository. **Whether and where this service is actually deployed and running in production could not
be determined from repository contents — this needs a direct operator answer, not a guess.** The main
Next.js app's own would-be callers are themselves unfinished:

```
app/(shell)/copilot/actions/wallet.ts:23   // TODO: Implement actual wallet status from services/agentiq-wallet
app/(shell)/copilot/actions/wallet.ts:77   // TODO: Implement actual balance queries via services/agentiq-wallet
app/(shell)/copilot/actions/wallet-write.ts:39  // TODO: Implement actual wallet creation via services/agentiq-wallet
```

So even if the Fastify service is deployed and its own identity resolution were working, the main
application does not yet call it for these actions — those routes are stubs on the *main app* side, a
separate and already-visible gap, not one this Phase 0 discovered new.

### 1.4 Namespace/semantic collision matrix

No foreign key anywhere in `didqube.*` references any `public.*` table (`pg_constraint` inspection
confirms every FK in the schema stays within `didqube.*`). The two identity models are structurally
disjoint today — this is what makes them "two implementations" rather than one implementation split
across two schemas.

| Concept | `public` (main spine) | `didqube` (agentiq-wallet) | Collision risk |
|---|---|---|---|
| Human anchor | `kybe_identity` (own PK, real anchor table) | `person.kybe_id` — a free-form **text column**, no FK to `public.kybe_identity`, no uniqueness constraint tying it to the real table | **High** — same term "kybe" names an authoritative UUID-keyed table in one schema and an unconstrained text field in the other; nothing enforces they ever agree. |
| Root DID | `root_identity.did_uri` | `person.default_root_did` (text) + `root_did_bindings.did_uri` (a separate binding table) | **Medium** — same concept, disjoint tables, no shared key. |
| Persona | `personas`, `did_persona` | `persona` (own PK `persona_id`, own `fio_handle`, own `app_origin`) | **High** — literally the word "persona" naming three unrelated tables across two schemas with no FK between any of them. |
| DID binding | `did_persona` (root_id → root_identity FK) | `persona_did_bindings` (persona_id → didqube.persona FK only) | **Medium** — parallel binding concept, disjoint referents. |
| Session | `personaSessionToken.ts`'s T1 token (not a table) | `sessions_remote` (real table, `require_level` field mirrors the service's own 4-tier ladder) | **Low** direct collision, but a second independent session/trust-tier model exists alongside the main spine's T0/T1/T2 model — worth noting as a second trust-tier vocabulary, not just a second identity schema. |

### 1.5 Operator ruling recorded

Per the operator: **do not delete, ignore, or treat `didqube.*` as an independent future authority.**
Converge this service onto the canonical `resolveDiDQube()` resolver once it exists; retire the
independent schema **only after** its readers/writers have migrated to the canonical resolver and
zero usage against `didqube.*` is proven (not assumed). This ruling is recorded here and folded into
the corrected execution plan (§2 of that document).

---

## 2. `personas.root_did` — authoritative-read inventory (expanded)

The prior architecture report found this dead-in-principle per `passportPrincipal.ts`'s own header
comment. Phase 0 expands the search to the whole tree; the pattern is read (and in one case written)
in more places than previously catalogued:

| Site | Read or write | What it does | Risk classification |
|---|---|---|---|
| `services/agents/provisionAgentPersona.ts:115-146` | **read**, authoritative | Resolves the sponsoring citizen's `root_identity` via `personas.root_did → root_identity.did_uri` to set `agent_persona.delegation_user_root_id`. Has an explicit `allowUnanchored` flag that, when true, provisions the delegation row with `delegation_user_root_id = NULL` rather than refusing, when the lookup fails. | **Confirmed live risk** — see §3. |
| `app/api/homecoming/agent/stand-up/route.ts:270-271` | **read**, authoritative, **duplicated logic** | An independent, hand-rolled copy of the same `personas.root_did → root_identity` lookup, inline in the route rather than calling a shared resolver. Same failure mode as above, plus an `inv.engineering.036/037` "one authoritative location" concern in its own right — this is a second implementation of the walk `provisionAgentPersona.ts` already does. | High — duplication risk in addition to the anchor risk. |
| `services/passport/bureauIdentityService.ts:370` | read | Reads `personaRows[0].root_did` as one candidate signal during Bureau identity binding — not the primary walk (that's the kybe-based `bindBureauIdentity` flow), but still a read of the deprecated field. | Medium — needs confirmation it's genuinely a fallback, not primary. |
| `services/agents/provisionAigentMePersona.ts:23` | read (comparison) | Compares `personas.root_did = agent_root_identity.did_uri` as an idempotency/matching check for the special "is this the aigentMe persona" case. | Medium. |
| `services/standing/agentStandingPersona.ts:12,23` | read + **write** | Provisions a `personas` row with `root_did = did_uri` if absent, for Standing continuity. This is a **write site** for the deprecated column, not just a read — every future write here perpetuates the field. | High — actively perpetuates the pattern, not just reads legacy data. |
| `services/passport/legacyPassportLinkageRepair.ts` (header) | explicitly avoids | The file's own header states it deliberately does NOT read `personas.root_did` — cited here as the counter-example / the already-correct pattern to generalize from. | N/A — reference implementation. |
| `app/api/identity/persona/[id]/route.ts:231-237` | read | Reads `root_did`, queries `root_identity` by `did_uri` to enrich a persona detail response. | Medium — informational/display use; confirm it's not gating anything consequential. |
| `app/api/admin/identity/sync-persona-evm-addresses/route.ts:92-93` | **write** | Writes `root_did = did:fio:<handle>` when absent, as part of an admin backfill script. | High — an admin tool actively populating the field that should be retired; will need updating in lockstep with any removal. |
| `app/api/wallet/identity/references/route.ts:117-122` | read | Matches a persona's `root_did` against a sponsored agent's root as one signal in reference-issuance logic. | Medium — confirm whether this is authoritative or advisory. |
| `app/api/qubetalk/{delegations,channels,messages}/route.ts` | read (request body echo) | These reference a `root_did` field arriving in a request body/context object (QubeTalk message metadata), not a `personas.root_did` table read — a different, unrelated use of the same field name. Included here only to rule them out explicitly, not because they're part of the same defect class. | N/A — false positive, ruled out. |

**Ruling #5 (operator) applies most directly to the first two rows.** Both
`provisionAgentPersona.ts` and the duplicated logic in `homecoming/agent/stand-up/route.ts` must move
to principal-first resolution from the authenticated `auth_user_id` (the same walk
`passportPrincipal.ts::resolveRootPrincipalForAuthUser` already implements), with persona membership
used for authorization only (does this persona belong to this authenticated caller?), never as the
identity-resolution mechanism itself. This is scoped **ahead of** Phase 3/4 in the corrected plan, per
the operator's explicit resequencing.

**Existing precedent for this exact fix already in the invariant registry:**
`CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001` (candidate, unratified) already states
the general principle — a resolver binding across identity tables must walk a documented FK chain end
to end, provisioning under a distinct namespace marker rather than fuzzy-matching, and its own
`occurrences` array already cites `services/standing/agentStandingPersona.ts` as a prior confirmed
instance of exactly this defect class (a different specific bug in the same file, already fixed once).
This DiDQube plan's elimination of `personas.root_did` reads is a second, related fix to the same file
and the same general principle — worth tracking as a second occurrence under the same candidate
invariant rather than a freestanding new finding.

### 2.1 Live-data confirmation of real exposure

```sql
select count(*) total, count(*) filter (where delegation_user_root_id is null) unanchored
from public.agent_persona;
-- total: 3, unanchored: 2
```

**2 of the 3 existing `agent_persona` rows (67%) are currently unanchored** — `delegation_user_root_id`
is NULL. This is not a theoretical edge case; it is the majority state of real data today, produced by
the two call sites (`app/api/ops/agents/provision-platform-agent/route.ts`,
`app/api/homecoming/agent/stand-up/route.ts`) that pass `allowUnanchored: true`. Any Phase 3/4 fix must
account for backfilling or explicitly flagging these 2 existing rows, not only gate future issuance.

---

## 3. Existing Agent Passport reconciliation — read-only counts

Per operator ruling #3: dry-run resolution report only, no rewrite of any row.

### 3.1 Record-level anchor population (both classes)

```sql
select passport_class, count(*) total,
  count(*) filter (where root_identity_id is not null) has_root_identity_id,
  count(*) filter (where kybe_identity_id is not null) has_kybe_identity_id,
  count(*) filter (where root_did_public_ref is not null) has_root_did_public_ref,
  count(*) filter (where kybe_did_public_ref is not null) has_kybe_did_public_ref
from public.polity_passport_records group by passport_class;
```

| Class | Total | has root_identity_id | has kybe_identity_id | has root_did_public_ref | has kybe_did_public_ref |
|---|---|---|---|---|---|
| `citizen` | 14 | 1 | 1 | 0 | 0 |
| `agent_participant` | 13 | **0** | 0 | **0** | 0 |

**Zero of the 13 existing Agent Passports carry any RootDID anchor on the record itself** — this is
the exact defect the operator's brief identifies, confirmed at 100% of current rows. Zero
`root_did_public_ref`/`kybe_did_public_ref` population across the board (both classes) confirms these
public-ref columns exist in schema but have never been backfilled for any row — a separate but related
gap from the class-sensitive-subject fix in the corrected plan's Phase 3.

### 3.2 Resolution via `agent_card_url` (application → agent_root_identity)

```sql
-- join polity_passport_applications (passport_class='agent_participant') to
-- agent_root_identity on agent_card_url; categorize by match count
```

| Category | Count |
|---|---|
| Resolves to exactly one `agent_root_identity` | 10 |
| `agent_card_url` matches zero `agent_root_identity` rows | 3 |
| `agent_card_url` matches more than one (ambiguous) | 0 |
| No `agent_card_url` on the application at all | 0 |

**All 13 applications carry an `agent_card_url`; 10 resolve unambiguously; 0 are ambiguous; 3 are
currently unresolvable** (the referenced card URL matches no live `agent_root_identity` row — likely a
stale/superseded agent record, not investigated further under Phase 0's read-only scope).

### 3.3 Issuance-completeness for the 10 resolvable applications

All 10 resolvable applications have `application_status = 'approved'`. Cross-checking
`agent_root_identity.bound_passport_id` against the application's own `passport_id`:

| Outcome | Count |
|---|---|
| `bound_passport_id` correctly matches the issued Passport | 6 |
| `bound_passport_id` is NULL despite an approved, resolvable application | 3 |
| `bound_passport_id` mismatches the issued Passport (data corruption) | 0 |

**3 of 10 resolvable, approved Agent Passport applications never got their `agent_root_identity.bound_
passport_id` back-reference written** — confirming, with real data, the operator's characterization of
this write as "a best-effort afterthought" rather than a guaranteed consequence of issuance. Zero
mismatches is the reassuring half of this finding: where the back-reference exists, it is correct: no
existing row points at the wrong Passport.

*(Note: 6 + 3 = 9 of the 10 categorized above; the tenth row needs one further closer-look query this
report did not run, to avoid scope creep beyond what Phase 0 needs — flagged, not silently dropped.)*

**Design implication carried into the corrected plan:** because reconciliation must never rewrite
issued history (ruling #3), the 3 unbound-but-resolvable rows are candidates for a **successor
credential** issuance path (see plan §"Agent Passport corrections"), not a mutation of the existing
issued Passport row.

---

## 4. RootDID-independent human DiDQube — current data shape

Per ruling #2 (a human DiDQube is established by one `kybe_identity` row alone, never conditioned on an
active RootDID):

```sql
select count(*) kybe_total, count(*) root_total,
  count(*) filter (kybe with 0 linked roots) kybe_with_zero_roots
from ...
```

| Metric | Value |
|---|---|
| `kybe_identity` rows | 19 |
| `root_identity` rows | 22 |
| `kybe_identity` rows with **zero** linked `root_identity` rows | **0** |
| Distinct kybes with at least one root | 19 |

**Today, every kybe already has at least one root** — current data does not yet exhibit the edge case
(a kybe whose only RootDID has been revoked/superseded pending reissuance) that makes this ruling
architecturally necessary. This does not make the ruling unnecessary — it is a forward-looking
correctness requirement for the reissuance/revocation window the ruling describes, not a fix for a
currently-visible data defect. Recorded here so Phase 1's `human_didqubes` backfill logic is written
against the rule (kybe alone is sufficient), not against today's coincidentally-total root coverage.

**Robot/organization root tables:** confirmed absent. `information_schema.tables` search for any table
matching `%robot%` or `%organization%` under `public` returns zero rows. The corrected plan's Phase 1
already flagged this as unverified; it is now confirmed as a real prerequisite gap — `robot_didqubes`/
`organization_didqubes` have no canonical anchor table to bind to today.

**Agent anchor volume:** `agent_root_identity` — 19 total rows, 13 with `sponsor_persona_id` populated
(the other 6 are presumably platform/system agents without a human sponsor — not investigated further
under Phase 0's scope, flagged for whoever designs the Phase 1 backfill).

---

## 5. Resolution-record preflight (CLAUDE.md Resolution → Invariant Loop)

**Resolution records / candidate invariants reviewed:**

- `CI-2026-08-23-CANONICAL-IDENTITY-CHAIN-OVER-FUZZY-MATCH-001` (candidate, unratified) — directly
  governs the `personas.root_did` elimination work; already cites
  `services/standing/agentStandingPersona.ts` as a prior occurrence. This plan's work is a second
  occurrence of the same candidate invariant, not a new one — should be recorded as such when the
  actual fix lands (not in Phase 0, which performs no fix).
- `CI-2026-08-15-EXPLICIT-ANCHOR-AUTHORITATIVE-001` (candidate, unratified) — states that once a
  record's own anchor has been reconciled by a full principal-resolution walk, a downstream consumer
  must read the record's own anchor columns directly rather than re-running the walk. Directly
  supports `resolveDiDQube()`'s design requirement to compose existing resolvers (e.g.
  `resolvePassportExplicitAnchor`) rather than re-deriving.
- `CI-2026-08-03-ACTOR-SUBJECT-OWNER-001` (candidate, unratified) — "actor, subject and owner are
  distinct references... must not substitute one for another." Directly supports the plan's trust-class
  distinctions (ruling #7) and Aegis's actor/subject/principal separation (already present in the
  brief's DVN receipt shape).

**Canaries protecting these today:** `tests/agent-standing-persona.test.ts` (protects the
canonical-chain invariant for the specific occurrence already fixed once in this file — a NEW
regression here would need a new/extended canary, not reliance on this one alone, since this plan's
`personas.root_did` fix targets a *different* function in the same file, plus two other files);
`tests/legacy-passport-linkage-principal-first.test.ts` (protects `legacyPassportLinkageRepair.ts`'s
already-correct principal-first pattern — the reference implementation this plan generalizes from).

**Unresolved risks this plan could invalidate/bypass/duplicate if executed carelessly:**

- Duplicating `resolveRootPrincipalForAuthUser`'s walk a third time (in the new `resolveDiDQube()`)
  instead of composing it would itself violate `inv.engineering.036`/`037` and the
  `CI-2026-08-15-EXPLICIT-ANCHOR-AUTHORITATIVE-001` candidate — the corrected plan's Phase 2 explicitly
  requires composition, not re-derivation.
- Fixing `provisionAgentPersona.ts` without also fixing the duplicated logic in
  `app/api/homecoming/agent/stand-up/route.ts` (§2, row 2) would leave a second, unfixed copy of the
  exact same defect — both must move together, not just the one the operator named explicitly.
- `services/standing/agentStandingPersona.ts` is both a **read** and a **write** site for
  `personas.root_did` (§2) — eliminating reads elsewhere while this file keeps writing the column would
  leave the column's data quality actively degrading even as its readers are removed. The write site
  needs equal priority to the read sites the operator named.

---

## 6. Proposed canonical mapping and migration boundaries (Phase 0 output, not yet DDL)

This is the mapping the corrected plan's Phase 1 will implement — stated here as the Phase 0
deliverable, not executed:

| DiDQube subtype | Canonical anchor (unchanged, authoritative) | Migration boundary |
|---|---|---|
| `human_didqubes` | `public.kybe_identity` (by `id`, no RootDID condition per ruling #2) | Backfill from every `kybe_identity` row unconditionally; ambiguity is not expected here (kybe is already the leaf) |
| `agent_didqubes` | `public.agent_root_identity` (by `id`) | Backfill from every `agent_root_identity` row; 19 candidates, 13 sponsored |
| `robot_didqubes` | **none exists** | Blocked — no canonical robot root table; must be created (out of this plan's current scope) or explicitly deferred with operator sign-off before any robot DiDQube is modeled |
| `organization_didqubes` | **none exists** | Same blocker as robot |
| `services/agentiq-wallet`'s `didqube.*` schema | Not a canonical anchor — a separate, currently-non-functional (per §1.2) identity model to be converged and eventually retired | Convergence path: point `identity.ts`/`anonymous.ts`/`config.ts` at `resolveDiDQube()` once it exists; keep `didqube.*` tables until zero live reads/writes against them is proven, per operator ruling |

---

## 7. CFS-051 registration

Registered as a candidate architectural refinement in `public.research_backlog_items`
(`slug: didqube-canonical-constitutional-container-refinement`, id `a514831a-ef5f-4ca5-a7a0-020e50c9c3e4`),
per CFS-051A Roadmap C, lifecycle stage `architecture-candidate`. The operator's ontology ruling is
recorded as authoritative on the *ontology*; implementation status remains candidate until behaviorally
validated, per the operator's own closing instruction.

---

## 8. What Phase 0 did NOT do (scope discipline)

No DDL executed. No row inserted/updated/deleted in any identity or Passport table (`kybe_identity`,
`root_identity`, `did_persona`, `agent_root_identity`, `agent_persona`, `polity_passport_records`,
`polity_passport_applications`, any `didqube.*` table). No Passport issued, revoked, or reconciled. No
`resolveDiDQube()` code written. No DVN payload touched — only its inventory/design implications are
discussed in the corrected plan, per the operator's explicit "return later with the precise versioned
payload diff... for separate approval" instruction.
