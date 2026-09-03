# ACCESS-STEWARD-001 — S0 Current-Source Reconciliation

**Status:** S0 (read-only reconciliation) complete. Bounded S1 slice (shared explanation facade +
one paired allow/deny retrieval path, synthetic fixture) implemented and tested. S2–S5 not started —
separately scoped follow-ups per the operator's run instruction.
**Spec:** ACCESS-STEWARD-001 v1.0 (2026-09-03), operator handoff, this session.
**Branch:** `spec/access-steward-001` (this worktree).
**Method:** Source-code-only reconciliation. Live Supabase MCP access to the `Aigent Z`
(`bsjhfvctmduxhohtllly`) and `Aigent Nakamoto` (`ysykvckvggaqykhhntyo`) projects was confirmed
reachable (`mcp__Supabase__list_projects` returned real project rows), but this run did **not**
query live tables for named individuals (Ian, Austin, Horizen contacts, Lehigh faculty/students) —
the spec's §2 "no current... live entitlement... was inspected" instruction is honoured literally:
S0 inventories *mechanisms*, not live rows. No production grant is asserted or inferred anywhere in
this document. `threshold` (metaMe Threshold Gateway) MCP requires interactive OAuth this
non-interactive session cannot perform — unavailable this run, noted where relevant.

---

## 0. Headline finding

**This is not a greenfield workstream.** The four acceptance families named in the spec already
have substantial, tested, production server-side machinery reusable almost as-is:

- **Ian (§7.1)** — `services/research/reciprocalExchange.ts` (1,660 lines) is a complete,
  fail-closed, receipted bilateral exchange primitive with a dedicated `getExchangeView()`
  authorization+projection function that already implements the entire ALLOW/DENY shape the spec
  asks for (membership fail-closed, disclosure-policy-gated content, T0 stripping, revocation
  handling). Six existing test files exercise it.
- **Austin / research access (§7.2)** — `services/research/researchWorkspaceRoles.ts` +
  `researchWorkspaceViews.ts` encode exactly the human-vs-role distinction the spec asks for
  (compile-time `false` literals for powers no workspace role may hold), and
  `services/delegation/delegationGrantStore.ts` already separates per-agent delegation from a
  persona's independent grants (`readActiveGrantForAgent` vs `readActiveGrants`) — the exact
  AS-08 requirement ("revoking agent delegation must not delete the human's own access").
- **Horizen / Marketa (§7.3)** — `services/horizen/partnerAuthorizationStore.ts` (a real state
  machine: `PREPARED → AWAITING_SIGNATURE → SIGNED → SUBMITTED → CONFIRMED`/refused/expired/
  quarantined) plus `services/passport/participationTabGate.ts`'s
  `participationDomain`/`participationRoles` gate (built specifically from a prior Horizen audit,
  2026-07-27) already separate partner-org membership from workspace-content visibility.
- **Lehigh (§7.4)** — `services/passport/participationAccess.ts`'s `DOMAIN_ROLES['research-lab']`
  **already lists** `'faculty-lead'` and `'student-researcher'` as named roles, added 2026-07-27/28
  specifically because "a faculty-lead administers ONE cohort... not programme-wide" — i.e. the
  exact CS/MFE boundary the spec worries about is already a ratified, coded distinction, not an
  open question. What is **not** yet resolved (matches spec §2 exactly): whether any real Lehigh
  faculty member's live grant actually spans both programmes.

**The second headline finding**: `docs/security/2026-08-27_irl-os-containment-breach-audit.md` is a
very recent (7 days before this handoff), 490-line, exhaustively-verified security audit that is
functionally a first real-world exercise of an Access Steward-shaped analysis — it found and fixed
exactly the failure class §9/§10 of this spec warns about (a public cartridge deep-linking into a
private one via query params; two unauthenticated document routes; client-controlled `isAdmin`
influencing a UI gate). Its **own "Residual risks / Phase 2" section (5 items) is effectively a
pre-written punch list for this workstream's S2** — most notably Residual Risk 0, which is a live,
already-approved external reviewer flow (Autonomi/Austin) that the audit's Phase 1 fix
**unintentionally 403s** pending exactly the "scope-aware gating" this spec's Austin case (§7.2)
calls for. This is not a hypothetical case — it is a currently-broken legitimate-access path,
named in the operator-approved audit, waiting on the work this spec describes.

