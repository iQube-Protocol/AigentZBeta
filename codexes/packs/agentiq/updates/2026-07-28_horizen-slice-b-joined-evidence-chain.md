# Horizen Slice B — the joined evidence chain in the Partner Workspace

**Date:** 2026-07-28
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Builds on:** Slice A (`2026-07-28` ERC-8004 agent binding as a constitutional record)
**Scope:** Slice B only. No Standing accrual (C), no registration/Pulse write paths (D),
no operator-claim UX (E), no Marketa vetting (F), no MoneyPenny orchestration (G).

---

## The ruling

> Surface the joined evidence chain in the Partner Workspace. The demonstrable object should show:
>
> `Horizen agent identity + Horizen proof/validation + DVN ingestion receipt + passport-backed delegation → Attributable constitutional evidence`
>
> **"The UI should not expose raw T2 identifiers. It should show safe status and commitments."**
>
> "That is the actual differentiator to demonstrate to Horizen."

---

## What shipped

| File | Role |
|---|---|
| `services/horizen/evidenceChain.ts` | **NEW.** The pure server-side projection: `projectEvidenceChain()` → `EvidenceChainView`. Seven links, three-valued link state, the Standing verdict with its reason. |
| `services/venture/partnerWorkspace.ts` | `PartnerReferenceAgent` + `referenceAgents` on the Horizen pilot. One authoritative list; a second pilot is one more entry. |
| `services/receipts/activityReceiptService.ts` | `readReceiptAnchorStatus(receiptId)` — the DVN anchoring state of one receipt, three-valued (`status` / `null` = no receipt / `undefined` = could not read). |
| `app/api/venture/workspace/[workspaceId]/evidence-chain/route.ts` | **NEW.** The minimum serving route, gated by the EXISTING participation spine. |
| `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` | `EvidenceChainPanel`, mounted on the Evidence surface. Renders server statuses verbatim; its only branch is `state → tone`. |
| `tests/horizen-evidence-chain.test.ts` | **NEW.** 31 canaries across 11 blocks. |

---

## Decisions, with file:line

### 1. The seven links, and what each one reads

`services/horizen/evidenceChain.ts:83-100` fixes the link set and its order to the ruling's own
enumeration. Each link reads ONE fact and never a neighbouring one — Slice A's four
`AgentAuthorityFacets` are independent and "nothing in this module may make one imply another"
(`services/horizen/agentBinding.ts:117-143`).

| Link | Rendered words | Source of truth |
|---|---|---|
| Agent identity | verified / unverified / unknown | `facets.ownershipVerified` (`evidenceChain.ts:344`) |
| Operator relationship | claimed / unclaimed / unknown | `facets.operatorRelationshipClaimed` (`evidenceChain.ts:363`) |
| Passport backing | confirmed / absent / unknown | presence of `evidence.passportRef` (`evidenceChain.ts:383`) |
| Delegation | active / inactive / unknown | `facets.delegationActive` (`evidenceChain.ts:397`) |
| Authority scope | present / undefined / unknown | `constitutionalAct.scopeDefined` (`evidenceChain.ts:415`) |
| Horizen proof | validated / self-reported / unvalidated | `validationTag` + `validatorAddress` (`evidenceChain.ts:503-540`) |
| DVN receipt | recorded / pending / anchor-failed / not-recorded / unknown | `ReceiptAnchor` (`evidenceChain.ts:552-604`) |

Standing is deliberately NOT an eighth link (`evidenceChain.ts:78-82`) — it is the verdict the
chain produces, and rendering it as one more row would invite a reader to treat it as one more
input.

### 2. No raw identifier reaches the screen — not even the T2 commitments

`evidenceChain.ts:29-46`. Slice A's rule is that the four commitments are the ONLY identifiers
permitted in a DVN receipt. Slice B's rule is stricter for the SCREEN: the projection converts each
ref into a boolean presence (`evidenceChain.ts:451-456`) and drops the value. This is the one place
Slice B is deliberately narrower than Slice A, and it is why the canary scans for the 16-hex ref
strings and not only for the T0 values.

What DOES cross is Horizen's own published chain data — network, chainId, canonical tokenId,
registry alias, identity class, validation tag, zkVerify attestation id, adapter tx hash. It names
no person, and without it "Horizen proof: validated" would be unverifiable by the partner it is
being demonstrated to. `validatorAddress` is reduced to `gatewayAttested: boolean`
(`evidenceChain.ts:444`) — the only thing a reader needs from it is brief §3.3's
attested-vs-self-reported distinction.

### 3. Every status is decided server-side

