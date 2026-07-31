# Commit Brief: `71496e9` — Tighten the CCRL research loop: one-click Run-stage hand-off via a cartridge-agnostic tab-nav seam

| Field | Value |
|-------|-------|
| SHA | [`71496e9`](https://github.com/iQube-Protocol/AigentZBeta/commit/71496e979a0ca965cc5121fc0ba97b0778efc507) |
| Author | Claude |
| Date | 2026-07-07T18:19:15Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Tighten the CCRL research loop: one-click Run-stage hand-off via a cartridge-agnostic tab-nav seam

The C3 Run stage surfaced only a text pointer ("run it in the ccrl-experiment-lab
tab") because no generic intra-cartridge tab-switch existed — only KNYT's
surface-specific `knyt:navigate-tab` event. Generalize that pattern: the codex
viewer now listens for a cartridge-agnostic `codex:navigate-tab` CustomEvent and
switches to the requested tab IF it is a currently-visible tab of the active
codex (an unknown/hidden slug is ignored, so it can't cross cartridges or reveal
a hidden tab). The Run-stage card's pointer becomes a one-click "Open the
Experiment Lab" button that dispatches it.

This is NAVIGATION, not execution — the constitutional boundary holds: running
still happens in the lab, the copilot never runs the experiment; the button just
takes the operator to where they run it. Observed as a surface interaction.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The C3 Run stage surfaced only a text pointer ("run it in the ccrl-experiment-lab
tab") because no generic intra-cartridge tab-switch existed — only KNYT's
surface-specific `knyt:navigate-tab` event. Generalize that pattern: the codex
viewer now listens for a cartridge-agnostic `codex:navigate-tab` CustomEvent and
switches to the requested tab IF it is a currently-visible tab of the active
codex (an unknown/hidden slug is ignored, so it can't cross cartridges or reveal
a hidden tab). The Run-stage card's pointer becomes a one-click "Open the
Experiment Lab" button that dispatches it.

This is NAVIGATION, not execution — the constitutional boundary holds: running
still happens in the lab, the copilot never runs the experiment; the button just
takes the operator to where they run it. Observed as a surface interaction.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/codex/viewer/page.tsx` |
| Modified | `components/composer/CCRLResearchCopilotTab.tsx` |

## Stats

 2 files changed, 50 insertions(+), 8 deletions(-)
