# KNYT Bridge — Standing, Reputation & Rewards Activation Spec

**Date:** 2026-08-16  
**Status:** implementation-ready operating specification  
**Scope:** KNYT Bridge / Knightsbridge campaign activation, CRM capture, Kickstarter pre-launch conversion, Standing, Reputation and Knightcoin rewards.

## 1. Governing constitutional model

This spec operationalizes the Canon II ruling in `codexes/packs/polity-core/constitutional-records/personhood-identity-standing-reputation.md`:

- **Standing accrues to the person.**
- **Reputation accrues to the persona.**
- **Evidence is the governed bridge.** One event may produce both Standing and Reputation, but they are distinct outputs with distinct attribution rules.
- Economic rewards are a third output. A reward does not itself constitute Standing or Reputation.

Canonical event model:

```text
Action
  -> Evidence / Receipt
      -> Reputation(persona)
      -> Standing(person), if constitutionally valid
      -> Reward(economic), if campaign policy qualifies the action
```

The three outputs MUST be independently computed and independently receipted. No score is mechanically converted into another score.

## 2. Existing substrate — reuse, do not rebuild

The repo already contains the major primitives needed for this activation:

- `SmartWalletDrawer` already exposes **Tasks, Reputation and Rewards** as first-class wallet surfaces.
- `types/smartWallet.ts` already models `WalletTask`, `RecentReward`, `RewardsContext`, `reputationScore` and `reputationBucket`.
- The DIDQube/RQH reputation path is persona-partitioned via `/api/identity/persona/[id]/reputation` and `reputation_bucket` / reputation evidence.
- CRM already has `crm_personas`, engagement/reputation/reward primitives and typed access through `services/crm/crmDataAccess.ts`.
- Standing accrual already exists in `services/crm/standingAccrualService.ts` and activity receipts already flow to the DVN pipeline.
- KNYT campaign operations already define investor cohorts, campaign-state tags, CRM tagging and the handoff `Kickstarter -> KNYT Runtime -> Tasks & Rewards` in `KNYT_CAMPAIGN_OPERATIONS.md`.
- KNYT wallet types already expose a KNYT balance and RewardHub exists as a platform reward primitive.

This is therefore an **integration + attribution repair**, not a new rewards platform.

## 3. Required constitutional reconciliation before campaign launch

Current Standing implementation is historically persona-keyed (`crm_persona_reputation.persona_id`) and `standingScore.ts` currently reads contribution standing from the persona reputation row. That was coherent with the prior implementation but is not sufficient under the new Canon II rule.

For KNYT Bridge campaign events:

1. The **acting persona** remains the contextual actor and receives Reputation.
2. The event must resolve the **principal person** through the existing personhood spine (KybeDID / RootDID / Passport binding).
3. Standing evidence is attributed to that principal person, irrespective of which owned persona performed the action.
4. Multiple personas of one principal may develop different Reputation, while their validated Standing evidence converges on the same person-grade Standing lineage.

Do not delete legacy persona-keyed standing rows during this activation. Add a person-grade attribution seam and preserve existing rows for audit/compatibility until a dedicated Standing migration is authorized.

## 4. Choose section — new pre-launch conversion flow

The KNYT Bridge **Choose** section changes from a simple preorder/sign-up CTA into a two-part campaign activation surface.

### A. Email pre-registration

Copy direction:

**Get the MetaKnyts Kickstarter launch alert**  
Enter your email to join the pre-launch list and earn your first campaign recognition.

Behavior:

1. Normalize email (`trim`, lowercase).
2. Resolve the currently authenticated principal/persona when available.
3. Upsert into CRM — never blindly create.
4. If the email already belongs to an existing KNYT / MetaKnyts investor, preserve that contact and investor history and append campaign engagement state.
5. If unknown, create a prospect CRM persona/contact with campaign-source metadata.
6. Record `knyt_bridge_email_preregistered` evidence once per normalized email + campaign.
7. If a later Passport/personhood session proves that the prospect belongs to an existing person, merge/link the prospect rather than keeping duplicate CRM identities.

