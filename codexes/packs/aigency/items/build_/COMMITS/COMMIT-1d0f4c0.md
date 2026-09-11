# Commit Brief: `1d0f4c0` — feat(chain): auto-consult specialist on Queue — close the recursion loop

| Field | Value |
|-------|-------|
| SHA | [`1d0f4c0`](https://github.com/iQube-Protocol/AigentZBeta/commit/1d0f4c092eedf69d3cd8d930d709b49f0d641f33) |
| Author | Claude |
| Date | 2026-06-05T02:09:28Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(chain): auto-consult specialist on Queue — close the recursion loop

Queue button on a specialist recommendation now spawns the child
intent AND immediately fires the specialist consultation server-
side via askSpecialist(). Child intent flips to
awaiting_approval; child receipt carries the full
SpecialistResponse body (title + summary + recommendations[] +
suggestedArtifacts).

The operator's expanded child intent now shows Marketa's actual
recursive recommendations on the original bullet — each of which
is again queueable. Plan-to-execute loop closes without manual
approval gates between every step.

Failure-mode: askSpecialist failure leaves child in_progress and
returns autoConsulted=false, so the existing manual chain action
row still drives the consultation. Best-effort by design.

Chain dispatch for the parent CTA (marketa.ask-partner-proposal
→ chain template) was already wired in AigentMeWelcomeSplitTab
(line 1008) + the catalog id matches triggered_by_nbe. No
additional wiring needed there.
```

## Body

Queue button on a specialist recommendation now spawns the child
intent AND immediately fires the specialist consultation server-
side via askSpecialist(). Child intent flips to
awaiting_approval; child receipt carries the full
SpecialistResponse body (title + summary + recommendations[] +
suggestedArtifacts).

The operator's expanded child intent now shows Marketa's actual
recursive recommendations on the original bullet — each of which
is again queueable. Plan-to-execute loop closes without manual
approval gates between every step.

Failure-mode: askSpecialist failure leaves child in_progress and
returns autoConsulted=false, so the existing manual chain action
row still drives the consultation. Best-effort by design.

Chain dispatch for the parent CTA (marketa.ask-partner-proposal
→ chain template) was already wired in AigentMeWelcomeSplitTab
(line 1008) + the catalog id matches triggered_by_nbe. No
additional wiring needed there.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/intent-queue-next/route.ts` |

## Stats

 1 file changed, 55 insertions(+), 1 deletion(-)
