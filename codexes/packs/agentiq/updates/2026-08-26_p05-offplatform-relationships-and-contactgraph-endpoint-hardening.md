# P0.5 off-platform relationships (full widening) + ContactGraph endpoint-projection hardening

**Status:** Code-complete and pushed to `dev`. Live-database work referenced below (the ContactGraph
endpoint repair) was performed separately, directly against the live Supabase project, **outside this
coding session** — this document covers only the repository-side code that matches and hardens it.

**Branch:** `claude/fs-aee-catalogue-operate-destination` → merged to `dev` via the auto-merge workflow.

**Commits:** `6ed53a504` (P0.5 first pass), `e9dfea9d5` (P0.5 full widening), `efee2c707` (ContactGraph
reconciliation hardening).

---

## 1. P0.5 — off-platform relationship continuity

### The gap

`passport_peer_channels` is personhood-bound by construction — both principals are identified by a
real Polity Public Reference. `POST /api/qubetalk/people/[personId]/channel` therefore 409'd for any
ContactGraph `ContactPerson` with no linked platform persona, leaving the People tab's "Message"
action a dead end for the majority-common case of an off-platform contact.

### Operator-ruled architecture

Sibling relationship object, not a discriminator on `passport_peer_channels` — a new
`qubetalk_offplatform_relationships` anchor table, exposed through the SAME `RelationshipQube`
service surface as the platform-peer-channel case. `passport_peer_channels` itself is untouched.

### What shipped (two passes, second pass closing gaps found by code review)

- **Owner integrity at the DB level** — `qubetalk_offplatform_relationships.contact_person_id` is
  bound by a composite FK to `contact_persons (owner_auth_profile_id, id)`, not a plain single-column
  FK — Postgres itself refuses a row claiming ownership of someone else's ContactGraph contact.
