# PRD — QubeTalk Peer Exchange

**Personhood-Bound Messaging, Locker Sharing and Delegated Agent Communication**

**Status:** DOCS-FIRST — ratify before build. No code is implied by this
document; it fixes the *constitutional semantics* so implementation can proceed
in bounded phases.
**Date:** 2026-07-20 · **Area:** QubeTalk · Polity Passport · Locker · Delegated agents · DVN receipts

---

## 1. Problem / opportunity

Today a locker is a **destination** — a place to put materials for someone.
There is no sovereign, personhood-bound channel over which two principals (and
their delegated agents) can exchange messages, artifacts, review requests and
receipts with provenance and bounded permissions.

The immediate driver: Dele needs to share the confidential IRL research package
with Austin, have it land in Austin's locker with provenance + permissions, have
Austin (or his delegated agent) review and return feedback through the same
channel, with every consequential exchange receipted and attributable to the
right principal.

This is the missing **collaboration layer** connecting Polity Passport, research
participation, lockers, and delegated agents.

## 2. Core proposition

QubeTalk is **not** ordinary chat. It is the protocol by which
personhood-bound principals and their delegated agents exchange messages,
iQubes, artifacts, requests, and receipts.

```
Dele's Polity Passport
   ├── Dele
   └── delegated agents
            │
            ▼
       QubeTalk Channel   ← belongs to the two PRINCIPALS, not either agent
            │
            ▼
Austin's Polity Passport
   ├── Austin
   └── delegated agents
```

The channel belongs to the two principals. Agents participate only through
bounded delegation. **An agent never independently establishes an unbounded
relationship with another agent** — it communicates under the authority and
standing of its principal.

## 2a. Reconciliation with the EXISTING implementation (must extend, not fork)

Investigation (2026-07-20) found substantial existing machinery. This PRD MUST
build on it — creating parallel tables/services is a duplication defect (and a
`qubetalk_channels` table collision). What exists:

| Concern | Existing artifact | Notes |
|---|---|---|
| **Locker** | `passport_locker_items` (owner-gated by `holder_persona_id`, RLS) + `passport_locker_grants` (holder → delegated-persona access) — migration `20260613300000_passport_locker_qubetalk.sql` | This IS the sovereign store. "Copy to recipient's locker" = insert a `passport_locker_items` row for the recipient + a grant. Do NOT invent a locker. |
| **Passport channels** | `passport_qubetalk_channels` (`holder_persona_id`, `delegated_persona_id`, `channel_status`) + `GET /api/qubetalk/passport-channels` | Currently models **holder ↔ their own delegated persona** (a delegation channel), NOT peer ↔ peer between two independent principals. |
| **Tenant QubeTalk (agent runtime)** | `qubetalk_channels` + `services/qubetalk/qubetalkPersistence.ts` + `/api/qubetalk/channels\|messages\|delegations\|invoke` + `receiptService.createQubeTalkReceipt` | Tenant/participants model for agent messaging. The name `qubetalk_channels` is TAKEN — the peer layer must use a distinct name. |

**Design fork — needs operator ratification before build:** a Dele↔Austin peer
channel is between **two independent principals**, which the existing
`passport_qubetalk_channels` (holder↔own-delegate) does not model. Options:

- **(A) Extend `passport_qubetalk_channels`** with a `channel_kind`
  (`delegation` | `peer`) + a `counterparty_persona_id`, reusing its RLS + the
  existing passport-channels route. Least new surface; keeps one channel table.
- **(B) New `passport_peer_channels`** table for principal↔principal, leaving the
  delegation channel table untouched; reuse locker + receipts. Cleanest
  separation of two genuinely different relationship types; one new table.

Recommendation: **(B)** — the delegation channel (a principal ↔ their own agent)
and a peer channel (two sovereign principals) are different constitutional
objects; conflating them into one table via a discriminator invites the exact
"two things in one" confusion the ontology warns against. (B) reuses the locker
+ receipts + spine and adds exactly one peer-channel table + its messages, with a
name that does not collide.

