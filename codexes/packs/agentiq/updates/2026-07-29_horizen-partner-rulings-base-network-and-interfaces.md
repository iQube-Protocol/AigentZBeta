# Horizen pilot — partner rulings close three open questions (Base-native identity, interface stability, REST polling)

**Date:** 2026-07-29
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Source:** partner rulings from Horizen's primary technical contact, John Camardo (CTO)
**Builds on:** the pilot brief (2026-07-26) and Slice B (2026-07-28, joined evidence chain)

---

## What this closes

The 2026-07-28 Slice B build's own "Flagged, not decided" §3 named the exact ambiguity these
rulings resolve: the brief's worked PnL example pairs a Mainnet registry profile with
`erc8004Chain: "base-sepolia"`, and it was open with Horizen which was authoritative. Three rulings
close this and two related open questions:

1. **ERC-8004 identity is primarily Base-native.** Base Sepolia is the pilot's test environment;
   Base Mainnet is production. The Mainnet/Sepolia divergence in the brief's own worked example was
   **sample ambiguity, not confirmed intended behavior** — not a signal that the pilot needs a
   cross-network identity architecture. `registryProfileNetwork`, `erc8004IdentityChain` and
   `proofChain` stay THREE SEPARATE FIELDS, unchanged and still defensive (ruling §2 from the
   2026-07-28 build stands) — nothing here merges them or infers equality.
2. **Current interfaces are stable for this phase.** Registry, Pulse, REST, MCP and Verifiable PnL
   are treated as static. Keep strict schema validation, safe parsing and malformed-response refusal
   (already the discipline throughout `services/horizen/`) — no speculative version-negotiation or
   migration machinery.
3. **REST polling is the confirmed synchronization approach** for the first release. Direct
   Transfer-event indexing is a noted production evolution (`services/horizen/agentBinding.ts`
   already frames it this way) — not a pilot requirement, and the pilot is not gated on it.

## What changed

### Code (comments only — no behavior change)

| File | Change |
|---|---|
| `services/horizen/evidence.ts` | Added a "RULING, PARTNER CONTACT JOHN CAMARDO" section to the module header; updated the `registryProfileNetwork`/`erc8004IdentityChain`/`proofChain` field docs and the inline comment in `buildHorizenEvidence` to record the sample-ambiguity finding and the Base-native ruling. **No field, value, or type changed** — the three identity fields remain separate exactly as ruling §2 required. |
| `services/venture/partnerWorkspace.ts` | Extended the `PartnerWorkspace` type with two existing-pattern optional fields: `differentiatorStatement?: string` and populated the already-existing `contacts?` field for the Horizen entry (John Camardo, Luca Cermelli) — no new registry concept, using the field that was already there and documented as "omitted until verified contact data has a real home" (now has one). Updated the reference-agent comment to record the Base Sepolia = test / Base Mainnet = production ruling. |
| `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` | Threaded `contacts` and `differentiatorStatement` through `WorkspaceView` (both Lab views — `researchView` renders `[]`/`null` honestly, since the research registry has no such concept today). Added a registry-driven Contacts panel on the Overview surface (renders only when `ws.contacts.length > 0`) and passed `differentiatorStatement` into `EvidenceChainPanel`, which renders it verbatim when present. **The differentiator sentence and contact names were originally hardcoded directly in the tab and had to be moved into the registry** — `tests/partner-workspace.test.ts`'s "the tab holds no hand-copied partner data" canary caught this on the first pass (it asserts `'Horizen'` does not appear in the tab's source outside comments) and the fix generalizes correctly: instantiating the next partner workspace needs no tab change to carry its own contacts or differentiator line. |

### Docs

| File | Change |
|---|---|
| `codexes/packs/agentiq/updates/2026-07-26_partner-workspace-horizen-pilot.md` | Added an "Addendum (2026-07-29)" section: the differentiator statement verbatim, an "Outstanding questions — status" table closing all three rulings and naming the two genuinely still-open items (first Sepolia test date, agreed Mainnet reference agent), a Contacts section (fluid prose, not a formal escalation matrix), and both the Base Sepolia and Base Mainnet acceptance-criteria lists with a note on which items are checkable in code today. |
| `codexes/packs/agentiq/updates/2026-07-28_horizen-slice-b-joined-evidence-chain.md` | Appended a "RESOLVED 2026-07-29" note under "Flagged, not decided" §3, closing the exact ambiguity that section named, without rewriting the original record of what was open on 2026-07-28. |

## The differentiator statement (verbatim, now surfaced in two places)

> Horizen proves the PnL. metaMe proves who authorized the agent, under what delegation, and
> records the consequential action through DVN receipts.

Lives as `PartnerWorkspace.differentiatorStatement` (registry) and renders on the Partner Workspace
Evidence surface (`EvidenceChainPanel`) and in the pilot brief addendum above.

## Acceptance criteria — checkable in code today vs. documented-only

