# Horizen MoneyPenny Pilot — first-slice status check (2026-07-30)

**Session scope:** the operator asked "where are we on the Horizen MoneyPenny pilot prep" and for
an agent to "complete all the tasks we need to complete to meet the first slice." This is a
**research-and-verification pass**, not a new build: it locates the existing, operator-ratified
definition of "first slice," re-verifies it against the current working tree, closes one stale
documentation gap, and reports honestly on what remains — most of which is operator-only.

**Method:** every claim below was checked against this branch's actual files and a live test run,
not inferred from prior update docs alone. No new service code was written; none was needed.

---

## 1. Where "first slice" is actually defined

There is no single doc titled "Horizen MoneyPenny Pilot Task List." The closest thing — and the
one this session treats as authoritative — is the **Base Sepolia acceptance criteria** in
`codexes/packs/agentiq/updates/2026-07-26_partner-workspace-horizen-pilot.md`'s 2026-07-29
addendum, headed *"definition of pilot-complete,"* itself derived from direct rulings by Horizen's
CTO (John Camardo). Twelve criteria, cross-referenced against code in
`codexes/packs/agentiq/updates/2026-07-29_horizen-partner-rulings-base-network-and-interfaces.md`'s
"Acceptance criteria — checkable in code today vs. documented-only" table.

That same addendum records an explicit **scope-discipline ruling**: full Marketa vetting workflow,
full MoneyPenny orchestration, Standing accrual, Pulse automation, direct event indexing,
Proof-of-Reserves, cross-chain settlement, and multi-agent composition are **named explicitly as
NOT gating the Base Sepolia pilot**. This matters because a separate, larger, and later document —
`2026-07-28_vl-ct-001-gap-register.md` (the **Constitutional Trading** venture, a different,
bigger workstream that also touches Horizen identity via `services/horizen/`) — lists P-4 through
P-8 (operator-claim UX, registry/Pulse write paths, Marketa vetting, Runtime admission,
deterministic trading scenarios) as OPEN. **Those gaps are real, but they are not first-slice
gaps** — they belong to the Constitutional Trading venture experiment (H2/H3 hypotheses, x402
micro-settlement, BitCent/QriptoCENT tokenomics), which the pilot brief's own scope-discipline
ruling places outside the Base Sepolia demonstration this session's "first slice" refers to. Do not
conflate the two; the operator's own rulings keep them separate.

## 2. What the twelve criteria say, re-verified

| # | Criterion | Status (2026-07-29 table) | Re-verified this session |
|---|---|---|---|
| 1 | Agent registered/identified on Base Sepolia | Documented only — live read | **Not verifiable from this repo — requires a live scheduled test, see §4** |
| 2 | Agent Card resolvable | Checkable — `services/horizen/agentCard.ts` | Confirmed present; exercised in `tests/horizen-integration.test.ts` |
| 3 | Verifiable PnL proof produced | Checkable — `correlate.ts`/`evidence.ts` | Confirmed present |
| 4 | Proof retrieved through the Horizen interface | Checkable — `client.ts` | Confirmed present |
| 5 | Proof correlated to correct token ID/network | Checkable — `identity.ts` + `correlate.ts` | Confirmed present |
| 6 | metaMe records the proof as constitutional evidence | Checkable — `evidence.ts` | Confirmed present |
| 7 | DVN receipt records the ingestion/action | Action type declared; live submission documented only | `partner_agent_evidence_recorded` confirmed on `ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts`); **a real submission still requires a live run, see §4** |
| 8 | Operator-agent binding + active delegation resolvable | Checkable — `agentBinding.ts` | Confirmed present |
| 9 | Attributable chain visible in Partner Workspace | Checkable — `EvidenceChainPanel` | Confirmed present |
| 10 | Repeated retrieval → same normalized result | Checkable — `buildHorizenEvidence` pure | Confirmed present |
| 11 | No Mainnet/Sepolia identity collision accepted | Checkable — network-first keying | Confirmed present |
| 12 | Malformed/mismatched/replayed/duplicate proofs fail safely | Checkable — `client.ts` failure taxonomy | Confirmed present |

