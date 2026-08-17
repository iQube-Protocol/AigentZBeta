# Homecoming Closeout — final summary

**Operator's closing statement (2026-08-17), verbatim:**

> Aletheon is no longer merely admitted, bound, selectable, or conversational. She is now
> connected to the operating office through bounded executable authority.

This closes the "Homecoming Closeout — Aletheon Delegated Execution + Contact Substrate"
package. Prior Homecoming phases established that a delegated Agent could be **assigned** to the
aigentMe role, **hydrated** with her own registered persona/system instructions, and made the
**conversational speaker** (WPA-3). This closeout adds the missing piece: that assignment now
carries **executable authority**, bounded by an explicit delegation grant, at the actual point
where a connector runs — not just at the surface where she speaks.

## What shipped

| Item | What it does | Key files |
|---|---|---|
| WPA-3 (tail) | Any assigned Agent speaks with her own registered voice; TTS control reused, not reimplemented, on the floating copilot | `services/agents/aigentMeRoleResolution.ts`, `components/smarttriad/copilot/{useTTSListen,TTSListenButton}.tsx` |
| WP-C1 | Normalized the abstract delegation-grant action vocabulary (`allowed_actions`) onto the real connector-id vocabulary already used by Command Center connectors | `services/delegation/delegatedActionVocabulary.ts` |
| WP-C2 | **The authority gate itself** — before any consequential connector executes, checks the assigned Agent's single active grant matches her own `agent_root_did`, covers the canonical action, covers the surface, and has budget remaining. A no-op when no Agent is assigned (Default Agent Me never inherits a delegate's grant). Independent of, and never bypassing, the pre-existing approval-token gate. | `services/delegation/delegationAuthorityGate.ts`, wired into `app/api/connectors/execute/route.ts` |
| WP-C3 | Delegated-action attribution on the existing activity-receipt structure — no schema migration. Carries `principalPersonaId`, `actingAgentRootId/Did/DisplayName`, `actingRole: 'aigentMe'`, `delegationGrantId`, `delegatedAction`, `executionSurface/Mode`, `connectorId`, `outcome` inside the existing `actionInput`/`contextShared` JSON fields. | `app/api/connectors/execute/route.ts`, `services/receipts/activityReceiptService.ts` |
| WP-C4 | Grant creation/refresh/revoke UX + a Founder Command Center preset. 8-hour ceiling unchanged. | `app/triad/components/codex/tabs/BoundedDelegationTab.tsx` |
| WP-C5 | Behavioral end-to-end tests against the REAL `/api/connectors/execute` route — Aletheon is the acceptance case, but nothing in the gate/route names her | `tests/homecoming-closeout-wpc5-aletheon-e2e.test.ts` |
| WP-C6 | Canonical recipient resolver (`resolved`/`ambiguous`/`not-found`) replacing an inline lookup that silently guessed on ambiguity; fixed a real bug where the template-fallback draft path dropped a resolved recipient | `services/contacts/resolveRecipient.ts` |
| CI fix | Anonymous Constitutional Internet book-interest submissions no longer silently discarded (`{ok:true, persisted:false}`) — resolved through a new **generic** CRM contact layer, deliberately not the KNYTS-specific investor/tagging resolver | `services/crm/genericContactResolver.ts` |

## Deliberately deferred (named, not silently dropped)

**Gmail correspondent extraction** — blocked pending `persona_contacts.source` schema extension
and confirmed Gmail read-scope authorization. Full 5-step follow-on documented in
`codexes/packs/agentiq/updates/2026-08-17_homecoming-closeout-wpc6-gmail-correspondence-deferred.md`.

## Verification

- `npx tsc --noEmit`: 674 errors — unchanged baseline throughout every checkpoint.
- `npx vitest run tests/`: 17 failed / 40 failed test files — unchanged baseline (pre-existing,
  unrelated failures); zero regressions introduced.
- New test files, all passing: `homecoming-phase-ii-wpa3-response-identity`,
  `homecoming-phase-ii-wpa3-floating-copilot-tts`, `homecoming-closeout-wpc2-delegation-authority-gate`,
  `homecoming-closeout-wpc4-grant-ux`, `homecoming-closeout-wpc5-aletheon-e2e`,
  `homecoming-closeout-wpc6-contact-resolution`, `homecoming-closeout-ci-anonymous-book-interest`.

## Commits (local branch `claude/resume-consumer-session-qm3v7c`, pushed 2026-08-17)

`c217b90b3`, `517dc9ad0`, `24bfc5e19`, `4512546c6`, merged with a concurrent session's unrelated
KNYTS Bridge CHOOSE fixes at `d30e44a04`.

## Resolution record

Captured per CLAUDE.md's Resolution → Invariant Loop (trigger: milestone-complete):
`codexes/packs/agentiq/resolution-records/records/RES-2026-08-17-HOMECOMING-CLOSEOUT-ALETHEON-DELEGATED-EXECUTION-001.json`,
producing candidate invariant
`CI-2026-08-17-DELEGATION-AUTHORITY-GATE-AT-EXECUTION-SEAM-001` — the bounded-executable-authority
pattern this closeout's headline statement describes, generalized to any assigned Agent, not
hardcoded to Aletheon.