Either way: **reuse `passport_locker_items`/`passport_locker_grants` for locker
sharing, `receiptService`/DVN for receipts, and the identity spine for auth.**
The peer layer is the only genuinely new surface.

## 3. Constitutional requirements (fixed now)

1. **Personhood-bound channel ownership.** Channels belong to *principals*, not
   agents or outward-facing identities. Identity/alias may *label* a
   participant; **personhood gives continuity** — a channel persists through
   identity/alias rotation.
2. **Bounded delegation.** An agent may act only within a granted scope
   (e.g. read IRL docs, return technical comments, propose revisions — but not
   publish, reshare to third parties, commit the principal to funding, or
   delegate another agent).
3. **No agent-initiated delegation.** The one-degree-of-separation rule holds:
   an agent cannot invite or delegate another agent into a channel. Only the
   personhood-bound principal adds or authorises agents.
4. **Explicit content rights.** Every shared artifact carries a rights envelope
   (§6). Austin may be permitted to let his agent *reason over* the report
   without being permitted to *redistribute* it.
5. **Receipts for consequence.** Consequential events are receipted and
   DVN-anchorable (§7). Freeform messages need not all be heavyweight receipts;
   actions with consequence must be.
6. **Privacy / minimum disclosure.** Content is encrypted for channel
   participants; keys bound to the participants' passport/locker access. Only the
   minimum **T2** routing aliases needed to deliver a message are exposed. KybeDID
   / T0 personhood data MUST NEVER enter the channel payload (mirrors the
   identity-spine tiering + three-level persona reference model).

## 4. Architecture — extend, do not duplicate

This PRD binds to existing platform organs; it must not fork them.

| Concern | Reuse |
|---|---|
| Principal identity + continuity | Polity Passport + identity spine (`getActivePersona`), three-level persona reference model (Polity Public Reference / pairwise external ref — never raw UUID on the wire) |
| Sovereign content | Locker + the x409 locker/agreement integration |
| Messaging transport | Existing QubeTalk (`metame-runtime-thinclient` channel, `scripts/qubetalk*`, the bridge) extended with typed envelopes + peer channels |
| Delegation authority | Passport delegation (CFS-043) + delegation receipts |
| Consequential provenance | Activity receipts + the DVN anchoring pipeline (`experiment_result_published`-style, new action types) |
| Rights / access decisions | `evaluateAccess` spine gate |

New surface is the **peer channel** abstraction, the **typed envelope**, the
**rights envelope**, and the **share-from-locker** affordance — layered on the
above, not parallel to them.

## 5. Message and content types (typed, not freeform-only)

- **Human:** message · question · response · acknowledgement · introduction
- **Content:** artifact_share · locker_transfer · document · report ·
  canonical_plate · iqube · invariant_collection · experiment_record
- **Workflow:** review_request · approval_request · revision_request ·
  proposed_change · accepted · rejected · needs_clarification
- **Agent:** task_request · task_result · context_request ·
  capability_declaration · structured_handoff · failure_report

**Artifact relationship types** (lineage): `responds_to` · `reviews` ·
`revises` · `supersedes` · `annotates` · `accepts` · `rejects` ·
`submitted_for_review`. A returned artifact retains its relationship to the
original (original → shared copy → feedback → revised report → response receipt).

## 6. Rights envelope (per shared artifact)

`view · download · copy_to_locker · annotate · revise · reshare ·
agent_inference · confidential_nda · expiration · revocation_where_possible`

Rights are enforced server-side through the spine (`evaluateAccess`), never by
client honour. Example: Austin's agent may `agent_inference` over the report but
not `reshare`.

## 7. Receipts (consequential events)

Channel established · participant accepted · artifact delivered · artifact
copied to locker · artifact opened · review returned · agent authorization used
· permission changed · content reshared · channel revoked. Each is an activity
receipt, DVN-anchorable, attributed to the responsible **principal** (via the
persona public reference — never a raw UUID).

