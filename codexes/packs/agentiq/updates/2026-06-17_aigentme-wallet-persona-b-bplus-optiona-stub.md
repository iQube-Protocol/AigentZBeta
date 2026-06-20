# aigentMe as a wallet persona — B (engage), B+ (act-as), A (admin stub)

**Date:** 2026-06-17
**Surface:** Polity Passport (Apply tab) + SmartWalletDrawer persona switcher
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

Closes the loop: once an agent is designated a citizen's **aigentMe** (via
genesis, one-click create, or promotion of an existing delegate), it now surfaces
as a **persona in the wallet** — renameable via the normal Edit Persona flow,
and activatable.

### Identity model (operator-confirmed: B + B+, with A stubbed)

- **B — engage (default).** Tapping the aigentMe in the persona switcher
  **engages** it as your delegate/chief-of-staff (`aigentme-engaged` event) and
  does **not** swap your active spine persona. You stay sovereign; ownership,
  receipts, access, and Standing remain attributed to your citizen identity.
- **B+ — act as (advanced).** An explicit **"Act as"** control performs the full
  persona switch so you occupy the agent seat and the aigentMe acts directly.
  This needs **no change to the protected `getActivePersona`** — the aigentMe is a
  real `personas` row owned by your auth profile, which the spine already accepts.
  While acting as the aigentMe, a persistent **banner** ("Acting as your aigentMe
  (<name>) — you are in the agent seat") with a one-tap **"Return to <citizen>"**
  renders at the top of the wallet drawer; return restores the persona captured
  when "Act as" was pressed (falling back to the first human persona).
- **A — autonomous agent (admin-only STUB).** A clearly-labelled, disabled
  "Deploy as autonomous agent" affordance in the agent-setup step, visible only
  to admins. **Guardrails captured for when it's built:** an autonomous agent
  gets **no kybe DID**, can **never present as a human/citizen**, stays
  **identifiable as an agent**, and **cannot hold a citizen passport** (agent
  class only).

## Backend

`services/agents/provisionAigentMePersona.ts` (new) idempotently creates the
aigentMe `personas` row:
- `auth_profile_id` = caller (owned → surfaces in `/api/wallet/personas`, enables B+)
- `app_origin = 'aigent-me'` (the switcher marker; agent, not human)
- `root_did = agent.did_uri` (link to the agent — confirmed columns only, no
  dependency on `persona_agent_binding`)
- **no kybe identity attached** — consistent with the agent-not-human rule
- `default_identity_state = 'anonymous'`

Wired (best-effort, never breaks the flow) into:
- `POST /api/agents/aigentme` (create)
- `PATCH /api/agents/aigentme` (promote existing delegate)
- `POST /api/agents/genesis` (when `isAigentMe`)

## Frontend

- `SmartWalletDrawer` persona switcher: aigentMe rows (`appOrigin==='aigent-me'`)
  show a **★ aigentMe** badge, default tap = **engage** (B), plus an **"Act as"**
  button (B+) when not already active.
- `PassportBureauApplyTab`: admin-only **Option A** stub with the no-kybe /
  no-citizen / always-agent guardrail copy.

## Also in this push (separate fixes)

- Approved-but-unclaimed delegate passports no longer show "Awaiting issuance"
  (resolved via the application→passport linkage in `/api/persona/sponsored-agents`).
- Delegation trust band is clamped to the persona's max grantable band, fixing
  "Insufficient reputation. Required: 20, current: 0" for fresh citizens.

## Files

- `services/agents/provisionAigentMePersona.ts` (new)
- `app/api/agents/aigentme/route.ts`, `app/api/agents/genesis/route.ts`
- `app/components/content/SmartWalletDrawer.tsx`
- `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx`
- `app/triad/components/codex/tabs/BoundedDelegationTab.tsx` (band clamp)
- `app/api/persona/sponsored-agents/route.ts` (awaiting-issuance fix)

No new migration — uses confirmed `personas` columns. All paths soft-fail when
prerequisite migrations are pending.
