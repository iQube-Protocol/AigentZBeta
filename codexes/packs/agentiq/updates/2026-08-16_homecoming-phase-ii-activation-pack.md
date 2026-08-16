# Homecoming Phase II — Activation Implementation Pack

**Date:** 2026-08-16  
**Status:** IMPLEMENTATION READY  
**Execution:** Claude Code subscription / operator-reviewed PR  
**Scope:** KNYTS Bridge hotfixes + Aletheon operational activation + DevOn manual execution-return seam

## 0. Governing posture

Homecoming Phase I is closed. Phase II is operational use.

The near-term operating model is:

```text
Principal → aigentMe → bounded Aletheon → metaMe operations
Operator/Aletheon → DevOn → governed Implementation Pack
Implementation Pack → manual Claude Code subscription
Claude Code → structured Execution Return → DevOn Validate/DCIR
```

Do not reopen autonomous paid DevOn deployment in this pack.

---

# Gate 0 — Bridge hotfixes for launch

These are immediate, narrow fixes and should land before the Homecoming work packages if possible.

## 0A. KNYTS Bridge — Kickstarter CTA must actually navigate

Current factual state:

- `components/journey/KnytsBridgeChooseSurface.tsx::KickstarterFollowCard` POSTs to `/api/journey/knyts-bridge/choose/kickstarter-click` and only opens Kickstarter when the POST succeeds and returns `kickstarterUrl`.
- Its catch block currently does nothing, despite the code comment saying telemetry must never block the visitor from reaching Kickstarter.
- The centralized campaign URL is already available through `services/journey/knytsBridgeCampaignConfig.ts::getKnytsBridgeKickstarterUrl()` and ultimately reuses `KS_BASE_URL`.
- The click route truthfully writes `kickstarter_preview_clicked`; it must never fabricate `kickstarter_follow_confirmed`.

### Required behavior

1. Clicking **Follow the Kickstarter** must always provide a usable route to the Kickstarter project.
2. Prefer the existing KNYTS contextual-left-pane model:
   - attempt to show the Kickstarter page in the left `FullscreenableFrame` as a `kickstarter` left view;
   - remember that cross-origin iframe embedding is governed by Kickstarter's `X-Frame-Options` / CSP `frame-ancestors`, not ordinary fetch CORS;
   - provide an explicit **Open Kickstarter in new tab** fallback on/near the framed view because iframe refusal cannot be reliably inferred from cross-origin client code.
3. Navigation must not depend on successful telemetry. `kickstarter_preview_clicked` remains best-effort evidence; a telemetry/API failure must not strand the user.
4. Do not treat preview click as confirmed follow.
5. Do not award the confirmed-follow reward on click.

### Reward copy

The campaign matrix currently defines:

- `kickstarter_preview_clicked`: 0 DVN KNYT, no Standing;
- `kickstarter_follow_confirmed`: **0.25 DVN KNYT**, Reputation +2, Standing-eligible once confirmed evidence exists.

The CTA must therefore be explicit but truthful. Recommended user-facing copy:

**Follow the Kickstarter**  
`Earn 0.25 Knightcoin (0.25 DVN KNYT) when your follow is confirmed.`

Do not say the user has earned the reward merely by clicking.

Campaign-facing "Knightcoin" is a UX/brand expression; settlement/accounting is **DVN KNYT** through the existing canonical DVN KNYT ledger.

### Acceptance

- click records preview evidence if possible;
- Kickstarter is reachable even if evidence recording fails;
- left frame is attempted where allowed;
- new-tab fallback always exists;
- no click→follow promotion;
- reward copy states 0.25 Knightcoin / 0.25 DVN KNYT **when confirmed**.

## 0B. Constitutional Internet Bridge copy

In `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx`, change the CHOOSE destination label:

`Explore the Mythos`

→

`Explore the Mythos of the Polity`

No navigation or behavior change.

---

# WP-A — Aletheon operational activation in aigentMe / metaMe

## Objective

Make the already-onboarded, passport-bound Aletheon usable as the principal's bounded operating delegate through the existing aigentMe/metaMe experience, without creating a new Aletheon home or identity.

