# Platform-state-reporter role resolver — Aigent Z, not MoneyPenny, as report producer

**Date:** 2026-07-30
**Scope:** `services/workflows/identityEnvelope.ts`, `app/api/venture/workspace/[workspaceId]/report/route.ts`, `.github/workflows/workspace-report.yml`, `tests/workflow-authoritative-persona-role.test.ts`, `tests/workspace-report.test.ts`

## The correction this records

An earlier suggestion floated MoneyPenny as the eventual producer of the daily/weekly Horizen
workspace report once registered. **That was superseded before any code shipped.** The operator's
corrected ruling:

> The daily workspace report is produced by Aigent Z, based on authoritative platform state.
> MoneyPenny remains the Financial Services Runtime orchestrator and may supply financial-services
> state or evidence into the report, but Aigent Z composes and issues the daily platform-state
> report.
>
> The governing distinction is: **MoneyPenny reports on financial-services activity. Aigent Z
> reports the state of the platform.**

This was already correctly reflected in `services/venture/partnerWorkspace.ts` — the Horizen
workspace's `ownerAgentId` is `'aigent-z'`, and `services/experiments/workspaceReport.ts` names
`reportingAgentId` from that field (`tests/workspace-report.test.ts`'s "names the workspace owner
as the reporting agent" canary already covered this and needed no change). What was NOT yet
correct was **who a scheduled run attributes the publish-receipt to** — that ran through a
standalone, independently-configured Amplify env var (`WORKSPACE_REPORT_PERSONA_ID`) with no
connection to any authoritative-persona registry. This update closes that gap.

## What was found

1. **`WORKSPACE_REPORT_PERSONA_ID`** (`app/api/venture/workspace/[workspaceId]/report/route.ts`,
   the `authorize()` function's ops-token branch) was read directly from `process.env` and used
   as the receipt-attributed persona for scheduled (cron) report publishes, with no relationship
   to any other identity registry. If unset, the route refused with a 500 naming the variable —
   correct fail-closed behaviour, but the variable itself was an island with no authority model
   behind it.

2. **`WORKFLOW_AUTHORITATIVE_PERSONAS`** (`services/workflows/identityEnvelope.ts`) is the
   existing allowlist of personas permitted to make "authoritative" pipeline-state commits
   (consumed by `assertAuthority`, called from `app/api/workflows/route.ts` and
   `app/api/workflows/[id]/route.ts`). **It is env-var-driven, not a hardcoded TypeScript
   constant** — before this change, when the env var was unset, the code fell back to a substring
   heuristic (`personaId` containing `"agent-z"` or `"aigent-z"`).

3. **Discrepancy confirmed, not assumed:** the operator's claim that `aigentz@aigent` is "already
   included in `WORKFLOW_AUTHORITATIVE_PERSONAS`" could not be verified from the repository — the
   env var's live Amplify value is not readable from here (same limitation the 2026-07-30 Horizen
   pilot status-check doc already recorded for `WORKSPACE_REPORT_PERSONA_ID`). Worse, the
   **existing fallback heuristic had a real bug**: `"aigentz@aigent"` contains no hyphen, so it
   does not match the substring `"agent-z"` or `"aigent-z"` the fallback checked for. Absent the
   env var, the code would NOT have recognised Aigent Z's own handle as authoritative — the
   opposite of the intended default.

## What changed

### `services/workflows/identityEnvelope.ts`

- Replaced the substring-heuristic fallback with an explicit `DEFAULT_AUTHORITATIVE_PERSONAS`
  list — `aigentz@aigent`, `marketa@aigent`, `qriptiq@qripto`, `aigent-marketa@aigent` (the four
  personas the operator identified) — used only when `WORKFLOW_AUTHORITATIVE_PERSONAS` is unset
  or empty. The env var, when set, still fully overrides this default; nothing about the existing
  `assertAuthority` / pipeline-commit gate's precedence changed, only which personas the *default*
  resolves to. This is a narrowing (an enumerated list, not an open substring match) and a
  correctness fix (it now actually includes `aigentz@aigent`), not a broadening of an access gate.
- Added `resolveAuthoritativePersonaForRole(role, registry?)` and its fail-closed core
  `resolveExactlyOneAuthoritativePersona(candidates, registry)`. A declared role (currently only
  `'platform-state-reporter'`) maps to a set of eligible persona candidates in code
  (`ROLE_CANDIDATES`); resolution filters those candidates against the live
  `WORKFLOW_AUTHORITATIVE_PERSONAS` registry and:
  - returns the one persona if exactly one candidate is present in the registry;
  - **throws** if zero candidates are present (never guesses);
  - **throws** if more than one candidate is present (ambiguous — never silently picks one).
- `platform-state-reporter -> aigentz@aigent` is the one role mapping added. This is the
  deterministic encoding of the operator's ruling: Aigent Z is the platform-state reporter, full
  stop, resolved from the same registry every other "may this persona act authoritatively?"
  check already uses — not a parallel identity concept.

### `app/api/venture/workspace/[workspaceId]/report/route.ts`

- The ops-token branch of `authorize()` now calls
  `resolveAuthoritativePersonaForRole('platform-state-reporter')` as the **primary** source of
  the receipt-attributed persona.
- `WORKSPACE_REPORT_PERSONA_ID` is kept, but demoted to a **deprecated compatibility override**,
  read only if the role resolver throws. It carries no independent authority of its own anymore —
  it is a bridge for a deployment that has not yet configured `WORKFLOW_AUTHORITATIVE_PERSONAS`,
  and should be retired once every deployment relies on the role resolver. Nothing was deleted:
  other code paths were not audited for a dependency on this variable, per the instruction not to
  remove a variable without first checking for consumers.
- The 500 refusal path was extended to name both the resolver's failure reason and the fallback's
  absence — still fail-closed, still never a guessed persona.

### `.github/workflows/workspace-report.yml`

- Updated the header comment to describe the new primary/fallback authority model, so an operator
  reading the workflow file understands why no Amplify env var is strictly required for this to
  work today (the default registry already includes `aigentz@aigent`).

## Tests

- **`tests/workflow-authoritative-persona-role.test.ts`** (new) — proves:
  - `platform-state-reporter` resolves to `aigentz@aigent` given an explicit registry, the live
    `WORKFLOW_AUTHORITATIVE_PERSONAS` env var, and the built-in default (env var unset).
  - It never resolves to `marketa@aigent` or any other agent.
  - The resolver fails closed (throws) for: an empty registry, a registry missing the mapped
    candidate, an unmapped role, and — via the exported fail-closed core with a synthetic
    two-candidate role — an ambiguous (multiple-match) registry.
- **`tests/workspace-report.test.ts`** — extended the existing "never guesses a persona" canary to
  also assert the route calls `resolveAuthoritativePersonaForRole('platform-state-reporter')`
  before falling back to `WORKSPACE_REPORT_PERSONA_ID`.

## Verification run (this session)

```
npx vitest run tests/workflow-authoritative-persona-role.test.ts tests/workspace-report.test.ts \
  tests/persona-broadcast-handshake.test.ts tests/access-spine.test.ts \
  tests/horizen-integration.test.ts tests/horizen-agent-binding.test.ts \
  tests/horizen-evidence-chain.test.ts tests/partner-workspace.test.ts
```

**Result: 8 files, 236 tests, all green.**

A full `npx vitest run` was also executed. It reports 5 pre-existing failing files
(`tests/constitutional-context.test.ts`, `tests/passport-first-connection.test.ts`,
`tests/require-cartridge-admin.test.ts`, `tests/onboarding-substrate.test.ts`,
`tests/companion-observer.test.ts`) — confirmed, by stashing this session's changes and re-running
the same five files, to fail identically on the pre-existing `HEAD` (`1b6b871a4`) for reasons
unrelated to this change (`supabaseUrl is required` — this sandbox has no `SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_URL` configured; and one companion-observer 500-vs-terminal-status
assertion, also present on `HEAD`). Nothing this session touched contributed to any of the five.

## Files referenced

- `services/workflows/identityEnvelope.ts` — the registry, default list, and new role resolver
- `services/workflows/types.ts` — `IdentityEnvelope` type (unchanged)
- `app/api/venture/workspace/[workspaceId]/report/route.ts` — wiring
- `.github/workflows/workspace-report.yml` — header comment
- `tests/workflow-authoritative-persona-role.test.ts` (new)
- `tests/workspace-report.test.ts` (extended)
- `services/venture/partnerWorkspace.ts` — `ownerAgentId: 'aigent-z'` for `horizen-pilot-series-001`
  (unchanged; already correct)
- `services/experiments/workspaceReport.ts` — `reportingAgentId` (unchanged; already correct)
- `codexes/packs/agentiq/updates/2026-07-30_horizen-moneypenny-pilot-first-slice-status-check.md`
  (prior session — first documented `WORKSPACE_REPORT_PERSONA_ID` and flagged it as an
  operator-only credential this repo cannot verify)
