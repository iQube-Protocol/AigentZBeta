# ContactGraph — Substrate + QubeTalk Integration (QubeTalk Fast-Follow, steps 2-3a)

**Date:** 2026-09-30 (continues the sequence started by
`2026-08-25_qubetalk-communications-membrane-expansion-build.md`, commit `2c55dceaf` /
`22233d6f9`)
**Governing directive:** operator's "QubeTalk Fast-Follow — ContactGraph + aigentMe First
Deployment" brief (2026-09-30), superseding the earlier Slice 2 (Activation) framing in the
2026-08-25 closeout's §I.

This is the closeout record for **priority step 2** (ContactGraph substrate) and the first half
of **priority step 3** (QubeTalk Participant resolution integrated with ContactGraph) of the
revised activation sequence:

```
1. QubeTalk Foundation (done, 2026-08-25)
2. ContactGraph substrate                         <- this pass
3. aigentMe Full QubeTalk + Contacts projection    <- integration half done this pass;
                                                       aigentMe UI itself is the next increment
4. First real external transport
5. Publishing + engagement through aigentMe
6. Companion Ambient projection
7. Cartridge Contextual projection
```

Per the operator's instruction not to let steps 2-3 become an indefinite backlog item, work
continues directly into aigentMe's People/Conversations surface (step 3, UI half) as the next
increment in this same workstream — this record checkpoints the substrate now because it is a
complete, independently tested unit (schema + services + QubeTalk bridge + reconciliation), not
because the sequence is pausing.

---

## A. Contact reuse audit

Full matrix returned to the operator before any migration was written (reproduced here for the
record). Audited: `persona_contacts` + its two migrations
(`20260622000000_persona_contacts.sql`, `20260622100000_persona_contacts_sources.sql`),
`services/contacts/resolveRecipient.ts`, `app/api/contacts/{csv-import,vcard-import,google-import}/route.ts`,
`app/api/assistant/draft-email/route.ts`, `services/agents/draftEmail.ts`, the deferred Gmail-
correspondence closeout (`2026-08-17_homecoming-closeout-wpc6-gmail-correspondence-deferred.md`),
Slice 1's `qubetalk_participants`/`qubetalk_participant_endpoints`, and the identity spine
(`getActivePersona.ts`, `personas.auth_profile_id`).

| Required contact concept | Existing artifact | Gap | Decision |
|---|---|---|---|
| ContactPerson | *(none)* | `persona_contacts` has no person-level row; each import is a flat leaf | **New**: `contact_persons` |
| ContactPersona | *(none)* | No grouping/labeling layer anywhere | **New**: `contact_personas` |
| CommunicationEndpoint | `persona_contacts` flat email/phone columns + `qubetalk_participant_endpoints` (QubeTalk-owned, no persona layer) | Neither is normalized per-context | **New**: `contact_endpoints`, reusing QubeTalk's confidence vocabulary verbatim |
| ContactCandidate/ObservedCorrespondent | Already-authorized 2026-08-17 plan: a new `persona_contacts.source='gmail_correspondence'` value | The plan already exists and was operator-decided | **Extend `persona_contacts`** (`promotion_state` column), never a second table |
| ContactGroup | *(none)* | Genuinely absent | **Deferred**, recorded as explicit fast-follow (§ Known limitations) — not required for aigentMe People/Conversations |
| Existing `persona_contacts` rows | Flat, owner-persona-scoped address book | Not a gap — an asset | **Reconciled via projection** (`services/contactGraph/reconciliation.ts`), never migrated in place; `persona_contacts` is structurally untouched |
| QubeTalk `qubetalk_participants`/`_endpoints` | Slice 1 substrate | Flat, QubeTalk-owned | **Bridged**: nullable `contact_person_id`/`contact_persona_id` FKs; QubeTalk references ContactGraph, never forks it |
| Platform identity spine | `personas.auth_profile_id` (canonicalized, multi-email-merged) | No "person" concept for *other* people the owner knows | **No spine change** — `contact_persons.owner_auth_profile_id` reuses the existing anchor; `linked_personhood_ref`/`linked_platform_persona_ref` are opt-in FKs to `personas.public_ref`, never a new identity root |

---

## B. Domain mapping — exact persistence/service representation

| Domain concept | Table | Service |
|---|---|---|
| ContactPerson | `contact_persons` (owned by `owner_auth_profile_id` — see §C4 below, not `owner_persona_id`) | `services/contactGraph/contactPersons.ts` |
| ContactPersona | `contact_personas` (FK `contact_person_id`; denormalized `owner_auth_profile_id` for one-hop ownership checks; optional `linked_platform_persona_ref`) | `services/contactGraph/contactPersonas.ts` |
| CommunicationEndpoint | `contact_endpoints` (FK `contact_persona_id`; `normalized_identifier` for exact-match resolution; append-only `link_history` jsonb for provenance — no separate provenance table) | `services/contactGraph/contactEndpoints.ts` |
| ContactCandidate/ObservedCorrespondent | `persona_contacts.promotion_state` (`'candidate'` \| `'confirmed'`, additive column, default `'confirmed'` for backward compatibility) | `services/contactGraph/reconciliation.ts` (`promotePersonaContactCandidate`) |
| ContactGroup | *(deferred — not built this pass)* | — |

---

## C. QubeTalk integration

- **Bridge columns** (additive `ALTER TABLE`, both nullable): `qubetalk_participants.contact_person_id`
  (person-level continuity), `qubetalk_participant_endpoints.contact_persona_id` (which
  persona/context a specific endpoint belongs to) — refinement 1 of the operator's approval,
  implemented exactly as specified: person-level on the participant, context-level on the
  endpoint.
