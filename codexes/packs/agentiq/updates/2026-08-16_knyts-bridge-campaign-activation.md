# KNYTS Bridge Campaign Activation — Launch-Readiness Report

**Date:** 2026-08-16 (amended same day after a pre-push constitutional audit)
**Branch:** `claude/resume-consumer-session-qm3v7c` (commits `249bb8661`, `394a995da`, plus the post-audit attribution fix) — **not pushed, not merged to `dev`**
**Governing spec:** `codexes/packs/knyt/items/KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md`
**Status:** Gates A, B, D implemented and tested. Gate C implemented except share/referral triple-projection (deliberate, reported gap). A pre-push audit found and this patch fixes a cross-persona Reputation-misattribution defect (§9). Person-grade Standing unification remains a named, deferred post-launch migration (§9.3) — not fixed here, per operator instruction. Human review/merge is the final deployment authorization per the spec — this stops here.

---

## 1. Factual reuse audit (summary)

Full detail was reported to the operator in-conversation before implementation began. In short: every new capability extends an existing substrate — `campaign_events`/`campaignRegistry.ts` (share-reward wiring for this exact campaign id), `crm_personas`/`nakamoto_knyt_personas` (CRM + real investor records), `crm_reputation_events`/RQH (persona reputation), `standingAccrualService.accrueStanding()` (person-grade Standing), `knytLedgerService.creditKnyt()` (the one deployed KNYT balance), `knyts_bridge_editorial_config` (copy/media), and `SmartWalletDrawer`'s existing Reputation & Standing tab. Two new tables and one CHECK-constraint widening were added only where the existing schema genuinely could not represent the new requirement (see migration header comments for the justification of each).

## 2. Files changed

**New:**
- `services/journey/knytsBridgeCampaignConfig.ts` — centralized Kickstarter URL + reward matrix
- `services/crm/campaignContactResolver.ts` — CRM dedupe hierarchy
- `services/campaign/knytsBridgeCampaignEvidence.ts` — idempotent evidence ledger
- `services/campaign/knytsBridgeCampaignProjector.ts` — Gate B triple projection
- `app/api/journey/knyts-bridge/choose/kickstarter-click/route.ts`
- `app/api/journey/knyts-bridge/community/[id]/like/route.ts`
- `app/api/journey/knyts-bridge/campaign-summary/route.ts`
- `app/api/journey/knyts-bridge/operator-metrics/route.ts`
- `components/journey/KnytsBridgeCampaignSummaryCard.tsx`
- `supabase/migrations/20260930003200_knyts_bridge_campaign_activation.sql`
- `tests/knyts-bridge-campaign-activation.test.ts` (41 tests)
- `tests/knyts-bridge-cross-persona-attribution.test.ts` (12 tests, added post-audit — §9)

**Modified (post-audit, §9):**
- `services/crm/campaignContactResolver.ts` — cross-persona Reputation-misattribution fix

**Modified:**
- `app/api/journey/knyts-bridge/choose/book-interest/route.ts` — now dedupes, captures anonymous email, records evidence, projects outputs
- `components/journey/KnytsBridgeChooseSurface.tsx` — pre-registration copy + Kickstarter follow CTA; other five destinations unchanged
- `app/api/community-content/[id]/publish/route.ts` — records `crossing_story_published` evidence, scoped strictly to this campaign's tag
- `app/components/content/SmartWalletDrawer.tsx` — one new import + one new JSX line mounting the campaign summary card
- `services/campaign/ksRewards.ts` — exported the existing `KS_BASE_URL` constant (one-line change) so the campaign config can reuse it
- `types/crm.ts` — added `'campaign_contribution'` to `ReputationEventSourceType` (additive)

## 3. Migrations

`supabase/migrations/20260930003200_knyts_bridge_campaign_activation.sql` — additive only:
1. `knyts_bridge_campaign_evidence` (idempotent evidence ledger, RLS enabled, server-role only)
2. `knyts_bridge_story_likes` (unique per actor/story)
3. Widens `crm_reputation_events_source_type_check` by exactly one value

**This migration has not been applied to any live database in this pass.** Apply it before the campaign routes are exercised:

```bash
# from a machine with the Supabase CLI configured against the target project:
supabase db push
# or, applied directly via the SQL editor — paste the full contents of:
# supabase/migrations/20260930003200_knyts_bridge_campaign_activation.sql
```

## 4. Tests

41 targeted canaries in `tests/knyts-bridge-campaign-activation.test.ts` — reward matrix constitutional distinctions, CRM dedupe precedence, evidence idempotency, Gate B lane-independence, self-like/cap/threshold invariants, admin gating, and CHOOSE-surface regression. Plus 12 behavioral canaries in `tests/knyts-bridge-cross-persona-attribution.test.ts` (added post-audit, §9) driving the real `resolveCampaignContact()` against a fake in-memory CRM store. All 53 pass.

