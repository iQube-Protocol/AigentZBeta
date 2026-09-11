# KNYTS Bridge Campaign Implementation Specification — Claude Code

**Status:** Implementation-ready · operator-directed · 2026-08-16  
**Target:** `dev` branch, human-reviewed merge/deploy  
**Urgency:** Campaign activation targeted for tomorrow  
**Execution mode:** Direct Claude Code subscription session — **not** DevOn repository-dispatch for this pass.  
**Purpose:** Turn the KNYTS Bridge into a live acquisition + advocacy campaign that captures prospects, recognizes existing metaKnyt investors, drives Kickstarter pre-launch follows, and produces three distinct outputs from governed evidence: **Reputation, Standing, and Knightcoin rewards**.

---

## 0. Read first — governing sources

Before changing code, read these repo artifacts and reuse the existing architecture they describe:

1. `codexes/packs/polity-core/constitutional-records/personhood-identity-standing-reputation.md`
   - Standing accrues to the person.
   - Reputation accrues to the persona.
   - Evidence is the bridge between them.
   - One event may produce both, but they are different outputs.
   - DIDQube is the general personhood/identity DataQube class; KybeDID, RootDID, PersonaDID are first-class primitive DIDQube types.

2. `codexes/packs/knyt/items/KNYT_BRIDGE_STANDING_REPUTATION_REWARDS_ACTIVATION_SPEC.md`
   - campaign economics and first reward matrix.

3. `codexes/packs/knyt/items/KNYT_BRIDGE_DEVON_IMPLEMENTATION_SPEC.md`
   - bounded implementation decomposition and reuse map.

4. `codexes/packs/knyt/items/KNYT_CAMPAIGN_OPERATIONS.md`
   - investor cohorts, campaign-state progression, launch operations.

5. Existing implementation surfaces:
   - `components/journey/KnytsBridgeChooseSurface.tsx`
   - `app/bridge/knyts/page.tsx`
   - `services/journey/knytsBridgeCrossingJourney.ts`
   - `services/crm/*`
   - `services/standing/*`
   - `app/api/identity/persona/[id]/reputation/route.ts`
   - `app/components/content/SmartWalletDrawer.tsx`
   - existing social/reward tracking APIs used by `SocialSharingModal`

**Extend; do not duplicate.** Where a generic CRM, reward, reputation, Standing, receipt, social-tracking, journey, wallet, or campaign mechanism already exists, reuse it.

---

# 1. Campaign outcome

The live KNYTS Bridge should make this loop tangible:

**Discover / Choose**  
→ **Pre-register**  
→ **CRM prospect/investor recognition**  
→ **Follow Kickstarter preview campaign**  
→ **Share / tell your Crossing Story / earn engagement**  
→ **Evidence**  
→ **Reputation (persona)** + **Standing (person)** + **Knightcoin reward**  
→ **visible progress / advocacy / recruiting**

The bridge should become an active campaign rather than a static journey.

---

# 2. Constitutional attribution model — non-negotiable

## 2.1 Three outputs, one evidence event

A campaign action may produce all three of the following, but **never by conflation**:

### Reputation
- Persona-grade.
- Attributed to the acting `persona_id` / PersonaDID context.
- Contextual social confidence/recognition.

### Standing
- Person-grade.
- Must resolve through the existing personhood spine to the underlying person-grade anchor before accrual.
- Standing **does not accrue because a persona is popular**.
- It accrues only from constitutionally eligible, validated evidence attributable to the person.

### Knightcoin reward
- Economic/campaign reward.
- Independent of Standing and Reputation.
- Reward amount is governed by the campaign reward matrix and anti-abuse rules.

Canonical rule:

> **Action → Evidence → { Reputation(persona), Standing(person), Reward(economic) }**

and:

> **Reputation does not become Standing. Evidence is the bridge.**

## 2.2 Do not rewrite the identity spine