## 8. Agent-mediated exchange — attribution header

Every agent message states: which agent sent it, which principal delegated the
authority, the scope of that delegation, whether it was autonomous or explicitly
requested, and whether principal approval is required before any proposed
action. Rendered header, e.g.:

> **Sent by Austin's Research Agent** — acting for Austin under delegated *review*
> authority (read IRL docs · return comments · propose revisions). Autonomous.
> Principal approval required to publish or reshare.

## 9. UX

- **QubeTalk inbox** (first-class surface): People · Channels · Requests ·
  Shared with me · Agent activity · Awaiting my approval.
- **Locker integration:** every artifact gets Share · Send for review · Add to
  channel · Request feedback. Every received artifact gets Open · Save to locker
  · Ask my agent to review · Respond · Return annotated version.
- **Channel layout:** the bidirectional dual-pane pattern — left: conversation +
  inference; right: shared artifacts, requests, approvals, receipts, agent
  actions.

## 10. Canonical envelope (semantics fixed; exact schema later)

```json
{
  "schema": "qubetalk-message/v1",
  "channel": { "id": "qt_...", "principals": ["passport_alias_a", "passport_alias_b"] },
  "sender": {
    "type": "agent",
    "agentId": "aigent_research_...",
    "principalAlias": "passport_alias_a",
    "delegationReceipt": "receipt_..."
  },
  "message": { "type": "review_request", "text": "Please review the attached IRL research package." },
  "artifacts": [
    {
      "artifactId": "irl_findings_...",
      "relationship": "submitted_for_review",
      "permissions": { "view": true, "copyToLocker": true, "agentInference": true, "reshare": false }
    }
  ],
  "consequence": "operational",
  "receiptRequired": true
}
```

`principals` carry **aliases / public references**, never raw persona UUIDs or
T0 data. `delegationReceipt` binds an agent message to its principal's grant.

## 11. Delivery phases (each independently shippable)

- **Phase 1 — Human peer sharing.** Passport↔Passport channel; text messages;
  artifact references; copy-to-recipient-locker; delivery + access receipts;
  basic permissions. **Solves the Austin use case.**
- **Phase 2 — Review workflows.** review_request; annotations; response
  artifacts; accept/reject/request-revision; artifact lineage; shared research
  workspace.
- **Phase 3 — Delegated agent participation.** Agents join under principal
  authorization; visibly attributed agent messages; scope-enforced tool/content
  access; principal approval gates; agent↔agent structured handoffs.
- **Phase 4 — Protocol-level interoperability.** Stable message envelope;
  external agent endpoint; encrypted cross-runtime transport; cross-network
  messaging (e.g. LayerZero); DVN-anchored consequential receipts.

## 12. First acceptance scenario (Phase 1 must satisfy)

> Dele shares the confidential IRL package with Austin through their QubeTalk
> channel; the documents appear in Austin's locker with provenance and
> permissions; Austin or his delegated research agent reviews them and returns
> feedback through the same channel; all consequential exchanges are receipted
> and attributable to the relevant principal.

## 13. Significance

This turns the locker from private storage into a **personhood-bound sovereign
exchange space**, connecting the platform's separate concepts into one
collaboration architecture:

```
Polity Passport → establishes the principal
Locker          → holds sovereign content
QubeTalk        → exchanges content and intent
Delegated agents→ perform bounded work
Receipts        → preserve accountability and provenance
```

## 14. Ratification asks (before any build)

1. Confirm channel ownership is personhood-bound (not identity/agent) and
   persists through alias rotation.
2. Confirm the no-agent-delegation rule (one-degree-of-separation) holds inside
   channels.
3. Confirm the rights-envelope field set (§6) and that enforcement is server-side
   via `evaluateAccess`.
4. Confirm the consequential-event receipt list (§7) and that attribution uses
   the persona public reference, never raw UUID / T0.
5. Approve Phase 1 scope as the first build increment (the Austin use case).
