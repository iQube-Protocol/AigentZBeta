# Commit Brief: `aef38a6` — Persist segments at completion + sequence manifests + sequencing control arm

| Field | Value |
|-------|-------|
| SHA | [`aef38a6`](https://github.com/iQube-Protocol/AigentZBeta/commit/aef38a69337cde07cd3fbf6b8fba7ba77725b874) |
| Author | Claude |
| Date | 2026-07-05T20:38:15Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Persist segments at completion + sequence manifests + sequencing control arm

Root cause of the empty recovery list: the EXP-002 runs used Sora, and
Sora clips only persist to storage when the proxy URL is first PLAYED —
the multi-segment flow never plays individual segments (the stitch
downloads them), so when the stitch died at the ffmpeg check the clips
existed only on OpenAI's side, which purges after ~1 hour. Venice had
the same gap worse (no full-video persistence at all; its thumbnail
trace also needed the missing ffmpeg).

Three-part fix:

- Persistence at completion, both providers: the Sora status route now
  downloads and persists the FULL video to generated/openai/videos the
  moment completion is detected (was: 4MB thumbnail range only); the
  Venice status route gains the same for generated/venice/videos.
  Segment completion — not first playback — is now the durable moment.

- Sequence manifests: SkillVideoPlayer records the run's ordered clip
  membership to generated/sequences/<id>.json at SUBMIT time, before
  any generation completes. New /api/skills/video/sequences route
  (POST write, admin GET with per-segment URL resolution preferring
  persisted copies). The recovery panel lists sequences as first-class
  units — recorded play order shown per segment with stored/
  provider-only status — and stitches a whole run in one click instead
  of picking clips from an undifferentiated pile.

- Sequencing control arm (EXP-002 coherence-test extension): each
  sequence also offers "Stitch reversed" — identical clips, temporal
  ordering deliberately violated. Prediction recorded in the EXP-002
  README: semantic fidelity intact, narrative coherence destroyed —
  the dissociation signature of inv.constitutional.078, isolating
  temporal correctness (CFS-013 §7) at zero new generation cost.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Root cause of the empty recovery list: the EXP-002 runs used Sora, and
Sora clips only persist to storage when the proxy URL is first PLAYED —
the multi-segment flow never plays individual segments (the stitch
downloads them), so when the stitch died at the ffmpeg check the clips
existed only on OpenAI's side, which purges after ~1 hour. Venice had
the same gap worse (no full-video persistence at all; its thumbnail
trace also needed the missing ffmpeg).

Three-part fix:

- Persistence at completion, both providers: the Sora status route now
  downloads and persists the FULL video to generated/openai/videos the
  moment completion is detected (was: 4MB thumbnail range only); the
  Venice status route gains the same for generated/venice/videos.
  Segment completion — not first playback — is now the durable moment.

- Sequence manifests: SkillVideoPlayer records the run's ordered clip
  membership to generated/sequences/<id>.json at SUBMIT time, before
  any generation completes. New /api/skills/video/sequences route
  (POST write, admin GET with per-segment URL resolution preferring
  persisted copies). The recovery panel lists sequences as first-class
  units — recorded play order shown per segment with stored/
  provider-only status — and stitches a whole run in one click instead
  of picking clips from an undifferentiated pile.

- Sequencing control arm (EXP-002 coherence-test extension): each
  sequence also offers "Stitch reversed" — identical clips, temporal
  ordering deliberately violated. Prediction recorded in the EXP-002
  README: semantic fidelity intact, narrative coherence destroyed —
  the dissociation signature of inv.constitutional.078, isolating
  temporal correctness (CFS-013 §7) at zero new generation cost.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/video/[id]/status/route.ts` |
| Modified | `app/api/skills/video/recoverable-segments/route.ts` |
| Added | `app/api/skills/video/sequences/route.ts` |
| Modified | `app/api/skills/video/venice/[queueId]/status/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/experiments/exp-002-invariant-video/README.md` |
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |
| Modified | `components/composer/SkillVideoPlayer.tsx` |

## Stats

 7 files changed, 479 insertions(+), 28 deletions(-)