Required CRM campaign tags:

- `knyt_bridge_2026`
- `kickstarter_prelaunch`
- `prelaunch_registered`
- existing investor tags preserved (`investor`, `reg_cf_investor`, `legacy_investor`, cohort tags, etc.)
- campaign state transitions begin at `warming` or `reactivated` for an existing investor and `engaged` after a verified campaign action.

**Deduplication precedence:** personhood binding > authenticated CRM linkage > normalized email. Email is a discovery key, not personhood.

### B. Kickstarter preview / notify CTA

Primary CTA copy:

**Follow the Kickstarter**

Supporting copy:

**Get notified when MetaKnyts goes live.**

The CTA opens the canonical Kickstarter pre-launch/preview project page in a new browser context while recording the outbound campaign event.

Important evidence distinction:

- `kickstarter_preview_opened` is directly observable by us.
- `kickstarter_follow_confirmed` must only be recorded when a trustworthy external callback/import/operator-verifiable signal confirms the user actually followed/subscribed on Kickstarter.
- A click must never be promoted into a confirmed follow.

If Kickstarter provides no suitable callback, build an import/reconciliation path rather than fabricating confirmation.

## 5. Campaign event ledger

Every qualifying action writes one idempotent campaign evidence event before downstream accrual.

Minimum shape:

```ts
interface KnytBridgeCampaignEvent {
  id: string;
  campaignId: 'metaknyts-kickstarter-2026';
  actionType: KnytBridgeActionType;
  principalRef?: string | null;      // server-side person-grade attribution
  personaId?: string | null;         // contextual identity attribution
  crmPersonaId?: string | null;
  normalizedEmailHash?: string | null;
  evidenceGrade: 'observed' | 'verified' | 'attested' | 'external-confirmed';
  evidenceRef?: string | null;
  sourceUrl?: string | null;
  occurredAt: string;
  idempotencyKey: string;
}
```

No T0/person-grade identifiers may be exposed to the client.

Recommended idempotency key:

```text
campaignId + actionType + attributed subject + external evidence id / period
```

## 6. Initial reward and accrual matrix

Knightcoin values intentionally stay in the small-participation range. All rewards are campaign-policy amounts, not constitutional values.

| Action | Evidence threshold | Persona Reputation | Person Standing evidence / CVS | Knightcoin | Guardrail |
|---|---|---:|---:|---:|---|
| Email pre-register | verified email ownership | +1 | +0.5 | **0.10** | once per campaign/person |
| Open Kickstarter preview | observed outbound click | +0.25 | 0 | **0** | signal only; click is not follow |
| Kickstarter follow / notify | external-confirmed | +2 | +1 | **0.25** | once per campaign/person |
| Share Kickstarter campaign | receipted share invocation | +1 | +0.5 | **0.10** | max 1 per channel/day |
| Share drives a qualified unique campaign visit | tracked referral evidence | +1 additional | +0.5 additional | **+0.15** | recipient dedupe + anti-self-referral |
| Publish Crossing Story | published artifact + author binding | +4 | +2 | **0.50** | first qualifying story; later stories policy-capped |
| Like another Crossing Story | authenticated unique like | +0.25 | 0 | **0.05** | max 5 rewarded likes/day; no self-like |
| Receive unique verified like on own story | authenticated unique liker | +1 to author | 0 initially | **0** | reputation signal, not purchasable standing |
| Story reaches 5 unique verified likes | aggregate evidence threshold | +2 bonus to author | +1 | **0.25** | threshold paid once |
| Qualified referral becomes confirmed Kickstarter follower | external-confirmed referral | +3 | +2 | **0.50** | one reward per distinct referred person |

### Why likes are treated differently

A like is primarily contextual social evidence, so it directly affects **Reputation**, not Standing. Only when a pattern crosses a governed evidence threshold (e.g. multiple unique verified people responding to a contribution) may it generate a Standing-eligible evidence event. This prevents popularity from becoming constitutional authority.