Full regression (post-fix): **17 failed files / 40 failed tests — unchanged from the established baseline** (confirmed by exact failing-file-set diff, not just counts). Typecheck: **675 errors before and after — unchanged baseline** (the touched files carry zero new errors).

## 5. Manual/live steps still required before announcing

1. **Apply the migration** (§3) to the target Supabase project.
2. **Confirm `KICKSTARTER_CAMPAIGN_URL`** env var, or accept the fallback: `getKnytsBridgeKickstarterUrl()` already resolves to the real, live project (`https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats-0?ref=9pbmus` — corrected 2026-08-16 with the operator-provided `-0` slug suffix; the same correction was applied to the two other pre-existing hardcoded copies of this URL, `app/api/crm/track/ks/route.ts` and `app/api/mvl/send/route.ts`) if the env var is unset — nothing further is required to ship, but set the env var if the operator wants campaign traffic separately attributable from the investor-reward tracking links in `ksRewards.ts`.
3. **Smoke-test live**: submit a test email through CHOOSE, confirm one `knyts_bridge_campaign_evidence` row and one `crm_personas` row are created, submit the same email again and confirm no duplicate row appears.
4. **Operator metrics**: `GET /api/journey/knyts-bridge/operator-metrics` (admin-gated, same `requireAdminPersona` gate as the existing Crossing-of-the-Week admin route) — no UI panel was built for this in this pass; the counters are queryable now via that route or a follow-up admin-panel addition.

## 6. Reward matrix actually deployed

Centralized in `services/journey/knytsBridgeCampaignConfig.ts::KNYTS_BRIDGE_REWARD_MATRIX` — the exact initial values from the spec (pre-register 0.10 KNYT, confirmed follow 0.25, share 0.10, qualified visit +0.15, story published 0.50, like 0.05 capped, 5-like threshold +0.25, referral conversion 0.50), each also carrying its Reputation delta and Standing eligibility/CVS. Adjustable in one place without touching attribution logic.

## 7. Known gaps — reported explicitly, not hidden

