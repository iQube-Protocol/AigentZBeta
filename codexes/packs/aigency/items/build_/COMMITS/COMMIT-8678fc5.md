# Commit Brief: `8678fc5` — Close infra handoff, add MoneyPenny educational video (C-15/A3), fix Prepare empty-state gap [merge spec/moneypenny-mpy2-3]

| Field | Value |
|-------|-------|
| SHA | [`8678fc5`](https://github.com/iQube-Protocol/AigentZBeta/commit/8678fc53c6dbd1ee05542c91a6a512af32f9d336) |
| Author | Claude |
| Date | 2026-09-02T19:18:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close infra handoff, add MoneyPenny educational video (C-15/A3), fix Prepare empty-state gap [merge spec/moneypenny-mpy2-3]

- Infra handoff: identified dev Supabase project (bsjhfvctmduxhohtllly, the only
  project referenced anywhere in this repo's config/seeded data), applied and
  verified two outstanding migrations (bridge_content_placements table +
  knyts_bridge_editorial_config.infographic_url column) directly blocking C-15/A3.
- C-15/A3: one educational video, administered through native Qriptopian Bridges
  (assignDraftAsset/publishPlacement, unchanged), playable inline in the MoneyPenny
  copilot via a new shared SmartTriadInferenceRenderer media-video block, with a
  related chip opening a new structured "learn" panel. Deterministic chat-route
  short-circuit (exact prompt match, never LLM-interpreted) — no real video asset
  exists yet, so every surface honestly shows "not published" rather than
  fabricating one.
- Prepare empty-state fix: upsertFinancialProfileQube hardcoded has_profile: true
  on every write, including a compute pass where every uploaded statement was
  unreadable — silently earning "financial profile prepared" evidence on a
  genuinely empty profile. Now derives has_profile from whether real aggregates
  exist.
- Real Supabase access this session (unlike prior turns) allowed live-backend
  verification of the read paths; full authenticated (real end-user session)
  acceptance remains blocked on two named, precise gaps — no Auth Admin API
  access to mint a real session, and a sandbox-only missing
  SUPABASE_SERVICE_ROLE_KEY that breaks /api/codex/chat's module-level client
  for every caller, not specific to this change. Both documented in full.

tsc holds at 677; full vitest suite at 41 failed / 15 failed files, all
pre-existing and untouched by this diff (142 MoneyPenny-specific tests pass).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

- Infra handoff: identified dev Supabase project (bsjhfvctmduxhohtllly, the only
  project referenced anywhere in this repo's config/seeded data), applied and
  verified two outstanding migrations (bridge_content_placements table +
  knyts_bridge_editorial_config.infographic_url column) directly blocking C-15/A3.
- C-15/A3: one educational video, administered through native Qriptopian Bridges
  (assignDraftAsset/publishPlacement, unchanged), playable inline in the MoneyPenny
  copilot via a new shared SmartTriadInferenceRenderer media-video block, with a
  related chip opening a new structured "learn" panel. Deterministic chat-route
  short-circuit (exact prompt match, never LLM-interpreted) — no real video asset
  exists yet, so every surface honestly shows "not published" rather than
  fabricating one.
- Prepare empty-state fix: upsertFinancialProfileQube hardcoded has_profile: true
  on every write, including a compute pass where every uploaded statement was
  unreadable — silently earning "financial profile prepared" evidence on a
  genuinely empty profile. Now derives has_profile from whether real aggregates
  exist.
- Real Supabase access this session (unlike prior turns) allowed live-backend
  verification of the read paths; full authenticated (real end-user session)
  acceptance remains blocked on two named, precise gaps — no Auth Admin API
  access to mint a real session, and a sandbox-only missing
  SUPABASE_SERVICE_ROLE_KEY that breaks /api/codex/chat's module-level client
  for every caller, not specific to this change. Both documented in full.

tsc holds at 677; full vitest suite at 41 failed / 15 failed files, all
pre-existing and untouched by this diff (142 MoneyPenny-specific tests pass).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Added | `app/(shell)/moneypenny/components/MoneyPennyLearnPanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/api/codex/chat/route.ts` |
| Added | `app/api/moneypenny/learn-content/route.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Modified | `services/journey/knytsBridgeEditorialConfig.ts` |
| Added | `services/journey/moneyPennyEducationalMedia.ts` |
| Modified | `supabase/migrations/20260901000000_bridge_content_placements.sql` |
| Added | `tests/moneypenny-c15-educational-video.test.ts` |
| Added | `tests/moneypenny-empty-profile-evidence.test.ts` |
| Modified | `tests/moneypenny-financial-profile.test.ts` |

## Stats

 17 files changed, 997 insertions(+), 12 deletions(-)
