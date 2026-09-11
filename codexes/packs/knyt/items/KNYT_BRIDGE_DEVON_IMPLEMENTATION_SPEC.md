# KNYTS Bridge — DevOn Bounded Implementation Spec

**Status:** implementation-ready · **Date:** 2026-08-16 · **Target:** DevOn / IDE 2.0

## 0. Operator intent

Activate the KNYTS Bridge as a live campaign surface that converts participation into three distinct outputs:

**Action → Evidence/Receipt → Reputation(persona) + Standing(person) + Reward(economic)**

Canonical constraint: **Standing accrues to the person; Reputation accrues to the persona; Evidence is the governed bridge. One event may produce both, but they remain different outputs.**

This implementation MUST extend the existing KNYT Bridge, CRM, reputation, Standing, Smart Wallet, social/referral, receipt and reward substrates. Do not create parallel identity, reputation, Standing, reward, CRM, or social tracking systems.

## 1. Existing surfaces to reuse

- `components/journey/KnytsBridgeChooseSurface.tsx` — current CHOOSE surface. It already contains the reserve-interest form and `SocialSharingModal` campaign integration.
- `components/journey/BridgeReserveInterestCard.tsx` — existing email-interest UI pattern.
- `/api/journey/knyts-bridge/choose/book-interest` — current KNYTS demand-signal endpoint.
- `KNYTS_BRIDGE_CAMPAIGN_ID` — existing campaign identifier. Reuse it throughout.
- `packages/smarttriad/src/SocialSharingModal` + existing `/api/social/track` flow — reuse for share/referral evidence rather than building another tracker.
- CRM substrate (`crm_personas`, engagement/reputation/reward primitives and existing data-access layer).
- Reputation substrate (`reputation_bucket`, `reputation_evidence`, RQH adapter/API) — persona-scoped.
- Standing substrate (`services/standing/*`, `services/crm/standingAccrualService.ts`) — extend through a person-grade attribution seam; do not redefine the Standing formula in this feature.
- Smart Wallet Tasks / Reputation / Rewards surfaces and existing reward types.
- Activity receipt / DVN pipeline for consequential campaign events.

## 2. Full campaign outcome

CHOOSE should become a progression surface:

**Pre-register → Follow Kickstarter → Share → Publish Crossing Story → Receive likes/referrals → Reputation + Standing + Knightcoin → Advocate / Recruiter**

Campaign participation must be visible in CRM and deduplicated against existing people, including existing metaKnyt investors.

## 3. FIRST DEVON LIVE TEST — Phase A only

### Goal

Make CHOOSE a real pre-launch acquisition/evidence surface without yet changing Standing, Reputation, Knightcoin balances, identity bindings, or external Kickstarter state.

### Why this is the first live slice

It is deliberately bounded to UI + CRM + campaign evidence. It exercises DevOn's new implementation-pack → bounded actor → PR → human authorization loop against real product code while avoiding personhood, Standing and economic writes on the first production test.

### Required behavior

#### A1. Pre-register email capture

Replace the current reserve-only framing with campaign-oriented copy while preserving truthful semantics.

Recommended visible copy:

**Pre-register for metaKnyt**

`Get the Kickstarter preview and be first to know when the campaign opens.`

Primary action: **Pre-register**

The form accepts an email address and creates/updates campaign prospect state in CRM.

#### A2. CRM deduplication

Normalize email for lookup (`trim`, lowercase) and reuse an existing CRM record when a matching contact/persona already exists.

If the matching record is already a metaKnyt investor, do NOT create a second prospect. Preserve all investor/cohort data and append campaign participation to the same CRM relationship.

Do not treat investor status as proof of the currently active persona or personhood. Email dedupe is CRM/contact reconciliation only.

Record at minimum:

- campaign id = existing `KNYTS_BRIDGE_CAMPAIGN_ID`
- normalized email
- source = `knyts_bridge_choose`
- event = `campaign_preregistered`
- first/most-recent campaign timestamps
- existing/new contact classification
- investor-known boolean/tag when already known from CRM
- campaign state progression, initially `warming` or the nearest existing canonical state

The endpoint must be idempotent: repeated preregistration by the same email must update/append evidence, not create duplicate prospects or duplicate rewards.

#### A3. Kickstarter preview/follow CTA

After successful preregistration, reveal or emphasize a second action:

**Follow the Kickstarter**

This opens the configured Kickstarter preview/pre-launch page and records an outbound campaign event such as `kickstarter_preview_clicked` before navigation.

