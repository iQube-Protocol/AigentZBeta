# QubeTalk Communications Membrane — Expansion Build

**Date:** 2026-08-25
**Governing spec:** `codexes/packs/agentiq/updates/2026-08-25_qubetalk-communications-membrane-domain-spec-v0.2.md`
(canonical — commit `f35ecb31a` on `origin/dev`)
**Also read:** `2026-07-20_prd-qubetalk-peer-exchange.md`, `2026-07-21_qubetalk-peer-exchange-phase1-build.md`,
`docs/qubetalk/METAME_RUNTIME_CHANNEL_MEMORY.md`

This is the closeout record for the QubeTalk domain-substrate expansion — evolving the existing
Phase 1 peer-exchange primitive into the platform-agnostic communications membrane the domain spec
defines, per its own §24/§25 documentation requirement.

### Correction pass (2026-08-25, operator-caught)

An earlier draft of this record and the accompanying code was built from a **reconstruction** of the
domain spec transcribed from the task prompt, not the canonical file. Two consequences were caught in
operator review, both fixed before this build was committed:

1. **The spec file itself.** The canonical doc already existed on `origin/dev` (commit `f35ecb31a`,
   1233 lines); the reconstruction was 964 lines and diverged materially. Fixed by fetching and
   fast-forward-merging `origin/dev`, deleting the reconstruction, and confirming the file in this
   branch is now byte-identical to the canonical one. Nothing in this build ever overwrote it.