- **Safe PK migration** for `qubetalk_relationship_state` — a real `id` column takes over as primary
  key (backfilled before being constrained `NOT NULL`), `channel_id` becomes nullable, an XOR CHECK
  (`num_nonnulls(channel_id, offplatform_relationship_id) = 1`) enforces exactly one anchor kind per
  row. The statement order was corrected mid-implementation (DROP the old PK *before* dropping
  `channel_id`'s NOT NULL, not after) — the original order would have failed against real Postgres.
- **Discriminated anchor type**, `types/qubetalk.ts`:
  ```ts
  export type QubeTalkRelationshipAnchor =
    | { kind: 'peer-channel'; channelId: string }
    | { kind: 'off-platform'; relationshipId: string };
  ```
  Resolution of an off-platform anchor requires the caller's resolved owner context at the DB-query
  level (`.eq('owner_auth_profile_id', ...)`), never a bare UUID lookup.
- **Conversations and messages widened to the same anchor**, not just relationship state —
  `qubetalk_conversations` and `passport_peer_messages` both gained an `offplatform_relationship_id`
  column (the latter with its own XOR CHECK), so a conversation and its messages can exist for an
  off-platform relationship exactly as they do for a platform one.
- **UI** — `QubeTalkInboxTab` was found too hard-wired to `passport_peer_channels` ids to parametrize
  proportionately this pass; built a minimal but genuinely functional inline compose surface
  (`OffplatformThread` in `RuntimeQubeTalkDrawer.tsx`) instead — real send/receive, not a dead end.
- **Promotion** (linking an off-platform relationship to a real `passport_peer_channels` row once the
  contact links a persona) is transactional-by-verification: checks owner match, confirmed
  `linked_personhood_ref`, both-principals-match on the target channel, and no conflicting prior
  lineage, before a compare-and-swap write. Owner-scoped uniqueness on `promoted_to_channel_id`
  (never global — the channel is shared, the ContactGraph relationship is owner-scoped).
  Post-promotion, a `{kind:'peer-channel'}` lookup for the same owner+channel redirects to the
  pre-existing off-platform state lineage rather than forking a new one.
- **Transport honesty** — creating a relationship never implies delivery. A send attempt resolves
  real `contact_endpoints` against `transportRegistry.ts`'s actual capability state first;
  `no_reachable_transport` / `transport_not_wired` are returned honestly rather than a fabricated
  success.

### Known, named follow-ups (not built this pass)

- No automatic promotion trigger — nothing currently calls `promoteOffplatformRelationship`
  automatically when a ContactGraph contact later gains `linked_personhood_ref`.
- Off-platform relationships do not yet appear in the surface-independent projection contract
  (`services/qubetalk/projection.ts`).
- If both principals of a channel each independently promote their own off-platform relationship
  onto it (structurally possible since uniqueness is owner-scoped, not global), the redirect above
  takes the first match rather than picking a specific side — documented in code, not exercised by
  tests.

### Tests

34 tests in `tests/qubetalk-offplatform-relationships.test.ts`; 109/109 passing across every QubeTalk
test file touched by this work. `tsc` unchanged at the branch's 679-error pre-existing baseline.

---

## 2. ContactGraph endpoint-projection hardening

**The live data repair itself — reconciling `persona_contacts` against ContactGraph endpoints on the
live Supabase project `bsjhfvctmduxhohtllly` — was already performed separately, outside this coding
session.** Verified live result at the time this repo-side work began: 1,228 graph people, 1,763
endpoints (1,707 iCloud, 1,254 SMS, 509 email), 1,205 iCloud rows projected, 778 endpoint-less rows
correctly excluded, 1 ambiguous row flagged for review. **This session's migration is
classification/schema-only against that already-correct data — it does not re-import contacts, does
not rerun the backfill, and never touches `promoted_contact_person_id` for a row that already has
one.**

### What shipped

- **`persona_contacts.projection_state`** (`pending` / `projected` / `ineligible` / `ambiguous`),
  distinct from the pre-existing `promotion_state` (which answers "has the owner confirmed this is a
  saved contact," unchanged). A `BEFORE INSERT OR UPDATE` trigger keeps the two purely-structural
  states (`ineligible` for endpoint-less rows, `pending` on re-eligibility) honest without ever
  regressing an already-projected row or touching the two states only the application layer can
  determine (`projected`, `ambiguous`).
- **Paginated, resumable, endpoint-aware reconciliation** — `reconcileConfirmedPersonaContacts` now
  takes `{limit, cursor}`, filters on `projection_state = 'pending'` (automatically skipping
  known-ineligible and known-ambiguous rows instead of re-attempting them every call), and returns a
  `nextCursor`. `/api/contactgraph/people` calls it bounded (`limit: 200`); because a projected row's
  state flips out of `'pending'`, each subsequent page load naturally advances through the backlog
  without needing a cursor threaded across requests.
- **Real ambiguity detection, not silent first-match-wins** — `findExistingContactPersonId` now
  collects every distinct existing `contact_person_id` across a row's candidate endpoints. More than
  one distinct match no longer picks one arbitrarily; it sets `projection_state = 'ambiguous'` and
  returns a discriminated outcome (`{outcome:'ambiguous', candidateContactPersonIds}`) that makes it
  structurally impossible for a caller to mistake an unresolved conflict for a resolved one.
  Identity resolution remains exact-endpoint-match only — never a name-based merge.
- **Phone-as-`sms`-endpoint and transport honesty** — verified already correct (phone/phone_2 already
  map to `platform: 'sms'`; `transportRegistry.ts` already marks `sms` fully unsupported via
  `deferred()`) and backed with regression tests rather than rebuilt.

### Tests

6 new tests added to the existing `tests/contactgraph-substrate-scenarios.test.ts` (24/24 passing):
iCloud source projection, endpoint-less exclusion, ambiguity, SMS-only projection, pagination/
resumability, and an SMS-transport-honesty regression guard. `tsc` unchanged at 679.

### Not yet applied live

Both this document's migrations (`20260930100000_qubetalk_offplatform_relationships.sql`,
`20260930110000_persona_contacts_projection_state.sql`) are code-complete and traced against the real
current schema but have not been applied to any live database from within this session — no Supabase
MCP access was available. They join the existing backlog of migrations pending a live-apply pass.
