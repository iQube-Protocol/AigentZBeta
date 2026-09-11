# Commit Brief: `2ba52ac` — Add GitHub Actions workflows for the ops routes needing CRON_TRIGGER_TOKEN

| Field | Value |
|-------|-------|
| SHA | [`2ba52ac`](https://github.com/iQube-Protocol/AigentZBeta/commit/2ba52ac029613d97006ec7e296642f508768ccff) |
| Author | Claude |
| Date | 2026-08-09T17:51:55Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add GitHub Actions workflows for the ops routes needing CRON_TRIGGER_TOKEN

The operator hit "unauthorized" pasting a literal <CRON_TRIGGER_TOKEN>
placeholder into curl by hand. These wrap agent-journey-forensics,
correct-premature-standing-seed, and provision-agent-wallet the same way
apply-moneypenny-aigentqube.yml already does: the real secret is read
server-side from repo secrets and never has to be typed or seen directly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

The operator hit "unauthorized" pasting a literal <CRON_TRIGGER_TOKEN>
placeholder into curl by hand. These wrap agent-journey-forensics,
correct-premature-standing-seed, and provision-agent-wallet the same way
apply-moneypenny-aigentqube.yml already does: the real secret is read
server-side from repo secrets and never has to be typed or seen directly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `.github/workflows/agent-journey-forensics.yml` |
| Added | `.github/workflows/correct-premature-standing-seed.yml` |
| Added | `.github/workflows/provision-agent-wallet.yml` |

## Stats

 4 files changed, 145 insertions(+), 1 deletion(-)