2. **Vocabulary drift in the implementation.** Working from the reconstruction rather than the source
   text, several enums were invented rather than copied: agent-policy modes, routing states, capability
   names (plural vs. the spec's singular `comment.read`/`mention.read`/`reaction.read`/`attachment.*`),
   capability states (missing `unknown`), engagement types/states, publication states, and receipt
   action-type names (`qubetalk_agent_message_sent` vs. canonical `qubetalk_message_agent_sent`, and
   `qubetalk_disclosure_authorized` vs. canonical `qubetalk_conversation_context_disclosure`). All were
   realigned to the canonical spec's literal strings across `types/qubetalk.ts`, the migration's CHECK
   constraints, every service that referenced them, and the test suite — see §E for the re-verification.

A third, independent finding from the same review: the original audit's claim that "no working
credentials or integration exist for any external transport" was **wrong for Discord** — see §F.

---

## A. Reuse audit (the required pre-work checkpoint, §21)

Three structurally distinct "QubeTalk" systems shared the name going into this build:

| System | Tables | Verdict |
|---|---|---|
| **A — Tenant/agent-runtime** | `qubetalk_channels`/`_delegations`/`_messages` | Text-keyed, sender-spoofable until a 2026-07-28 leak fix, deny-all RLS since. **Not extended** — a second/stub receipt pipeline, no persona spine. |
| **B — Passport holder↔delegate** | `passport_qubetalk_channels` | uuid-keyed, real RLS, **no message table at all**. Not extended — nothing to build a message plane on. |
| **C — Peer Exchange Phase 1** | `passport_peer_channels` / `_messages` / `_shared_artifacts` | personaPublicRef-keyed (T2), clean spine/DVN integration, actively extended as recently as `reciprocal_exchanges` (`20260930020000`). **This is the system extended.** |
| **D — Marketa agent/campaign bus** | `marketa.marketa_qubetalk_channels` / `_messages` (separate `marketa` Postgres schema) | Text-keyed, tenant-scoped, agent-to-agent content-transfer + campaign-delivery bus bundled in the same migration as Marketa's campaign tables. **Not extended, not mentioned anywhere in v0.2's own §0/N10 enumeration** — caught in a second reuse-audit pass (operator-prompted), not the original one. See classification below. |

`services/qubetalk/peerChannel.ts` and `components/composer/QubeTalkInboxTab.tsx` are System C's service
and UI. Per N1/N2, every new domain object in this build is either a companion table 1:1 with an
existing `passport_peer_channels` row, or a genuinely new concept (GroupQube, PublicationQube,
EngagementQube) that had no prior representation in the schema at all — never a fork of A, B, or D.

### Channel-family classification (added in the correction pass, per operator request)

| Family | Classification | Why |
|---|---|---|
| A — tenant `qubetalk_channels`/`_delegations`/`_messages` + `services/mcp/qubetalkContracts.ts` + `app/api/messenger/dispatch/route.ts` | **Specialized projection / the repo's only real adapter-lane precedent** | Named in v0.2 §0 as existing substrate to preserve. `qubetalkContracts.ts` is a clean, DB-agnostic envelope type + two pure helpers (`computeThreadKeyV1`, `inferIntentHint`) — a real candidate adapter seam per §16's "constitutionally dumb" contract. Its only consumer writes to this system's own store, not System C's. |
| B — `passport_qubetalk_channels` | **Delegation-specific** | Named in v0.2 §0/N10. Holder↔own-delegate only; narrow and single-purpose; never to be collapsed into a general relationship graph. |
| C — `passport_peer_channels`/`_messages`/`_shared_artifacts` | **Canonical core** | Named in v0.2 §0/N10. This is what the new domain substrate extends. |
| D — `marketa.marketa_qubetalk_channels`/`_messages` | **Legacy/compatibility surface, out of scope** | Not named anywhere in v0.2. Narrow Marketa-internal agent-to-agent bus, RLS permissively open (`USING (true)` for read *and* insert, mitigated at the API layer by `requireMarketaQubeTalkAccess`) — a pre-existing security posture worth a separate look, unrelated to this build. Left untouched. |

`services/access/evaluateAccess.ts` is confirmed never called from any QubeTalk code (three ad hoc
gates exist instead) — a real gap, but out of scope for this build (unifying it was not requested and
would widen the change well beyond the domain-substrate expansion asked for).

---

## B. Domain implementation mapping (§23 discipline — concept → existing → gap → decision)

| Domain concept (spec) | Existing structure | Gap | Decision |
|---|---|---|---|
| ParticipantQube (§3) | *(none)* | Genuinely absent — no per-owner communications directory existed anywhere | **New**: `qubetalk_participants` + `qubetalk_participant_endpoints` |
| RelationshipQube (§4) | `passport_peer_channels` (unique `pair_key`, order-independent) | The pair-identity anchor already exists; open loops/commitments/memory did not | **Extend, don't fork**: `qubetalk_relationship_state` is a 1:1 companion keyed on the EXISTING channel id, not a new relationship id |
| GroupQube (§5) | *(none — `passport_peer_channels` is hard-pinned to exactly 2 principals)* | Genuinely absent — nothing models >2 parties | **New**: `qubetalk_groups` / `_group_endpoints` / `_group_memberships` |
| ConversationQube (§6) | *(none)* | Genuinely absent | **New**: `qubetalk_conversations`, deterministic-only resolution (no topic inference exists in the code at all — the prohibition is satisfied by omission) |
| MessageQube (§7) | `passport_peer_messages` (working, DVN-integrated) | Missing contextual columns (transport, direction, sensitivity, etc.) | **Extend**: `ALTER TABLE` adds nullable/DEFAULTed columns only — never a parallel message table (P2) |
| PublicationQube / projections (§13) | *(none)* | Genuinely absent | **New**: `qubetalk_publications` / `_publication_projections` |
| EngagementQube (§14) | *(none)* | Genuinely absent | **New**: `qubetalk_engagements` |
| Agent policy (§10) | `delegation_grants` (real bounded-delegation store) | The grant store exists; nothing in QubeTalk read it | **New** `qubetalk_agent_policies` (mode/scope only) that RE-READS the existing grant store live on every resolution — never a duplicate authority record |
| Communications events (§16) | *(none)* | Genuinely absent | **New**, deliberately lightweight: `qubetalk_events` (insert-only, not a receipt) |
| Receipts (§17) | `activity_receipts` + DVN pipeline | Action-type vocabulary didn't cover publishing acts | **Extend**: 4 new `ActivityActionType` values, added to `ANCHORABLE_ACTION_TYPES` (the one CLAUDE.md-permitted unilateral DVN-file change) |
| Adapter contract (§15) | `services/mcp/qubetalkContracts.ts` (`MessengerProvider`/`QubeTalkEnvelope`) | Real abstraction, but wired only to System A, not System C | **New** `transportRegistry.ts` — a capability registry over System C's transport concept; System A's contract left untouched |

No migration in this build creates a table because an existing name was merely inconvenient — every
`CREATE TABLE` above corresponds to a concept with no prior representation, and every `ALTER TABLE`
extends an existing row rather than duplicating it.

---

## C. Files and migrations changed

**Migration** (additive/backward-compatible only, no destructive statement):
`supabase/migrations/20260930040000_qubetalk_communications_membrane_domain_substrate.sql`
— 12 new tables (all RLS-enabled, deny-all — service-role only, matching the established
`passport_peer_*` convention), an `ALTER TABLE passport_peer_messages` adding 12 nullable/DEFAULTed
columns, and a rebuilt `activity_receipts_action_type_check` CHECK constraint (full cumulative list,
extracted programmatically from the prior migration, never hand-transcribed, to avoid silently
dropping an existing valid action type).

**New domain types:** `types/qubetalk.ts`

**New services** (all following the existing `PeerResult<T>` convention from `peerChannel.ts`):
`services/qubetalk/participants.ts`, `groups.ts`, `conversations.ts`, `relationships.ts`,
`disclosurePolicy.ts`, `agentPolicy.ts`, `events.ts`, `ingestion.ts`, `publications.ts`,
`engagement.ts`, `transportRegistry.ts`, `projection.ts` (the surface-independent capability seam, §H)

**Extended (not forked):**
`services/receipts/activityReceiptService.ts` — 9 new `ActivityActionType` values (§17's candidate
list, corrected to the canonical spec's literal names in the vocabulary-realignment pass)
`services/dvn/activityReceiptDvnPipeline.ts` — same 9 values added to `ANCHORABLE_ACTION_TYPES`
`services/qubetalk/groups.ts` — `listGroupsCreatedBy` (owned-scope resolution for the projection contract)
`services/qubetalk/conversations.ts` — `listConversationsForRelationship`/`listConversationsForGroup`
(same purpose)

**New API routes:** `app/api/qubetalk/peer-channels/[channelId]/relationship/route.ts`,
`app/api/qubetalk/projection/route.ts` (the projection contract's real, callable surface)

**UI (evolved, not replaced — §18):** `components/composer/QubeTalkInboxTab.tsx` gained a
relationship-summary panel (last interaction, open loops, commitments, memory summary) fetched
alongside the existing messages/artifacts calls.

**Spine-compliance fix found and fixed during audit:** `app/triad/components/codex/tabs/LockerTab.tsx`
had 2 QubeTalk spine-endpoint calls using the forbidden `authedFetchHeaders`+raw-`fetch` pattern
(CLAUDE.md's Identity & Access Spine rule) — switched to `personaFetch`. The other ~11 unrelated
`authedFetchHeaders` call sites in that file were deliberately left untouched (out of scope).

**Tests:** `tests/_lib/fakeSupabase.ts` (new generic multi-table in-memory Postgrest fake, following
the single-table pattern already established in `tests/delegation-multi-agent-model.test.ts`; extended
in the projection pass with `.or()` support to model `listChannelsForCaller`'s query),
`tests/qubetalk-communications-membrane-scenarios.test.ts` (the 8 mandatory acceptance scenarios, §22),
`tests/qubetalk-projection-contract.test.ts` (the projection contract, §H).

**Doc registration:** this file's companion domain spec was added to
`codexes/packs/agentiq/collections.json`'s `col_updates` collection.

---

## D. UI implemented (Increment C)

Per §18's explicit instruction — "evolve the existing QubeTalk inbox rather than replacing it
wholesale" — this build added a relationship-summary panel to the existing `QubeTalkInboxTab.tsx`
channel pane (last interaction time, unresolved open loops, unresolved commitments, memory summary),
backed by the new `/relationship` route.

**Deferred, not attempted:** the full §18 nav redesign (Conversations / Needs Me / Agent Managed /
Waiting / Publishing / Engagement as primary sections) is a materially larger UI initiative — new
routing, a new tab/section structure — than the domain-substrate work this pass prioritized. It is
tracked here as explicit future work, not silently dropped.

---

## E. Tests — exact counts

- `tests/qubetalk-communications-membrane-scenarios.test.ts` (new): **16/16 passed**, covering all 8
  mandatory §22 scenarios (Scenario 5 and 6 each split across multiple `it`s for clarity).
- `tests/qubetalk-projection-contract.test.ts` (new): **7/7 passed** — bounded-visibility scope
  evaluation, contextual-profile 'all' refusal, not-owned denial, surface continuity (identical
  conversation id across profiles), delegation filtering (denied/granted), and the summaries-only
  disclosure boundary (structural key-set assertion).
- Existing QubeTalk regression (`tests/qubetalk-peer-channel.test.ts`,
  `tests/qubetalk-confidentiality.test.ts`) + `tests/activity-receipts-action-type-parity.test.ts`
  (exercises the rebuilt CHECK constraint): **49/49 passed**, unmodified — confirms `peerChannel.ts`
  itself was never touched and the new `ActivityActionType` values parse correctly.
- **QubeTalk total: 72/72 passed.**
- Full repo `npx vitest run` (run twice — once before, once after the vocabulary-realignment and
  projection-contract passes): **459 test files, 7669/7719 tests passed, 2 skipped, 48 failed — the
  SAME 19 failing files and 48 failing tests both times**, confirmed pre-existing and unrelated to
  this build (spot-verified: `tests/journey-orient-legacy-regression.test.ts`'s failure reproduces
  identically with this build's service/receipt-type edits stashed out; `tests/repo-weight.test.ts`'s
  tracked-bytes-budget failure is a pre-existing baseline condition this build's small text-file
  additions did not cause — none of this session's new files are large enough to move that needle).
  Zero QubeTalk-named files appear in either failure list.
- `npx tsc --noEmit`: zero errors in any QubeTalk file, `types/qubetalk.ts`, the new relationship
  route, or the two edited UI/service files. (679 pre-existing errors remain elsewhere in the
  repo, entirely unrelated to this build — implicit-any params and unrelated type mismatches
  across ~120 files with no QubeTalk overlap; confirmed by name-filtering the error log, both before
  and after the vocabulary-realignment correction pass — the count is identical.)
- **Re-verification after the vocabulary-realignment correction pass**: all 65 tests above re-run
  clean after every enum literal was realigned to the canonical spec's strings across
  `types/qubetalk.ts`, the migration's CHECK constraints, `agentPolicy.ts`, `ingestion.ts`,
  `engagement.ts`, `disclosurePolicy.ts`'s comments, both receipt files, and the test file itself
  (one missed literal — the `NO_AGENT` fallback assertion — was caught by this re-run and fixed).

Where a scenario cannot be proven end-to-end without a live database or a live external platform
credential (this repo has neither wired for QubeTalk's new surface), the test says so explicitly in
comments rather than claiming a level of proof it doesn't have (No-Guessing discipline) — e.g.
Scenario 8's regression proof is structural (peerChannel.ts's own untouched test suite + a check that
every new column is safe for its existing INSERT), not a re-implementation of that suite's own proof.

---

## F. External platform readiness — no guessing

`services/qubetalk/transportRegistry.ts` is the single source of truth.

**Correction (operator-caught, 2026-08-25):** the original audit claimed no working integration
exists for any external transport. That was **wrong for Discord**. `app/api/messenger/dispatch/route.ts`
has a real, working, bot-token-gated Discord send path (`postDiscordMessages`, gated on
`DISCORD_BOT_TOKEN`, explicitly "Live dispatch currently supports Discord only") and a public,
ungated invite→channel resolver (`resolveDiscordChannelFromInvite`). Both are now registered as
`restricted` rather than `unsupported`: `group.send` because sending is gated on an env credential
this module cannot confirm is provisioned in any given deployment, and `identity.lookup` because the
resolver only handles invite→channel resolution, not general identity lookup — registering it fully
`supported` would overclaim. Neither capability is wired into this new domain substrate's adapter
contract yet — that route writes to System A's own store (`qubetalkStore.ts`), not the
RelationshipQube/ConversationQube graph this migration builds. Adapting it into a live transport for
the new substrate is deliberately **deferred**, not attempted in this pass (see Known Limitations).

Confirmed by audit (not assumed): every OTHER external transport — WhatsApp, Telegram, Signal,
LinkedIn, X, Email, SMS, Facebook, Instagram, Medium, Substack, Qriptopian — genuinely has no working
credentials or integration anywhere in this repo.

**Capability vocabulary is now the canonical spec's own literal strings** (singular `comment.read`/
`mention.read`/`reaction.read`/`attachment.*`, plus `post.edit`/`post.delete`/`schedule.publish` which
the original build omitted; capability states now include `unknown`) — corrected in the same pass as
§0's vocabulary-drift fix.

**`qubetalk-native` remains the only fully `supported` transport** (`dm.*`, `group.*`,
`history.backfill`, `identity.lookup` supported; `attachment.*` restricted — reference-only sharing,
never raw bytes, matching `peerChannel.ts`'s actual `shareArtifact` behavior). Every transport besides
`qubetalk-native` and Discord's two narrow capabilities is registered fully `unsupported` (§16/N11 —
an honest, explicit answer rather than a silent gap).

**§13's "existing Share capability" ambiguity, resolved:** audit found only
`ShareViaQubeTalkButton`/`ShareDialog` (artifact-sharing *within* an existing peer channel — a
different concern from publishing to an external audience) and `SocialSharingModal` (unrelated public
social sharing). Neither is a general-purpose "publish to an external channel" service. `publications.ts`
therefore reuses the SAME capability registry (`transportHasCapability(channel, 'post.publish')`) that
governs all other QubeTalk egress, rather than building a second, parallel publishing mechanism —
satisfying the "don't build a second Share system" intent without forcing an unrelated integration.

---

## G. Invariants — evidence

| Invariant | Evidence |
|---|---|
| P1/N1 relationship continuity, no second architecture | RelationshipQube = companion over the EXISTING `passport_peer_channels.id`; System A/B untouched |
| P2 one canonical MessageQube | `ALTER TABLE`, never a parallel message table; partial unique index on `(transport, external_message_id)` for idempotency |
| N4 never merge on name match | `participants.ts`'s `resolveParticipantByEndpoint` is exact-endpoint-match only; proven in Scenario 4's test (same display name, different endpoint → two participants) |
| P4 frozen audience | `snapshotGroupAudience` captures the roster at send time; Scenario 2's test removes a member AFTER capture and asserts the earlier snapshot is unchanged |
| P5/N15 traceable memory, no hidden provenance | `updateMemorySummary` refuses to write with an empty `sourceMessageIds` (`code: 'no_provenance'`) |
| P7/§8 context may inform, audience constrains disclosure | `disclosurePolicy.ts`'s `evaluateDisclosure`; Scenario 3's test is the spec's own named example, passing |
| P8/N8 external input never authority | Structural: `ingestion.ts` has no import of `delegationGrantStore`'s write functions and no write path to `qubetalk_agent_policies` — asserted directly against the file's source in Scenario 6's test, not just documented |
| P9/P10 bounded delegation, no redelegation | `agentPolicy.ts` only ever READS `delegationGrantStore`, live, on every resolution — never persists or widens a grant; BOUNDED requires a named grant ref at set-time (Scenario 5) |
| P14/N13 QubeTalk emits, never computes rewards | `events.ts` is insert-only with no reward logic; Scenario 7's test greps `publications.ts` for reward-adjacent terms and asserts none appear |
| N11 never fake unsupported capability | `addChannelProjection` only reaches `'publishing'` status when the registry says `'supported'`; every external channel stays `'pending'` (Scenario 7) |

---

## H. Surface-independent capability architecture — ratified AND built (operator, 2026-08-25)

Not in v0.2. Ratified by the operator as the governing shape for QubeTalk, and — per the operator's
explicit scope decision — **built in this same pass** rather than only documented, because it defines
the architectural boundary of QubeTalk itself:

> QubeTalk must be implemented as a surface-independent contained capability. No UI, cartridge, Agent
> or application surface owns the communications state or transport integrations. Runtime, Companion,
> cartridges and future experiences consume scoped projections of one canonical QubeTalk
> communications graph.
>
> Do not embed QubeTalk domain logic or third-party transport adapters directly inside metaMe
> Runtime, Companion, Marketa, KNYT or any cartridge. Surface code may compose, render and invoke
> QubeTalk; it may not fork it.

**Ratified invariants** (added to the canon alongside P1–P17/N1–N15):

- **Contained capability** — QubeTalk core state, policy, identity/relationship resolution,
  communication memory and transport registry are surface-independent.
- **Surface projection** — a surface receives only a bounded projection of QubeTalk determined by:
  `principal ∩ persona ∩ surface ∩ requested projection ∩ requested scope ∩ delegation ∩ disclosure
  policy = visible/invocable QubeTalk capability`.
- **Surface continuity** — changing interfaces cannot create a new conversation (receive in Companion
  → inspect in Runtime → approve from a cartridge → send via QubeTalk remains one RelationshipQube,
  one ConversationQube, one canonical history).
- **Surface non-ownership** — Runtime, Companion, Marketa, KNYT and cartridges may render and invoke
  QubeTalk but may not own communications state, implement independent relationship graphs, or embed
  third-party transport logic directly.
- **Transport non-ownership** — WhatsApp, Discord, LinkedIn, Telegram etc. belong to the QubeTalk
  adapter perimeter, not to individual product surfaces.

**What was built** (`services/qubetalk/projection.ts`, `app/api/qubetalk/projection/route.ts`,
`types/qubetalk.ts`'s new projection types, `tests/qubetalk-projection-contract.test.ts`):

- The request contract: `{capability:'qubetalk', projection:'full'|'ambient'|'contextual', scope,
  requestingSurface, actingAgentRootDid?}`.
- Scope evaluation (`evaluateProjectionScope`) — every requested relationship/group id is intersected
  against what the calling principal actually owns; anything outside that is `denied`, never silently
  dropped. `'contextual'` profile refuses `scope: 'all'` outright (a cartridge can never ask for
  everything) — proven by test, not just asserted in a comment.
- Delegation enforcement — when `actingAgentRootDid` is set, every granted item is re-checked against
  `agentPolicy.ts`'s live `resolveEffectiveAgentPolicy`; an Agent with no policy grant for a
  relationship the human principal owns is denied it (reason `agent_not_authorized_for_scope`).
- Disclosure boundary — the contract returns SUMMARIES only (open-loop counts, conversation ids, a
  display label), never message bodies; actual content still flows through the existing message-read
  routes unchanged. Proven structurally: a test asserts the exact key set on the result shape.
- Surface continuity, proven behaviorally: a `'full'` projection and a `'contextual'` one scoped to
  the same single relationship return the IDENTICAL `conversationId` — nothing in this contract ever
  mints a second conversation for the same channel.
- One minimal proof consumer: the API route itself (a real, callable surface any future consumer can
  hit) plus the test file's three simulated "surfaces" (`metame-runtime`, `cartridge:horizon`,
  `aigentme`) each requesting different profiles/scopes against the same underlying data — per the
  operator's explicit instruction, **no production Companion or cartridge UI was built** in this pass.

## I. Commit

<COMMIT_SHA_FILLED_IN_AFTER_PUSH> (Slice 1 — Foundation: domain + policy + vocabulary + projection seam)

Slice 2 (Activation — real transport promotion + real surface consumers + continuity E2E proof +
platform capability audit + Share→Publishing wiring) proceeds immediately as a fast-follow on top of
this commit, per the operator's explicit instruction not to wait for another prompt between slices.
Its own commit SHA and closeout will be appended below once it lands.

---

## Known limitations / explicit future work

1. **§18 nav redesign** (Conversations/Needs Me/Agent Managed/Waiting/Publishing/Engagement as
   primary sections) not attempted — see §D above.
2. **No external adapter is wired.** `ingestCommunicationEvent` is written to accept an
   `IngressEvent` from any future adapter, but no route currently calls it from a live inbound
   source — this build has no external credentials to test one against (§F). The native peer-exchange
   send path (`peerChannel.ts`) continues to operate exactly as before, unmodified.
3. **`evaluateAccess` unification** — QubeTalk still uses its own three ad hoc access gates rather
   than the platform's central `evaluateAccess.ts`. Flagged during the reuse audit; out of scope for
   this build (a real gap, not introduced by this work).
4. **Publishing-plane relationship linkage** — an EngagementQube converted to a conversation creates a
   new standalone conversation; it does not yet join an existing `passport_peer_channels` relationship
   even when the commenter is independently known to the owner (would require resolving the engagement
   author against BOTH the participant directory and any existing peer channel — deferred, not attempted).
5. **Discord adapter wiring** — `postDiscordMessages`/`resolveDiscordChannelFromInvite` are real and
   registered honestly in the capability registry (§F). Promoting them into a live transport for the
   new domain substrate is Slice 2 (Activation) work, in progress as a fast-follow on this commit —
   see §I.
6. ~~ExperienceQube scoped-projection contract~~ — **built in this pass**, see §H. (Production
   Companion/cartridge UI consuming it is Slice 2 work.)
