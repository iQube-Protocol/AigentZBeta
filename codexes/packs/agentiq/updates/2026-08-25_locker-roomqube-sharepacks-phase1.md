# Locker, RoomQubes and Share Packs — Phase 1 closeout

**Status:** Code-complete for the in-scope Phase 1 surface (schema + service
layer + API routes + tests), NOT applied to any live database. Built in an
isolated worktree whose own git history was found to significantly predate
this session's concurrent "QubeTalk Communications Membrane" / "ContactGraph"
work on `dev` — read §0 before anything else in this document; it governs
every reuse decision below and is the single most important finding of this
pass.

**Spec:** *Locker, RoomQubes and Share Packs — Federated Asset Curation and
Communications Specification*, v1.0, 25 August 2026 (operator-approved,
pasted verbatim into the implementing session).

**Scope:** Spec §19 Phase 1 ("Locker-native files and investor workflow")
plus the §5/§6/§7 conceptual/data model as schema foundation. Phases 2
(federated native resources) and 3 (rich communications, adaptive curation)
are explicitly out of scope for this pass and are not started.

---

## §0 — Environment finding that shaped every decision below (read first)

Before writing any code, this pass ran the mandatory reuse audit the task
required (grep for `Locker`, read `services/qubetalk/peerChannel.ts`, read
the QubeTalk Communications Membrane migration, read ContactGraph,
`content_qubes`, `activityReceiptService.ts`, `delegationGrantStore.ts`,
`InviteModal.tsx`, `mailjetAdapter.ts`). That audit surfaced a blocking
discovery:

**This worktree's own git history has NO common ancestor with `origin/dev`.**
`git merge-base HEAD origin/dev` returns nothing; `git merge origin/dev`
fails outright with `fatal: refusing to merge unrelated histories`. This
worktree's local migration timeline stops at `20260525000000` (25 May) with
an `activity_receipts` table carrying only 9 `action_type` values, and its
local `CLAUDE.md` is a much shorter, earlier revision than the one this
session's system prompt carries — none of `services/qubetalk/peerChannel.ts`,
`egress.ts`, `conversations.ts`, `relationships.ts`, `agentPolicy.ts`,
`services/contactGraph/*`, `passport_peer_channels`, `passport_peer_messages`,
`qubetalk_groups`, `qubetalk_conversations`, or the `qubetalk_participants`
table exist anywhere in this checkout. `origin/dev` (fetched read-only via
`git show origin/dev:<path>`, never merged) is at commit `10c04dac5`
("Close the QubeTalk messaging loop end-to-end (Phase 6)") and does have all
of the above, including the exact migrations named in the task brief
(`20260930040000_qubetalk_communications_membrane_domain_substrate.sql`,
`20260930050000_contactgraph_substrate.sql`).

**This is an infrastructure fact about the assigned worktree, not a design
choice.** It means every "read the existing X before building" instruction
in the task brief had to be satisfied against `origin/dev` via `git show`
(read-only — this pass never merged, and per the task's own constraints
never pushed), while every line of code this pass actually WRITES had to
compile and run inside a checkout that is missing that entire substrate.
Two consequences follow, both handled explicitly rather than worked around
silently:

1. **The schema still targets the real membrane tables by name and exact
   shape** (`qubetalk_groups`, `qubetalk_group_memberships`,
   `qubetalk_conversations`), copied verbatim from `origin/dev` where this
   worktree needed to (re)create them locally just to be buildable/testable
   — see `supabase/migrations/20260930055000_qubetalk_group_conversation_compat.sql`,
   whose header names exactly what to delete at integration and why. This is
   the "reuse, don't fork" instruction honored across a git-history gap,
   not a redesign of the target tables.
2. **The service-layer QubeTalk integration is deliberately shallow** —
   RoomQube provisions a real GroupQube + ConversationQube row and keeps
   group membership synchronized, but does NOT post messages into the
   conversation (`postRoomMessage`/`postSharePackToRoom`, spec §16.4),
   because that requires `passport_peer_messages` + `services/qubetalk/
   egress.ts`'s Agent-authority/disclosure-gated send path, which is not
   reachable from this checkout at all. Documented as deferred in §"Known
   limitations" below, not silently dropped.

