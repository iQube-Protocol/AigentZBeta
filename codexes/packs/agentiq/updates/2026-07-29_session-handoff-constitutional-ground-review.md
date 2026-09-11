# Session handoff — constitutional ground review (2026-07-28/29)

**Branch:** `claude/constitutional-ground-review-7yg8nb` → merged to `dev`
**For:** any agent or session picking up this work
**Read this first, then only the docs your workstream needs.**

---

## How to use this

Do **not** read all twelve docs below. Read this index, identify your workstream, read its two or three
docs, and trust the canaries for everything else. **The canaries are the real transfer mechanism** —
they fail the build rather than describing an intention, and most of what follows is already enforced.

---

## The four workstreams

### 1. EXP-P1 crystal — BLOCKED on a human act, everything else built

The corpus is **478 rows** in the database (the Live Invariant Corpus, authoritative). The Seed Corpus
file holds 373 and drifts by design.

Built: `scripts/export-crystal-snapshot.mjs` (`--survey`, `--scaffold-relations`, `--triage-relations`,
`--relations`, freeze), `services/research/experimentRelation.ts`, and `IRL-REVIEW-001` Phase 1
(`services/research/review/`, the two-reviewer runner, the Lab surface in the experiments form).

**Nothing is frozen, correctly.** The blocker is the independence review itself, which is a governed
act. Reviewer pair is pinned: `llama-3.3-70b` (R1) / `qwen3-235b-a22b-instruct-2507` (R2).

- `2026-07-29_external-review-rulings.md` — the EXP-P1 rulings
- `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md` — the general capability
- `2026-07-29_irl-review-001-phase-1-adjudication-workflow.md` + `..._lab-surface.md`

### 2. VL-CT-001 pilot — substrate complete, execution not started

`codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-constitutional-trading-venture-charter.md` is the
charter; the gap register beside it is honest about what is *not* built. Three hypotheses: H1
operability, H2 micro-stablecoin efficiency, H3 constitutional preparation neutrality.

Built: the venture substrate (`services/venture/trading/`) — opportunity as the primary unit,
preparation-cost events, completion verdicts, the obligation ledger, the V-10 Standing guard, and a
16-run MoneyPenny matrix. **Obligations appear in 8/8 cells for execution and 4/8 for refusal, and the
four are exactly the `*-COMPLETE` cells** — the effect is the compensation regime, not the
denomination or pricing.

Not built: Slices C–G (Standing attribution, registration/Pulse writes, operator-claim UX, Marketa
vetting, MoneyPenny production orchestration), V-1's actual cost computation, V-3, V-6, V-8, V-9.

### 3. QriptoCENT — supply and settlement constitution

`2026-07-29_qriptocent-supply-constitution.md`. Per **denomination**, not per chain. Base Q¢ holds
400,000,000 against its own 1,000,000,000 cap (`0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE`, Base
8453). B¢ intended at 100,000,000, **etching blocked** pending the allocation plan.

Interoperability is **inter-ledger settlement, not token bridging** — an earlier revision said
lock-and-mint and was corrected. See `2026-07-29_qriptocent-cross-denomination-settlement.md` and
`2026-07-29_constitutional-trading-transparency-and-fee-classification.md`.

### 4. Research Workspace — in flight at handoff

`codexes/packs/irl/foundation/SPEC-IRL-WORKSPACE-001_research-workspace.md`. One shared workspace
primitive, configured not forked. Autonomi independent review + two Lehigh capstones.

---

## Standing rulings a new session must not rediscover

**The Constitutional Trading Transparency Principle.** *A market movement is a market fact. A
deliberately retained spread is a fee.* No provider may attribute retained compensation to market
conditions without separately proving the underlying market movement. Ratified across the whole
Financial Services Runtime, implemented in settlement only.

**Standing follows verified constitutional contribution**, never transaction volume, execution count,
revenue, fees, notional or profit alone. A correct refusal must be capable of earning equal or greater
Standing than an execution. Student capstone contributions earn Standing on the same basis — the
**verified contribution**, never the submission.

**Corpus membership ≠ experimental eligibility ≠ freeze ≠ canonicality.** Four questions, routinely
collapsed into the word "crystal". `proposed` invariants may be frozen in their actual state; synthetic
promotion is forbidden. Standing gates arm *treatment*, never corpus *eligibility*.

**Exclude self-reference, not internal knowledge.** Internal provenance does not disqualify; derivation
from the experiment's target, tasks or observed outcomes does.

---

## The defect class that dominated this session

**A mechanism that cannot fire.** Four instances, three of them the agent's own:

| Instance | Shape |
|---|---|
| QubeTalk RLS policies gating on an unset GUC, under a service-role connection that bypasses RLS | read as protection, never once evaluated |
| The vP1 domain boundary containing every namespace in the corpus | a filter that excluded nothing |
| `applyProvenanceReclassification` with zero callers | a checklist with no write path |
| `if (false && !isAdmin)` | every source-grep canary green, every caller admitted |

**The lesson, and the reason the canaries in this branch look the way they do: exercise the mechanism,
do not grep for its presence.** A canary asserting a gate *exists* passes identically whether the gate
works or is inert.

Two related traps worth knowing:

- **A denial-only suite proves exclusion, not availability.** It passes at its maximum when the surface
  is reachable by nobody. Every gated surface needs a positive reachability canary asserting **exact
  sets**, driving the **real** filter.
- **Verify a mutation actually applied before concluding a canary survived.** Four false survivors
  occurred: an interface-only edit with no typecheck at test time; a module-collection throw emitting
  no per-test marker; a canary deriving its expectation with the same predicate as the code under test;
  and the `if (false && ...)` above.

---

## Open, and needing the operator

| | |
|---|---|
| Two migrations | receipt CHECK rebuild + `research_objects` object_kind |
| `merge-claude-to-dev.yml` → `main` | or generic merge messages recur next session |
| First independence review | CLI is the reliable path for 478 rows; the form suits smaller assets |
| **R-10** | the B¢ allocation plan — **etching is blocked and the Rune name is immutable** |
| G-2 | two etching scripts with irreconcilable tokenomics; both guarded, neither authoritative |
| G-3 | a hardcoded testnet WIF in `scripts/deploy-qct-bitcoin.js` |
| Marketa / composer / pipeline routes | same `x-persona-id`-as-auth pattern as the QubeTalk leak; audited, not fixed |
| `app/api/mcp/xmtp-bridge` | unauthenticated write path into QubeTalk channels; needs a callback secret |

---

## Two facts about this repo that cost time before they were known

**`origin` on the operator's laptop is the stale `Kn0w-1` fork.** Session work lives on
`iQube-Protocol`, which is the `iqp` remote there. Never tell the operator to `git pull origin` for
anything session-related — see CLAUDE.md, "Canonical Repo vs the Operator's Local Clone."

**Two deployment-registry docs disagreed** about whether Base QCT was deployed. `docs/alpha/agentiq-knyt/35-…`
said PENDING; `codexes/packs/agentiq/updates/2026-04-22_mainnet-deployment-registry.md` carried the live
address. The second is right. Check both before reporting deployment state.
