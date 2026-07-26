# Passport-native access — reconciliation against what is already ratified and shipped

**Date:** 2026-07-26
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Deliverable:** `PRD-PAG-001` **Amendment A** (docs-only). **No code was written.**
**Update 2026-07-26 (later):** architecture rulings received from Aletheon via the operator and
folded in — see "Rulings and plan" at the foot of this note.

---

## Why this is an amendment and not a new spec

The operator specified "Passport-Native Access and Companion Connection" as a fresh
implementation specification. **It is substantially the same architecture as
`PRD-PAG-001 — Polity Access Gateway ("Sign in with Polity Passport")`, which was ratified
by operator direction on 2026-07-22, and whose Phase 1 was chartered and shipped the same
day.**

Writing it as a second document would have been the `CS-001` / `inv.engineering.036` defect
this repository has a named doctrine against — and PAG-001's own §0 exists precisely to stop
a well-argued external design from silently forking the spine. So the specification is
recorded as **Amendment A** to PAG-001, carrying only what is genuinely new plus the finding
that motivated it.

## The finding that matters

**Phase 1 shipped as authorization over an existing session, not as primary authentication.**

`app/api/access-gateway/complete/route.ts:41-44` — the act that mints the authorization code
calls `resolvePersonaOrTimeout` and returns **401 `unauthenticated`** without a Supabase
session. The consent page reaches it with `personaFetch` (Supabase Bearer attached), and
`humanSession.ts:343` reads the Passport from `polity_passport_records` **keyed by
`personaId`** — resolved *from* the session.

The route says so in its own header: *"Called from the browser consent page by the SIGNED-IN
human."* That was a faithful reading of PAG-001 §0.7 ("federate Supabase, don't replace it").
Its consequence is the thing the operator objected to: the Passport currently functions as
**a claim attached to a pre-existing account**.

The circular dependency, exactly:

```
getActivePersona (getActivePersona.ts:353)
  └─ getCallerIdentityContext (personaRepo.ts:219-221) — requires a Supabase Bearer
       └─ authProfileId → owned personas → personaId
            └─ polity_passport_records keyed by persona
```

No session → no persona → no Passport read. One direction of one dependency is backwards.

## What the specification genuinely adds

- **Passport multiplicity and consolidation** — not in PAG-001 at all. But mostly expressible
  in primitives that already exist: the graded personhood ladder
  (`personhoodProof.ts`: `captcha | world_id | agent_declaration | operator_attestation`)
  already *is* the provisional-vs-canonical distinction, and
  `passportStatusMachine.ts` already ratifies `active → superseded_by_reissue` with
  `reissue_continuity_binding` evidence — the operator's "predecessor" state. Net-new is
  narrower: lineage resolution, the deterministic origin rule, and standing/delegation
  reconciliation.
- **The three holder-control tiers** — level 1 has challenge/verify primitives; level 2
  (passkey) is still genuinely unbuilt, as §0.5 already recorded; level 3 has
  `requireAuthorizedAgreement` but no stated risk→grade binding.
- **The Companion Connect state machine** (States A–E).

## Two things the operator must decide before any code

Neither has a defensible default, and both touch protected spine files.

1. **How a principal resolves without `authProfileId`.** `personhoodResolver.ts` already
   walks `root_identity → kybe_id → did_persona` and documents that the Passport is
   KYBE-driven — "it belongs to the person, a level BENEATH persona". The right chain exists;
   only its entry point is wrong. Sibling resolver, or teach `getCallerIdentityContext` a
   second credential kind (protected file).
2. **How a platform session is minted.** There is **no server-side session-minting mechanism
   in the repo today** — no `admin.createUser`, no `generateLink`, no equivalent.

## A security prerequisite the specification's own requirements expose

`walletAliasService.ts` already provides a SIWE-shaped challenge and EVM signature
verification — reusable. But `app/api/identity/wallet-alias/challenge/route.ts` states:
**"Nonces are stateless — they're embedded in the message."** Nothing consumes them.

Fine for its current job (wallet-alias binding re-validates persona ownership at register
time). **Not** fine for session establishment: a replayed signed challenge would mint a
session. The specification requires single-use, short-lived, replay-resistant challenges — so
a **server-side single-use nonce store is a prerequisite, not a follow-on.** The challenge
message is also keyed to `didPersonaId`, which a pre-session caller does not have.

## One tension to rule on

PAG-001 §3 / §7 Phase 3 call the browser extension *"an optional convenience connector —
never the identity store, never required for metaMe login."* The new specification makes the
Companion's **Connect** the primary access path. Reconcilable — primary *presentation
channel* is not the same as *identity store* or *requirement* — but the two documents
currently read as disagreeing. Operator ruling requested.

## Why no code

Closing the circular dependency means creating an **unauthenticated session-minting path**.
That is the highest-risk change available in this codebase, and it is gated twice over:
CLAUDE.md's "Identity & Access Spine" PARAMOUNT rule, and PAG-001's own §6.3 / §10, which
chartered Phase 1 explicitly on the condition that no protected spine file was touched.

Shipping a partial version of this would be worse than shipping nothing. The amendment
carries an unchecked ratification record; on sign-off of §A.3 and §A.4 the implementation is
a bounded, well-scoped pass.

---

## Rulings and plan (second pass, same day)

All eight architecture rulings received and folded into Amendment A §§A.3, A.7, with an
implementation plan at §A.9 and a ratification record at §A.10.

**The most consequential consequence: the implementation now requires ZERO protected-file
modification.** Because the Passport path terminates in a canonical `authProfileId` (ruling:
Supabase stays the application-session compatibility envelope), `getActivePersona.ts`,
`evaluateAccess.ts` and `personaSessionToken.ts` are all untouched — they consume
`getCallerIdentityContext`'s result and cannot tell which credential produced it. The work
lands in `services/wallet/personaRepo.ts`, `services/identity/personhoodResolver.ts` and
`services/identity/walletAliasService.ts`, none of which are on CLAUDE.md's protected list.

If an implementation pass finds it needs a protected file, that is a signal the design has
drifted from the ruling — stop and re-ratify rather than request an exception.

**A second verified finding:** the KybeDID→Supabase binding the ruling requires **already
exists in schema and is indexed.** `supabase/migrations/20260427000000_root_did_persona_binding.sql:17`
comments `root_identity.auth_user_id` as *"Supabase auth.users id — canonical link between
auth session and root DID"*, with `idx_root_identity_auth_user_id` on it, and
`personhoodResolver.ts:89-100` already walks it session→kybe. Passport-native access is the
**same edge walked in reverse** — no new binding table, and provisioning is needed only when
no `root_identity` row exists for the resolved kybe.

Also folded in: one additive table (`passport_connection_challenges`) with atomic single-use
consumption by conditional update; a five-step rollback that is reversible without data loss
precisely because sessions stay ordinary Supabase sessions; eight canaries led by the
negative one — *no pre-session flow may reference `personaId`, `authProfileId` or
`didPersonaId`*; and PAG-001's body language on the Companion revised per ruling 6.

Consolidation, passkey enrolment, SessionQube-as-runtime-session and external RP presentation
are each explicitly out of scope and separately chartered.

**Still not implemented.** §A.10's last two boxes — operator sign-off on the plan, and
chartering the pass — are unticked, per the instruction not to implement until the amended
ratification record is complete.
