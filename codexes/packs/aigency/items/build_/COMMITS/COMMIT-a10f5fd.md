# Commit Brief: `a10f5fd` — add Stage-0 instrument validation (IRV-001/IPV-001) — shake down IRE+IPE before the science

| Field | Value |
|-------|-------|
| SHA | [`a10f5fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/a10f5fd83550411a56b4aae37b23b0b406df87a8) |
| Author | Claude |
| Date | 2026-07-18T01:11:40Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Stage-0 instrument validation (IRV-001/IPV-001) — shake down IRE+IPE before the science

Validate the engines before they carry any experiment (calibrate the telescope
before observing). Adds:
- Public IRE/IPE resolve route /api/public/irl/resolve (persona-free, T2-safe;
  new surface, gated route untouched) so the shakedown + independent replication
  run without credentials.
- scripts/run-instrument-validation.mjs — IRV-001 (Synthetic Expert Baseline vs
  IRE: coverage/compression/novelty + seed-set stability) and IPV-001 (IPE
  projection reproducibility). SEB personas forbidden the word 'invariant';
  framed as engineering calibration, explicitly NOT a Delphi study.
- 20-intent multi-domain config; hash-committed results/manifest output.
- IRV-001/IPV-001 charters + roadmap Stage-0 insert + registry (IV0 series).
Runnable now (needs a dev host + one provider key); no external sign-off.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Validate the engines before they carry any experiment (calibrate the telescope
before observing). Adds:
- Public IRE/IPE resolve route /api/public/irl/resolve (persona-free, T2-safe;
  new surface, gated route untouched) so the shakedown + independent replication
  run without credentials.
- scripts/run-instrument-validation.mjs — IRV-001 (Synthetic Expert Baseline vs
  IRE: coverage/compression/novelty + seed-set stability) and IPV-001 (IPE
  projection reproducibility). SEB personas forbidden the word 'invariant';
  framed as engineering calibration, explicitly NOT a Delphi study.
- 20-intent multi-domain config; hash-committed results/manifest output.
- IRV-001/IPV-001 charters + roadmap Stage-0 insert + registry (IV0 series).
Runnable now (needs a dev host + one provider key); no external sign-off.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/public/irl/resolve/route.ts` |
| Modified | `codexes/packs/irl/collections.json` |
| Modified | `codexes/packs/irl/foundation/IRL_VALIDATION_ROADMAP.md` |
| Added | `codexes/packs/irl/foundation/experiments/ipv-001-invariant-projection-validation/README.md` |
| Added | `codexes/packs/irl/foundation/experiments/irv-001-invariant-resolution-validation/README.md` |
| Added | `scripts/run-instrument-validation.mjs` |
| Added | `services/experiments/instrument-validation-intents.json` |
| Modified | `types/research.ts` |

## Stats

 8 files changed, 541 insertions(+), 1 deletion(-)