- **Bridge service**: `services/contactGraph/qubetalkBridge.ts` —
  `resolveContactPersonForInboundEndpoint` (exact-match ContactGraph lookup),
  `linkParticipantToContactPerson`, `linkParticipantEndpointToContactPersona`. This is the ONLY
  module that writes the bridge columns.
- **Live wiring**: `services/qubetalk/ingestion.ts`'s participant-resolution step (§11 of the
  QubeTalk domain spec) now tries ContactGraph resolution BEFORE creating a blank unresolved
  participant, when QubeTalk's own directory has no match yet. A ContactGraph hit pre-links the
  new participant and seeds its endpoint at `high_confidence` (real evidence, not yet
  owner-confirmed within QubeTalk); a miss — or an unresolvable owner (e.g. Supabase
  transiently unavailable) — falls back to EXACTLY the prior behavior (a brand-new unresolved
  participant), never throws.
- **C9/NC10 held structurally**: `qubetalk_participants`/`_participant_endpoints` are otherwise
  untouched. No QubeTalk service performs a name-based or fuzzy contact merge; the only new
  identity-resolution call QubeTalk makes is the same exact-normalized-identifier lookup
  ContactGraph itself uses (`resolveEndpointForOwner`).

---

## D. Gmail correspondence

**Schema landed, live extraction NOT implemented — deliberately gated, per §9 of the operator's
brief.**

- Landed: `persona_contacts.source` CHECK extended with `'gmail_correspondence'` (the
  already-authorized 2026-08-17 follow-on), plus `promotion_state`, `interaction_count`,
  `reciprocal`, `first_observed_at`, `last_observed_at`, `promoted_contact_person_id` — all
  additive/DEFAULTed, so every existing row defaults to `promotion_state='confirmed'`
  (nothing already saved becomes a candidate).
