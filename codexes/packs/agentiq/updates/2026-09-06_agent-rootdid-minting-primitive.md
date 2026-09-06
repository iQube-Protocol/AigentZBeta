# RootDID minting primitive for "Create and establish an agent" (Use Case Zero)

**Date:** 2026-09-06
**Workstream:** AgentiQ Alpha / Use Case Zero (Aigent Factor constitutional financial-agent establishment)

## What changed

"Create and establish an agent" was previously a disabled stub — no RootDID-minting
primitive existed anywhere in this codebase, so the second Use Case Zero entry path executed
identically to "Bring my own agent" (or was disabled outright) rather than actually creating a
new agent identity.

Investigation (per the operator's instruction — "do not create a new RootDiD process when one is
already in place; that a violation of our re-use law") found **four disagreeing, already-shipped
RootDID-minting paths** in this codebase (`personas.root_did` via `did:fio:` for human personas,
`root_identity` via `did:root:<authUserId>` for the identity-bind route, `root_identity` via
`did:root:ppb:<random>` for Passport Bureau signup, and `agent_root_identity` via
`did:agent:root:<slug>` through `services/agents/sponsorPolityAgent.ts` for citizen-sponsored
agents) — plus a fifth, never-implemented planning doc (`docs/ROOT_DID_IMPLEMENTATION.md`,
`did:qube:root-{uuid}`, no such service exists).

`sponsorPolityAgent.ts` (already the shared genesis core behind `/api/agents/genesis` and the
one-click aigentMe route) is the correct, existing primitive for "a citizen sponsors a new agent" —
it mints `did:agent:root:<slug>`, is free (no cost), and never broadcasts a blockchain transaction.
This is reused **unchanged** — no second, disagreeing minting scheme was created.

(A migration onto `did:fio:` was considered and rejected: `FIOService.registerHandle()` costs a
real, hardcoded 40 FIO fee and performs a genuine on-chain broadcast — directly conflicting with
Use Case Zero's own paramount rule that it never moves funds, broadcasts a transaction, or uses
production credentials. `sponsorPolityAgent`'s existing `did:agent:root:` scheme is the one Use
Case Zero itself uses; a real-FIO option is backlogged below for callers OUTSIDE Use Case Zero.)

### Implementation

- `services/agents/sponsorPolityAgent.ts` — added `findAgentRootIdentityBySlug()`, extracted from
  the function's own existing slug-uniqueness lookup (Extend-Don't-Duplicate), so other callers can
  check "does this slug already have a RootDID" without hand-copying the query.
- `services/factor/useCaseZeroReadinessProjection.ts` — `agentShell` leg now recognises TWO facts,
  never conflated: (1) is this slug Horizen-registrable (`REGISTRABLE_AGENTS`, a separate, real,
  code-level allowlist for runtime custody wallets/health routes — unchanged, still not dynamically
  provisionable), and (2) does this slug have a minted RootDID at all
  (`agent_root_identity`/`sponsorPolityAgent`). A freshly-sponsored agent now reports `agentShell`
  as `established` even though it is not yet Horizen-registrable — later legs that need a runtime
  agent id (wallets, Horizen registration, Bankr binding) report that honestly and separately,
  rather than this leg papering over it. The leg also now requires the OPERATOR's own citizen
  Passport to already be issued before offering to sponsor a new agent (`awaiting_external_action`
  otherwise) — matching the operator's stated sequence: "creates a passport and then sponsors an
  agent."
- `services/factor/useCaseZeroOrchestrator.ts` — the `agentShell` step, when `missing` on the
  `create_and_establish` path, calls `sponsorPolityAgent` (given `sponsorPassportId`, `displayName`,
  `description`, `origin` — Factor never invents these, same manifest boundary as the token-launch
  spec), writes an `agent_root_identity_sponsored` activity receipt, and binds the minted RootDID
  onto the Factor case's `candidate_agent_root_did` (new `factorCaseService.bindCandidateAgentRootDid`
  helper) so `delegationAuthority` and everything else reads the REAL identity rather than raw,
  operator-typed candidate text.
- `services/receipts/activityReceiptService.ts` / `services/dvn/activityReceiptDvnPipeline.ts` —
  added `agent_root_identity_sponsored` as a DVN-anchorable action type (the one change
  `activityReceiptDvnPipeline.ts` permits unilaterally).
- `components/moneypenny/useCaseZero/UseCaseZeroReadinessCapsule.tsx` — "Create and establish an
  agent" is enabled and calls `choosePath("create_and_establish")`; a genesis input form (sponsor
  passport id, display name, description) renders when `agentShell` is the next permitted action.
- `services/factor/factorCapabilityManifest.ts` — the stale "no RootDID primitive exists" /
  "Coming next" correction text is updated to describe the real behaviour.

Test coverage: `tests/use-case-zero-orchestrator.test.ts` (new describe block — awaiting_external_action
without a Passport, blocked on bring_own_agent with nothing to bring, awaiting_input without genesis
fields, successful sponsorship + receipt + case bind, no bind when no case yet, blocked when
`sponsorPolityAgent` itself refuses, established/no-op when a RootDID already exists),
`tests/use-case-zero-capsule-provider-mode.test.tsx` (button enabled, invokes the real path).

## Backlogged as a fast-follow (NOT implemented in this pass — operator instruction, 2026-09-06)

**Migrating agent registration onto real, on-chain identity** is explicitly deferred:

1. **Real FIO handle registration** as an opt-in capability on `sponsorPolityAgent` (or a clearly
   separate extension of it) for callers OUTSIDE Use Case Zero who choose to pay the real,
   hardcoded ~40 FIO fee and broadcast the registration (`services/identity/fioService.ts::registerHandle`).
   Never invoked by the Use Case Zero rehearsal path itself.
2. **Elevating a freshly-sponsored `agent_root_identity` agent into `REGISTRABLE_AGENTS`** — the
   Horizen-registrable runtime allowlist (`services/horizen/registrableAgents.ts`) that provisions
   the agent's own custody wallet (`agent_keys`), health route, and Horizen Register/Verify/Claim
   eligibility. This remains a deliberate, code-level change (one config entry + one Agent Card
   route + one registry_assets seed migration, per that file's own header) — not something Use Case
   Zero can do at runtime. A freshly-sponsored agent today has a real constitutional identity
   (RootDID) but stops there; wallets/Horizen registration/Bankr binding legs report `missing`
   honestly until this fast-follow lands.

Also outstanding, not part of this pass: closing the `root_did_public_ref` gap on
`polity_passport_applications`/`polity_passport_records` (defined in schema to enforce "no Agent
Passport without a RootDID," but never populated anywhere today) and the corresponding refusal gate
in `services/passport/issuanceService.ts`.
