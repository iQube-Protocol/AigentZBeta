# Operator Signing Runbook — EXP-P1 Agreement (INTERNAL)

**For Dele · not part of the Austin package.** The Institute side of the x409 handshake: **form** the agreement, then **authorize** after Austin's agent accepts. Both run through the gated route (`POST /api/constitutional/agreement`) as your authenticated persona — this is what makes you the owner and the only party able to authorize.

## Prerequisite (one-time env)

Set the steward-of-record persona (used for receipts on external acceptance/submission):

```
RESULTS_STEWARD_PERSONA_ID=<your personaId>   # Amplify env var, then rebuild
```

Without it, acceptance/submission still succeed but their receipts fail-soft (logged, not written).

## Step 1 — Form the agreement (you, once)

Run in the browser console at https://dev-beta.aigentz.me while logged in (the spine needs your Bearer token; this pulls it from localStorage per the CLAUDE.md debugging pattern). **Pick an unguessable agreementId** — it is the capability credential you'll share privately with Austin:

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const parsed = JSON.parse(localStorage.getItem(k));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  const r = await fetch('/api/constitutional/agreement', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'form',
      agreementId: 'exp-p1-austin-' + crypto.randomUUID().slice(0, 13),  // unguessable slug
      displayLabel: 'EXP-P1 joint pre-registration + external result submission (Austin Ambrozi / Autonomi Solutions)',
      capabilityRef: 'irl:experiment-result:submit',
      selectedAgentRef: 'agent:austin-autonomi',   // agree this ref with Austin first
      delegatedAuthority: {
        band: 'L2',
        allowedActions: ['publish-result'],
        forbiddenActions: ['ratify', 'flip-authoritative', 'edit-crystal', 'read-persona'],
        allowedSurfaces: ['irl:experiment-result:submit'],
        ttlHours: 1080,          // 45 days — the EXP-P1 §13 window + margin
        maxActions: 8,           // EXP-P1 + IRV/IPV re-runs + margin
        valueCeiling: null       // free submission (read-write risk; CFS-043 graded proof: weak captcha suffices)
      },
      verificationRequirements: ['captcha-verified-authorizer'],
      constraints: ['results must be hash-consistent with the frozen pre-registration bundle (EXP-P1 §10/§11)'],
      governingInvariants: []
    })
  });
  console.log(JSON.stringify(await r.json(), null, 2));
})();
```

**Copy the `agreementId` from the response and send it to Austin privately** (it goes in the `<AGREEMENT-ID>` slots of his one-pager). Do not publish it.

## Step 2 — Austin's agent accepts

Nothing for you to do — his agent runs one-pager §4b. Check acceptance landed:

```bash
curl -s "https://dev-beta.aigentz.me/api/public/irl/agreement?agreementId=<AGREEMENT-ID>"
# status should be "accepted", acceptance.acceptorType "agent"
```

Confirm `acceptance.commitmentHash` is present and `selectedAgentRef` is the agreed ref before authorizing.

## Step 3 — Authorize (you, once — THE countersignature)

Same console pattern; this is the EXP-P1 §15 freeze + the submission-gate opening, and only your persona (owner-commitment match) can do it:

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const parsed = JSON.parse(localStorage.getItem(k));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  const r = await fetch('/api/constitutional/agreement', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'authorize', agreementId: '<AGREEMENT-ID>' })
  });
  console.log(JSON.stringify(await r.json(), null, 2));
})();
```

From here Austin's agent can submit (one-pager §5) until TTL/budget lapse. An `agreement_authorized` receipt (DVN-anchorable) records your countersignature.

## Revoke / inspect at any time

- **Inspect:** `GET /api/constitutional/agreement` (console pattern, your token) lists your agreements; the public `GET /api/public/irl/agreement?agreementId=` shows the safe view.
- **Revoke:** the gate re-checks status + TTL + budget on every submission. TTL lapse or budget exhaustion closes it automatically (409). For immediate revocation ahead of TTL, flip the agreement row's status off an open state in Supabase (`constitutional_agreements` table) — the next submission 409s.

## Honest posture (recorded)

This is the **capability-URL v1** of CFS-042 Phase 2: the unguessable agreementId + pre-named `selectedAgentRef` binding + operator-only authorization stand in for a full agent-passport auth seam (the CFS-043 guided passport flow remains the onboarding upgrade path). Acceptance can only bind to the pre-named agent; nothing but your authenticated persona can authorize; every act is receipted. Deliberately simple, deliberately bounded — turnkey for the EXP-P1 window.
