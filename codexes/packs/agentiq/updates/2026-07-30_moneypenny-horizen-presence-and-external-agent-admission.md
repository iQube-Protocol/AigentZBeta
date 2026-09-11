# MoneyPenny's Horizen presence + provisional external-agent admission (2026-07-30)

**Session scope, two operator-ratified "proceed now" tasks:**

1. Establish MoneyPenny's own Agent Card + Base Sepolia identity/proof presence, per the operator's
   ratified sequence: *mint Agent Card on Base Sepolia → register in metaMe → operator-to-MoneyPenny
   delegation → test P&L proof → correlation + DVN receipt → surface in the Horizen pilot workspace.*
2. Design a provisional external-agent admission record (a non-human, non-Passport admission path),
   per the operator's ruling that a Horizen-native agent is not a human citizen and must not receive a
   human Polity Passport.

**Method:** extend the existing Horizen pilot infrastructure (`services/horizen/*`,
`services/delegation/delegationGrantStore.ts`, `services/venture/partnerWorkspace.ts`) and the
existing Passport Bureau patterns (`services/passport/passportStatusMachine.ts`,
`services/identity/personaReferences.ts`) — no parallel identity, delegation, or DVN mechanism was
built. Both tasks were researched fully before any code was written.

---

## Task 1 — MoneyPenny's Horizen presence

### What was already there (research findings, with citations)

- **The pure binding ceremony already exists** — `services/horizen/agentBinding.ts` (1103 lines):
  `bindAgentIdentity`, `buildAgentClaimMessage`/`verifyAgentClaimMessage` (the EIP-191 claim-message
  discipline), `evaluateOperatorClaim` ("wallet control alone is not delegation; passport possession
  alone is not proof of agent control"), `resolveBinding`, ownership-freshness tiers, and the T2-safe
  `bindingRefs` commitments. This is **"the existing Base Sepolia identity and proof path"** the
  operator's ruling refers to — but **before this session, nothing in the codebase called
  `bindAgentIdentity`** (confirmed by grep: only `agentBinding.ts` itself, `delegationGrantStore.ts`'s
  type imports, and `tests/horizen-agent-binding.test.ts` referenced it). The model existed; no route
  exercised it.
- **The Agent Card pattern** — `app/api/agents/aletheon/route.ts` is the reference implementation (a
  served, static A2A-shape JSON with `metadata`/`registry_entry` conventions), separate from the
  dynamic genesis-agent pattern at `app/api/agents/[id]/agent-card.json/route.ts` (backed by the
  `agent_root_identity` table, populated via `/api/agents/genesis` for citizen-SPONSORED new agents
  like Aletheon). **MoneyPenny is neither** — she is an established, first-class runtime agent
  (`aigent-moneypenny` in `RUNTIME_AGENT_IDS`, `services/metame/agentLlmOrchestra.ts:52`; an existing
  `agent_keys` row per `scripts/add-moneypenny.ts`), so her card follows the Aletheon (static,
  hand-curated) pattern, not the genesis flow.
- **DVN readiness** — `partner_agent_evidence_recorded` (`HORIZEN_EVIDENCE_ACTION_TYPE`,
  `services/horizen/evidence.ts:156`) is already present on `ANCHORABLE_ACTION_TYPES`
  (`services/dvn/activityReceiptDvnPipeline.ts:86`), confirmed unchanged this session — no DVN
  pipeline file was touched, consistent with CLAUDE.md's DVN Pipeline Protection (the one permitted
  unilateral addition was already made in a prior session).
- **MoneyPenny is already the Financial Services layer owner** of the one seeded Partner Workspace
  (`services/venture/partnerWorkspace.ts:210`, `'financial-services': 'aigent-moneypenny'`) — that
  form of "surfacing" already existed. What did NOT exist is MoneyPenny appearing as a
  `referenceAgents[]` entry (the Horizen-side external-identity list the Evidence surface's
  `EvidenceChainPanel` reads) — that requires a real `registryAlias`/tokenId, which this session could
  not produce (see "Blocked" below).