Do not modify KybeDID, RootDID, Passport, DIDQube, Passport linkage, root identity, persona binding, or Aletheon/Homecoming identity repair code as part of this campaign implementation.

Use existing personhood-resolution APIs/services. If the correct person-grade anchor cannot be resolved, **withhold Standing only** and report/receipt the unresolved attribution. Do not guess. Reputation and eligible campaign reward may still proceed if their own conditions are satisfied.

---

# 3. CHOOSE surface — immediate public campaign UX

Current surface: `components/journey/KnytsBridgeChooseSurface.tsx`.

## 3.1 Replace “Reserve metaKnyt Agentic Graphic Novel” with campaign pre-registration

The first CHOOSE card should become the primary campaign CTA.

Suggested copy:

### Title
**Get first access to the metaKnyt Kickstarter**

### Supporting copy
**Pre-register for the campaign, then follow the Kickstarter preview so you are notified when we launch.**

### Form
- email address — required for anonymous/non-authenticated visitors
- if an authenticated persona already has a known email, prefill where privacy policy allows; do not expose hidden CRM data
- submit CTA: **Pre-register**

On success, show:

**You’re on the list. Now follow the Kickstarter.**

Then expose a clear external CTA:

**Follow on Kickstarter**

Use the actual campaign preview URL from existing campaign config if already present. If it is still a placeholder, centralize it in one campaign config constant/env/config record rather than hard-code it in multiple components.

## 3.2 Do not call this a preorder

Before the Kickstarter itself is live, this is a **pre-registration / follow-notification** action, not a purchase, pledge, reservation with monetary commitment, or paid preorder.

The existing “interest signal, not a payment” honesty pattern should be retained.

---

# 4. CRM capture and dedupe

## 4.1 Goal

Every valid pre-registration should become a campaign-recognized CRM relationship without duplicating people who are already known.

## 4.2 Dedupe hierarchy

Use the strongest existing identifiers available, in this order:

1. authenticated person/persona linkage already known to CRM;
2. normalized email match;
3. existing metaKnyt investor / Reg CF investor CRM record by existing CRM linkage;
4. create a new prospect only when no existing relationship resolves.

Do not create a second prospect merely because the same person enters the campaign through a different surface.

## 4.3 Preserve existing investor status

If the registrant is already a metaKnyt investor, legacy investor, Reg CF investor, cohort member, or otherwise existing CRM contact:

- retain the same CRM record;
- preserve all investor/cohort metadata;
- append campaign engagement state/events;
- do **not** downgrade/replace their state with generic `prospect`;
- record that the existing investor has now joined/followed the current Kickstarter campaign funnel.

Relevant campaign tags/states from `KNYT_CAMPAIGN_OPERATIONS.md` should be reused where compatible:

- `investor`
- `reg_cf_investor`
- `legacy_investor`
- cohort tag
- campaign-state such as `warming`, `reactivated`, `engaged`, `advocate`, `recruiter`

## 4.4 Idempotency

Repeated submission of the same campaign action must not:

- create duplicate CRM personas/prospects;
- create duplicate rewards;
- double-accrue Standing;
- double-accrue Reputation;
- create duplicate evidence for the same idempotency key.

---

# 5. Campaign evidence ledger

Create or extend a generic campaign-evidence mechanism rather than putting reward/Standing logic directly in the React component.

Each evidence record should minimally carry:

- campaign id — reuse `KNYTS_BRIDGE_CAMPAIGN_ID`;
- action/event type;
- timestamp;
- acting persona id when known;
- resolved person-grade/root anchor reference when legitimately available internally;
- CRM relationship/contact reference;
- source surface;
- external reference when applicable;
- idempotency key;
- verification state;
- qualification outputs for Reputation / Standing / Reward;
- linked receipt id(s) where supported.

Keep T0/T1 privacy boundaries intact. Raw person-grade identifiers must not be exposed client-side merely to make campaign attribution convenient.

### Initial event vocabulary

Use a compact, generic vocabulary such as:

- `campaign_preregistered`
- `kickstarter_preview_clicked`
- `kickstarter_follow_confirmed`
- `bridge_shared`
- `qualified_campaign_visit`
- `crossing_story_published`
- `crossing_story_liked`
- `crossing_story_engagement_threshold_reached`
- `campaign_referral_converted`

Reuse an existing generic engagement/reputation/reward event table if it is semantically sufficient. Only add a new table if existing stores genuinely cannot represent the evidence cleanly.

---

# 6. Kickstarter evidence — click is not follow

This distinction is mandatory.

## Preview click

When the user presses **Follow on Kickstarter**:

- record `kickstarter_preview_clicked`;
- send them to Kickstarter;
- this is evidence of intent/traffic only;
- **do not claim they followed/subscribed**;
- **do not award the confirmed-follow reward or Standing**.

## Confirmed follow

`kickstarter_follow_confirmed` may only be recorded when trustworthy evidence exists, e.g.:

- supported Kickstarter callback/integration;
- operator/import reconciliation against campaign follower data;
- another auditable verification method.

If no API exists today, build the data model and reconciliation seam, but do not fabricate confirmation.

---

# 7. Reward matrix — initial campaign values

Use **Knightcoin / KNYT reward units already represented by the existing KNYT reward substrate**. Do not create a second token/balance system.

Initial amounts:

| Action | Knightcoin | Reputation | Standing |
|---|---:|---:|---:|
| Valid email pre-registration | **0.10** | small positive campaign-engagement signal | none by default |
| Confirmed Kickstarter follow | **0.25** | positive campaign-engagement signal | small eligible contribution evidence |
| Share the KNYTS Bridge | **0.10** | positive advocacy signal | none on share alone |
| Share generates qualified unique visit | **+0.15** | stronger advocacy signal | eligible contribution evidence |
| Publish a Crossing Story | **0.50** | creator/story reputation | eligible contribution evidence if person-attributable |
| Unique qualified like received on story | **0.05** to the story author, subject to caps | increases story/persona reputation | **no direct Standing per like** |
| Story reaches 5 unique verified/qualified likes | **+0.25** threshold bonus | reputation milestone | separate Standing-eligible evidence event |
| Referral converts to confirmed Kickstarter follow | **0.50** | recruiter/advocate reputation | Standing-eligible contribution evidence |

These are initial campaign economics, not immutable constitutional values. Centralize them in campaign configuration so they can be adjusted without rewriting attribution logic.

## 7.1 Caps / abuse controls

At minimum:

- no self-like reward;
- unique actor per story like;
- one reward per action idempotency key;
- daily/periodic cap on like-derived Knightcoin;
- repeated link clicks from the same actor do not farm reward;
- anonymous traffic can be recorded as traffic evidence but cannot receive person/persona-linked accrual until attribution requirements are satisfied;
- referrals must be attributable and conversion-confirmed before conversion reward.

Do not create a heavyweight anti-sybil system in this pass; reuse Passport/personhood signals where already available.

---

# 8. Reputation implementation

## 8.1 Persona-grade attribution

Campaign Reputation must stay persona-scoped.

The repository already exposes persona reputation through the Smart Wallet and RQH/reputation pathways. Reuse those stores/interfaces where possible.

Do not use person-level RootDID/Kybe as the reputation partition key.

## 8.2 Campaign reputation categories

Prefer additive categorized evidence rather than a second reputation engine. Useful campaign labels may include:

- `knyt_campaign_engagement`
- `knyt_advocacy`
- `knyt_storytelling`
- `knyt_recruiting`

If existing `crm_reputation_events` / RQH skill-category primitives can carry this cleanly, extend those rather than adding a new reputation store.

---

# 9. Standing implementation — person-grade compatibility seam

The existing implementation historically stores/accrues substantial Standing state through persona-keyed CRM machinery. **Do not rip that out in this campaign.**

Instead:

1. accept campaign evidence with acting persona context;
2. resolve the underlying person-grade anchor using existing personhood/Passport/root resolution mechanisms;
3. determine whether the evidence is Standing-eligible;
4. accrue through the existing Standing service in a way that preserves current compatibility while recording the person-grade attribution/provenance;
5. if the person-grade anchor is unavailable, refuse/withhold the Standing leg only.

Standing remains evidence-driven and event-driven.

### Explicit rule

A like is **not** Standing.

A story crossing a governed threshold such as five unique qualified likes may produce a *new evidence event* (`crossing_story_engagement_threshold_reached`) which can then independently qualify for Standing.

---

# 10. Stories and likes

If the KNYTS Bridge already has a Crossing Story publishing path, extend it. Do not create a parallel social network.

Required capabilities:

- user can write/publish their Crossing Story;
- campaign story is attributable to a persona where known;
- story can be shared;
- authenticated/qualified users can like a story;
- one qualified like per actor/story;
- no self-like reward;
- public like count can be displayed;
- reputation accrual follows persona;
- threshold evidence can feed Standing;
- reward event and receipt are separately recorded.

If the current story feature is incomplete, implement the minimum coherent version needed for campaign launch and explicitly report deferred richer social features.

---

# 11. Smart Wallet and standings presentation

The Smart Wallet already has Tasks, Reputation, Rewards and Standing-related UI. Reuse it.

For the campaign, make the three outputs legible together without collapsing them:

### Recommended campaign summary

**Your KNYTS Campaign**

- Reputation — persona context
- Standing — person-grade constitutional contribution
- Knightcoin — campaign reward balance/earned amount

Show recent reward/evidence actions when available.

## Public standings / leaderboard

Default public social ranking should be based on campaign **Reputation / advocacy / story engagement**, not disclosure of person-grade Standing.

Separate views may include:

- Top storytellers
- Top advocates
- Top recruiters
- Knightcoin earned

Standing may be shown only where existing disclosure policy permits it.

---

# 12. CRM/operator visibility

Add enough operator visibility to answer:

- how many unique preregistrations?
- how many are existing investors vs new prospects?
- which legacy/high-value cohorts reactivated?
- how many preview clicks?
- how many confirmed follows?
- shares / qualified visits?
- stories published?
- likes / engagement thresholds?
- referrals / conversions?
- Knightcoin proposed/distributed?
- campaign Reputation generated?
- Standing-eligible events / Standing accrued?

Do not build a huge analytics product if an existing CRM/admin surface can expose these counters with a small additive panel/query.

---

# 13. Implementation order

Implement in this order so the campaign can ship incrementally while remaining coherent.

## Phase A — acquisition / CRM / evidence

- CHOOSE preregistration UX;
- CRM dedupe;
- preserve investor/cohort state;
- campaign evidence/idempotency;
- Kickstarter preview click;
- receipts;
- central campaign config/reward matrix.

**Gate A:** prove existing investor dedupe + new prospect capture + click-vs-follow honesty.

## Phase B — triple projection

From the same verified evidence event, independently project:

- persona Reputation;
- person-grade Standing where eligible/resolvable;
- Knightcoin reward.

**Gate B:** prove one event can produce separate outputs without one deriving mechanically from another.

## Phase C — stories / likes / referrals

- Crossing Story campaign integration;
- unique likes;
- engagement threshold evidence;
- share referral attribution;
- conversion reward.

**Gate C:** prove anti-double-award and no direct like→Standing conversion.

## Phase D — wallet / standings / operator visibility

- campaign summary in existing wallet/reputation/rewards surfaces;
- standings/leaderboard projection;
- minimal operator metrics.

**Gate D:** prove users can see why they earned each output and operators can see campaign conversion.

---

# 14. Tests / canaries

At minimum, add automated coverage for:

