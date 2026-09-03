# Commit Brief: `bfb5733` — Fix MoneyPenny reader honesty: distinct 503s replace false not-published

| Field | Value |
|-------|-------|
| SHA | [`bfb5733`](https://github.com/iQube-Protocol/AigentZBeta/commit/bfb5733e2503d7de0df3ae97675b880982dab44f) |
| Author | Claude |
| Date | 2026-09-02T23:56:20Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix MoneyPenny reader honesty: distinct 503s replace false not-published

getCommunityContentSupabase() silently fell back to the anon key when
SUPABASE_SERVICE_ROLE_KEY was missing, and bridge_content_placements'
service_role-only RLS then returned zero rows with no error — a config
gap indistinguishable from "nothing published yet." Add
getServiceRoleSupabaseOrThrow() which throws named, distinguishable
errors instead, and wire it into /api/moneypenny/learn-content and
/api/journey/knyts-bridge/placements (GET+POST) as named 503s ahead of
the generic 500.

Also switch moneyPennyEducationalMedia.ts off bridge_content_placements
(admin-only draft bookkeeping) onto getKnytsBridgeEditorialSection — the
same published-content projection every CI/KNYTS public bridge reader
already uses — without broadening the placements table's RLS.

Add a real behavioral proof that editing/replacing a financial profile
invalidates its prior review (reviewedAt: null -> set -> null across
compute -> review -> edit), not just source-shape assertions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

getCommunityContentSupabase() silently fell back to the anon key when
SUPABASE_SERVICE_ROLE_KEY was missing, and bridge_content_placements'
service_role-only RLS then returned zero rows with no error — a config
gap indistinguishable from "nothing published yet." Add
getServiceRoleSupabaseOrThrow() which throws named, distinguishable
errors instead, and wire it into /api/moneypenny/learn-content and
/api/journey/knyts-bridge/placements (GET+POST) as named 503s ahead of
the generic 500.

Also switch moneyPennyEducationalMedia.ts off bridge_content_placements
(admin-only draft bookkeeping) onto getKnytsBridgeEditorialSection — the
same published-content projection every CI/KNYTS public bridge reader
already uses — without broadening the placements table's RLS.

Add a real behavioral proof that editing/replacing a financial profile
invalidates its prior review (reviewedAt: null -> set -> null across
compute -> review -> edit), not just source-shape assertions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/knyts-bridge/placements/route.ts` |
| Modified | `app/api/moneypenny/learn-content/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `services/journey/moneyPennyEducationalMedia.ts` |
| Added | `services/supabase/requireServiceRoleClient.ts` |
| Modified | `tests/knyts-bridge-infographic-render.test.ts` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |
| Modified | `tests/moneypenny-financial-profile-reviewed.test.ts` |
| Added | `tests/moneypenny-reader-honesty.test.ts` |

## Stats

 9 files changed, 627 insertions(+), 55 deletions(-)