- **The Base Sepolia acceptance criteria** (`codexes/packs/agentiq/updates/
  2026-07-26_partner-workspace-horizen-pilot.md`'s 2026-07-29 addendum) name item 1 — *"One ERC-8004
  agent is registered or identified on Base Sepolia"* — as requiring **a live read/registration**, and
  the 2026-07-30 status-check doc (same folder) independently confirmed the same two items (1 and 7's
  live half) as the only genuinely open first-slice gaps, both scheduling/execution-only. This
  session's finding is consistent with, not a correction of, that prior status check.

### What this session built (real, tested, no network required)

1. **`app/api/agents/moneypenny/route.ts`** — MoneyPenny's canonical Agent Card, mirroring
   `aletheon/route.ts`'s shape exactly (A2A fields, `metadata`, `registry_entry`), populated from
   PRD-MPY-001's three modes (Advisor/Architect/Runtime). Includes an honest
   `metadata.horizen` block: `{ network: 'base-sepolia', identityRegistry: <the real deployed address
   from services/horizen/identity.ts>, tokenId: null, registryAlias: null, status:
   'pending_registration' }` — no fabricated token id or registry alias.

2. **`services/horizen/operatorClaim.ts`** — the I/O seam `agentBinding.ts`'s own header says belongs
   at "Slice E": recovers the wallet signature via `verifyEvmOwnership`
   (`services/identity/walletAliasService.ts` — the platform's one EVM-signature-recovery primitive,
   reused rather than forked), runs the pure `bindAgentIdentity` ceremony, persists the resulting
   binding via `persistAgentIdentityBinding` (`services/delegation/delegationGrantStore.ts`), writes
   the attributable receipt via `createActivityReceipt` with `actionType:
   'partner_agent_evidence_recorded'`, and enqueues the **existing, untouched** DVN pipeline via
   `enqueueActivityReceiptAnchor`. Two-phase design: `buildOperatorClaimMessage` (server computes the
   exact message to sign) then `performOperatorAgentClaim` (verifies the returned signature and
   completes the bind).

3. **`app/api/venture/workspace/[workspaceId]/agent-claim/route.ts`** — the route that makes (2)
   callable. Same spine-auth + workspace-membership gate as the sibling
   `evidence-chain/route.ts`, **plus an `isAdmin` requirement** (this route WRITES a consequential
   constitutional record, unlike the read-only sibling, so it is held to the stricter of the two
   gates already established in this route family — CLAUDE.md: never weaken a gate, and when
   uncertain, use the stricter existing one).

4. **Tests** — `tests/horizen-operator-claim.test.ts` (6 tests: message construction, a synthetic
   catalogue id refused rather than coerced, signature-refusal path, the full bind→persist→receipt→
   DVN-enqueue path with mocked I/O, and a forged-claimExpectation rejection proving the message
   re-verification is real, not decorative). All existing Horizen suites re-run clean
   (`horizen-integration`, `horizen-agent-binding`, `horizen-evidence-chain`, `partner-workspace` —
   171 tests, unchanged, all passing) to confirm nothing in the existing pipeline regressed.

### Blocked — and why, precisely (do not re-attempt without addressing both)

The operator's own instruction anticipated this outcome for a live broadcast and asked for it to be
reported plainly rather than faked. Two **independent** blockers, either one sufficient on its own:

1. **Network egress is blocked in this sandbox.** Verified directly this session:
   ```
   curl -sS --max-time 8 -X POST https://sepolia.base.org ... → curl: (56) CONNECT tunnel failed, response 403
   curl -sS --max-time 8 https://agent-registry.horizenlabs.io/api/agents/0x1 → curl: (56) CONNECT tunnel failed, response 403
   ```
   Both the public Base Sepolia RPC (`https://sepolia.base.org`, already used elsewhere in this repo,
   e.g. `app/api/ops/base/sepolia/route.ts`) and Horizen's own Registry REST API are unreachable from
   this environment — consistent with CLAUDE.md's "QubeTalk — Sandbox Limitation" note that outbound
   HTTPS is blocked here, and with a prior session's confirmation that Supabase and blockstream.info
   are blocked the same way.

2. **The on-chain registration procedure itself is not documented anywhere in this repository.**
   `services/horizen/client.ts`'s own header states the kickoff scope is *"reads and correlation only
   — no registration, no wallet signing"*; every write is described in the brief as
   *"authenticated by a wallet signature"* but the exact contract function/ABI for registering a NEW
   ERC-8004 identity is never named in this repo — only the deployed `IdentityRegistry` CONTRACT
   ADDRESS is recorded (`services/horizen/identity.ts`'s `HORIZEN_NETWORK_FACTS['base-sepolia'].
   identityRegistry`, `0x8004A818BFB912233c491871b3d84c89A494BD9e`). The full "Horizen Agentic
   Services — Partner Integration Brief" that the code comments cite section-by-section is an
   EXTERNAL document held by the operator/prior sessions, not checked into this repo. **Constructing
   an actual registration transaction would require guessing the contract's function signature — a
   guess CLAUDE.md's "No Guessing" rule forbids outright**, independent of the network block.

   This is also why MoneyPenny's `agent_keys` wallet (`scripts/add-moneypenny.ts`,
   `0x8D286CcECf7B838172A45c26a11F019C4303E742`) was deliberately **not** used to attempt anything —
   inspection shows it, and the accompanying BTC/Solana addresses, are seed/placeholder values
   (`tb1qmp0neypenny1234567890abcdef1234567890ab` is not a valid encoded testnet address), not a real,
   funded Base Sepolia key. Treating it as live would itself be a form of fabrication.

3. **The "test P&L proof" step (`services/horizen/client.ts`'s `fetchPnlCorrelation` →
   `services/horizen/correlate.ts` → `services/horizen/evidence.ts`) is genuinely read-pipeline-only
   and depends on Horizen's live Verifiable-PnL service** — blocked for the same network reason as
   (1). The pipeline itself is code-complete and test-covered (confirmed unchanged this session), so
   once network access and a real tokenId exist, no further code is needed to exercise it.

4. **Establishing the actual operator-to-MoneyPenny delegation grant** (via the existing
   `persistDelegationGrant`, `services/delegation/delegationGrantStore.ts`) requires the operator's
   real `personaId` and an `agentRootDid` for MoneyPenny — neither was invented this session per
   CLAUDE.md's no-guessing rule. The mechanism is unchanged and already accepts an arbitrary
   `agentRootDid` (it is not hardcoded to the single `did:iqube:aigent-c-os-root` the
   `agentiq-os/delegation` route happens to use for the citizen→aigentMe case) — establishing a real
   grant for MoneyPenny is a one-call operation once the operator supplies their own persona context,
   through the same store this session's `operatorClaim.ts` already composes with.

### Net position

Every step of the operator's sequence that does **not** require a live Base Sepolia read/write is
built, wired, and tested today: the Agent Card, the full claim-and-bind ceremony (signature recovery →
pure binding → persistence → attributable receipt → DVN enqueue), and the workspace route that exposes
it. The three steps that genuinely require live network access and/or operator-supplied real
credentials (the registration broadcast itself, a live PnL proof retrieval, and the real delegation
grant) are documented above with the exact blocker for each, matching the "build up to and document
the block" instruction rather than fabricating a result.

---

## Task 2 — Provisional external-agent admission

### What was found (research)

- **No Marketa vetting workflow exists in code today** — every reference is scope/doc-level
  (`2026-07-26_partner-workspace-horizen-pilot.md`'s explicit scope-discipline ruling: *"Full Marketa
  vetting workflow... [is] NOT gating the Base Sepolia pilot"*). This session did not build one,
  consistent with that ruling — `candidateStatus: 'vetting'` is a state the new record can occupy;
  the vetting DECISION remains Marketa's, not this module's.
- **The right sibling pattern is `services/passport/passportStatusMachine.ts`**, which already models
  TWO passport-class lifecycles (irrevocable Citizen personhood vs. revocable Participant standing —
  Aletheon's card already declares `passport_class: 'Agent Participant'`). The operator was explicit
  that the new record should NOT be a fork of that machinery ("does not need the final generalized
  agent-passport framework") — so a **third, smaller, sibling** state machine was built rather than
  reusing or forking the passport enums.
- **The hard-false literal-type pattern** already exists at
  `services/research/review/types.ts:73` (`ReviewRoleAuthority.mayEditSourceAssets: false`) — mirrored
  exactly for `mayDelegateOnward: false`.
- **T2 commitment discipline** reuses `constitutionalRef` (`services/identity/personaReferences.ts`) —
  the same derivation `agentBinding.ts`'s `bindingRefs` already uses — for the sponsor reference and
  `services/horizen/evidence.ts`'s `commitCard` pattern (sha256 of a stable JSON projection) for the
  external Agent Card commitment.

### What was built — `services/passport/externalAgentAdmission.ts` (real, not a stub)

A pure, fully-tested model (`tests/external-agent-admission.test.ts`, 23 tests) implementing exactly
the fields the operator listed:

| Operator's field | Implementation |
|---|---|
| External Agent Card | `externalAgentCardCommitment` — sha256 commitment, never the raw card |
| Network + registry | `network: HorizenNetwork \| null`, `registry: string` (reuses the existing type) |
| Sponsor | `sponsor: { kind: 'operator' \| 'institutional'; ref: <T2 commitment> }` |
| Candidate status | `candidateStatus`, a closed 7-state enum with an explicit transition graph (`candidate → vetting → {admitted, rejected}`; `admitted ↔ suspended`; `{admitted, suspended} → revoked`; `admitted → expired`) |
| Permitted pilot actions | `permittedPilotActions: readonly string[]` — constructor **refuses** an empty list or a wildcard (`*`/`all`/`any`) rather than admitting unbounded authority |
| Expiry | `expiresAt` — constructor refuses a non-future value |
| Revocation | `revocation: { revoked, revokedAt, revokedReason }` |
| No onward delegation | `mayDelegateOnward: false` — a **literal type**, not `boolean`; `canDelegateOnward()` is typed to return the literal `false` unconditionally |
| Evidence/Standing hooks | `evidenceRefs: readonly string[]` + `standingAccrualEligible: boolean` (extension point only — no accrual pipeline implemented, per the operator's explicit scope) |

`evaluateAdmissionAuthority(admission, action, now)` is the runtime gate (mirrors
`agentBinding.ts`'s `evaluateNewActionAuthority` shape: a refusal LIST, not a single boolean, so a
denied caller learns why). No Supabase table/migration was added this session — the model is the
pure, persistence-agnostic layer (the same posture `agentBinding.ts` itself takes; its own I/O layer is
a separate file, `delegationGrantStore.ts`). Adding a durable store for this record is a natural
follow-up but is a schema decision the operator should ratify explicitly, consistent with the
"minimal, real, not the final generalized framework" instruction.

---

## Files touched

- `app/api/agents/moneypenny/route.ts` — NEW: MoneyPenny's Agent Card
- `services/horizen/operatorClaim.ts` — NEW: the claim/bind I/O orchestration
- `app/api/venture/workspace/[workspaceId]/agent-claim/route.ts` — NEW: the route exposing it
- `services/passport/externalAgentAdmission.ts` — NEW: the provisional admission model
- `tests/horizen-operator-claim.test.ts` — NEW: 6 tests
- `tests/external-agent-admission.test.ts` — NEW: 23 tests
- This doc, registered in `codexes/packs/agentiq/collections.json` (`col_updates`)

## Test results

```
npx vitest run tests/horizen-operator-claim.test.ts tests/external-agent-admission.test.ts \
  tests/horizen-integration.test.ts tests/horizen-agent-binding.test.ts \
  tests/horizen-evidence-chain.test.ts tests/partner-workspace.test.ts \
  tests/moneypenny-runtime-authority-boundary.test.ts tests/access-spine.test.ts \
  tests/persona-broadcast-handshake.test.ts tests/source-of-truth-parity.test.ts

Test Files  10 passed (10)
     Tests  337 passed (337)
```

`npx tsc --noEmit` was attempted but fails project-wide on pre-existing, unrelated configuration issues
(`TS2688` missing `iqube` type-def entry point, `TS5103` invalid `--ignoreDeprecations` value in
`tsconfig.json`) — confirmed these are not introduced by this session's files (neither error path
references any file touched here).