### Investor treatment

Existing MetaKnyts/KNYT investors receive **no automatic Standing or reward merely for being investors**. Investment status is CRM context and segmentation evidence. If an investor follows, shares, writes or refers, the same action policy applies and their event is additionally tagged as an investor reactivation event.

This prevents wealth or prior ownership from buying Standing.

## 7. Three independent accrual lanes

### Reputation lane — PersonaDID / contextual identity

Use the existing RQH / `reputation_evidence` path. Add a KNYT campaign reputation category/bucket rather than creating a parallel reputation engine.

Suggested category:

```text
knyt_campaign_participation
```

The wallet Reputation view should expose campaign-derived evidence in the active persona's reputation history.

### Standing lane — person-grade principal

Campaign evidence is first resolved from acting persona -> owning person through the personhood spine, then passed to Standing as validated contribution evidence.

Do **not** update Standing merely because Reputation increased.

Standing input is the evidence event itself. The campaign CVS above is the contribution value attached to that evidence.

### Reward lane — economic recognition

Use existing RewardHub / wallet `RecentReward` semantics.

Initial campaign asset label: **Knightcoin / KNYT campaign reward**. Reuse the existing KNYT reward/balance primitive if it is the deployed economic asset; do not mint a new wallet currency enum solely for campaign naming without an explicit token-definition decision.

Rewards transition through existing states (`proposed -> approved -> distributed`, or the current RewardHub equivalent). UI may show earned/provisional rewards before distribution, but must label them honestly.

## 8. Wallet presentation

The Smart Wallet already colocates Reputation, Rewards and task surfaces. KNYT Bridge should make the new constitutional distinction legible rather than adding another dashboard.

For a qualifying event confirmation, show a compact three-line consequence card:

```text
Crossing Story published
+2 Standing evidence     Person
+4 Reputation            [Active Persona]
+0.50 Knightcoin         Reward
```

Wallet summary should continue to expose Standing and Reputation together while labeling their owners distinctly:

- **Standing — Person**
- **Reputation — [Persona name]**
- **Knightcoin — Rewards**

## 9. KNYT / MetaKnyts standings page

The existing standings/ranking experience should become an evidence-backed campaign leaderboard, not a single blended social score.

Recommended columns/cards:

- Persona / Knight identity
- Campaign Reputation
- Person Standing contribution (display only where disclosure policy permits)
- Knightcoin earned
- stories published
- verified likes received
- campaign shares
- confirmed followers referred
- existing investor / cohort badge where appropriate (context only; no score multiplier)

Default public ordering should use **campaign Reputation**, not person-grade Standing. Standing is constitutional and should not become a popularity leaderboard.

Optional views:

- **Reputation** — social/campaign contribution ranking
- **Rewards** — Knightcoin earned
- **Standing contribution** — private/self or governed disclosure view, not public by default

## 10. CRM operational model

Extend the existing campaign tags in `KNYT_CAMPAIGN_OPERATIONS.md` with action-state tags:

```text
knyt_bridge_2026
kickstarter_prelaunch
prelaunch_registered
kickstarter_preview_visited
kickstarter_follow_confirmed
campaign_sharer
crossing_story_author
campaign_advocate
campaign_recruiter
```

CRM must retain one contact/person relationship while recording many campaign events. Existing investor dedupe is mandatory.

Example:

```text
Existing legacy investor
  + submits same email in Choose
  -> NO new CRM prospect
  -> existing contact tagged prelaunch_registered + reactivated
  -> campaign event appended
  -> reward/reputation/standing derived from that event
```

## 11. Anti-abuse and constitutional safety

- No reward for repeated email submissions.
- No reward for self-referrals or self-likes.
- Likes are unique by actor + target story.
- Rewarded likes capped per day.
- Share invocation is not the same evidence as downstream qualified traffic.
- Kickstarter click is not the same evidence as Kickstarter follow.
- Investor status never multiplies Standing.
- Reputation never directly converts into Standing.
- Person-grade attribution is server-side only.
- Every economic or Standing-producing action is receipted and idempotent.
- Reversals/fraud findings may reverse campaign rewards/reputation evidence according to their own rules without rewriting historical evidence; Standing correction follows its constitutional evidence/correction process.