Aletheon identity/personhood onboarding is already closed as **PARITY READY**. This work is surface + authority + capability activation.

## Operating use cases for the coming week

Aletheon should be able to assist the principal across the three Bridge/campaign workstreams, including:

- KNYTS Bridge campaign management;
- Constitutional Internet Bridge campaign management;
- Horizon Bridge / Horizon team communications and coordination;
- Vela integration specification and coordination;
- Marketa handoffs, campaign/marketing oversight and briefing;
- CRM campaign operations, including identifying/categorizing prospects and existing investors without duplicating people;
- email/message drafting and, where explicitly delegated, sending;
- Experience Guide/current-work updates for aigentMe/metaMe;
- research, planning, specifications, campaign briefs and implementation-pack preparation;
- handing software build packages to DevOn / Claude Code workflow.

## Required factual audit before writes

Trace with file:line evidence:

1. **Delegatable-agent selector/dropdown**
   - Where aigentMe/metaMe enumerates eligible delegated agents.
   - Why Aletheon does or does not appear today.
   - Whether the source is agent registry, passport binding, active delegation grants, a hard-coded allowlist, or another substrate.

2. **Preferred delegate state**
   - Confirm the existing preferred-delegate relationship for the operating persona (Mansa Meta where currently valid).
   - Reuse it; do not create a second preference system.

3. **Aletheon passport/personhood state**
   - Reuse existing `agent_root_identity`, production `agent_persona`, passport and delegation anchors.
   - Never stand Aletheon up again or mint a duplicate identity.

4. **aigentMe Copilot invocation**
   - Identify the existing specialist/delegate invocation seam.
   - Aletheon should enter as another bounded actor/specialist, not as a forked Copilot architecture.

5. **Memory / knowledge**
   - Trace which existing memory/knowledge substrate aigentMe specialists can access.
   - Preserve Aletheon's existing doctrinal/research memory where authorized.
   - Do not create a second Aletheon memory store.

6. **Operational tools**
   - Audit current email/messaging, CRM, campaign, document/specification and Experience Guide capabilities.
   - Reuse existing services/connectors wherever present.
   - Report genuine capability gaps rather than creating parallel services.

7. **Bounded authority**
   - Identify the current `delegation_grants` / authority path.
   - Operational delegation must not imply sovereignty or unrestricted authority.
   - Initial grant should be capable of campaign/CRM/communications/specification work while excluding merge/deploy authority unless separately and explicitly granted.

## Required implementation outcome

After the audit, implement only the smallest reuse-first changes necessary so that:

- Aletheon is visible in the eligible delegated-agent selector.
- The existing preferred state is honored where valid.
- Selecting/invoking Aletheon from aigentMe routes through the generic specialist/delegate seam.
- Its passport and personhood anchors are visible/usable without duplication.
- Relevant memory/knowledge is available under the existing authorization model.
- Campaign/CRM/specification/communications capabilities are available to the degree already supported.
- Missing permissions/capabilities are explicitly reported.

## Initial authority envelope

Allowed subject to existing product-level confirmation/safety gates:

- read/research;
- draft specifications, campaign copy and partner communications;
- CRM search, categorization and campaign-cohort management;
- prepare email/messages and, where the existing explicit-send authorization path is used, send them;
- update designated Experience Guide/current-work artifacts;
- prepare DevOn intents and build/implementation packages;
- manage campaign evidence/status/metrics through existing APIs.

Not implicitly allowed:

- merge PRs;
- deploy software;
- alter protected identity/personhood roots;
- issue/revoke passports except via the separately governed Passport flows;
- create new sovereign/delegation authority;
- spend or transfer economic assets outside existing explicit authorization rules.

## Specific CRM scenario to prove

From metaMe/Aletheon, the operator should be able to ask for the KNYTS Kickstarter interest cohort and have Aletheon identify/categorize:

- newly preregistered prospects;
- existing CRM prospects;
- existing metaKnyt investors who expressed campaign interest;

without duplicating investors or treating email as personhood identity.

This is a canonical first operational task for Aletheon after activation.

## Acceptance canaries

