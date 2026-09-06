# Scope: make Aigent Factor callable by other agents as the execution engine for Use Case Zero

**Date:** 2026-09-06
**Status:** SCOPED ONLY — not implemented. Per operator instruction: "scope out (auth path + external contract + capabilityRegistry registration + a tool wrapper) as its own task."

## The question this answers

> "Can another agent call on Aigent Factor to run the task end to end? I.e. Aigent Factor remains
> the execution agent but can be called by other agents to run the task for them. Technically this
> should be the case now where MoneyPenny should be able to execute Use Case Zero using Factor to
> actually execute it."

**Checked, not assumed: this does not exist today.** Investigation of `services/moneypenny/*` and the
`app/(shell)/moneypenny/` UI found exactly two existing MoneyPenny↔Factor integration points, neither
of which is an execution call:

1. **UI composition** — `app/(shell)/moneypenny/components/FactorPanel.tsx` is mounted inside the
   MoneyPenny shell. A human operator clicks Factor's own buttons; this is a human driving Factor's
   UI from within MoneyPenny's surface, not MoneyPenny (the agent/orchestrator) calling Factor.
2. **Advisory-only consult** — `services/moneypenny/caseContextConsultation.ts::askCaseContextSpecialist`
   calls `/api/assistant/ask-agent` to let the operator ask Factor a grounded QUESTION. Its own header
   is explicit: this "cannot mutate the case" and is "distinct from a panel's real domain actions."

Neither path lets MoneyPenny's own orchestration code say "run Use Case Zero for this case" and get
a real execution result back. That is genuinely new work, scoped below.

## Design direction — Factor stays the execution agent, never becomes a subordinate skill

Per operator correction (2026-09-06): the earlier framing ("package Factor as a skill DevOn can
call") had the direction backwards. The correct model is **Factor as a callable execution service** —
other agents (MoneyPenny today; DevOn or others later) delegate the *task* to Factor, and Factor
remains the one agent that actually executes `advanceUseCaseZero`. This mirrors the existing
constitutional pattern elsewhere in this codebase (Aegis assesses, MoneyPenny decides admission,
Factor never performs either) — delegation of execution, not skill absorption.

## Scope items

### 1. Auth / calling path

`advanceUseCaseZero` (`services/factor/useCaseZeroOrchestrator.ts:454`) is already a plain exported
async function — it requires no new export to be importable in-process. The real question is what
identity a delegated call carries:

- **Same-request, same-persona delegation (the MoneyPenny case)** — when MoneyPenny's own
  server-side orchestration decides to have Factor execute a step on behalf of the SAME accountable
  human operator whose request is already resolved through the spine (`getActivePersona`), the
  correct pattern is a **direct in-process call carrying the ALREADY-resolved `actorPersonaId`/
  `tenantId` forward** — never a new agent credential, and never re-authenticating. This is
  orchestration routing within one accountable request, not a new principal acting. No change to
  the identity spine is needed for this case; it needs a thin, explicitly-named bridge function
  (e.g. `services/moneypenny/factorExecutionBridge.ts`) so the delegation is visible and testable as
  its own seam, rather than MoneyPenny code reaching into `useCaseZeroOrchestrator` ad hoc from
  scattered call sites.
- **Genuinely external/service-to-service delegation (a separate agent process, no shared human
  persona context — e.g. a future DevOn-as-its-own-process, or a scheduled/automated caller)** —
  this needs the SAME platform-authority pattern already used elsewhere in this codebase
  (`services/agents/sponsorPolityAgent.ts`'s `isPlatformAuthority`, gated on an authenticated
  platform-level credential such as `CRON_TRIGGER_TOKEN` — never inferred, never client-supplied).
  Re-use that pattern; do not invent a second agent-credential scheme.

### 2. External contract (documented, versioned response shape)

`AdvanceUseCaseZeroResult` / `UseCaseZeroReadiness` already exist as typed interfaces, but the
contract a delegating caller needs is "run until blocked/complete," not "one step." Scope: a thin
wrapper, e.g. `runUseCaseZeroToCompletion(input)`, that loops `advanceUseCaseZero` and stops
honestly at the first non-`advanced` outcome — `awaiting_input` (needs caller-supplied data, e.g.
`agentGenesis`/`launchSpec`), `awaiting_external_action` / `blocked` (a real boundary), or
`requiredStepsComplete`. This must NEVER auto-chain across a human/Aegis/MoneyPenny approval
boundary any more than `advanceUseCaseZero` already refuses to — the wrapper only removes the
"call again yourself" busywork for a delegating caller, it does not remove any approval gate.
Document this shape as the stable contract (manifest + a short reference doc), not just as
whatever shape the UI capsule happens to consume today.

### 3. `capabilityRegistry` registration

`constitutional_financial_agent_establishment` is described in `services/factor/factorCapabilityManifest.ts`
but has never gone through `registerCapability()` (`services/constitutional/capabilityRegistry.ts`) —
confirmed by checking `scripts/register-ccb-capabilities.ts`'s actual seed list, which does not
include it. Scope: register it (or wait until the wrapper above exists, so what's registered is the
real callable contract, not just the manifest description).

### 4. Tool wrapper (for callers outside this same Next.js process)

For a caller genuinely outside this codebase's process (a separate agent runtime, or an MCP client),
the in-process function call above isn't reachable — that caller needs the EXISTING HTTP routes
(`app/api/moneypenny/factor/use-case-zero/{readiness,advance}`) wrapped as an MCP tool or agent-card
action with a real invocation contract (params schema, auth requirement, response schema), not just
listed in the Agent Card as `externallyActionable: true` with no invocation detail (the current
state). Scope: define this only once the auth path (item 1's platform-authority branch) exists for
a real external caller to use — building the wrapper first would give it nothing legitimate to
authenticate with.

## Also backlogged (operator instruction, 2026-09-06): a dedicated DevOn agent card + system prompt

"DevOn" is documented as AigentZ operating in the Dev Command Center (`docs/platform-ontology.md`,
`docs/architecture/domain-runtime-orchestrator-model.md`) — a peer domain orchestrator to
MoneyPenny, not a subordinate skill-caller. No dedicated DevOn agent card or system prompt exists
today (AigentZ's own). Backlogged as its own item, separate from the Factor-execution-callable work
above — the two are related (a DevOn agent card would be a plausible external caller of the tool
wrapper in item 4) but are not the same task.

## Not in scope here

- Implementing any of the above. This document is the scope only.
- Changing `advanceUseCaseZero`'s own approval-boundary rules — every item above explicitly
  preserves them.
- The Bankr PRD (separate ask, tracked separately — see note below) and the DIDQube/RootDID backlog
  items already captured in the CFS-051 research registry.

## Registry entries

Tracked as backlog items in the CFS-051 research registry (`research_backlog_items`, live Supabase):
`factor-agent-callable-execution-packaging` (high) and `devon-agent-card-and-system-prompt` (medium).

## Resolved — Bankr/Factor/Aegis/MoneyPenny PRD committed

The operator re-supplied the PRD (it had been uploaded into a prior session's context only, never
saved to disk or committed — confirmed by a filesystem and full git-history search finding no
copy anywhere in this environment). Committed verbatim at
`codexes/packs/agentiq/items/FACTOR_AEGIS_MONEYPENNY_PRD_0.1.md` and registered under a new
`col_factor_aegis_prd` collection in `codexes/packs/agentiq/collections.json`. The prior citations
in `codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase1-reconciliation.md` (and this
file's own earlier note) that described it as "uploaded, never committed" are now stale — the PRD
has a real repo path.