A click is NOT a confirmed Kickstarter follow/subscription. Do not award the full follow reward, Reputation, or Standing for a click.

Keep the external URL configuration server/admin-owned rather than hard-coding it in multiple components.

#### A4. Campaign evidence ledger

Create/reuse the smallest generic campaign-evidence persistence seam needed to represent:

- `campaign_preregistered`
- `kickstarter_preview_clicked`
- future `kickstarter_follow_confirmed`
- future `bridge_shared`
- future `qualified_share_visit`
- future `crossing_story_published`
- future `crossing_story_liked`
- future `qualified_referral`

Every record needs a stable idempotency key and enough attribution to later resolve:

- campaign
- CRM/contact relationship
- persona when known
- person/root when constitutionally resolvable
- source/target object when relevant
- occurrence timestamp
- verification state (`observed`, `verified`, `rejected` or reuse existing equivalent)

Do not award Standing/Reputation/Knightcoin in Phase A. The evidence must be sufficient for Phase B to consume deterministically.

#### A5. Receipts

Receipt the consequential state transitions using the existing receipt service. Reuse an existing sufficiently generic campaign/social/engagement action type if one exists; introduce a new action type only if the existing ontology cannot truthfully express the event.

Receipt failure must be visible/auditable; do not silently claim DVN anchoring if only the database state was written.

### Phase A acceptance criteria

1. CHOOSE shows pre-register email capture and clear Kickstarter-follow progression.
2. Existing CRM contact/investor + same normalized email results in no duplicate prospect.
3. New email creates exactly one campaign prospect/contact relationship.
4. Repeated preregistration is idempotent.
5. Investor/cohort tags are preserved.
6. Kickstarter click is recorded separately from confirmed follow.
7. No Standing, Reputation or Knightcoin balance changes occur in Phase A.
8. Campaign evidence is persisted with idempotency + attribution fields sufficient for Phase B.
9. No identity/personhood spine fields are changed.
10. Existing KNYT Store, CI, Ask Kn0w1 and Social Sharing destinations still work.
11. Targeted canaries + affected subsystem tests pass; full regression runs once at final gate.
12. PR is created and stops at human authorization; no autonomous merge.

## 4. Phase B — Triple-output accrual

Implement only after Phase A is merged and observed live.

Introduce a single campaign-event projector that consumes **verified campaign evidence** and independently determines three outputs.

### Reputation — persona grade

Write to the existing persona Reputation substrate. Reputation is contextual to the persona through which the action occurred.

Initial proposed deltas (subject to reuse of existing scale):

- preregister: +1
- confirmed Kickstarter follow: +2
- bridge share: +1
- qualified share visit: +1
- Crossing Story published: +3
- unique verified story like received: +0.25, capped
- qualified referral: +3

Do not force personhood resolution to grant persona Reputation.

### Standing — person grade

Standing may accrue only when evidence can be constitutionally attributed to a person-grade spine (KybeDID/RootDID/Passport) and the event satisfies the Standing rule.

Do not let raw popularity mechanically become Standing.

Initial proposed Standing-eligible evidence:

- campaign preregistration by passport-bound person: small contribution evidence
- confirmed Kickstarter follow: contribution evidence
- qualified campaign share/referral: contribution evidence
- Crossing Story publication: stronger contribution evidence
- aggregate threshold such as 5 unique verified likes: one separately validated Standing event, not 5 direct Standing increments

Use the existing Standing service/formula wherever possible. The new work should chiefly be attribution + evidence qualification.

### Reward — economic

Knightcoin reward is independent of Standing and Reputation. Reuse RewardHub/wallet reward infrastructure and retain proposed/approved/distributed states.

Initial campaign schedule:

| Verified event | Knightcoin |
|---|---:|
| Pre-register email | 0.10 |
| Confirmed Kickstarter follow | 0.25 |
| Share Bridge/campaign | 0.10 |
| Share generates qualified visit | +0.15 |
| Publish Crossing Story | 0.50 |
| Unique verified like received | 0.05, capped |
| Story reaches 5 unique verified likes | +0.25 milestone |
| Qualified referral becomes confirmed Kickstarter follower | 0.50 |

No reward for opening the share modal. No full Kickstarter-follow reward for outbound click alone.

All reward events require idempotency and anti-farming caps.

## 5. Phase C — Stories, likes, referrals

Extend the existing Crossing Story and social substrate rather than create a separate social network.