**Recommendation to the orchestrating session:** this branch cannot be
`git merge`d onto `dev` in the normal sense (no common ancestor). The
practical integration path is almost certainly: diff/cherry-pick this
worktree's new files (listed in full at the bottom of this document) onto
an actual `dev` checkout, drop the compat-shim migration
(`20260930055000_...`) since `dev` already has the real tables, and re-point
`services/locker/roomQube.ts`'s QubeTalk calls at the real
`services/qubetalk/egress.ts`/`conversations.ts` once that's done. This
document gives the exact file list and exact table/column shapes so that
reconciliation is mechanical, not a rewrite.

---

## Reuse audit matrix

| Required capability | Existing artifact (audited) | Gap | Decision | Justification |
|---|---|---|---|---|
| Federated asset reference registry | `content_qubes` + `content_qube_storage` (`20260513010000_content_qubes_schema.sql`) | No table for a general cross-system asset (deck/agreement/report/paper/…), only content (episode/character/gn/…) | **NEW** — `asset_records` / `asset_renditions`, deliberately mirroring `content_qubes`' unified-object + linked-rendition-rows SHAPE | Genuinely new domain (spec §7.1 says as much); reusing the SHAPE keeps one mental model across both registries rather than inventing a third pattern |
| Room/data-room primitive | *(none — audited via grep, nothing found)* | No existing sub-Locker/room concept in this worktree | **NEW** — `roomqubes` / `roomqube_placements` / `roomqube_members`, ONE table set for every room type (§11.1) | Spec is explicit there is no existing capability here; a single polymorphic `room_type` CHECK column, never a per-type table |
| Share/delivery manifest | *(none)* | No recipient-scoped, version-pinning delivery object exists | **NEW** — `share_packs` / `share_pack_items` | Same — spec names this as new; §14.3's "pin at send" behavior has no existing analog to extend |
| Room discussion / messaging | `qubetalk_groups`, `qubetalk_group_memberships`, `qubetalk_conversations` (QubeTalk Communications Membrane, `origin/dev` only — see §0) | Tables exist on `dev`, NOT in this worktree | **EXTEND (by FK reference)**, never forked | Spec §9.1 explicitly forbids a parallel room-messaging table; RoomQube's `qubetalk_group_id`/`qubetalk_conversation_id` are real FKs into these tables. §0's compat migration recreates them verbatim ONLY so this worktree can build/test; it is not a second definition to keep |
| Actual message posting into a room conversation | `passport_peer_messages` + `services/qubetalk/egress.ts` (`origin/dev` only) | Entire substrate absent from this worktree | **DEFERRED** (see Known limitations) | Cannot extend a table/service that does not exist in the checkout without either forking it (forbidden) or vendoring its full transitive dependency graph (six-plus modules deep, itself indistinguishable from a fork). Scoped out honestly rather than faked |
| Membership resolution (invite a named person) | `app/api/mycanvas/entries/[id]/invite/route.ts`'s `resolveHandleToPersonaId` (UUID / `did:iq:` / `fio_handle` / EVM / `agent_keys` fallback), `components/shared/InviteModal.tsx` | Not exported as a shared service; ContactGraph (`contact_persons`/`contact_personas`/`contact_endpoints`) not present in this worktree either (§0) | **EXTEND the PATTERN** (compact re-implementation of the resolution strategy in the RoomQube members route), **DEFER** full ContactGraph-backed resolution | mycanvas's own resolver is an unexported route-local function, not a service — importing it would mean reaching into an unrelated route file for a private helper; the resolution STRATEGY (T1 handle → server-side persona_id, never client-visible) is reused faithfully. ContactGraph genuinely isn't in this checkout (§0) |
| Storage | `services/content/storageAdapter.ts` (`StorageAdapterFactory` / `SupabaseStorageAdapter`) | None — fully present and reusable | **REUSE as-is** | Exactly the "existing approved storage adapter" the spec's §8.5 names; new bucket name (`locker-assets`) only, no new adapter code |
| Receipts / auditability | `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts` `ANCHORABLE_ACTION_TYPES` | None — present, and CLAUDE.md names the ONE permitted unilateral extension point | **REUSE + the one permitted extension** — 9 new `ActivityActionType` literals, 2 added to `ANCHORABLE_ACTION_TYPES` | Exactly the extension path CLAUDE.md's DVN Pipeline Protection section pre-authorizes; submission mechanism/state machine/canister interaction untouched |
| Email delivery | `services/campaign/adapters/mailjetAdapter.ts` | `mailjetAdapter.send()`'s `ChannelPayload`/`TemplateID` shape is built for campaign batch sends against `nakamoto_knyt_personas` + per-sequence Mailjet templates — does not fit one named recipient + free-form message + governed links | **REUSE the endpoint/credentials, new call site** (mirrors that file's own `sendBccSummary` helper, which already establishes a non-templated single-purpose send against the identical endpoint) | Same Mailjet REST endpoint, same env vars (`MAILJET_API_KEY`/`MAILJET_SECRET_KEY`/`MAILJET_FROM_EMAIL`/`MAILJET_FROM_NAME`), same auth helper pattern — a second call site against one integration, not a second email service |
| Delegation/Agent-authority gating for distribution | `services/delegation/delegationGrantStore.ts` (`origin/dev` only) | Absent from this worktree (§0) | **DEFERRED** | Spec §4.6's "aigentMe may discover but must not distribute without authority" governs an *agent-initiated* share flow; Phase 1's Share Pack send is always a direct HUMAN action (`approveSharePack`/`sendSharePack` both require the caller to own the pack), so the gate's absence does not create a Phase-1 authority gap — it becomes load-bearing only once an agent-initiated send path is added (Phase 2+) |
| Governed/gated link delivery | CLAUDE.md's "Gated Content — Confidential Exposure Rules" pattern (`/api/content/pdf/[cid]` proxy style — never a raw storage URL to the browser) | No share-pack-specific link mechanism existed | **NEW, following the EXISTING pattern** — `share_pack_items.access_token` + `GET /api/locker/share/[token]` 302 redirect, resolved server-side, checks `authorization_state` (revoked/expired/not-yet-sent all refuse) | The pattern (never hand the client a raw storage URL; proxy through an authenticated/token-gated route) is reused verbatim; the token table is new because no share-specific one existed |
| PeerResult\<T\> service convention | `services/qubetalk/egress.ts`, `.../conversations.ts` (`origin/dev` only, per the task brief) | Not present in this worktree at all | **NEW, compatible definition** in `types/locker.ts` | Same shape (`{ok:true,value}|{ok:false,error,code?}`) as the pattern the task brief named; nothing local to import from, so a fresh but shape-compatible type was the only option |

