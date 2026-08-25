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