**Base Sepolia (pilot-complete definition), from the brief addendum:**

| # | Criterion | Status |
|---|---|---|
| 1 | Agent registered/identified on Base Sepolia | Documented only — depends on a live scheduled read |
| 2 | Agent Card resolvable | Checkable — `services/horizen/agentCard.ts`, exercised in `tests/horizen-integration.test.ts` |
| 3 | Verifiable PnL proof produced | Checkable — `services/horizen/correlate.ts` / `evidence.ts` |
| 4 | Proof retrieved through the Horizen interface | Checkable — `services/horizen/client.ts` |
| 5 | Proof correlated to the correct token ID/network | Checkable — `identity.ts`'s network-first key + `correlate.ts` |
| 6 | metaMe records the proof as constitutional evidence | Checkable — `evidence.ts`'s `HorizenEvidenceRecord` |
| 7 | DVN receipt records the ingestion/action | Checkable that the action type is declared on `ANCHORABLE_ACTION_TYPES`; a live submission is documented only |
| 8 | Operator-agent binding + active delegation resolvable | Checkable — `services/horizen/agentBinding.ts`, `tests/horizen-agent-binding.test.ts` |
| 9 | Attributable chain visible in the Partner Workspace | Checkable — `PartnerProgrammesTab.tsx`'s `EvidenceChainPanel`, `tests/horizen-evidence-chain.test.ts` |
| 10 | Repeated retrieval produces the same normalized result | Checkable — `buildHorizenEvidence` is pure; asserted in `tests/horizen-integration.test.ts` |
| 11 | No Mainnet/Sepolia identity collision accepted | Checkable — network-first keying in `identity.ts`, asserted in `tests/horizen-agent-binding.test.ts` |
| 12 | Malformed/mismatched/replayed/duplicate proofs fail safely | Checkable — `client.ts`'s failure taxonomy + the binding resolution's ownership-freshness gate |

Items 1 and 7 are genuinely documented-only pending a scheduled live test run — the code paths exist
but pilot-complete status for those two depends on an actual Base Sepolia read and a real DVN
submission, not something a unit test can assert.

**Base Mainnet (later-phase bar)** — all twelve items documented only, none built, per Scope
Discipline below.

## Scope discipline — confirmed, nothing added as a pilot blocker

Full Marketa vetting workflow, full MoneyPenny orchestration, Standing accrual, Pulse automation,
direct event indexing, Proof-of-Reserves, cross-chain settlement, multi-agent composition — none of
these were found treated as pilot blockers in the existing code or docs, so nothing needed
correcting here.

## What was deliberately NOT touched

- **`services/dvn/activityReceiptDvnPipeline.ts`** — not modified. `HORIZEN_EVIDENCE_ACTION_TYPE`
  was already declared on `ANCHORABLE_ACTION_TYPES` by the 2026-07-28 build; nothing in this ruling
  set implies a pipeline change, and CLAUDE.md's DVN Pipeline Protection section requires operator
  approval before touching anything beyond that one addition.
- **`PartnerWorkspace.contacts` as a brand-new field** — it already existed (documented as
  intentionally unpopulated); this work populates it rather than inventing a second one, per the
  task's explicit caution and the discovery that verified contact data now has a real home
  (`HORIZEN_PARTNERSHIP.contacts` in `services/horizen/evidence.ts`, added 2026-07-28).
- **No merge of `registryProfileNetwork`/`erc8004IdentityChain`/`proofChain`** — ruling §2 from the
  2026-07-28 build (keep them separate, defensively) is unaffected by this ruling set; only the
  narrative around why they diverged in the brief's example changed.
- **No event-indexing or version-negotiation code was added** — both are explicitly ruled out as
  pilot requirements; the existing code already treats them as noted future evolutions, not gaps to
  fill now.

## Verification

- `npx tsc --noEmit` — fails with a pre-existing, environment-level error unrelated to this change
  (`Cannot find type definition file for 'iqube'`, `Invalid value for '--ignoreDeprecations'`),
  reproduced identically on a clean `git stash` of this session's changes. Not introduced here.
- `npx vitest run tests/horizen-integration.test.ts tests/horizen-agent-binding.test.ts tests/horizen-evidence-chain.test.ts tests/partner-workspace.test.ts` — **171/171 passing.**
- `npx vitest run` (full suite) — 4 test files fail (`research-lab-workspace.test.ts`,
  `research-workspace-spec.test.ts`, `lab-tab-restructure-and-locker-ux.test.ts`,
  `capability-artefact-home.test.ts`), all in the Research Workspace area a concurrent background
  agent was mid-flight restructuring in the same working tree (`data/codex-configs.ts`,
  `services/research/*` modified, not by this session). Verified by stashing every file this session
  touched and re-running the same four files: **identical failures persist with none of this
  session's changes present**, confirming they are pre-existing/concurrent, not a regression from
  this work.