---

## What was built

### Schema (3 new migration files, none applied to any live database)

- `supabase/migrations/20260930055000_qubetalk_group_conversation_compat.sql`
  — **compatibility shim only**, see §0. Recreates the minimal `qubetalk_groups`
  / `qubetalk_group_endpoints` / `qubetalk_group_memberships` /
  `qubetalk_conversations` subset verbatim from `origin/dev` so this
  worktree is self-buildable. Its header names the exact deletion action
  required at integration.
- `supabase/migrations/20260930060000_locker_roomqube_sharepack_schema.sql`
  — the real Phase 1 schema: `asset_records`, `asset_renditions`,
  `roomqubes`, `roomqube_placements`, `roomqube_members`, `share_packs`,
  `share_pack_items`. Every table: `CREATE TABLE IF NOT EXISTS`, RLS
  enabled, deny-all + `service_role`-only policy, matching the exact style
  of `20260513010000_content_qubes_schema.sql` /
  `20260930040000_qubetalk_communications_membrane_domain_substrate.sql`.
- `supabase/migrations/20260930061000_activity_receipts_locker_action_types.sql`
  — wholesale CHECK-constraint rebuild adding 9 `locker_*` action types,
  mirroring the rebuild discipline the membrane migration itself uses.

**Version-family model** (spec §7.1/§9.5): `asset_records.version_family_id`
groups every version of "the same asset"; `version_number` is 1-based within
the family; `supersedes_asset_id` links a new version back at the exact row
it replaced. A `UNIQUE (version_family_id, version_number)` constraint
prevents two rows silently claiming the same version slot. Registering a new
version NEVER mutates the prior row — verified in tests.

### Service layer (`services/locker/`, PeerResult\<T\> convention throughout)

