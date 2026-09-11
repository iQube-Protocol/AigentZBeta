# Commit Brief: `d1289ff` — Add EXP-001 independent-judge evaluation harness

| Field | Value |
|-------|-------|
| SHA | [`d1289ff`](https://github.com/iQube-Protocol/AigentZBeta/commit/d1289ff2b2e08aa49a46039c0cea8eb4d694deb5) |
| Author | Claude |
| Date | 2026-07-04T07:35:58Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add EXP-001 independent-judge evaluation harness

Executes evaluation-protocol.md end-to-end: per-artifact + combined
answer passes over the 4 text artifacts (video recorded as pending its
EXP-002 production run), the Q13-15 adversarial hallucination probes,
and machine-assisted rubric scoring (consistency/correctness/
hallucination judged per question, coherence per artifact,
explainability computed from expected-vs-cited markers) with the
protocol's targets table. Provider-selectable like the EXP-003 harness,
defaulting to non-Anthropic judges for independence since the artifacts
were Anthropic-authored. Emits the flywheel-eligible invariant list but
never applies validation events itself — recordConsequence belongs to
the Invariant Service. Results JSON carries every raw answer for the
human scorer the protocol requires.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Executes evaluation-protocol.md end-to-end: per-artifact + combined
answer passes over the 4 text artifacts (video recorded as pending its
EXP-002 production run), the Q13-15 adversarial hallucination probes,
and machine-assisted rubric scoring (consistency/correctness/
hallucination judged per question, coherence per artifact,
explainability computed from expected-vs-cited markers) with the
protocol's targets table. Provider-selectable like the EXP-003 harness,
defaulting to non-Anthropic judges for independence since the artifacts
were Anthropic-authored. Emits the flywheel-eligible invariant list but
never applies validation events itself — recordConsequence belongs to
the Invariant Service. Results JSON carries every raw answer for the
human scorer the protocol requires.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/README.md` |
| Added | `scripts/evaluate-exp001.mjs` |

## Stats

 2 files changed, 473 insertions(+), 1 deletion(-)
