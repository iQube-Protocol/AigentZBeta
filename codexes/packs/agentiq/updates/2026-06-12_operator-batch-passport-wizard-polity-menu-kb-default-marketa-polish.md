# 2026-06-12 — Operator batch: passport wizard, Polity Passport menu, copilot KB default, Marketa polish

Session branch: `claude/optimistic-davinci-exiykx` (same session as the
golden-path completion doc). This records the operator-directed batch that
followed: Marketa UI polish, the SmartTriad KB default fix, Gmail 1:1 send,
passport lifecycle improvements, the Polity Passport menu in AgentiQ, the
citizen/participant wizard, and the Turnstile CAPTCHA integration.

## Marketa cartridge polish

- **Rep → Reputation** button label (`20c7827b`).
- **Pink copilot accent** — new `pink` palette in `CodexCopilotLayer`
  (`ACCENT_PALETTES`); Marketa copilot switched from `rose` to `pink` to
  match the cartridge (`20c7827b`).
- **Passport approved badge** — light green glass pill
  (`bg-green-400/15 text-green-300 border-green-400/30 backdrop-blur-sm`);
  in-flight statuses amber, not_started slate (`20c7827b`).
- **Claim passport (W3C VC)** — approved passports render a green glass
  pill on the scorecard chip linking the Phase A credential envelope route
  `/api/polity-passport/credential/[passportId]`. FIO @aigent stays
  stubbed (`aae90775`).
- **Q¢ secondary display** — opportunity rows show the Q-cent count next
  to the USD primary ($1 = 100 Q¢ canon); macro dashboard stays USD
  (`aae90775`).
- **Passport auto-sync** — selecting a candidate whose passport is
  in-flight fires a silent Bureau re-sync so steward approvals flip the
  chip without re-clicking Passport (`8dbfd7b1`).
- **Gmail 1:1 send** — outreach send accepts `sendVia: 'gmail'`
  (delegates to the `google.gmail.send` connector with the operator's
  personaId) alongside the default Mailjet path; UI send-via selector
  (`8dbfd7b1`).

## SmartTriad copilot KB default (PARAMOUNT behaviour fix)

All copilots were defaulting to the metaKnyts KB through the
`aigent-marketa` mapping. Operator decision: the global SmartTriad KB
fallback chain is **aigentMe → metaMe → aigentC → aigentZ**. Implemented in
`SmartTriadCopilotLayer.tsx` (`domainForPersona`) and documented at the
KB gate in `app/api/codex/chat/route.ts`: only `aigent-kn0w1` (metaKnyts)
and `aigent-moneypenny` (qriptopian) get cartridge KBs; every other
persona resolves to `'aigentMe'`, which returns an empty content scaffold
until aigentMe/metaMe KBs are populated (`8dbfd7b1`).

## Polity Passport as first-class AgentiQ menu (`f4e322d4`)

Replaced the placeholder Operations Hub in `AGENTIQ_CARTRIDGE` with a
`passport` group at order 6 (between Governance and Ecosystem). Apply /
Registry / Steward tabs mirror the canonical
`POLITY_PASSPORT_BUREAU_CARTRIDGE` via the hoisted
`polityPassportTabsByGroup` helper with lazy `subTabs` getters — 3 levels
deep, in lockstep with the Bureau cartridge. Steward keeps `adminOnly` at
every level (the gate already existed on the Bureau cartridge; never
weakened). `operators-manual` re-homed to Governance (order 90, still
admin-only).

## Passport wizard: citizen / participant (`f72d55e3`)

`PassportBureauApplyTab` now opens with a Class step:

- **Citizen** — original anonymous flow unchanged
  (account → identity → vault → consents → captcha submit).
- **Participant** — per PRD, apply for an agent: the Agent panel captures
  display name, agent-card URL (Bureau identity anchor), type,
  description, capabilities, and binds the agent to the applicant via an
  **AgentiQ OS bounded-delegation grant** (trust band + TTL; same
  `/api/codex/chat/agentiq-os/delegation` surface as
  BoundedDelegationTab). Submit posts the `agent_participant_passport`
  application through `/api/polity-passport/submit` with the four
  mandatory Bureau consents and the delegation binding in `references`.

## CAPTCHA (Cloudflare Turnstile)

- `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` added to the
  Amplify env allowlist (`scripts/create-env-production.js`).
- The citizen submit step now renders the **real Turnstile widget** when
  the site key is configured (script loaded once, explicit render, token
  → `captchaToken`, expiry/error resets); falls back to the manual
  dev-token input when unset.
- Operator setup: Cloudflare dash → Turnstile → Add widget (hostnames =
  dev/prod hosts, Managed mode) → put both keys in Amplify env vars →
  redeploy.

## Open items

- Steward "needs human approval" flagging after Registry click — the
  operator wants a clearer stage indicator (auto-sync now helps; a
  dedicated pending-steward badge may follow).
- aigentMe / metaMe KB population — the fallback chain is wired; the KBs
  themselves don't exist yet.
- CRM bridge decision for opportunities — still open.