**Conclusion for S0's own instruction ("propose minimal change")**: the correct S1–S5 shape is a
**thin, additive explanation/audit facade** composing the mechanisms below — never a new grant
authority, never a parallel resolver. Section 5 below names the one new file this run adds.

---

## 1. Evidence table

Columns: **Requirement** (spec §) · **Current mechanism** (exact file/symbol) · **Enforcement
point** · **Observed result** (what reading the code shows, not inferred) · **Gap** · **Proposed
minimal change**.

### 1.1 Core identity / access spine (spec §4, §5)

| Requirement | Current mechanism | Enforcement point | Observed result | Gap | Proposed minimal change |
|---|---|---|---|---|---|
| Resolve requester (server-trusted, never client-supplied) | `services/identity/getActivePersona.ts` — `getActivePersona(request)` | Every route that calls it | Priority chain: personaSessionToken → `x-persona-id` header → `?personaId=` (legacy, deprecation window) → `crm_auth_profiles.default_persona_id` → first owned persona. Ownership always re-checked against `ownedPersonaIds`. `isAdmin`/`adminCartridges` resolved server-side in the same pass (`resolveAdminFlag`, `getCartridgeAdminGrants`). | `cohortMemberships` is **hardcoded to `[]`** — comment: "table not yet built (cohort backlog Phase 3 wire-up)." `resolvePartnerFlag()` is **hardcoded `false`** — "not yet a first-class platform concept." | No live cohort-membership or partner-flag signal exists on the spine today. Any Steward explanation that needs cohort/partner state must read `participationAccess.ts`'s `access_grants`/`access_invitations` tables directly (see 1.2) — it is the actual source of truth for those, not the spine's `cartridgeFlags`. | None needed for S1. Document this clearly (done here) so a later slice does not assume `ActivePersonaContext.cohortMemberships` is populated. |
| The one gate every content consumer calls | `services/access/evaluateAccess.ts` — `evaluateAccess(context, descriptor, action, opts)` | Content-state-aware (A–E), full types in `types/access.ts` | ALLOW requires affirmative evidence (free / owned / credential-met / token-proof); every other path is an explicit `denyDecision(reason,...)`. No implicit "most permissive wins" — deny is default. Receipt emission is awaited (Lambda-freeze-safe), privacy-stripped by construction (alias commitment only, T0 never in the handle). | This gate answers "may this persona consume THIS content asset" — it has no notion of exchange parties, cohorts, delegation scope, or partner-approval workflow. It is the right layer for content/media delivery (spec §9's "video/image/download delivery"), not for the relationship-scoped cases in §7. | The Steward composes ON TOP of `evaluateAccess` for content-state gating; it does not replace it. No change to this file (it is on the "do not modify without approval" list per CLAUDE.md's Identity & Access Spine section anyway). |
| ALLOW/DENY/UNRESOLVED with reasons, evidence, obligations | No existing single contract shaped exactly this way | — | `AccessDecision` (`types/access.ts`) has `allow: boolean` + `reason` (closed enum) + `deliveryMode` + `receipt` — binary, not tri-state; no `UNRESOLVED`, no structured `evidence[]`, no `obligations[]`. `getExchangeView` (below) has the tri-state shape informally (`ok:true` disclosed / `ok:true` locked / `ok:false`) but not the spec's exact contract. | **Confirmed gap**: no existing symbol returns the exact ALLOW/DENY/UNRESOLVED + evidence + obligations shape spec §5 asks for. | **This is the S1 deliverable** — `services/access/accessSteward.ts` (new, additive, this run). See §5 below. |
| Tab/UI visibility gate, fails closed on "not loaded" | `services/passport/participationTabGate.ts` — `tabPassesAccessGates`, `satisfiesParticipationGate`, `satisfiesWorkspaceScope`, `scopesGrantedIn`, `grantAllowsScope` | `useCodexConfig`, all four tiers in `CodexPanelDynamic` (per its own doc comment, "ONE IMPLEMENTATION (inv.engineering.036)") | Order is `adminOnly` first (never widened by a participation domain), then domain+role, with an explicit not-loaded → closed state (`EMPTY_PARTICIPATION_ACCESS`). Workspace/pilot **scope** is a *separate* deny-by-default check (`grantAllowsScope`) added by the 2026-07-28 "Amendment G" cohort-isolation ruling specifically because "a generic `venture-lab` membership must never confer access across all pilot cohorts." | This is a **render**-only gate by its own explicit doc comment ("decides what is RENDERED, never what is permitted") — every route it fronts must still independently re-verify. Confirmed independently re-verified for 4 routes by the containment audit (§0 above); **not** exhaustively re-verified platform-wide (audit's own stated limitation, Residual Risk 5). | No change to this file. A Steward "why is X blocked" explanation for a *tab* should read through this gate's inputs (same `ParticipationAccessState`) rather than re-deriving membership — noted as the S2 integration point. |

### 1.2 Invitation / grant / cohort mechanisms (spec §3, §8)

| Requirement | Current mechanism | Enforcement point | Observed result | Gap | Proposed minimal change |
|---|---|---|---|---|---|
| One shared invitation+grant mechanism across access domains | `services/passport/participationAccess.ts` — `ACCESS_DOMAINS` (`passport, research-lab, venture-lab, metame-studio, developer-studio`), `DOMAIN_ROLES`, `DOMAIN_STEWARD_ROLES`, invite-issue/claim flow over `access_invitations` + `access_grants` tables | `/api/participation/*` routes (not individually re-read this pass; inferred from the service's own doc header and `participationTabGate`'s doc comment naming `/api/participation/my-access` as the canonical read) | Header doc states plainly: "ONE shared mechanism for every permissioned area, keyed by access domain... Role catalogues are configuration, not UI branches — extend DOMAIN_ROLES to add a domain or role, never fork the mechanism." Bearer codes are sha256-hashed at rest, shown once, bounded (expiry/max-uses/revocation/intended-recipient). Every grant is receipted (`passport_privilege_changed`). `research-lab` domain's role list **already contains** `'faculty-lead'` and `'student-researcher'` (added 2026-07-27/28, "administers ONE cohort... not programme-wide") plus `'principal-investigator'`. | This is exactly the mechanism spec §8's mutation flow (resolve recipients → resolve resource/scope → verify authority → preview → confirm → execute → record → re-evaluate) should be built on. Not independently confirmed this pass whether the full 8-step flow (specifically "preview affected subjects... before execute") is implemented end-to-end in the route layer — flagged as unresolved, not assumed either way. | None for S1 (out of scope: spec explicitly forbids issuing real invitations/grants this run). S3 should read the actual `/api/participation/*` route implementations before adding any Steward-mediated mutation wrapper. |
| Role-scoped authority within a workspace (what a role may DO, distinct from what renders) | `services/research/researchWorkspaceRoles.ts` — `RESEARCH_WORKSPACE_ROLE_AUTHORITY`, `services/research/researchWorkspaceViews.ts` | Consumed by workspace surfaces (not individually traced this pass) | Six powers are typed as the literal `false` on **every** role (`mayFreeze`, `mayCanonize`, `mayPublish`, `maySelfReviewConfirmatoryWork`, `mayGrantStanding`, `mayEditSourceAssets`) — a compile error, not a review-catchable data mistake, if any role is ever granted one. `faculty-lead`'s administrative authority is explicitly bounded "to their own grant's scope by `resolveInvitationAuthority`" per this file's own comment (verified this symbol exists in `services/passport/participationAccess.ts`, not independently re-read line-by-line this pass). | Confirms spec §7.4's proposed role templates are **already coded**, not merely proposed — but per spec's own instruction ("do not remove established legitimate access... S0 must identify existing rules and return unresolved choices"), whether a *live* faculty member's grant is scoped correctly (CS-only vs cross-programme) is a data question, not a code question, and is explicitly out of this run's evidence (no live query run). | None. Record as resolved-in-code, unresolved-in-data (rule-decision register, §4). |
| Bilateral reciprocal exchange (Ian's case, generically) | `services/research/reciprocalExchange.ts` — full lifecycle (`createExchange` → `inviteCounterparty`/`joinExchange` → `depositArtifact` → `declareFreeze` → `signInstrument` → auto-`recomputeExchangeState` → `EXCHANGED` crossing) + **`getExchangeView(admin, {exchangeId, personaId})`** | Every mutating function independently re-checks `resolveMembership` before doing anything — file's own header: "it is never acceptable for a route or the UI to be the only gate." `getExchangeView`'s own doc comment: "the ONLY function that decides whether the counterparty's artifact content is visible to this viewer. Fails CLOSED." | Verified by direct read (not inferred): non-party → `{ok:false, error:'not-a-party'}` before any other check. Content disclosure gated by `disclosurePolicy` (`RECIPROCAL_AFTER_BOTH_DEPOSIT` / `MANIFEST_BEFORE_CONTENT` gate on `hasCrossed(status)`; `IMMEDIATE_ON_DEPOSIT` gates on the counterparty simply having deposited). Revocation (`REVOKED_ACCESS_POST_EXCHANGE`) independently forces non-disclosure regardless of crossing. T0 fields (`initiatorPersonaId`/`counterpartyPersonaId`/`inviteCodeHash`) are deleted from the projected view at runtime, not just typed away. Six existing test files (`reciprocal-exchange.test.ts` et al.) exercise this. | None found in the mechanism itself. The gap is only that its output isn't yet expressed in the spec's uniform ALLOW/DENY/UNRESOLVED contract. | **S1 target** — thin translation wrapper, see §5. |
| Delegated-agent vs. principal access, independently revocable | `services/delegation/delegationGrantStore.ts` | Authority-gate callers (not individually traced) | `readActiveGrantForAgent(personaId, agentRootDid)` is explicitly the correction for a named prior defect: "a current MoneyPenny delegation made Nakamoto appear delegated... and vice versa." `revokeGrantForAgent` revokes exactly one agent's grant; `revokeAllActiveGrants` is reserved and explicitly commented "never used as a side effect of granting or revoking one specific agent's authority." | This durably implements AS-08 ("revoking agent delegation blocks agent use without deleting independent human access") **for the delegation-grant model** — but delegation here is persona-to-agent authority (what an agent may DO on the platform), not "does this human own separate direct access to resource X regardless of agent delegation," which is the Austin-specific reading of AS-08. Those are related but not identical; conflating them would be a modeling error. | None for S1. Flag for S2/Austin-specific slice: verify whether Austin's *human* research-lab grant (via `participationAccess.ts`/`access_grants`) is queried independently of any `delegation_grants` row for his research copilot. |
| Partner authorization / publication workflow (Horizen ↔ Marketa) | `services/horizen/partnerAuthorizationStore.ts` (partner-agnostic table, `partner` column; only writer today is `services/horizen/authorizationClient.ts`, only value written is `'horizen'`) | Own state machine, one row per request | Real state machine: `PREPARED → AWAITING_SIGNATURE → SIGNED → SUBMITTED → CONFIRMED`, terminal `REFUSED`/`EXPIRED`/`QUARANTINED`. Never persists plaintext key material — `signatureRef` is a hash reference. | This governs Horizen's own agent-authorization/Pulse-signing flow, not (as far as this pass traced) a Marketa draft→approved→published *content* workflow. Spec §7.3's five-step publication workflow (partners collaborate on a restricted draft → reviewers inspect a release candidate → approvals collected → Marketa publishes the approved projection → public reads only the projection) was **not** found as a single existing mechanism this pass — `services/marketa/activation/*` (found: `policy.ts`, `outreachTemplates.ts`, `normalizers.ts`, `agentBenchReadModel.ts`) concerns outreach/activation sequencing, not content-publication approval. | **Confirmed gap, not yet reconciled.** Whether an existing publication-approval primitive exists elsewhere (e.g. under `services/venture/` or a Qriptopian-specific projection service) was not exhaustively searched this pass — flagged as an open S0 item, not asserted absent. Do not build a parallel approval mechanism before this search completes. |

### 1.3 Public/private projection & the containment audit (spec §6, §9)

| Requirement | Current mechanism | Enforcement point | Observed result | Gap | Proposed minimal change |
|---|---|---|---|---|---|
| A public cartridge must never be a navigation/authority bridge into a private one | `docs/security/2026-08-27_irl-os-containment-breach-audit.md` (ratified hard invariant, quoted verbatim in that doc) | `app/api/codex/packs/[packId]/file/route.ts`, `app/api/public/irl/doc/route.ts`, `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts`, `utils/codex-nav.ts` (`buildCodexUrl`) | Both document-serving routes are now default-deny with an explicit allowlist (`IRL_PUBLIC_PACK_PATHS`/`IRL_PUBLIC_DOC_PATHS`, one entry each). `isAdmin` is no longer accepted from any URL param/postMessage anywhere in the auth bridge (verified: literal `useState<boolean>(false)`, reset-first-on-persona-switch, the only `setIsAdmin(true)` call site gated on the canonical server response). 17+29 canaries in `tests/irl-os-containment.test.ts` and `tests/irl-os-query-derived-authority-removal.test.ts`. | The audit's own "What this audit does NOT claim" section lists three explicit non-claims: (a) not every `personalId`/`isAdmin`/`fromTab` query usage was traced platform-wide; (b) Participation group's non-admin sub-tabs were not independently re-audited this pass; (c) no public-safe projection was authored for the now-hidden IRL OS tabs — they are hidden, not fixed. **Residual Risk 0 is a live regression**: a genuinely-invited, non-admin reviewer (the Autonomi/Austin flow) now 403s on `agent-package`-issued document URLs, because the packs/file route's new gate is admin-only for any non-allowlisted path and has no way to see the `agent-package` route's own prior vetting. | This is the most concrete, already-scoped, already-approved-in-principle next slice for S2: "add scope-aware gating to the packs/file route (accept a caller whose canonical research-lab grant covers the referenced experiment, not just admin)." Not attempted this run (S2 is out of scope) — named here so it is not lost. |
| Constitutional Internet manuscript classification (spec §6's named example) | `codexes/packs/polity-core/items/commentary/constitutional-internet/` — plates (`CIP-006`, `CIP-007`, `00-canonical-plate-register.md`), `agent-edition/` (schema + package), `02-source-and-evidence-matrix.json`, `BOOK_IMPLEMENTATION_RECONCILIATION.md` | Not traced to a specific serving route this pass | The manuscript tree is real and locatable in-repo. Its live audience/publication state (draft vs. approved-release vs. public) was **not** independently re-derived this pass — no route/flag was read that asserts one. | Per spec §6, this is explicitly **not to be auto-classified**. Recorded here as "exists, location confirmed, classification state genuinely unresolved" — matches the spec's own framing exactly, not resolved further. | None. Add to rule-decision register (§4) as an explicit open item for the operator, not inferred. |

### 1.4 MCP / Companion / cross-surface (spec §9)

| Requirement | Current mechanism | Enforcement point | Observed result | Gap | Proposed minimal change |
|---|---|---|---|---|---|
| MCP invitation resolution, T2-safe | `services/threshold/resolveInvitation.ts` | `resolveInvitation(code)` | Emits **no** persona/T0 identifiers — only invitation metadata plus a sha256 commitment as `invitationId`. Two invitation code namespaces observed: `pinv-` (against `access_invitations`, same table `participationAccess.ts` writes) and `x409-` (against a separate `x409_invitations` table, labelled "Constitutional Agreement" / "Independent Reviewer"). | The `x409_invitations` table's relationship to the acceptance families (is it Austin's reviewer path? a different one?) was not traced further this pass. | Flag as an S0 open item — worth resolving before any S2 MCP-scoped gating work, since it's a second invitation table alongside `access_invitations`. |
| MCP-side constitutional acts / write gating | `services/threshold/mcpConstitutionalActs.ts`, `services/threshold/gateway.ts`, `services/threshold/serviceRegistry.ts` | Not read in full this pass (file list only) | Present and organized as a distinct MCP-facing layer (gateway/session/registry/navigator) separate from the native-UI routes — consistent with spec §9's requirement that MCP list/search/read carry "the same policy semantics" as native surfaces, but this pass did not verify the semantics actually match line-for-line. | Open — flagged for S2, not verified either way this pass. |

---

## 2. What this session did NOT verify (named explicitly, per spec §2 and CLAUDE.md's no-guessing rule)

- No query was run against the live `Aigent Z` or `Aigent Nakamoto` Supabase projects for any named
  individual, cohort, partner organisation, or agreement row. Connectivity was confirmed
  (`list_projects` succeeded); no `execute_sql`/`list_tables` call was made against project data.
  This was a deliberate choice, not a limitation discovered mid-run: the spec's own "Evidence status
  and limits" section instructs recording current mechanisms, not fishing for live individuals'
  grants, and the "No production grant may be inferred to fill these gaps" instruction governs.
- `mcp__metaMe_Threshold__*` tools (Threshold Gateway) require interactive OAuth this session cannot
  perform. Not used. No Threshold-side journey/exchange state was read live.
- GitHub MCP tools were available but not used — no PR/issue/branch operations were needed for a
  read-only S0 pass; the S1 code below is committed directly to the fresh session branch.
- The full `/api/participation/*` route tree, `services/marketa/*` beyond the four files named
  above, `services/threshold/gateway.ts`/`serviceRegistry.ts` internals, and the complete
  `data/codex-configs.ts` gate-field inventory were **not** read exhaustively — named as open S0
  items for a follow-up pass, not silently assumed clean or broken.
- Whether any Marketa/Qriptopian content-publication-approval primitive exists outside
  `services/horizen/partnerAuthorizationStore.ts` was not conclusively determined (§1.2, last row).

---

## 3. Reused mechanisms (nothing new stood up, per CLAUDE.md's Extend-Don't-Duplicate + spec §4's "one engine")

`services/identity/getActivePersona.ts` (identity spine) · `services/access/evaluateAccess.ts`
(content gate) · `services/passport/participationTabGate.ts` (render gate) ·
`services/passport/participationAccess.ts` (invitation/grant/role mechanism) ·
`services/research/reciprocalExchange.ts`, specifically `getExchangeView` (Ian-shaped
membership+disclosure resolver) · `services/research/researchWorkspaceRoles.ts` (role authority
table) · `services/delegation/delegationGrantStore.ts` (per-agent delegation) ·
`services/receipts/activityReceiptService.ts` (audit trail, via the exchange service's own calls).

---

## 4. Rule-decision register — unresolved choices (spec §2, §7.4; blocks only the affected slice, never the whole audit)

| # | Open decision | Where it matters | Current disposition |
|---|---|---|---|
| RD-1 | Is any real Lehigh faculty member's live grant scoped to both CS and MFE? | §7.4 cross-programme faculty case | **Unresolved — no live query run.** Code already supports scoping this correctly (`faculty-lead` role + `resolveInvitationAuthority`-bounded scope); the question is a data fact, not a code gap. Do not infer either way. |
| RD-2 | Does Ian's exchange (or any real exchange row) actually exist, and has it reached `EXCHANGED`? | §7.1 acceptance criteria AS-05 | **Unresolved — no live query run.** The mechanism (`reciprocalExchange.ts`) is proven against synthetic fixtures (existing test suite + this run's new S1 test, §6). Live case status is explicitly a separate, still-open question per spec §13 ("live case remains blocked, not passed"). |
| RD-3 | Does Austin have a live, current research-lab grant independent of any agent delegation, and is his agent's delegation currently active? | §7.2 AS-07/AS-08 | **Unresolved — no live query run.** Additionally: Residual Risk 0 of the containment audit means even a fully-entitled Austin currently 403s on the `agent-package`-issued document URLs — a **known, named, live regression**, not a hypothetical. |
| RD-4 | Does a Marketa content-publication approval workflow (draft → candidate → approvals → publish) exist as a named mechanism anywhere outside `partnerAuthorizationStore.ts`? | §7.3 AS-09/AS-10 | **Unresolved — search not exhaustive this pass.** Do not assume absent; do not assume present. |
| RD-5 | What is the current classification (draft/review/frozen/approved-release/published) of the Constitutional Internet manuscript, version-pinned? | §6, AS-19 | **Explicitly unresolved per spec's own instruction — not to be inferred from cartridge/folder/branch.** Location confirmed (§1.3); classification is an operator decision, not evidenced in code. |
| RD-6 | Relationship between `access_invitations`/`pinv-` codes and `x409_invitations`/`x409-` codes — are these the same acceptance family under two mechanisms, or genuinely distinct? | §8, MCP invitation resolution | **Unresolved — not traced this pass.** |

None of RD-1 through RD-6 block the S1 slice below, which uses clearly-labeled synthetic fixtures
per the spec's explicit allowance ("If Ian's live evidence cannot be accessed, use clearly marked
synthetic fixtures for implementation proof; live case remains blocked, not passed").

---

## 5. S1 — what was built this run

**File:** `services/access/accessSteward.ts` (new).

A single, additive, read-only translation function,
`explainReciprocalExchangeArtifactAccess(admin, { exchangeId, requestingPersonaId })`, that calls
the existing `getExchangeView()` (unmodified) and re-expresses its already-correct fail-closed
result in the spec §5 decision contract shape: `{ decision: 'ALLOW'|'DENY'|'UNRESOLVED', scope,
reasons[], evidence[], validity, obligations[], nextAction, auditRef }`. It performs **no**
authorization decision of its own — every ALLOW/DENY/UNRESOLVED branch is a direct, traceable
re-statement of what `getExchangeView` already returned. This satisfies the spec's operating
principle exactly: "Deterministic server-side policy mechanisms make and enforce access decisions
[...] the language model cannot [...] reinterpret contractual prose into a new grant."

This is the "shared explanation and access-audit helper" (S1) plus "one paired allow/deny retrieval
path for a verified frozen exchange artifact" (the bounded first coding slice), using clearly-marked
synthetic fixtures — no live Ian evidence was available or sought this run, so the live case remains
explicitly unresolved (RD-2), not passed.

**Not built this run** (explicitly out of scope per the run instruction): any facade over the
Austin/Horizen/Lehigh mechanisms, any route wiring, any UI surface, any invitation/grant mutation,
any S2–S5 work.

See `codexes/packs/agentiq/updates/2026-09-03_access-steward-001-acceptance-ledger.md` for the
acceptance-criteria status (AS-01–AS-30) and `tests/access-steward-s1.test.ts` for the paired
allow/deny/unresolved tests.

---

## 6. Smallest next slice (per spec §13's closing requirement)

1. **Resolve RD-3's live regression** (Residual Risk 0 of the containment audit) — add scope-aware
   gating to `app/api/codex/packs/[packId]/file/route.ts` so a caller whose canonical `research-lab`
   grant (via `participationAccess.ts`) covers the referenced experiment is accepted, not just an
   admin. This is the single highest-value, most concrete, already-operator-flagged next step, and
   it directly serves AS-07 (Austin human access) without inventing anything.
2. Extend `accessSteward.ts` with a second explain function over `participationTabGate.ts`'s inputs
   ("why is this tab/domain blocked for this persona") — reuses the existing gate exactly as §1.1
   above describes, no new authority.
3. Resolve RD-4 (Marketa publication mechanism) before attempting any S4 work — a real search, not
   an assumption either way.