The client's ONLY branch is `state → tone`
(`app/triad/components/codex/tabs/PartnerProgrammesTab.tsx:341-360`). It names no facet, calls no
gate, and never compares a binding state. `isStandingEligible` is called exactly once in the whole
pipeline — inside `evidence.ts` — and the projection PROJECTS the result
(`evidenceChain.ts:425-431`) rather than deriving it a second time.

The view shape is imported into the surface as `import type` from its single definition
(`PartnerProgrammesTab.tsx:70-74`), erased at compile time, so there is no hand-copied interface to
go stale and no server module in the client bundle.

### 4. Ineligibility always carries its reason

`evidenceChain.ts:148-163`. `standing.reason` is the binding resolution's OWN reason, carried
verbatim; `standing.reasonCode` is a stable machine token derived from the four states
(`evidenceChain.ts:139-144`). "ineligible" with no reason is the Terminal Outcome defect — an
outcome the operator can only diagnose from a SQL console is unobservable — and a reason written in
prose beside the badge stops describing the verdict the moment either changes.

### 5. `unbound` and `binding_unresolvable` render differently, by construction

`bindingAvailability()` (`evidenceChain.ts:252-274`) is the single place the distinction becomes
visible:

- **`unbound`** → the five constitutional links render **negative** (a factual claim: we looked,
  there is none) with the detail "no constitutional binding exists for this agent — valid external
  evidence, not attributable to a metaMe passport" (`evidenceChain.ts:322-326`).
- **`binding_unresolvable` with no record** → the same links render **indeterminate** (an admission
  of ignorance) carrying the resolution's own reason.
- **`binding_unresolvable` with a record** (a suspension) → the facets ARE readable and are read;
  the record is knowledge, not absence.

An unbound agent must not look like an error, so the surface paints `negative` **neutral slate**,
never rose (`PartnerProgrammesTab.tsx:341-360`). `indeterminate` gets amber — "we could not
establish this" is the state that genuinely wants attention.

### 6. The route reuses the existing gate

`app/api/venture/workspace/[workspaceId]/evidence-chain/route.ts:95-113` is byte-for-byte the
sibling route's authorisation: spine authentication, `resolveParticipationSelfView`, then
`satisfiesWorkspaceScope(..., ws.participation.domain, ws.id, isAdmin)`. Domain membership alone is
not enough — the grant must be scoped to this workspace (Amendment G cohort isolation).

`readAgentIdentityBindings` returns `null` for "could not read" and `[]` for "read, none", and the
route passes the result STRAIGHT to `resolveBinding` (`route.ts:137-142`). A `?? []` there would
silently convert every outage into the factual claim that a partner's agent is unattributed.

### 7. Bounded payload

Statuses, three-valued link states, four timestamps, fixed-length chain identifiers, boolean
commitment presence, and correlation notes capped at `MAX_CORRELATION_NOTES = 8`
(`evidenceChain.ts:238`). No Agent Card body, no evidence prose, no stored text. The canary asserts
a serialised view under 12 KB even when fed a 5 KB card description and 40 correlation notes.

---

## Mutation table

Every canary was verified by breaking the thing it guards and confirming it fails.

| # | Mutation | Caught by |
|---|---|---|
| M1 | Render the `principalRef` commitment value instead of its presence | *leaks no T2 COMMITMENT either*; *all four commitments are HELD* |
| M2 | Client re-derives eligibility from `bindingState` | *the surface never names a facet, a gate, or a binding-state comparison* |
| M3 | `standing.reason` blanked when ineligible | *every ineligible state carries a reason code AND the resolution's own reason* |
| M3b | `standing.reason` replaced with prose written beside the verdict | same |
| M4 | `bindingAvailability` collapses `binding_unresolvable` into `none` | *the two states differ in reason code, in link state, and in every constitutional link* |
| M5 | The `partner-evidence` entrance disabled | *the Evidence entrance survives `getEnabledTabs`…* (exact set) |
| M5b | The entrance opens `initialSurface: 'overview'` | *that entrance mounts the workspace surface on the evidence sub-surface* |
| M6 | Route replaces the scope gate with a domain-only check | *authenticates through the spine and scopes to THIS workspace* |
| M7 | Route `?? []`s an unreadable binding store | *never converts an unreadable binding store into the claim "unbound"* |
| M8 | Route returns the evidence records as well as the views | *returns statuses, not stored bodies* |
| M9 | Projection re-derives eligibility with `isStandingEligible` | *the projection never re-implements the eligibility rule* |
| M10 | DVN `pending` rendered as `recorded` | *the DVN link separates "no receipt", "could not read", "pending", "anchored" and "failed"* |
| M11 | Correlation notes uncapped | *caps correlation notes and carries no card body or evidence prose* |
| M12 | View shape imported as a VALUE, not a type | *the surface imports the view TYPE only* |
| M13 | `negative` painted rose — an unbound agent reads as an error | *an UNBOUND agent renders fully and does not read as an error* |
| M14 | `border-white/10` reintroduced on the new panel | *the new panel introduces no white hairline* |
| M15 | Panel built but never mounted on the Evidence surface | *the surface mounts the panel on the evidence surface…* |
| M16 | Pilot loses `referenceAgents` | *the workspace behind that entrance declares the reference agents the chain needs* |
| M17 | Reference agent alias no longer normalises | same |
| M18 | Surface drops `personaIdHint` (persona-UNAWARE spine read) | *…and fetches through the spine transport* |
| M19 | One link silently dropped from the chain | *projects exactly the seven links*, +4 others |
| M20 | `operator-relationship` reads `delegationActive` | **ESCAPED first pass.** Now: *each link reads its OWN fact — no facet is inferred from another* |
| M20b | `authority-scope` reads `ownershipVerified` | same (added canary) |
| M20c | `agent-identity` reads `runtimeAdmissionEligible` | same (added canary) |
| M21 | A self-reported validation shown as `validated` | *a validation that did not come through the gateway is indeterminate, not validated* |
| M22 | Projection can never affirm anything (denials-only) | *composed liveness — affirms all seven links and reports Standing eligible* |