- **`assetRegistry.ts`** — `registerAsset`, `addRendition`,
  `uploadLockerFile` (the Phase 1 Locker-native upload path: hash → detect
  duplicate → store via `StorageAdapterFactory` → register → attach
  rendition, spec §8.5 steps 1–6), `detectDuplicateAsset` (exact
  content-hash match, spec §8.4), `detectVersionCandidates` (same
  owner/class/title-or-filename, different hash — a *proposal*, registration
  still requires the caller to explicitly confirm `newVersionOf`),
  `getAsset`/`listRenditions`/`listLockerAssets` (all ownership-checked),
  `resolveAsset` (alias/title lookup with a `confidence` tier —
  `exact_alias` > `exact_title` > `fuzzy_title` — returns ALL plausible
  matches rather than guessing when ambiguous, spec §13), `updateAssetStatus`.
- **`roomQube.ts`** — `createRoomQube` (any `room_type`, ONE primitive, seats
  the owner as the first member), `resolveRoomQube`/`listRoomQubes`/
  `archiveRoomQube` (archiving never deletes placements/members),
  `addAssetToRoomQube`/`removeRoomQubePlacement` (a placement is a
  reference — removing it never touches `asset_records`),
  `inviteRoomQubeMember`/`updateRoomQubeMemberRole`/`removeRoomQubeMember`
  (personhood-anchored for `subjectType: 'person'`; removing a member also
  ends their `qubetalk_group_memberships` row when the conversation is
  already open), `openRoomConversation` (idempotent — provisions a
  `qubetalk_groups` row from current room members + a
  `qubetalk_conversations` row with `topology: 'group'`, and re-calling
  returns the existing context rather than duplicating it).