1. **Kickstarter confirmed-follow — cannot be automated today.** `kickstarter_follow_confirmed` evidence has NO writer in this pass. Kickstarter exposes no public API/webhook for "this person followed/subscribed to a project" — no external confirmation signal exists to consume. The data model (`evidenceGrade: 'external-confirmed'`, the action type itself, the full reward-matrix row) is fully built and ready to consume such a signal the moment one exists (an operator CSV import against Kickstarter's own follower export, or a future Kickstarter API grant, would both slot into `recordKnytsBridgeEvidence({actionType:'kickstarter_follow_confirmed', evidenceGrade:'external-confirmed', ...})` with zero further code changes). **This is the single largest gap and the one most likely to block a "confirmed follow" reward claim being paid at launch** — until an import/reconciliation path is built, no visitor can receive the confirmed-follow Reputation/Standing/Knightcoin, only the honest preview-click signal.
2. **Share/referral triple-projection not wired.** `bridge_shared`, `qualified_campaign_visit`, and `campaign_referral_converted` evidence recording (Gate B for these three action types) was deliberately not connected to the existing `/api/social/track` route in this pass, to avoid creating a second, competing reward mechanism on top of the one already live and working for this exact campaign id (`distributeShareReward`/`rewards_ledger`, already registered in `campaignRegistry.ts`). Sharing continues to work exactly as before; it does not yet independently emit Reputation/Standing evidence through the new Canon-II ledger.
3. **No operator-facing UI for `operator-metrics`.** The route exists and is admin-gated; a small panel (following the existing `KnytsBridgeAdminPanel.tsx` pattern) was not built in this pass.
4. **Investor `campaign_state`/click/backed timestamps deliberately untouched.** The resolver only appends `campaign_tags`; it never writes `nakamoto_knyt_personas.campaign_state`, `kickstarter_clicked_at`, or `kickstarter_backed_at`, since those columns are owned by the live email-send/tracking pipeline and writing them here risked corrupting that pipeline's own state machine.

## 9. Pre-push constitutional audit + fix (2026-08-16)

Before pushing, a constitutional audit traced Standing/Reputation attribution end-to-end against Canon II (`codexes/packs/polity-core/constitutional-records/personhood-identity-standing-reputation.md`: *"Standing accrues to the person. Reputation accrues to the persona. Evidence is the governed bridge."*) using the exact two-persona scenario — one real person acting through Persona A and Persona B, sharing the same email.

### 9.1 Defect found and fixed — cross-persona Reputation misattribution

`campaignContactResolver.ts`'s email-match step could hand Persona B the SAME `crm_personas` row already bound (via `identity_persona_id`) to Persona A whenever B supplied A's email. Since `crmPersonaId` is the Reputation-partition key consumed by `knytsBridgeCampaignProjector.ts`'s `createReputationEvent()`, this meant **B's Reputation could silently accrue onto A's record** — a direct violation of "Reputation accrues to the persona" for the non-acting persona, not merely an incompleteness.

**Fix:** `resolveCampaignContact()`'s email-match branch now checks whether the matched row is already `identity_persona_id`-bound to a *different* persona than the one acting. If so, that row is used only for CRM/investor context (its own investor tags are still appended) and is never returned as the acting persona's attribution record; control falls through to create/reuse a row scoped specifically to the acting `activePersonaId`. Preserved unchanged: anonymous email-only prospects, an email match against an unbound row, the same persona returning with the same email, and known-investor recognition — each has its own regression canary in `tests/knyts-bridge-cross-persona-attribution.test.ts`.

Verified behaviorally (not just structurally) against a fake in-memory CRM store: two personas sharing one email now resolve to two distinct `crm_personas` rows, each persona's own row is stable across repeat calls, investor recognition is still shared as context via the same email, and repeating either persona's action never creates a third row or double-credits.

### 9.2 Reward currency — confirmed, not changed

`services/wallet/knyt/knytLedgerService.ts` is the canonical DVN KNYT ledger (its own header: *"Core service for DVN KNYT (x402 ledger) operations"*; `wallet_balances`/`wallet_transactions` fields are literally named `dvnKnyt`). `creditKnyt()` — the only reward-writing call in the projector — is that same substrate. "Knightcoin" is campaign-facing copy only; settlement is DVN KNYT throughout. No second ledger was created; none is needed.

### 9.3 Named, deferred gap — person-grade Standing unification (NOT fixed in this patch, by design)

**Standing still does not unify across two personas of one person.** `accrueStanding()` (`services/crm/standingAccrualService.ts`) remains keyed by `crm_persona_reputation.persona_id = crmPersonaId` — unchanged, per operator instruction not to introduce another heuristic persona→person resolver into this campaign patch. Persona A and Persona B of the same real person, each with their own `crm_personas` row (guaranteed distinct by the §9.1 fix), will each independently accrue Standing on their own row rather than converging on one person-level Standing entitlement.

This is now recorded as a **named post-launch constitutional migration**: a genuine person-grade Standing unification requires walking the real personhood spine (KybeDID/RootDID/Passport — e.g. `resolvePassportPrincipalById`/`resolveRootPrincipalForAuthUser` in `services/identity/passportPrincipal.ts`) to resolve the underlying person, then re-keying Standing accrual to that anchor rather than to `crm_personas.id`. `KNYT_BRIDGE_STANDING_REPUTATION_REWARDS_ACTIVATION_SPEC.md` §3 anticipates exactly this: *"Add a person-grade attribution seam... until a dedicated Standing migration is authorized."* That migration is out of scope for tomorrow's launch and should be tracked as its own workstream.

## 10. Verdict

**READY TO PUSH — WITH STANDING MIGRATION DEFERRED.**

Launch-ready for the acquisition/CRM/evidence loop (Gate A) and the triple-output attribution model (Gate B), with the cross-persona Reputation defect fixed and verified. The confirmed-Kickstarter-follow reward (gap §7.1) will not pay out until an operator-side reconciliation step exists; recommend announcing pre-registration and "follow the Kickstarter" prominently, and treating confirmed-follow rewards as a fast-follow once a reconciliation import is authorized. Person-grade Standing unification across a person's multiple personas (§9.3) is a real, named limitation — Standing still accrues correctly to whichever single persona/CRM-contact performed each action, but will not converge across two personas of the same person until the deferred migration lands.

**Human review/merge remains the final deployment authorization**, per the governing spec. This branch has not been pushed to the remote: this repo's existing `merge-claude-to-dev` GitHub Action auto-merges any push to a `claude/**` branch straight into `dev`, which would bypass the review this task explicitly required. To review and ship:

```bash
# review the diff locally:
git fetch origin claude/resume-consumer-session-qm3v7c
git log -1 --stat origin/claude/resume-consumer-session-qm3v7c 2>/dev/null || \
  git -C <local-clone> log -1 --stat claude/resume-consumer-session-qm3v7c

# once reviewed, push to land it on the session branch (this WILL auto-merge to dev):
git push -u origin claude/resume-consumer-session-qm3v7c
```
