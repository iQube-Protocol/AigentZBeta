# Commit Brief: `7832d1a` — Harden experiment step transport against gateway timeouts (Safari fix)

| Field | Value |
|-------|-------|
| SHA | [`7832d1a`](https://github.com/iQube-Protocol/AigentZBeta/commit/7832d1a76b0f56bec914d075a4855c73cd989d3f) |
| Author | Claude |
| Date | 2026-07-05T14:46:48Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Harden experiment step transport against gateway timeouts (Safari fix)

The first cartridge-mounted EXP-003 run failed on iPad Safari with "The
string did not match the expected pattern" — the initialized-arm answer
call outlived the ~30s SSR gateway timeout, the gateway answered with an
empty body, and Safari's res.json() threw its cryptic WebKit error.

Two-sided fix:

- Client: new components/composer/experimentStepFetch.ts reads text
  first and parses defensively, so non-JSON/empty responses become
  descriptive errors (with a gateway-timeout hint), and retries each
  step once automatically (steps are stateless and idempotent at
  temperature 0). All three experiment surfaces (EXP-001, EXP-003,
  Results tab) now route through it.

- Server: callChatWithUsage aborts provider calls at 25s so the route
  returns a clean JSON error the client retry can act on, instead of
  being killed by the gateway with an empty body.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The first cartridge-mounted EXP-003 run failed on iPad Safari with "The
string did not match the expected pattern" — the initialized-arm answer
call outlived the ~30s SSR gateway timeout, the gateway answered with an
empty body, and Safari's res.json() threw its cryptic WebKit error.

Two-sided fix:

- Client: new components/composer/experimentStepFetch.ts reads text
  first and parses defensively, so non-JSON/empty responses become
  descriptive errors (with a gateway-timeout hint), and retries each
  step once automatically (steps are stateless and idempotent at
  temperature 0). All three experiment surfaces (EXP-001, EXP-003,
  Results tab) now route through it.

- Server: callChatWithUsage aborts provider calls at 25s so the route
  returns a clean JSON error the client retry can act on, instead of
  being killed by the gateway with an empty body.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/Exp001EvaluationRunner.tsx` |
| Modified | `components/composer/Exp003RediscoveryRunner.tsx` |
| Modified | `components/composer/ExperimentResultsTab.tsx` |
| Added | `components/composer/experimentStepFetch.ts` |
| Modified | `services/experiments/llm.ts` |

## Stats

 5 files changed, 130 insertions(+), 64 deletions(-)
