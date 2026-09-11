# EXP-P1 — Everything You Need on One Page

**For Austin Ambrozi + agent · Invariant Research Lab · 2026-07-18**
**Base host:** `https://dev-beta.aigentz.me` (all links below are live against it)

---

## 1 · Read the package (human, browser — no login)

The IRL OS open cartridge is the front door:

| What | Link |
|---|---|
| **Dashboard** (mission + published results) | https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-dashboard&theme=dark&density=wide |
| **Protocols & Articles** — EXP-P1 protocol, Stage-0 handoff, IRV/IPV records | https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-protocols&theme=dark&density=wide |
| **Constitutional Evaluation** (CFS-033 — the evaluation framework) | https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-evaluation&theme=dark&density=wide |
| **Invariant Registry** (browse the substrate) | https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-invariant-registry&theme=dark&density=wide |
| **Invariant Field Explorer** (live field + counterfactuals) | https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-invariant-field&theme=dark&density=wide |

## 2 · Download the documents (agent, raw markdown — no login)

`GET /api/public/irl/doc?path=<pack path>` returns the raw file:

```bash
BASE=https://dev-beta.aigentz.me/api/public/irl/doc

curl -sL "$BASE?path=foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md"        -o EXP-P1_Protocol.md
curl -sL "$BASE?path=foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md" -o Stage-0_Handoff.md
curl -sL "$BASE?path=foundation/experiments/irv-001-invariant-resolution-validation/README.md"        -o IRV-001_Record.md
curl -sL "$BASE?path=foundation/experiments/ipv-001-invariant-projection-validation/README.md"        -o IPV-001_Record.md
curl -sL "$BASE?path=foundation/IRL_VALIDATION_ROADMAP.md"                                            -o IRL_Validation_Roadmap.md
curl -sL "$BASE?path=foundation/CFS-033_constitutional-evaluation.md"                                 -o CFS-033_Evaluation.md
```

## 3 · Fetch the frozen substrate (agent, JSON — no login)

The exact bytes every run grounded against:

```bash
HOST=https://dev-beta.aigentz.me

# The invariant corpus (statements + standing; the crystal)
curl -s "$HOST/api/public/irl/invariants?limit=500"

# The live invariant field (enables/constrains/contradicts edges)
curl -s "$HOST/api/public/irl/invariant-field"

# Drive the IRE/IPE yourself — the same engine the Stage-0 runs used
curl -s -X POST "$HOST/api/public/irl/resolve" \
  -H 'content-type: application/json' \
  -d '{"intent":"Decide whether a delegated agent may extend its authority beyond what its principal granted."}'

# Published results (verify: sha256 over resultsJson verbatim == contentHash)
curl -s "$HOST/api/public/irl/experiments-results"
```

## 4 · Sign the agreement (the x409 handshake — starts everything)

One constitutional act covers protocol freeze + your agent's submission authority. You will receive an **agreement id** privately (treat it as a capability credential — anyone holding it can act the steps below; don't publish it).

**4a — Review the terms** (either of you):
```bash
curl -s "https://dev-beta.aigentz.me/api/public/irl/agreement?agreementId=<AGREEMENT-ID>"
```
Returns the bounded authority you're being granted: allowed actions, TTL, submission budget (`maxActions`), forbidden actions. Nothing is granted yet.

**4b — Your agent accepts its side** (x409; can only bind to the pre-named agent ref):
```bash
curl -s -X POST "https://dev-beta.aigentz.me/api/public/irl/agreement" \
  -H 'content-type: application/json' \
  -d '{"action":"accept","agreementId":"<AGREEMENT-ID>","acceptorId":"<YOUR-AGENT-REF>"}'
```
`acceptorId` must equal the agreement's `selectedAgentRef` (from 4a). Acceptance does **not** open the gate.

**4c — Dele authorizes** (Institute side, human-only — you'll be notified). Poll until `status: "authorized"`:
```bash
curl -s "https://dev-beta.aigentz.me/api/public/irl/agreement?agreementId=<AGREEMENT-ID>" | grep status
```
This countersignature is simultaneously the **EXP-P1 §15 freeze** and your agent's submission authorization.

## 5 · Submit results (agent, after authorization)

```bash
curl -s -X POST "https://dev-beta.aigentz.me/api/public/irl/experiments/submit" \
  -H 'content-type: application/json' \
  -d '{
    "agreementId": "<AGREEMENT-ID>",
    "experiment": "EXP-P1",
    "provider": "<your provider>",
    "model": "<exact model string>",
    "aggregates": { "note": "independent re-run, judge config sha256=..." },
    "results": { }
  }'
```
- Accepted experiments: `EXP-P1`, `EXP-P2`, `EXP-P3`, `IRV-001`, `IPV-001`.
- Every submission is checked against the agreement: authorized status, TTL not lapsed, budget not exhausted. The response returns your remaining budget.
- Your submission is stored verbatim, sha256-committed, receipted into the Institute's constitutional memory with `origin: "external"` / *independently submitted* — the same trust path as internal results.

**Verify any published result trustlessly:**
```bash
curl -s "https://dev-beta.aigentz.me/api/public/irl/experiments-results"
# recompute: sha256(resultsJson verbatim) and compare with contentHash
```

## 6 · The safeguards (what you can rely on)

- **Acceptance ≠ authorization.** Only Dele, authenticated as the agreement's owner, can authorize — your agent (or anyone) can never open its own gate.
- **Bounded, expiring, revocable.** TTL + `maxActions` + status are enforced per submission; lapse or revocation closes the door with a 409 and a stated reason.
- **Everything receipted.** Acceptance, authorization, and each submission emit tamper-evident receipts (DVN-anchorable).
- **Nothing about you is stored beyond refs.** Agent ref + agreement slug only — no personal identifiers in any stored row or receipt.

## 7 · Questions in the review ask

1. Does the protocol adequately distinguish instrument behaviour from measurement artefacts?
2. Is the frozen methodology sufficient to proceed into EXP-P1?
3. Is the invariant substrate appropriate for the intended investigation?

Reply through any channel; if satisfied, 4b–4c executes the countersignature.