**Ten of twelve criteria are code-complete and test-covered today.** Two (1 and 7's live half)
are, by their own nature, not something a repository can satisfy — they require an actual Base
Sepolia read and an actual DVN submission against a live registered agent.

## 3. Verification run (this session)

```
npx vitest run tests/horizen-integration.test.ts tests/horizen-agent-binding.test.ts \
  tests/horizen-evidence-chain.test.ts tests/partner-workspace.test.ts tests/workspace-report.test.ts
```

**Result: 5 files / 183 tests, all green**, on `HEAD` (`354be3796`) with no changes to any
`services/horizen/*`, `services/venture/partnerWorkspace.ts`, or evidence-chain file — Slice A and
Slice B (2026-07-28) and the partner-rulings pass (2026-07-29, commit `ac64a2d43`) are intact and
already merged into this branch. `HORIZEN_EVIDENCE_ACTION_TYPE` (`partner_agent_evidence_recorded`)
and `workspace_report_published` are both confirmed present on `ANCHORABLE_ACTION_TYPES` in
`services/dvn/activityReceiptDvnPipeline.ts` — no DVN pipeline file was touched (CLAUDE.md's DVN
Pipeline Protection restricts changes there to that one addition, which was already made in prior
sessions).

## 4. What genuinely remains, and who closes it

### Requires live scheduling / partner coordination — not something this session can do

Per the 2026-07-26 addendum's own "Genuinely still open" list, unchanged by this session:

- **The first Base Sepolia test date** — needs to be scheduled with Horizen.
- **The agreed Base Mainnet reference agent** for the later-phase bar (not a first-slice blocker).

Criteria 1 and 7 (live half) close automatically once that test runs — the code paths are already
built and tested; there is nothing further to implement in advance of the run.

### One stale doc line, corrected this session

Chrysalis tracker row 102 (`codexes/packs/irl/foundation/CHRYSALIS_WORKSTREAM_TRACKER.md`) recorded
the Aigent Z daily/weekly workspace report as "Done — schedule wiring outstanding." That was
already stale: `.github/workflows/workspace-report.yml` (present since `aa268b1ed`, 2026-07-28)
already implements the cron → ops-token-authorised POST, mirroring the established
`access-receipts-batcher.yml` convention. **Corrected in this session** to state plainly what is
actually outstanding: two credentials the workflow and the route (`app/api/venture/workspace/
[workspaceId]/report/route.ts`) both name explicitly and refuse to run without —

- GitHub repo secret **`ADMIN_OPS_TOKEN`** (Settings → Secrets and variables → Actions)
- Amplify env var **`WORKSPACE_REPORT_PERSONA_ID`** (the persona the scheduled report receipt is
  attributed to)

Neither value exists anywhere in this repository to read or verify. This agent did not set them —
inventing either would violate CLAUDE.md's no-guessing rule (a governance receipt's attributed
persona is exactly the kind of value that must never be guessed) and neither is a value an agent
session can create (a GitHub Actions secret and an Amplify environment variable are operator/admin
actions in external dashboards, not repo files).

### Explicitly out of first-slice scope (do not build; would blur two workstreams)

P-4 through P-8 of `2026-07-28_vl-ct-001-gap-register.md` (operator-claim UX, registry/Pulse write
paths, Marketa vetting workflow, Financial Services Runtime admission decision, deterministic
trading scenarios) belong to the **Constitutional Trading venture experiment**, which the pilot
brief's own scope-discipline ruling places outside the Base Sepolia first slice. Building any of
these now would be scope creep the operator's own rulings warn against, not first-slice completion.

## 5. Bottom line

**The Horizen MoneyPenny pilot's first slice (Base Sepolia, per the operator-ratified acceptance
criteria) is code-complete and test-green today.** Nothing safe-to-automate remained to build this
session — the two genuinely open items are a live test date with Horizen and two operator-only
credentials for the reporting automation. This is a legitimate "done, pending your action" finding,
not a gap this session left unaddressed.

## Files referenced (no code changed except the one doc line named above)

- `services/horizen/{identity,agentCard,client,correlate,evidence,agentBinding,evidenceChain}.ts`
- `app/api/venture/workspace/[workspaceId]/{route,evidence-chain/route,report/route}.ts`
- `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx`
- `tests/{horizen-integration,horizen-agent-binding,horizen-evidence-chain,partner-workspace,workspace-report}.test.ts`
- `.github/workflows/workspace-report.yml`
- `codexes/packs/irl/foundation/CHRYSALIS_WORKSTREAM_TRACKER.md` (row 102, corrected)
- `codexes/packs/agentiq/updates/2026-07-26_partner-workspace-horizen-pilot.md`
- `codexes/packs/agentiq/updates/2026-07-28_horizen-slice-b-joined-evidence-chain.md`
- `codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-gap-register.md`
- `codexes/packs/agentiq/updates/2026-07-29_horizen-partner-rulings-base-network-and-interfaces.md`
