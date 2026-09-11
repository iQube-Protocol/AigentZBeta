# Commit Brief: `b0396c4` — Homecoming Phase II WP-A Increment 2: aigentMe-role runtime resolution end-to-end

| Field | Value |
|-------|-------|
| SHA | [`b0396c4`](https://github.com/iQube-Protocol/AigentZBeta/commit/b0396c49ef98d43c386fddfa6c98a9023d7d580f) |
| Author | Claude |
| Date | 2026-08-16T20:44:25Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Homecoming Phase II WP-A Increment 2: aigentMe-role runtime resolution end-to-end

Implements the operator-directed three-axis model in full, no schema
changes:

- services/agents/aigentMeRoleResolution.ts (new): resolves WHO
  fulfils the aigentMe role from the persona's EXISTING
  currentAigentMe assignment (resolveConstitutionalContext), never
  from a client-supplied identity. Fails open to the Default aigentMe
  identity on any gap (no assignment, unwired display name, resolution
  error) -- a voice choice, not a security gate.

- app/api/codex/chat/route.ts: the chat route's system-prompt
  resolution now uses this server-resolved identity instead of
  trusting the client's raw persona/aigentId body fields, but ONLY
  when the role claim is 'aigent-me'. Every existing
  resolvedAgentId === 'aigent-me' / isAigentMe gate elsewhere in the
  route (metaMe context, attached uploads, layout suggestions) is
  untouched -- those are the surface's own product features and must
  keep firing regardless of which agent speaks.

- components/smarttriad/copilot/AigentMeRoleSelector.tsx (new): the
  "aigentMe · <label>" header control. Reads the eligible roster from
  the EXISTING boundAgents list (GET /api/identity/constitutional-context)
  and writes the assignment via the EXISTING
  POST /api/identity/persona-assignments path (same route
  BoundedDelegationTab already uses) -- no new agent list, no new
  write path, never touches delegation_grants. Mounted in both
  SmartTriadCopilotLayer header render paths, gated on
  agentId === 'aigent-me'.

- services/agents/specialistRouter.ts: two small exported accessors
  (specialistIdForLabel, personaKeyForSpecialist) derived from the
  existing SPECIALIST_LABELS/SPECIALIST_PERSONA_KEY maps -- the bridge
  from a bound agent's display_name to its specialist identity,
  without a second hand-maintained registry.

Selecting an agent for the aigentMe role changes routing only; it
never creates, modifies, or implies a delegation_grants row --
confirmed by a structural regression test. Default aigentMe remains
a pure UI/runtime role with no backing agent_root_identity, confirmed
by the Gate A0 audit and preserved by the selector rendering nothing
when no eligible agent exists.

11 new tests (tests/homecoming-phase-ii-wpa-increment2.test.ts), all
passing. Full regression unchanged from the established baseline: 17
failed test files / 40 failed tests, 675 TypeScript errors.
```

## Body

Implements the operator-directed three-axis model in full, no schema
changes:

- services/agents/aigentMeRoleResolution.ts (new): resolves WHO
  fulfils the aigentMe role from the persona's EXISTING
  currentAigentMe assignment (resolveConstitutionalContext), never
  from a client-supplied identity. Fails open to the Default aigentMe
  identity on any gap (no assignment, unwired display name, resolution
  error) -- a voice choice, not a security gate.

- app/api/codex/chat/route.ts: the chat route's system-prompt
  resolution now uses this server-resolved identity instead of
  trusting the client's raw persona/aigentId body fields, but ONLY
  when the role claim is 'aigent-me'. Every existing
  resolvedAgentId === 'aigent-me' / isAigentMe gate elsewhere in the
  route (metaMe context, attached uploads, layout suggestions) is
  untouched -- those are the surface's own product features and must
  keep firing regardless of which agent speaks.

- components/smarttriad/copilot/AigentMeRoleSelector.tsx (new): the
  "aigentMe · <label>" header control. Reads the eligible roster from
  the EXISTING boundAgents list (GET /api/identity/constitutional-context)
  and writes the assignment via the EXISTING
  POST /api/identity/persona-assignments path (same route
  BoundedDelegationTab already uses) -- no new agent list, no new
  write path, never touches delegation_grants. Mounted in both
  SmartTriadCopilotLayer header render paths, gated on
  agentId === 'aigent-me'.

- services/agents/specialistRouter.ts: two small exported accessors
  (specialistIdForLabel, personaKeyForSpecialist) derived from the
  existing SPECIALIST_LABELS/SPECIALIST_PERSONA_KEY maps -- the bridge
  from a bound agent's display_name to its specialist identity,
  without a second hand-maintained registry.

Selecting an agent for the aigentMe role changes routing only; it
never creates, modifies, or implies a delegation_grants row --
confirmed by a structural regression test. Default aigentMe remains
a pure UI/runtime role with no backing agent_root_identity, confirmed
by the Gate A0 audit and preserved by the selector rendering nothing
when no eligible agent exists.

11 new tests (tests/homecoming-phase-ii-wpa-increment2.test.ts), all
passing. Full regression unchanged from the established baseline: 17
failed test files / 40 failed tests, 675 TypeScript errors.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md` |
| Modified | `codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-handover.md` |
| Added | `components/smarttriad/copilot/AigentMeRoleSelector.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Added | `services/agents/aigentMeRoleResolution.ts` |
| Modified | `services/agents/specialistRouter.ts` |
| Added | `tests/homecoming-phase-ii-wpa-increment2.test.ts` |

## Stats

 8 files changed, 551 insertions(+), 4 deletions(-)