1. New email → one CRM prospect + one prereg evidence event.
2. Same normalized email twice → no duplicate CRM record, evidence/reward idempotent.
3. Existing metaKnyt investor preregisters → same CRM record, investor/cohort tags preserved, campaign engagement appended.
4. Kickstarter preview click ≠ confirmed follow.
5. Preview click cannot receive confirmed-follow Knightcoin or Standing.
6. Confirmed follow can produce independently configured Reputation / Standing evidence / Knightcoin.
7. Reputation attribution remains persona-scoped.
8. Standing leg requires person-grade resolution and refuses/withholds rather than guesses when unresolved.
9. A like updates eligible Reputation/reward but **does not directly accrue Standing**.
10. Five unique qualified likes produce one threshold evidence event, idempotently.
11. Self-like cannot produce reward.
12. Duplicate actor/story likes cannot double-reward.
13. Referral conversion reward only after confirmed conversion.
14. Existing CHOOSE destinations (Store, CI, CFS Pilot, Ask Kn0w1, Share) regress cleanly.
15. Existing SocialSharingModal tracking continues to function.
16. No identity-spine / Passport / root-binding tables are mutated by campaign code except through already-authorized existing services.
17. Reward events produce existing reward/receipt semantics; no parallel KNYT balance created.

Use targeted tests first. Run full regression once at the final gate and compare against the repo's known baseline; do not spend time repairing unrelated baseline failures.

---

# 15. Explicit non-goals / forbidden shortcuts

Do **not**:

- redesign KNYTS Bridge architecture;
- duplicate CRM;
- duplicate RQH/reputation;
- duplicate Standing;
- duplicate RewardHub/KNYT balance;
- create a second social-sharing system;
- treat email as personhood proof;
- infer RootDID/Kybe from display name or email;
- equate Kickstarter click with follow;
- equate popularity/reputation with Standing;
- award Standing for every like;
- rewrite Passport / KybeDID / RootDID / PersonaDID ontology;
- merge directly without operator review;
- hide failed reward/Standing attribution by fabricating success.

---

# 16. Implementation discipline for this Claude Code run

This is an urgent campaign build, but correctness still matters.

1. Start with a factual code audit and list exact reuse points before edits.
2. Prefer extending existing services over adding tables/services.
3. If a schema change is required, explain why existing tables are insufficient before creating it.
4. Keep campaign economic values centralized and configurable.
5. Commit in coherent gates/phases where practical.
6. Report any live external-integration gap honestly (especially Kickstarter confirmation).
7. Do not block the whole launch if one projection cannot resolve: record the evidence, grant only outputs whose criteria are satisfied, and make the missing leg explicit.
8. End with a deployment/readiness report including:
   - files changed;
   - migrations;
   - tests;
   - live/manual steps still required;
   - environment variables/config required;
   - exact Kickstarter URL/config state;
   - reward matrix actually deployed;
   - known gaps;
   - whether the campaign can be announced tomorrow.

---

# 17. Acceptance criteria — launch ready

The implementation is launch-ready when:

- a visitor can preregister from CHOOSE;
- duplicate submissions do not create duplicate prospects;
- known investors are recognized and preserved as investors;
- registrants are invited to follow the Kickstarter preview;
- preview click is tracked honestly and separately from confirmed follow;
- campaign evidence is auditable/idempotent;
- eligible actions can independently generate persona Reputation, person-grade Standing evidence/accrual, and Knightcoin rewards;
- one event may generate both Standing and Reputation but they remain distinct outputs;
- the wallet/campaign UI makes the three outputs legible;
- story/share/like/referral mechanics cannot trivially farm rewards;
- no personhood/identity ontology regression is introduced;
- existing Bridge destinations still work;
- operator can see campaign conversion and engagement state;
- tests/regression are clean relative to baseline;
- human review/merge remains the final deployment authorization.

---

## Operator shorthand

**Turn KNYTS Bridge into the live campaign loop:**

**Choose → Pre-register → Recognize → Follow → Share / Story → Evidence → Reputation + Standing + Knightcoin → Advocate / Recruit.**

**One event can produce both Standing and Reputation, but they are different outputs. Evidence is the bridge.**