Required properties:

- story author persona owns persona Reputation from story interactions
- likes are deduped per eligible actor/story
- likes primarily affect Reputation
- validated aggregate/social outcomes may separately generate Standing evidence
- referral attribution survives the outbound campaign link and is reconciled when an externally verified conversion becomes available
- Passport/personhood is required for Standing-earning and high-value anti-sybil reward events, not necessarily for merely viewing or sharing

## 6. Phase D — Wallet + standings UX

Bring the triple output together visually without collapsing their semantics.

Smart Wallet should show:

- **Standing** — person-grade; personhood anchored
- **Reputation** — active persona-grade/contextual
- **Rewards / Knightcoin** — economic balance/reward history

KNYT campaign standings should default to campaign Reputation / contribution activity, not expose person-grade Standing as a public leaderboard by default.

Support filters/views for Reputation, verified contributions, referrals, and Knightcoin earned. Person-grade Standing visibility follows existing disclosure policy.

## 7. Constitutional invariants / NEVER rules

- Standing accrues to the person; Reputation accrues to the persona.
- Evidence is the bridge; Reputation never mechanically converts into Standing.
- One event may produce both outputs, but they are independently attributed and validated.
- Investor status cannot buy or multiply Standing.
- Economic reward does not equal Standing.
- Popularity does not equal Standing.
- Do not mutate KybeDID, RootDID, Passport or persona bindings as part of campaign accrual.
- Do not create a second reputation engine, Standing engine, CRM, reward ledger, social tracker or identity spine.
- Do not infer external Kickstarter follow/backing state from an outbound click.
- No autonomous PR merge or deployment authorization.

## 8. DevOn execution policy

### First run profile

**Implement Phase A only.** Treat Phases B-D as explicit out-of-scope future work.

Expected route: `routine` or `complex` using the cheapest capable configured implementation actor. It should NOT require Opus merely because later phases mention Standing/personhood; the first run must not touch protected identity or Standing write paths.

Recommended execution envelope:

- max turns: 20
- max wall clock: 12 minutes
- validation passes: 4
- context expansions: 3
- no broad CLAUDE.md reread unless the bounded escalation rule fires
- stop at PR / awaiting authorization

### Areas expected for Phase A

Prefer the smallest set discovered from the existing implementation, likely centered on:

- `components/journey/KnytsBridgeChooseSurface.tsx`
- existing KNYTS choose-interest API/service
- existing CRM data-access/campaign-engagement seam
- one additive campaign-evidence service/migration only if no suitable generic store exists
- targeted tests/canaries

### Protected / out-of-scope for the FIRST run

Do not modify in Phase A:

- Kybe/Root/Passport/personhood resolution services
- `services/standing/*`
- `services/crm/standingAccrualService.ts`
- RQH/reputation scoring internals
- RewardHub distribution internals
- DVN pipeline internals
- delegation/sponsorship services
- generic Smart Wallet architecture

Calling existing receipt/CRM/social APIs is allowed; changing their protected internals is not.

## 9. Exact DevOn intent for the first live run

> Activate Phase A of the KNYTS Bridge campaign according to `codexes/packs/knyt/items/KNYT_BRIDGE_DEVON_IMPLEMENTATION_SPEC.md`. On the existing CHOOSE surface, turn the current graphic-novel interest action into campaign pre-registration with email capture, CRM dedupe that preserves existing metaKnyt investor/cohort records, and a post-registration “Follow the Kickstarter” outbound action. Record preregistration and Kickstarter preview-click as distinct, idempotent campaign evidence using existing CRM/social/receipt substrates wherever possible. Do not award or modify Standing, Reputation, Knightcoin/rewards, identity/personhood bindings, or external Kickstarter follow state in this phase. Reuse the existing KNYTS campaign id and current bridge components. Add focused canaries for dedupe, idempotency, investor preservation, click-vs-follow separation, zero accrual in Phase A, and regression of the existing CHOOSE destinations. Stop at PR / awaiting human authorization; do not merge.

## 10. Go/no-go gate for Phase B

Proceed only after the Phase A live result proves:

- CRM dedupe works on at least one existing investor and one new prospect
- campaign evidence is idempotent and inspectable
- click/follow semantics remain honest
- no accidental Standing/Reputation/reward writes
- receipts are either present or any receipt gap is explicitly diagnosed
- no regressions on KNYTS Bridge navigation

Only then should DevOn receive Phase B as a separate implementation pack.