**M20 is the one that matters.** A link reading a NEIGHBOURING facet produces a plausible word in
every state, so every other canary in the file — including the leak scans, the reason checks and the
composed-liveness block — stayed green. It is precisely the inference Slice A forbids
(`agentBinding.ts:117-143`), and it escaped until the independence canary was added: flip one fact,
assert exactly one link moves. The same block also pins `runtimeAdmissionEligible` as belonging to
Slice G and NOT to this chain — folding it in would make the workspace refuse to affirm a perfectly
bound agent that simply has not been admitted to the Financial Services Runtime.

---

## Suite

From one integrated HEAD: **176 files / 2754 tests, all green** (was 175 / 2724 — one new file,
+30 canaries; the independence canary brings this file to 31).

---

## Flagged, not decided

1. **`statusReason` is a T2-safety assumption, not an enforced property.** `standing.reason` carries
   `BindingResolution.reason` verbatim, which for a suspended or revoked binding is the record's
   `statusReason`. Today the only writers are `recheckBindingOwnership` (wallet addresses — public
   chain data) and the binding constructor. **When Slice D or E adds an operator-supplied revoke
   reason, that free text becomes screen-bound AND receipt-bound** (it already flows into
   `HorizenEvidenceRecord.bindingStateReason`, which is DVN-anchored). It must be constrained to a
   reason CODE plus T2-safe detail at the write path, not sanitised at the read path.

2. **`temporal.receiptCreatedAt` renders as "not yet wired" even when the DVN link says `recorded`.**
   The binding record carries `constitutionalAct.receiptId` but no receipt-creation timestamp, and
   `readReceiptAnchorStatus` deliberately returns the status only (a caller asking an anchoring
   question has not established a right to read receipt content). Asserting a timestamp we do not
   hold would be an invention. Closing this means either carrying `receiptCreatedAt` on the binding
   at write time (Slice D) or widening the reader — an operator call, not an agent one.

3. **The reference agent's network is sourced, not verified live.** `0x1eba` == tokenId 7866 on
   **base-sepolia** is transcribed from the Horizen Partner Integration Brief §3 as recorded in
   `services/horizen/correlate.ts:20-26` and exercised end-to-end in
   `tests/horizen-integration.test.ts`. The brief's own PnL example pairs a *Mainnet* registry
   profile with `erc8004Chain: "base-sepolia"` (`services/horizen/evidence.ts:35-41`), and which is
   authoritative is still open with Horizen. The registry entry records the network explicitly and
   the read path is network-qualified throughout, so the open question cannot cause a silent
   cross-network read — but if Horizen answers "mainnet", the registry entry is the one line to
   change.

4. **`evaluateNewActionAuthority` is not projected.** The ownership-freshness gate answers "may this
   binding carry a NEW action", which is Slice E/G's question, not "is this past evidence
   attributable". Deliberately out of scope; the chain would read as broken if a late poll turned
   every link amber.

5. **Live partner reads happen on request.** The route calls `correlateAgent` per reference agent
   (four upstream HTTP reads each), capped at `MAX_AGENTS_PER_REQUEST = 5`. There is no cache layer;
   brief §5.1's 60 s polling floor is respected by the surface only in the sense that the panel
   fetches once per mount. A scheduled ingestion + cache is Slice D work.