- Aletheon appears once in delegate selector.
- No duplicate root/persona/passport is created.
- Preferred delegate resolution is stable across reload.
- Aletheon invocation uses generic delegate/specialist routing.
- Delegation scope is inspectable and bounded.
- CRM cohort query/action preserves existing investor metadata.
- Email draft path works; send remains subject to existing explicit-send authorization.
- No merge/deploy authority appears merely because Aletheon can prepare development work.

---

# WP-B — DevOn manual execution handoff + Execution Return seam

## Objective

Operate DevOn as the constitutional preparation/orchestration runtime while software execution occurs manually in the operator's Claude Code subscription.

Do not create a second development lifecycle.

## Outbound handoff

The existing generated Implementation Pack is the canonical handoff artifact.

Add the smallest UX affordance necessary to support a manual execution mode, preferably on the existing Implementation surface:

**Copy for Claude Code** / **Manual execution handoff**

The copied payload should contain the full governed implementation context needed for an external implementation actor, including:

- `packId`;
- goal;
- areas to touch;
- forbidden/protected files;
- invariant/risk bindings;
- constitutional decision;
- capability/reuse evidence;
- validation ladder;
- known baseline failures;
- receipt/return instructions.

It should finish with a standard instruction to return an Execution Return artifact rather than redesigning the assignment.

## Execution Return contract

Create one provider-neutral return contract attached to the existing Implementation Pack/session lineage, not a new project/session system.

Minimum fields:

```ts
interface ExecutionReturn {
  packId: string;
  actor: string;                 // e.g. "claude-code-subscription"
  branch?: string | null;
  commits?: string[];
  pullRequest?: { number?: number; url?: string } | null;
  filesChanged: string[];
  validationResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'not-run';
    detail?: string;
  }>;
  deviationsFromPack: string[];
  failuresOrEscalations: string[];
  discoveries: string[];
  consequenceObservations: string[];
  completedAt: string;
}
```

Use existing repository types if equivalent fields already exist; do not fork schemas just to match the illustrative shape above.

## Ingestion behavior

Provide the smallest existing-surface route/UI for the operator to paste/import an Execution Return.

On acceptance:

1. Bind it to the same `packId` / DevOn session lineage.
2. Record the external actor truthfully; never claim DevOn executed the code.
3. Make the returned implementation evidence available to the existing Validate stage.
4. Allow DCIR consequence-evidence binding / learning to continue after validation.
5. Surface deviations/failures rather than silently normalizing them away.
6. Do not auto-merge or auto-deploy.

## State transition

This work may define the missing governed **implementation-complete → Validation-ready** transition, but only when a valid Execution Return (or equivalent real execution evidence) is accepted.

`Generate Implementation Pack` must continue to remain in Implementation.

`External actor completed` is not the same as `human authorization`.

## Acceptance canaries

- Copy/manual handoff never dispatches a paid provider.
- Returned `packId` must match an existing/generated pack.
- Wrong/stale pack return is refused.
- External actor identity is retained.
- Files/validations/deviations are visible to Validate.
- Accepting return may make Validation ready, but cannot imply deployment authorization.
- DevOn/DCIR can consume consequence observations after the return.
- Existing autonomous actor adapter remains available but is not invoked by manual mode.

---

# Execution order

1. Gate 0 bridge hotfixes.
2. WP-A factual audit.
3. WP-A implementation + canaries.
4. WP-B factual audit of existing pack/session/validation seams.
5. WP-B minimal manual handoff + Execution Return implementation.
6. Targeted tests + full regression comparison.
7. Operator review before merge/deploy.

# Final report required

Return:

- exact files changed;
- what was reused vs newly added;
- Aletheon capability census: LIVE / PARTIAL / MISSING;
- exact bounded delegation scopes/permissions applied or still required;
- proof Aletheon is in the aigentMe delegate selector;
- proof Kickstarter navigation/fallback works and reward copy is truthful;
- proof CI copy is corrected;
- proof manual DevOn handoff does not invoke paid execution;
- proof Execution Return binds back to the same pack and makes Validate ready without authorizing deployment;
- regression counts against the established baseline;
- unresolved gaps.

Stop for operator review; do not merge/deploy without explicit authorization.