- **`sharePack.ts`** — `composeSharePack`, `previewSharePack` (exact
  recipients/assets/versions/delivery-modes before anything sends, spec
  §14.2), `approveSharePack` (resolves every `follow-current` item to its
  CURRENT family member + primary rendition and PINS it — spec §14.3
  steps 1–2 — and refuses to approve a `restricted`/`legal`/`financial`
  asset that isn't marked `approved-to-share`, spec acceptance #28),
  `sendSharePack` (email channel only — direct Mailjet REST call, writes a
  `locker_share_pack_sent` activity receipt, moves the pack to `sent`),
  `revokeSharePack`, `resolveShareLink` (the governed-link resolver behind
  `/api/locker/share/[token]`).

### API routes (`app/api/locker/`)

`assets/route.ts` (GET list / POST register or multipart upload, plus a
`mode: 'candidates'` version-candidate check), `assets/[id]/route.ts` (GET /
PATCH lifecycle-sharing-sensitivity), `assets/[id]/versions/route.ts` (POST
new version, resolves the family server-side from the prior asset id),
`rooms/route.ts` (GET / POST), `rooms/[id]/route.ts` (GET resolve / PATCH
archive), `rooms/[id]/placements/route.ts` (POST / DELETE),
`rooms/[id]/members/route.ts` (POST invite — handle-or-personaId, mirroring
mycanvas's invite route — / PATCH role / DELETE), `rooms/[id]/conversation/
route.ts` (POST open), `share-packs/route.ts` (GET / POST compose),
`share-packs/[id]/route.ts` (GET preview / POST `{action}` approve|send|
revoke), `share/[token]/route.ts` (GET — 302 governed-link redirect, no
auth required, token + `authorization_state` IS the access control).

Every route resolves the caller via `getActivePersona(request)` and 401s
without it — the identity spine, not a parallel auth check.

### Receipts

`ActivityActionType` (`services/receipts/activityReceiptService.ts`)
extended with 9 `locker_*` literals; `ANCHORABLE_ACTION_TYPES`
(`services/dvn/activityReceiptDvnPipeline.ts`) extended with
`locker_share_pack_sent` and `locker_roomqube_member_invited` — the ONE
permitted unilateral DVN-pipeline change per CLAUDE.md. No new receipts
table; submission mechanism/state machine/canister interaction untouched
(verified by re-reading the diff before finishing — both edits are
literal-only).

### Tests

`tests/locker-roomqube-sharepack.test.ts` — 20 tests against the real
service functions (not a logic reimplementation) via a hand-rolled in-memory
fake Supabase client (no `createFakeSupabase()` helper exists in this
worktree to reuse — another §0 consequence). Covers spec §20 acceptance
items 1, 4–6, 9, 11–20, 21, 23–28, plus the governed-link lifecycle. See
"Test results" below for the run.

---

## Known limitations — explicitly deferred, not silently dropped

1. **`postRoomMessage` / `postSharePackToRoom` (spec §16.4) — not
   implemented.** RoomQube opens a real QubeTalk group+conversation and
   keeps membership synchronized, but nothing in this pass can POST a
   message into it: that requires `passport_peer_messages` (extended
   columns: `conversation_id`, `group_id`, `transport`, `direction`,
   `audience_snapshot`, …) and `services/qubetalk/egress.ts`'s
   ownership/Agent-authority/disclosure-gated send path, none of which
   exist in this checkout (§0). `SharePack.deliveryChannel` accepts
   `'qubetalk'` in the schema/type but `sendSharePack` refuses it with
   `channel_not_implemented` — it never silently no-ops or fakes success.
2. **Native-system resolver adapters (spec §6 `AssetResolver`, §10 "Add
   existing native assets to the Locker") — not implemented.** Phase 1 only
   resolves `native_system: 'locker'`. `asset_records.native_system` accepts
   `qriptopian`/`codex`/`irl`/`bridge`/`venture-workspace`/`external` at the
   schema level (so a RoomQube CAN hold a placement pointing at a
   Qriptopian essay registered by hand, as the test suite demonstrates) but
   no service resolves those references live — this is explicitly Phase 2
   per the spec's own plan.
3. **ContactGraph-backed membership resolution — not implemented.**
   `roomqube_members` invitation resolves a T1 handle to a persona id with a
   compact UUID/`fio_handle` check (mirroring, not importing,
   `app/api/mycanvas/entries/[id]/invite/route.ts`'s pattern) because
   `contact_persons`/`contact_personas`/`contact_endpoints` don't exist in
   this checkout (§0). Group/agent members accept an opaque
   `subjectGroupRef` string with no resolution at all.
4. **`inspectUpload` LLM-driven metadata proposal (spec §8.3) — not
   implemented.** Upload accepts explicit metadata from the caller; there is
   no automatic title/class/sensitivity/alias/room-suggestion inference
   step. The route/service contract (`mode: 'candidates'` on the assets
   route) leaves room for this to be added without a schema change.
5. **"Generate and save" conversational trigger (spec §9.2/§9.3 steps 1–3,
   the aigentMe-side "propose saving this artifact" flow) — not wired.**
   The SAVE side (`POST /api/locker/assets` with `provenance: {source:
   'generated-and-saved'}`) exists and is tested implicitly via
   `registerAsset`; the aigentMe conversational trigger that CALLS it is out
   of scope for this pass (it lives in the copilot/composer layer, not the
   Locker capability itself, and touching it risks the Companion Menu
   System invariants CLAUDE.md governs separately).
6. **UI — not built.** No Locker panel, RoomQube view, or upload/Share Pack
   composer UI. Schema + service layer + routes + tests were the stated
   priority for this pass; this is a plain scope cut given time, not a
   design decision.
7. **Delegation/Agent-authority gate for agent-initiated sends (spec §4.6)
   — deferred**, see the reuse-audit matrix row above; not load-bearing in
   Phase 1 because every send in this pass is a direct, ownership-checked
   human action.
8. **Access-token link controls beyond expiry-via-pack-state — partial.**
   `resolveShareLink` refuses on `revoked`/`expired`/not-yet-`sent`, but
   there is no PER-ITEM expiry timestamp, no download-vs-view distinction,
   no watermarking, and no access-event logging beyond the original
   `locker_share_pack_sent` receipt (spec §15.3's fuller list). The token
   table (`share_pack_items.access_token`) is designed so those can be
   added as additional columns later without a shape change.

---

## Test results

`npx vitest --config vitest.config.mjs run tests/locker-roomqube-sharepack.test.ts`
— **19/19 passed** (the fake-Supabase `.is(col, null)` filter needed one fix
mid-pass to match real Postgres "unset column defaults to NULL" semantics;
noted in the test file's own comment).

Full-suite run for collateral-breakage check
(`npx vitest --config vitest.config.mjs run`, this repo's default runner —
`node_modules` was reached via a temporary symlink to the sibling checkout
at `/home/user/AigentZBeta`, since this isolated worktree has none of its
own installed and the task disallowed a real `npm install`; removed again
before finishing): **245 passed, 36 failed, 2 skipped (283 total)**, 6 files
failed. Every failing file (`tests/access-spine.test.ts` — one hardcoded
debug-bypass assertion, `tests/content-encryption.test.ts`,
`tests/crm-integration.test.ts`, `tests/pack-registry.test.ts`,
`tests/partner-platform.test.ts`, `tests/backend/api.test.ts`) is
pre-existing and environment-dependent (live-server/auth/env-key
assumptions this sandbox doesn't satisfy) — confirmed independent of this
pass because none of them import `services/locker/*`,
`services/receipts/activityReceiptService.ts`, or
`services/dvn/activityReceiptDvnPipeline.ts` (grepped for all three before
concluding). `tests/locker-roomqube-sharepack.test.ts` itself is in the 15
passing files.

## TypeScript

`npx tsc --noEmit -p tsconfig.json` could not run as-shipped in this
worktree at all: `tsconfig.json`'s `ignoreDeprecations: "6.0"` is rejected
by the installed TypeScript 5.9.3 (`error TS5103: Invalid value for
'--ignoreDeprecations'`) — a **pre-existing** environment/config mismatch
unrelated to this pass (never touched `tsconfig.json`). Worked around
locally with a CLI-only override (`--ignoreDeprecations 5.0`, never written
to the tracked `tsconfig.json`) to get a real signal, and via the same
`node_modules` symlink described above (removed before finishing).

**Baseline** (this pass's changes fully `git stash`ed, including the new
untracked files): **272 errors.**
**After** (all Locker changes restored): **272 errors — zero delta, and
zero of the 272 lines mention any `services/locker/`, `app/api/locker/`,
`types/locker.ts`, or `tests/locker-*` path** (grepped explicitly). This
pass introduced no new type errors.

---

## Files created / modified

**New migrations:**
`supabase/migrations/20260930055000_qubetalk_group_conversation_compat.sql`,
`supabase/migrations/20260930060000_locker_roomqube_sharepack_schema.sql`,
`supabase/migrations/20260930061000_activity_receipts_locker_action_types.sql`

**New types:** `types/locker.ts`

**New services:** `services/locker/assetRegistry.ts`,
`services/locker/roomQube.ts`, `services/locker/sharePack.ts`

**New routes:** `app/api/locker/assets/route.ts`,
`app/api/locker/assets/[id]/route.ts`,
`app/api/locker/assets/[id]/versions/route.ts`,
`app/api/locker/rooms/route.ts`, `app/api/locker/rooms/[id]/route.ts`,
`app/api/locker/rooms/[id]/placements/route.ts`,
`app/api/locker/rooms/[id]/members/route.ts`,
`app/api/locker/rooms/[id]/conversation/route.ts`,
`app/api/locker/share-packs/route.ts`,
`app/api/locker/share-packs/[id]/route.ts`,
`app/api/locker/share/[token]/route.ts`

**New tests:** `tests/locker-roomqube-sharepack.test.ts`

**Modified (existing files, additive-only edits):**
`services/receipts/activityReceiptService.ts` (9 new `ActivityActionType`
literals), `services/dvn/activityReceiptDvnPipeline.ts` (2 new
`ANCHORABLE_ACTION_TYPES` entries)

**This closeout doc:**
`codexes/packs/agentiq/updates/2026-08-25_locker-roomqube-sharepacks-phase1.md`,
registered in `codexes/packs/agentiq/collections.json` under `col_updates`.

---

## Exact next steps for the orchestrating session

1. Resolve the unrelated-histories problem (§0) before any live-DB step —
   likely: apply this worktree's diff onto an actual `dev` checkout rather
   than attempting `git merge`.
2. Drop `20260930055000_qubetalk_group_conversation_compat.sql` once
   integrated onto a `dev` checkout that already has
   `20260930040000_qubetalk_communications_membrane_domain_substrate.sql`.
3. Apply `20260930060000_locker_roomqube_sharepack_schema.sql` and
   `20260930061000_activity_receipts_locker_action_types.sql` to the target
   Supabase project (neither was applied by this pass — no live credentials
   in this isolated context, per the task's own constraint).
4. Re-point `services/locker/roomQube.ts`'s `openRoomConversation` /
   `inviteRoomQubeMember` / `removeRoomQubeMember` QubeTalk calls at the
   real `services/qubetalk/conversations.ts` / `agentPolicy.ts` helpers once
   available in the integration checkout, in place of the direct
   table-level Supabase calls this pass used (functionally equivalent,
   written to be a mechanical swap — same tables, same columns).
5. Wire `postSharePackToRoom` / `postRoomMessage` against
   `services/qubetalk/egress.ts`'s `sendMessageThroughTransport` (Known
   limitations #1) — the schema (`deliveryChannel: 'qubetalk'`,
   `share_packs.source_roomqube_ids`) is already shaped for this.
6. Phase 2: native-system `AssetResolver` adapters (Qriptopian/Codex/
   IRL/Bridge), ContactGraph-backed membership resolution, `inspectUpload`
   LLM proposal step.
7. UI: Locker panel, RoomQube view, upload/Share Pack composer (Known
   limitations #6).

---

## Addendum — Integration onto `dev`-descended `claude/fs-aee-catalogue-operate-destination` (2026-08-25)

This addendum records what the orchestrating session actually did to bring
the above worktree output onto the real branch, following the "exact next
steps" this doc itself specified.

**1. Unrelated-histories resolution.** Confirmed via `git merge-base` that
the worktree truly shares no ancestor with `origin/dev`. Rather than
attempting any merge, every file was copied verbatim (types, services, API
routes, test file, this closeout doc) directly onto
`claude/fs-aee-catalogue-operate-destination` (itself descended from
`10c04dac5` → `4e9a97684`, the real QubeTalk Communications Membrane +
Publishing/Engagement lineage).

**2. Compat-shim migration dropped.** Per step 2 above,
`20260930055000_qubetalk_group_conversation_compat.sql` was deleted —
`qubetalk_groups`/`qubetalk_conversations` already exist on this branch with
the real, fuller shape.

**3. Schema migration renumbered, not applied as-is.** The worktree's
`20260930060000_locker_roomqube_sharepack_schema.sql` collided with this
branch's own `20260930060000_qubetalk_contact_endpoint_exact_bridge.sql`
(a same-slot filename collision between two independently-authored
migrations, not a semantic conflict). Renamed to
`supabase/migrations/20260930080000_locker_roomqube_sharepack_schema.sql`
(next free slot after this branch's own `...070000`), header comment
rewritten to record the renumbering. Creates `asset_records`,
`asset_renditions`, `roomqubes`, `roomqube_placements`, `roomqube_members`,
`share_packs`, `share_pack_items` — all real FKs into `qubetalk_groups`,
`qubetalk_conversations`, and `personas` (no parallel messaging table, per
the spec's own non-goal). **Not yet applied to any live database** — no
Supabase MCP connection was available during this integration pass; see
"Live application" below.

**4. Activity-receipts migration regenerated, not copied.** The worktree's
own `20260930061000_activity_receipts_locker_action_types.sql` was built
against its local 9-entry `action_type` CHECK constraint and would have
silently wiped ~150 real, live action types if applied as-is (this repo's
convention is a wholesale CHECK-constraint rebuild carrying the FULL current
list forward, never an additive append against a stale baseline). Instead,
a new migration —
`supabase/migrations/20260930090000_activity_receipts_locker_action_types.sql`
— was hand-generated by extracting this branch's real, current 159-entry
list (from its own `20260930070000_qubetalk_publication_execution.sql`) and
appending the 9 new `locker_*` types on top of it. Also **not yet applied
live**.

**5. `ActivityActionType` union and `ANCHORABLE_ACTION_TYPES` hand-merged.**
`services/receipts/activityReceiptService.ts`'s `ActivityActionType` union
gained the 9 `locker_*` literals (inserted between this branch's own
`'qubetalk_publication_projection_published'` and
`'qubetalk_message_agent_sent'` entries — both branches' additions
preserved, neither overwrote the other).
`services/dvn/activityReceiptDvnPipeline.ts`'s `ANCHORABLE_ACTION_TYPES`
gained only the two the worktree itself judged anchorable
(`'locker_share_pack_sent'`, `'locker_roomqube_member_invited'`) — per
CLAUDE.md's DVN Pipeline Protection rule, adding entries to
`ANCHORABLE_ACTION_TYPES` is the one permitted unilateral change to that
file, and no other DVN pipeline logic was touched.

**6. `collections.json` registration carried forward.** One entry added to
`col_updates` for this doc's path; verified as valid JSON after the edit.

**7. A real schema mismatch was found and fixed — not just copied.**
`services/locker/roomQube.ts`'s QubeTalk-group-membership sync code (in
`inviteRoomQubeMember`, `removeRoomQubeMember`, `openRoomConversation`) was
written against the worktree's own narrowed compat-shim shape
(`qubetalk_group_memberships.member_ref text`). The real table on this
branch has `participant_id uuid NOT NULL REFERENCES qubetalk_participants(id)`
— no `member_ref` column exists. Applied as originally written, this code
would have failed at runtime against the real database (Postgres: column
`member_ref` does not exist). Fixed by adding a
`resolveMemberParticipantId` helper built on the existing
`resolveOrCreateParticipantByPrincipalRef` (from
`services/qubetalk/participants.ts`, already used identically elsewhere in
the QubeTalk substrate) to resolve/create the correct `qubetalk_participants`
row from a persona id, and updating all three call sites to insert/query by
`participant_id` instead of the nonexistent `member_ref`. This is the
mechanical swap step 4 above anticipated, done against the real
`resolveOrCreateParticipantByPrincipalRef` helper rather than
`conversations.ts`/`agentPolicy.ts` (which are not required for group
membership rows).

**8. Test file fixed to match the corrected schema.**
`tests/locker-roomqube-sharepack.test.ts` (its own hand-rolled fake Supabase
client, independent of `tests/_lib/fakeSupabase.ts`, confirmed compatible
via its existing `vi.mock('@/app/api/_lib/supabaseServer', ...)` wiring) had
two assertions checking `qubetalk_group_memberships.member_ref` directly.
Both rewritten to resolve the real participant row from
`qubetalk_participants` (via `personaPublicRef(...)` — the same T2-safe
commitment helper used across the QubeTalk substrate) and assert against
`participant_id`. `personaPublicRef` import added.

**9. Verification.**
- `npx vitest run tests/locker-roomqube-sharepack.test.ts` — **19/19 passed**.
- Combined run with the Publishing+Engagement and OCSGA Research Lab test
  files (see below) — **242/242 passed** across 6 files, confirming no
  cross-workstream regression.
- `npx tsc --noEmit -p tsconfig.json` — 679 pre-existing errors (this
  branch's documented baseline, unchanged); zero errors in any file this
  integration touched or added (`grep`-confirmed).

**10. OCSGA Boundary Research integrated in the same pass.** A separate
background agent's OCSGA Boundary Research work (commit `c2c35e536`,
worktree branch `worktree-agent-af38d6127b497bb9e`) was found to share a
real merge-base with this branch (`4e9a97684`, this session's own Publishing
+Engagement commit — that worktree had reset itself to `origin/dev` before
starting, avoiding the unrelated-history problem entirely) and was applied
via a clean `git cherry-pick c2c35e536` — no manual reconciliation needed.
See `codexes/packs/agentiq/updates/2026-08-25_ocsga-boundary-research-invitation.md`
if a dedicated OCSGA doc exists, or the commit message itself for full
detail on that change.

**Deferred, unchanged from the original closeout:** native `AssetResolver`
adapters, ContactGraph-backed membership resolution,
`postRoomMessage`/`postSharePackToRoom` wiring against
`services/qubetalk/egress.ts` (now genuinely buildable against the real
substrate, but not built this pass), `inspectUpload` LLM proposal step, and
all Locker/RoomQube/Share Pack UI. None of these were in Phase 1 scope.

**Live application still pending:** both new migrations
(`20260930080000_locker_roomqube_sharepack_schema.sql`,
`20260930090000_activity_receipts_locker_action_types.sql`) remain
code-complete but not applied to any live database, alongside the
already-committed `20260930070000_qubetalk_publication_execution.sql` from
the Publishing+Engagement pass — all three should be applied together in one
pass once Supabase MCP access is available.