## 12. Implementation sequence

### Phase A — Activate Choose + CRM capture

1. Replace Choose copy with pre-launch email capture + `Follow the Kickstarter` CTA.
2. Add server-side CRM prospect upsert/dedupe.
3. Preserve existing investor contact/cohort state.
4. Add campaign event ledger + receipts.
5. Record preview click separately from confirmed follow.

**Gate:** same email never creates a duplicate investor/prospect; outbound click is observable; no rewards yet required.

### Phase B — Triple-output accrual

1. Add KNYT campaign reputation evidence adapter to existing RQH path.
2. Add person-grade campaign Standing attribution seam on top of the existing Standing service.
3. Add RewardHub Knightcoin proposals using the matrix above.
4. Drive all three from the same campaign evidence event.

**Gate:** one verified fixture event independently produces the expected Reputation, Standing evidence and reward; disabling one lane does not change the other two.

### Phase C — Stories, likes and referrals

1. Receipt story publication.
2. Add unique likes with caps/self-like protection.
3. Add tracked campaign share/referral links.
4. Add aggregate threshold event for 5 unique verified story likes.
5. Add confirmed Kickstarter follower reconciliation/import.

**Gate:** anti-sybil/idempotency canaries green; popularity does not directly become Standing.

### Phase D — Wallet + standings UX

1. Show three-output consequence confirmation.
2. Wallet labels Standing as person-grade and Reputation as persona-grade.
3. Campaign standings default to Reputation.
4. Rewards view shows provisional/distributed Knightcoin states.
5. CRM campaign dashboard surfaces prospect -> follower -> advocate -> recruiter progression.

## 13. Required canaries

At minimum:

1. Existing investor entering their known email does not create a duplicate CRM record.
2. Unknown email creates exactly one prospect despite repeat submissions.
3. A Passport/personhood resolution can link a prior email prospect to an existing principal without losing campaign history.
4. `kickstarter_preview_opened` cannot satisfy `kickstarter_follow_confirmed`.
5. One event can generate both Standing evidence and Reputation while preserving different attribution subjects.
6. Reputation delta cannot directly mutate Standing.
7. Same person acting through two personas accumulates persona-specific Reputation but person-convergent Standing evidence.
8. Self-like and self-referral pay zero.
9. Like cap is enforced.
10. Reward idempotency prevents duplicate Knightcoin payout.
11. Existing investor status does not multiply Standing or Knightcoin.
12. Public standings default to Reputation rather than person-grade Standing.
13. Every Standing/reward-producing campaign event has an activity receipt / evidence reference.

## 14. Launch metrics

The first campaign dashboard should measure:

- email pre-registrations
- existing-investor reactivations
- new prospects
- Kickstarter preview clicks
- confirmed Kickstarter followers
- share events
- qualified referral visits
- confirmed referred followers
- stories published
- unique likes
- Reputation accrued
- Standing evidence accrued
- Knightcoin proposed / approved / distributed
- cost per confirmed follower
- prospect -> follower -> advocate -> recruiter conversion

## 15. Campaign operating loop

```text
Choose
  -> Email pre-register / CRM dedupe
  -> Follow Kickstarter
  -> Receive evidence + recognition
  -> Share campaign
  -> Write Crossing Story
  -> Earn Reputation + validated Standing + Knightcoin
  -> Attract likes / referrals
  -> Become Advocate / Recruiter
  -> Generate stronger Kickstarter pre-launch signal
  -> Launch when signal threshold is sufficient
```

This makes Knightsbridge a live constitutional campaign rather than a passive funnel: participation is observable, personhood and persona attribution remain distinct, and economic recognition sits beside — rather than replacing — Standing and Reputation.