- **Not implemented**: no route reads Gmail headers, no OAuth scope change, no
  `ingestGmailCorrespondent`-style ingestion path. This repeats the exact gap the 2026-08-17
  closeout already identified and the operator's brief explicitly told this pass not to resolve
  on its own initiative (§9: "do not infer user consent merely from technically broad OAuth
  scope"; §19 Known limitations below).
- **What's ready for that follow-on**: `promotePersonaContactCandidate(ownerAuthProfileId,
  personaContactId)` is the one path that would turn a future Gmail-derived candidate row into a
  real ContactGraph entry — an explicit, named act, never automatic (satisfies NC3 in advance).
- **Permission state**: unchanged from 2026-08-17. `gmail.compose` + `gmail.modify` are requested
  today; whether `gmail.modify`'s read access is being knowingly used for correspondence
  extraction is still an open, operator-level product decision, not inferred by this pass.

---

## E. aigentMe

**Built in a follow-on pass, same day.** Two new Capsules — `people` and `conversations` — added
to aigentMe's existing Capsule↔Layout contract (`app/triad/components/codex/tabs/
AigentMeWelcomeSplitTab.tsx`'s `CapsuleId` union + `CAPSULE_LAYOUT` map, per CLAUDE.md's own
"aigentMe Capsule ↔ Layout Contract" section), both routed through the mandatory
`engageCapsuleAndMount` gateway from `handleCtaClick` and the copilot quick-prompt strip — never a
parallel activation path.

- **PeopleLayout** (`components/metame/welcome/layouts/PeopleLayout.tsx`) — a self-contained
  two-pane list/detail surface (mirrors `QubeTalkInboxTab`'s own shape rather than threading state
  through the tab's already-large `layoutProps`). List and detail both go through new
  `/api/contactgraph/*` routes → the ContactGraph service layer, never a direct table read. Supports:
  add person, add persona/context, add handle, confirm/reject a handle, reassign a handle between
  personas, mark preferred — the full §12 handle-lifecycle list except deep relationship-history
  threading (deferred, see Known limitations).
- **ConversationsLayout** (`components/metame/welcome/layouts/ConversationsLayout.tsx`) —
  deliberately thin: mounts the EXISTING `QubeTalkInboxTab` (`domainFilter="aigentme"`) inside the
  standard `LayoutShell` chrome, per that component's own "one shared store, filtered per surface"
  discipline and CLAUDE.md's "evolve the existing QubeTalk inbox rather than replacing it
  wholesale." No second messaging surface was built.
- **New API surface**: `GET/POST /api/contactgraph/people`, `GET /api/contactgraph/people/
  [personId]`, `POST /api/contactgraph/people/[personId]/personas`, `POST /api/contactgraph/
  personas/[contactPersonaId]/endpoints`, `PATCH /api/contactgraph/endpoints/[endpointId]`
  (action discriminator: confirm/reject/reassign/setPreferred). Every route: spine-authed
  (`getActivePersona`), resolves `owner_auth_profile_id`, then calls the existing ContactGraph
  service functions — no route contains its own business logic. `GET /people` lazily runs
  `reconcileConfirmedPersonaContacts` before projecting, so the People view shows the operator's
  real, already-saved `persona_contacts` from the very first load.
- **New service additions** (extending, not forking, the existing files): `setPreferredContactEndpoint`
  (`contactEndpoints.ts`, scoped per persona/context) and `listParticipantsLinkedToContactPerson`
  (`qubetalkBridge.ts`, a thin read-only cross-reference for the Person view's Relationship section).

**Entry point, honestly scoped**: both Capsules are reachable today via the client-side quick-prompt
fallback strip (used when no server-driven `primaryCtas` are present) and via
`engageCapsuleAndMount` from anywhere else in the tab. They are NOT yet added to the
server-generated `primaryCtas` list (an NBE/experience-model-driven system this pass did not audit)
— surfacing them there, or in a permanent nav row, is the §18 nav-redesign work the 2026-08-25
closeout already recorded as deferred. "People + Conversations must be real" (§11) is satisfied —
both are fully functional, tested surfaces — without redesigning aigentMe's primary navigation in
the same pass that built the underlying capability.

---

## F. Tests

- `tests/contactgraph-substrate-scenarios.test.ts` (new): **12/12 passed** — Scenario A (person/
  persona/handle organization, reassignment preserves `id`/`firstObservedAt`/prior history),
  Scenario C (ambiguous identity: two similarly-named ContactPersons never merge; confirm/reject
  are explicit acts), reconciliation conservative-backfill discipline (idempotent projection,
  exact-endpoint-match association across two `persona_contacts` rows, NEVER merging on display
  name alone even when identical), the QubeTalk bridge (exact-match resolution, platform
  mismatch never matches), and the contained-capability projection contract (contextual profile
  refuses `scope:'all'`, full profile returns bounded summaries only — asserted structurally by
  confirming the raw endpoint identifier never appears in the serialized result — and denies
  unowned ids explicitly rather than dropping them silently).
- QubeTalk regression (`tests/qubetalk-communications-membrane-scenarios.test.ts`,
  `tests/qubetalk-projection-contract.test.ts`, `tests/qubetalk-peer-channel.test.ts`,
  `tests/qubetalk-confidentiality.test.ts`, `tests/activity-receipts-action-type-parity.test.ts`):
  **72/72 passed, unmodified assertions** — confirms the ContactGraph bridge wiring into
  `ingestion.ts` does not change any existing QubeTalk behavior when ContactGraph has no match
  (the universal case in these tests, which don't seed `contact_*` tables).
- **Combined after the aigentMe follow-on: 87/87 passed** (3 more added: `setPreferredContactEndpoint`
  scoped per persona/context, and `listParticipantsLinkedToContactPerson`/
  `linkParticipantToContactPerson`'s ownership checks for the Person view's Relationship
  cross-reference).
- `npx tsc --noEmit`: zero errors in every file this pass touched or added, including the aigentMe
  follow-on (`PeopleLayout.tsx`, `ConversationsLayout.tsx`, the layout `types.ts`/`registry.ts`
  additions, every new `app/api/contactgraph/*` route, and
  `AigentMeWelcomeSplitTab.tsx` — the latter's 16 pre-existing errors are byte-for-byte the SAME
  errors at shifted line numbers, confirmed by diffing against the pre-change tsc log). **679
  pre-existing errors remain elsewhere**, the identical count the 2026-08-25 closeout recorded.
- Full repo `npx vitest run` (ContactGraph substrate pass): 442/461 files passed, the same 19
  failing files / 48 failing tests the 2026-08-25 closeout already documented as pre-existing and
  unrelated (`repo-weight.test.ts`'s tracked-bytes-budget check spot-verified unrelated — this
  pass's additions are small text/TS files).
- **UI verification**: the dev server was booted against `/triad/embed/codex/metame?tab=aigent-me`
  (the aigentMe embed route). Next webpack-compiled the FULL page — 21,830 modules, including
  `AigentMeWelcomeSplitTab.tsx`'s edits, `PeopleLayout.tsx`, `ConversationsLayout.tsx`, the layout
  `registry.ts`/`types.ts` additions, and the whole `services/contactGraph/*` chain — and returned
  **HTTP 200** with no module/syntax/render error. The only message logged
  ("Bail out to client-side rendering: next/dynamic") is the expected, correct behavior for
  ConversationsLayout's `dynamic(..., {ssr:false})` wrap of `QubeTalkInboxTab` — the same pattern
  the existing Locker-tab mount already uses. `GET /api/contactgraph/people` was also hit directly:
  its full import chain (route → ContactGraph services → `getActivePersona` → 
  `multiEmailIdentity`) compiled and executed cleanly, failing only on `supabaseUrl is required` —
  no live Supabase credentials exist in this sandbox, the same pre-existing environment limitation
  the 2026-08-25 closeout recorded for the whole QubeTalk surface, not a defect in this pass's
  code. **Not verified**: an actual authenticated session driving the People/Conversations
  Capsules interactively (clicking the chip, adding a person, confirming a handle) — that requires
  a live Supabase-backed persona session this sandbox does not have. Stated explicitly rather than
  overclaiming: server-render + compile verified; interactive/data-backed behavior verified at the
  unit-test level (87/87), not via a live click-through.

---

## G. Migrations — exact list requiring application

`supabase/migrations/20260930050000_contactgraph_substrate.sql` — additive/idempotent only
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), no
destructive statement:

- New tables: `contact_persons`, `contact_personas`, `contact_endpoints` (all RLS-enabled,
  deny-all — service-role only, matching `qubetalk_participants`'s convention).
- `ALTER TABLE qubetalk_participants ADD COLUMN contact_person_id` (+ index).
- `ALTER TABLE qubetalk_participant_endpoints ADD COLUMN contact_persona_id` (+ index).
- `ALTER TABLE persona_contacts`: extends `source` CHECK with `'gmail_correspondence'`; adds
  `promotion_state` (DEFAULT `'confirmed'`), `interaction_count`, `reciprocal`,
  `first_observed_at`, `last_observed_at`, `promoted_contact_person_id` (all nullable/DEFAULTed).

No live database is wired for this repo's QubeTalk/ContactGraph surface yet (same as the
2026-08-25 closeout's own finding) — this migration has not been applied to any live environment.

---

## H. Invariants — evidence

| Invariant | Evidence |
|---|---|
| C1 person continuity > endpoint continuity | Scenario A: reassigning an endpoint between two personas of the same person preserves the SAME row id/history — never a new person |
| C2 identifiers belong to personas, personas belong to people | Locked hierarchy `contact_persons -> contact_personas -> contact_endpoints`, enforced by FK cascade |
| C3/NC6 no new personhood root | `linked_personhood_ref`/`linked_platform_persona_ref` are nullable FKs to `personas.public_ref`, set only by an explicit resolution — never inferred (types/contactGraph.ts's own header + migration comments) |
| C4 external correspondents need no Passport | Every ContactPerson/ContactPersona/ContactEndpoint field that would require platform identity is nullable |
| C6/NC2 explicit confidence, never a silent assertion | `addContactEndpoint` defaults `confidence:'unresolved'`; `confirmContactEndpoint`/`rejectContactEndpoint` are the only paths that change it, both requiring an explicit actor | Scenario C's test |
| C7 reassignment re-indexes, never rewrites | `reassignContactEndpoint` is an `UPDATE` on the same row id; `firstObservedAt` and prior `linkHistory` entries proven unchanged in Scenario A's test |
| C8/NC3/NC4 saved vs. observed distinguishable | `persona_contacts.promotion_state` + `contact_endpoints.source` (`gmail_correspondence`/`qubetalk_observed` vs. import/manual sources) |
| C9/NC10 QubeTalk references, never forks | `qubetalk_participants`/`_participant_endpoints` schema and existing service functions untouched; the only new QubeTalk code path READS ContactGraph via `qubetalkBridge.ts`, never writes a competing identity table |
| C13 contained capability | `services/contactGraph/projection.ts` reuses the SAME shared seam as QubeTalk's own (`types/capabilityProjection.ts`) — proven by the projection-contract tests exercising `capability:'contacts'` end to end |
| NC1 no second contact database | `persona_contacts` is structurally untouched; every ContactGraph table is additive; the reuse-audit matrix (§A) traces every new table to a genuine gap |
| NC2 never merge on name alone | Scenario C's test: two ContactPersons with deliberately similar/identical display names but no shared endpoint remain separate through both `createContactPerson` and the reconciliation projector |
| NC3 never silently promote a candidate | `projectPersonaContact` refuses (`code:'not_confirmed'`) any row where `promotion_state !== 'confirmed'`; proven by test |

---

## I. Commit

Pending this record's own commit — see the branch's git log for the exact SHA (this file is
committed in the same push).

---

## Known limitations / explicit future work

1. **aigentMe People/Conversations entry point** — both Capsules are built, tested, and reachable
   via the fallback quick-prompt strip + `engageCapsuleAndMount`, but not yet added to the
   server-driven `primaryCtas`/experience-model chip generation, and not surfaced in a permanent
   nav row (§18's full nav redesign, already recorded as deferred in the 2026-08-25 closeout).
2. **Relationship-history depth in the Person view** — `listParticipantsLinkedToContactPerson`
   surfaces only a count/summary today; deep open-loop/commitment/conversation threading into
   PeopleLayout's Relationship section is deferred to Conversations-side work.
3. **Live Gmail correspondence extraction** — schema-ready, deliberately not implemented; needs a
   separate, explicit OAuth-consent product decision before any header read (§D).
4. **ContactGroup** — deferred, not built. Recorded here as the explicit fast-follow the operator's
   brief requires (never silently dropped, never conflated with QubeTalk's GroupQube).
5. **First real external transport, publishing/engagement, Companion Ambient projection, Cartridge
   Contextual projection** — steps 4-7 of the activation sequence; a parallel agent is promoting
   Discord (step 4) concurrently with this record.
6. **No live database wired** — this migration has not been applied anywhere; same standing
   limitation the 2026-08-25 closeout recorded for the whole QubeTalk surface.
7. **§13 natural-language acceptance** — not implemented this pass. CLAUDE.md's own instruction
   ("do not implement fake NLP routing just to make demos pass") was followed by deferring this
   rather than building a shortcut; it requires auditing the existing Agent intent/action
   architecture first, which this pass did not do.

---

## Addendum — Runtime fan-out (product roles finalized, same day)

**Governing directive**: operator's "Deployment adjustment — do not change track on aigentMe"
(same day). aigentMe's People/Conversations increment was finished and left unchanged; this
addendum fans the SAME ContactGraph/QubeTalk capability into metaMe Runtime as the primary
full-depth communications workbench, per the finalized product roles:

- **aigentMe** — where the operator asks their Agent to communicate (compact, conversational).
- **metaMe Runtime** — where the operator sees, organizes, and manages the full communications
  world that Agent is operating within (full-depth workbench).

Neither owns or forks ContactGraph/QubeTalk state — both are Full consumers of the same contained
capability (C13), proven by construction (same `/api/contactgraph/*` routes, same service layer)
and by a new explicit surface-continuity test.

### Reuse-audit preflight (before writing any Runtime code)

Audited `MetaMeRuntimeClient.tsx`'s `conversationIdRef` — the operator's flagged highest-risk
item — end to end: it is a client-only, per-React-mount `crypto.randomUUID()` held in a `useRef`,
used in EXACTLY ONE place (a fire-and-forget analytics write to `/api/iqube/memory`'s `metadata`
column), never read back anywhere, and never passed to the actual chat inference call
(`/api/codex/chat`). **It has no relationship whatsoever to a QubeTalk `ConversationQube.id`.**
No new Runtime↔QubeTalk conversation-focus association was needed this pass (Runtime's new
workbench doesn't yet need to record "which QubeTalk conversation is this session looking at" as
a durable fact) — but a code comment was added at `conversationIdRef`'s definition explicitly
warning future agents never to conflate the two, and documenting where a genuine association
would go (a separate, explicit field) if one becomes necessary.

Also audited Runtime's existing Share/Invite/Message/Refer surface: `SocialSharingModal` and
`InviteModal` are both content-entity-scoped (share/invite a MyCanvas entry or capsule content),
not person-scoped — there was no pre-existing "Message a person" capability to preserve or
conflict with. The "Message" button already existed with QubeTalk-flavored prompt copy ("Send a
direct message via QubeTalk") but only opened the generic `SocialSharingModal` — genuinely
disconnected from QubeTalk. `SocialSharingModal`/`InviteModal` themselves were left completely
untouched; only the "Message" button's dispatch was reconciled to open the real workbench, and a
new "People" button was added alongside it (both entry points, `Invite`/`Refer` unmodified).

### What was built

**Fan-out, not a fork** — the generalization shape follows this codebase's own established
idiom (confirmed by the same audit pass, mirroring `QubeTalkInboxTab`'s "self-contained component
+ scope prop, reused verbatim by multiple callers" pattern already used elsewhere):

- `components/metame/contactgraph/useContactGraphPeople.ts` (new) — ALL of PeopleLayout's
  data-fetching/mutation logic (load list, load detail, create person, add persona/context, add
  handle, confirm/reject/reassign/mark-preferred an endpoint) extracted into one shared hook.
  Zero JSX. Both consumers below call this SAME hook — never two copies of the fetch logic.
- `components/metame/welcome/layouts/PeopleLayout.tsx` — refactored to a thin presentational
  wrapper over `useContactGraphPeople()`. Visually and behaviorally UNCHANGED (pure extraction,
  proven by the unmodified 17/17 test assertions still passing).
- `components/metame/runtime/RuntimeQubeTalkDrawer.tsx` (new) — the richer Runtime workbench.
  Consumes the SAME `useContactGraphPeople()` hook for its People tab (wider two-column detail
  grid, more breathing room than aigentMe's compact layout) and mounts the SAME
  `QubeTalkInboxTab` (with `domainFilter="runtime"`, the identical reuse pattern
  `ConversationsLayout` already established) for its Conversations tab. Follows this repo's
  existing drawer idiom (`components/iqube/ConnectionsIQubeDrawer.tsx`/`MemoryIQubeDrawer.tsx` —
  fixed backdrop + right-entering panel) rather than aigentMe's Capsule/LayoutShell chrome, matching
  how Runtime's own UI shell already works. SLATE house style throughout (`border-slate-800`,
  `bg-slate-900/40`) — deliberately not copying the residual `border-white/10` pattern present in
  neighboring pre-existing drawer files (out of scope to fix; not introduced fresh here).
- **`MetaMeRuntimeClient.tsx`** — three additive changes only: (1) two new `useState` slots
  (`qubeTalkDrawerOpen`, `qubeTalkDrawerTab`) alongside the existing drawer states; (2) the drawer
  mounted inside the existing `iQubeDrawerLayer` alongside `MemoryIQubeDrawer`/
  `ConnectionsIQubeDrawer`; (3) the existing "Message" button (both mobile and desktop variants of
  the Share dropdown) reconciled to open the workbench's Conversations tab, plus a new "People"
  button opening the People tab — `Invite`/`Refer` and their existing modals untouched.

### Runtime target IA — this increment

Per the operator's explicit "People and Conversations remain the first required operational
views" — both built; Groups/Needs Me/Waiting/Agent Managed/Publishing/Engagement are NOT
attempted this pass (mirrors how aigentMe's own People/Conversations pass scoped itself, and how
the original 2026-08-25 closeout already deferred the equivalent full-IA work for QubeTalk itself).

### Surface continuity — proof

Two new tests in `tests/contactgraph-substrate-scenarios.test.ts`
(`describe('aigentMe <-> Runtime surface continuity...')`):

1. A projection requested with `requestingSurface: 'aigentme'` and one requested with
   `requestingSurface: 'metame-runtime'` against the same underlying data return
   byte-identical results (`toEqual`). An endpoint added as if from Runtime is visible on
   aigentMe's very next read with no synchronization step — and exactly one `ContactPerson` row
   exists throughout, proving no duplicate was created by "switching surfaces."
2. Reassigning an endpoint (as if from Runtime's richer picker) preserves the SAME row id and
   link-history — aigentMe's compact view reads the identical endpoint in its new context.

### Tests / tsc

- **102/102 passing** (17 ContactGraph + 72 QubeTalk regression + 13 Discord transport, the
  latter landed via the concurrent Discord agent's `3cc4dadf`, merged cleanly before this work
  began). 2 of the 17 ContactGraph tests are the new surface-continuity tests above.
- `npx tsc --noEmit`: zero errors in every new/touched file (`useContactGraphPeople.ts`,
  `PeopleLayout.tsx`, `RuntimeQubeTalkDrawer.tsx`). `MetaMeRuntimeClient.tsx` carries 10
  pre-existing errors, confirmed byte-identical (same messages, consistently shifted line numbers)
  against the pre-Runtime-edit baseline — none introduced by this pass.
- **Build verification**: `GET /metame/runtime` against a live dev server returned **HTTP 200**
  (17,968 modules compiled, zero module/syntax/render error) — confirming
  `MetaMeRuntimeClient.tsx`'s surgical edits (new drawer state, the reconciled Message/People
  buttons in both mobile and desktop Share-menu variants, the `RuntimeQubeTalkDrawer` mount, the
  new `User` icon import) integrate cleanly into an already-massive (~6,300+ line) component. Not
  verified: an authenticated session actually opening the drawer and exercising People/
  Conversations interactively — same honest limitation as aigentMe's own build-verification note.

### Known limitations — Runtime fan-out

1. **Deep-link menu-action path not reconciled** — `coerceRuntimeIntent`'s `"share-message"`/
   `"share-invite"` string mapping (used for parent-iframe `postMessage`-driven deep links into
   the Share menu) still produces chat-prompt text rather than opening the workbench directly;
   only the primary visible button click path was reconciled this pass.
2. **Relationship-history depth in Runtime's Person view** — same limitation as aigentMe's own
   Known Limitations #2; `listParticipantsLinkedToContactPerson` still returns a count/summary,
   not full open-loop/commitment threading.
3. **Groups / Needs Me / Waiting / Agent Managed / Publishing / Engagement** — not built in
   Runtime this pass, matching the mandatory-scope-only approach used for aigentMe.
4. **ContactGroup, Companion Ambient projection, Cartridge Contextual projection** — unchanged
   from the prior closeout's own Known Limitations; still not started.

---

## Addendum — Closing the QubeTalk messaging loop end-to-end (Phase 6, same day)

**Governing directive**: operator's "close the QubeTalk messaging loop end-to-end" brief — prove
`person → endpoint → relationship → conversation → policy → external transport` operate as ONE
system, not independently-implemented pieces, then move directly to Publishing + Engagement
without another architecture review.

### Seam audit — the actual gap

Per the operator's framing ("audit the seam, not the architecture"), the substrate, the Discord
transport, and the fan-out UI were all already built and independently tested. The real gap was
one call site: `app/api/qubetalk/peer-channels/[channelId]/messages/route.ts`'s POST handler still
called `postMessage(...)` directly, bypassing `services/qubetalk/egress.ts`'s canonical
`sendMessageThroughTransport` entirely — meaning the one UI-facing send route never ran Agent
policy resolution, transport selection, or provenance/receipt logic. This is the "smallest missing
connection" the brief asked to find; no second parallel send path was introduced, and no
architecture was redesigned. The route now calls `sendMessageThroughTransport` exclusively; GET
(`listMessages`) is unchanged.

### What was built

- **`services/qubetalk/contactResolution.ts`** (new) — `resolveContactPersonForChannel(...)`
  resolves a `passport_peer_channels` counterparty to its ContactGraph `ContactPerson` +
  personas/endpoints, ownership-checked. Documented scope boundary in its header: this only works
  for counterparties who are real platform personas, because `RelationshipQube` itself is
  personhood-bound — see Known Limitations below.
- **`services/qubetalk/egress.ts`** — extended, not forked:
  - `OutboundSendRequest.destination` gained `contactEndpointId` alongside the existing
    `discordChannelId`, resolved via a new `resolveDiscordDestination` helper: ownership-checked
    endpoint lookup → snowflake-direct or invite-code resolution → a clear `endpoint_unresolvable`
    error if neither resolves. **No silent failover** — an unresolvable endpoint fails the send,
    never substitutes a different channel (brief requirement 4).
  - A disclosure gate was inserted immediately after the existing Agent-authority gate: an optional
    `sourceContext` is evaluated against the destination audience via the existing
    `evaluateDisclosure`, and any excluded context item denies the send with `disclosure_denied`
    **before the transport is ever touched** (brief requirement 6/9's confidentiality intersection).
  - Fixed a `type` field that would have been silently dropped when the messages route was
    rewritten to call egress instead of `postMessage` directly — threaded through to both the
    native and Discord `postMessage(...)` call sites so provenance/message-kind metadata is
    preserved identically to the pre-egress route's behavior.
- **`services/contactGraph/contactEndpoints.ts`** — added `getContactEndpointById`, an
  ownership-checked single-endpoint read (denormalized `owner_auth_profile_id`), reused by both the
  new contact-resolution service and the destination resolver — no parallel endpoint-lookup query
  written.
- **`app/api/qubetalk/peer-channels/[channelId]/contact/route.ts`** (new) — GET, membership-checked,
  surfaces a channel's counterparty as a ContactGraph `ContactPerson` for the composer's endpoint
  picker.
- **`app/api/qubetalk/people/[personId]/channel/route.ts`** (new) — POST, resolves-or-creates the
  `passport_peer_channels` relationship for a ContactPerson that has a linked platform persona
  (`linkedPersonhoodRef`); returns `409 not_linked_to_platform_persona` otherwise rather than
  fabricating a relationship for an off-platform contact.
- **`components/composer/QubeTalkInboxTab.tsx`** — extended (shared verbatim by aigentMe and
  Runtime, no fork): a `pendingShareArtifact` prop threads Share → Message content through the
  channel's own existing `/share` route (brief requirement 9 — never a rebuilt sharing path); a
  transport `<select>` in the composer row is populated from the channel's Discord endpoints only
  (other ContactEndpoint platforms are not offered — they are not wired in
  `transportRegistry.ts` and would only ever bounce off egress's honest `transport_not_wired`
  rejection, so the composer doesn't offer a choice that cannot succeed); an `initialChannelId` prop
  lets a caller (Runtime's People panel) land the drawer directly on a specific conversation.
- **`components/metame/runtime/RuntimeQubeTalkDrawer.tsx`** — `RuntimePeoplePanel` gained a
  "Message" button that resolves-or-creates the person's channel via the new `channel` route, then
  switches the drawer to the Conversations tab focused on that channel — proving the
  person→relationship→conversation seam from the Runtime People surface, not just from an
  already-existing conversation list.
- **`components/metame/MetaMeRuntimeClient.tsx`** — three additive changes: (1) a
  `qubeTalkPendingShareArtifact` state resolved from the active capsule's content (deliberately
  **not** falling back to `capsuleContents[0]` the way `share`/`invite` do, matching the brief's
  "if not content-scoped, Message simply enters normal conversation flow" requirement) and passed
  through to the drawer from both Message button variants (mobile + desktop); (2) `"share-message"`
  and `"share-people"` entries added to `DRAWER_ACTION_HANDLERS`, so the `MENU_ACTION` deep-link
  path opens the SAME workbench the in-app button opens, closing the prior increment's own
  Known-Limitation #1 ("deep-link menu-action path not reconciled") — there is now one meaning for
  "Message," not two (brief requirement 10); (3) `Invite`/`Refer` and their existing modals remain
  completely untouched.

### Agent behavior — proof (brief requirement 6)

No special Discord authority path exists: the same `AGENT_POLICY_MODES` gate egress already
enforced for native sends applies identically to a Discord-destined send, before transport
resolution runs. `manual` sends (no acting Agent) succeed unconditionally; `agent_drafts` mode
denies autonomous dispatch exactly like having no policy at all — proven for both destination types
in the new test suite.

### Timeline / write-back — proof (brief requirement 7)

A successful send — native or Discord — writes exactly one `passport_peer_messages` row and one
`qubetalk_events` row. No second synthetic "sent" record is created for the Discord path; the same
egress function and the same canonical write happen regardless of transport.

### Inbound Discord (brief requirement 11)

**Deliberately deferred, not fabricated.** The Discord adapter work (`3cc4dadf`) implemented
outbound send only; no existing inbound/webhook path was found for this increment to wire up.
Per the brief's explicit acceptance criterion ("the acceptance for this increment is real outbound
messaging, not fabricated bidirectionality"), no inbound Discord capability was built or stubbed.

### Tests

New file `tests/qubetalk-messaging-loop-e2e.test.ts` — **14/14 passing**, covering the brief's
acceptance scenarios: ContactPerson+Discord-endpoint resolution (snowflake, invite-code,
clean-failure-on-unresolvable), conversation continuation vs. creation, a structural proof that
`conversationIdRef` is never threaded into any QubeTalk-named call (reusing the prior addendum's
own audit finding as a standing regression guard), Agent policy modes for both transports, the
disclosure gate, one-canonical-record-per-send, aigentMe↔Runtime surface continuity for messages,
and the Share→Message/deep-link convergence.

Full regression suite — **116/116 passing** across
`tests/contactgraph-substrate-scenarios.test.ts` (17),
`tests/qubetalk-communications-membrane-scenarios.test.ts` (16),
`tests/qubetalk-projection-contract.test.ts` (7),
`tests/qubetalk-peer-channel.test.ts` (9),
`tests/qubetalk-confidentiality.test.ts` (37),
`tests/activity-receipts-action-type-parity.test.ts` (3),
`tests/qubetalk-discord-transport-egress.test.ts` (13), and the new file (14).

`npx tsc --noEmit -p tsconfig.json`: **679 errors**, byte-identical to the pre-Phase-6 baseline
confirmed in the prior addendum — zero new errors introduced across every new/touched file.

### Known limitations — messaging loop closure

1. **Off-platform-only ContactGraph contacts have no RelationshipQube home.** `passport_peer_channels`
   is personhood-bound by design — both principals are identified by Polity Public Reference. A
   `ContactPerson` with no `linkedPersonhoodRef` (a real-world contact who isn't yet, or will never
   be, a platform persona) cannot have a QubeTalk relationship/conversation created for them today;
   `POST /api/qubetalk/people/[personId]/channel` returns `409 not_linked_to_platform_persona` for
   this case rather than fabricating one. A synthetic ContactGraph-scoped public reference (same
   sha256/16-hex shape as `personaPublicRef`) was considered as a way to let such a relationship
   exist, but this touches identity-model territory closely enough that it was left as a flagged,
   deferred architectural question rather than built unilaterally under "do not start another
   architecture pass." Surfaced to the operator as a candidate architectural refinement, not
   captured into the CFS-051 pipeline without explicit authorization.
2. **Inbound Discord** — not built this pass; see above.
3. **Non-Discord ContactEndpoint platforms** (email/WhatsApp/etc.) are resolvable by ContactGraph
   but not offered in the composer's transport picker and not wired in `transportRegistry.ts` —
   unchanged scope from the Discord-only transport work.
4. **Groups / Needs Me / Waiting / Agent Managed / Publishing / Engagement** — still not built in
   either surface; Publishing + Engagement is the operator's explicitly named next increment.
5. ~~No live database wired~~ — **superseded**, see the "Live deployment repair" addendum below:
   `20260930040000`/`20260930050000` were applied directly to the linked dev project and verified
   live on 2026-08-25.

---

## Addendum — Live deployment repair + exact-endpoint bridge follow-on (same day)

**Trigger**: live verification on `dev-beta.aigentz.me` surfaced `Could not find the table
'public.contact_persons' in the schema cache` in aigentMe and a 504 loading Runtime's People/
Conversations panels — the application commit had deployed via Amplify, but neither
`20260930040000` (QubeTalk domain substrate) nor `20260930050000` (ContactGraph substrate) had ever
reached the live dev Supabase project. Root cause: `amplify.yml`'s build pipeline builds and deploys
the Next.js app only — it has never run Supabase migrations; that gap is the operator's own
documented manual step elsewhere in this repo (the VL-CT-001 gate comment says as much), not
something CI has ever closed. The `2026-09-30` migration-filename prefixes are a long-standing,
repo-wide convention (57 other migrations share it) and were correctly left unrenamed.

**Repair**: both migrations applied directly to the linked dev project (`bsjhfvctmduxhohtllly`) via
the Supabase MCP connector, in dependency order, after confirming their preconditions live (the
`personas.public_ref` unique index existed; the live `activity_receipts_action_type_check`
constraint matched exactly the pre-state both migrations assume, so the wholesale rebuild was safe).
Verified live: all 15 new tables, both bridge columns, the six new `passport_peer_messages`
columns, and the rebuilt constraint — via direct SQL AND a live `GET /rest/v1/contact_persons`
PostgREST probe after `NOTIFY pgrst, 'reload schema'` (HTTP 200), proving the schema-cache error
itself was resolved, not just the underlying tables.

**Prevention**: extended the existing `GET /api/ops/dvn/migration-ledger` diagnostic (Horizen Pilot
Closure precedent, 2026-08-09 — reused rather than forked) with the same live-table-probe discipline
for the QubeTalk + ContactGraph substrate. Commit `b1da3ecf`.

**Contact-count discrepancy (51 vs 57)** — investigated per the operator's explicit request not to
assume a lost-import defect. `persona_contacts` held exactly 51 `google_contacts` rows for the
operator's persona, matching the UI. Reading `app/api/contacts/google-import/route.ts`: the response
is `{imported, skipped, total}`, rendered as `"{imported} imported, {skipped} skipped ({total}
total)"`; rows lacking `display_name`/`email`/`phone` are filtered before insert. The numeric match
(51 stored = 51 successfully upserted; 57 = raw Google `total`; 6 = the filtered delta) is the
code-evidenced explanation — not confirmed by re-running the import (no live Google OAuth context in
this session), but not a guess either.

### Exact-endpoint bridge follow-on (`20260930060000`)

The original ContactGraph↔QubeTalk bridge (`20260930050000`, refinement 1) links a
`qubetalk_participant_endpoint` to the ContactGraph CONTAINER it resolved into
(`contact_persona_id -> contact_personas.id`) — correct for "which context/persona" but not precise
enough to say which of that persona's endpoints it actually is. `20260930060000` adds
`qubetalk_participant_endpoints.contact_endpoint_id -> contact_endpoints.id` alongside it (both kept,
per the operator's explicit "keep the existing contact_persona_id if useful" — the coarser column
still answers "which persona/context" without a join before a specific endpoint is resolved).

Wired into the one real call site: `resolveContactPersonForInboundEndpoint`
(`services/contactGraph/qubetalkBridge.ts`) now returns `contactEndpointId` alongside
`contactPersonId`/`contactPersonaId` (the value was already available from
`resolveEndpointForOwner`'s return — just not previously surfaced), and
`services/qubetalk/ingestion.ts`'s inbound-endpoint-creation path persists it onto the new
`qubetalk_participant_endpoints` row. `linkParticipantEndpointToContactPersona` gained an optional
third `contactEndpointId` param (additive; its zero existing callers are unaffected).
`migration-ledger` extended to probe the new column.

**Not yet applied to live dev** — Supabase MCP disconnected from this session partway through Phase
6 (confirmed via `ListConnectors`/`ToolSearch`, the same "connected but `enabledInChat: false`"
failure mode CLAUDE.md's Session Start section documents) and did not reconnect before this
increment closed. The migration file, service-layer wiring, and test coverage are complete and
tsc/test-verified; applying `20260930060000` to the live dev project — and the operator's requested
live spot-check of the lazy-reconciliation output — are the one explicitly open item carried out of
this increment, not a silent gap. Exact SQL and verification queries were handed to the operator
directly in-session.

**Live Discord verification** — this sandbox holds no `DISCORD_BOT_TOKEN` or any live Discord
session; confirmed `services/qubetalk/transportRegistry.ts` registers Discord as genuinely wired
(`group.send`/`identity.lookup`: `'restricted'`, gated on `DISCORD_BOT_TOKEN`, not a stub) and the
13/13 Discord egress tests pass against a faked HTTP boundary — that is the ceiling of what this
session could verify. An actual live send needs to be performed by the operator through the deployed
UI; this session can verify its result server-side (one `passport_peer_messages` row, one
`qubetalk_events` row) once Supabase MCP is reachable again or the operator reports back.

**Runtime→aigentMe live north-star** — the code path (`RuntimePeoplePanel`'s "Message" button →
`POST /api/qubetalk/people/[personId]/channel` → same channel id opened in both
`RuntimeQubeTalkDrawer` and `QubeTalkInboxTab` via `initialChannelId`, no sync/copy layer) is built
and unit-tested (surface-continuity tests in `tests/contactgraph-substrate-scenarios.test.ts` and
`tests/qubetalk-messaging-loop-e2e.test.ts`), but an authenticated, live cross-surface walkthrough
requires the operator's own browser session — this sandbox cannot authenticate as the operator.
