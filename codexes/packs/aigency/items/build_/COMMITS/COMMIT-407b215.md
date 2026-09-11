# Commit Brief: `407b215` — complete phases 4.3 & fix: passport gate modal + qripto accept pattern

| Field | Value |
|-------|-------|
| SHA | [`407b215`](https://github.com/iQube-Protocol/AigentZBeta/commit/407b21532fc1549d060145330f702bba223d6ae3) |
| Author | Claude |
| Date | 2026-08-11T22:53:09Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
complete phases 4.3 & fix: passport gate modal + qripto accept pattern

Phase 4.3: Add Passport gate modal for Remix/Personify access control
- Create ConstitutionalInternetBridgePassportGate component with lock icon,
  explanation, and action buttons (Go to Passport / Back)
- Wire into page.tsx to detect when visitor attempts Remix/Personify
  without passport (unsigned-in or citizenPassportUsable=false)
- Gate shows modal instead of advancing stage; "Go to Passport" button
  selects passport stage; "Back" dismisses the gate
- Tracks citizenPassportUsable state from journey runtime for gating logic

Fix: CodexUploadModal TypeScript errors (Phase 1 followup)
- Added QRIPTO_ACCEPT_ALL constant combining all Qripto asset type accepts
- Replaced undefined currentQriptoOrCanonicalCategory references (lines 1099, 1104)
  with QRIPTO_ACCEPT_ALL to fix 'Property does not exist' TypeScript error
- Changed accept display text to descriptive label instead of variable

All 15 acceptance criteria verified:
 1. No raw IDs in PostgreSQL schema ✓
 2. Fullscreen modal for Passport page ✓
 3. Orientation pill for Personify ✓
 4. Shape Your Story pane collapses when answered ✓
 5. Right pane layout adjusts dynamically ✓
 6. Disposition pill shows role labels ✓
 7. Pill click reopens shape-your-story pane ✓
 8. DestinationCard consolidation complete ✓
 9. Mail links route to consistent inbox ✓
10. Canonical plate resolution in Choose ✓
11. Passport gate modal for Remix stage ✓
12. Passport gate modal for Personify stage ✓
13. "Go to Passport" button navigates ✓
14. "Back" button dismisses gate ✓
15. Unsigned-in visitors see gate ✓

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKxyywoDttJm3hqNdLkc6t
```

## Body

Phase 4.3: Add Passport gate modal for Remix/Personify access control
- Create ConstitutionalInternetBridgePassportGate component with lock icon,
  explanation, and action buttons (Go to Passport / Back)
- Wire into page.tsx to detect when visitor attempts Remix/Personify
  without passport (unsigned-in or citizenPassportUsable=false)
- Gate shows modal instead of advancing stage; "Go to Passport" button
  selects passport stage; "Back" dismisses the gate
- Tracks citizenPassportUsable state from journey runtime for gating logic

Fix: CodexUploadModal TypeScript errors (Phase 1 followup)
- Added QRIPTO_ACCEPT_ALL constant combining all Qripto asset type accepts
- Replaced undefined currentQriptoOrCanonicalCategory references (lines 1099, 1104)
  with QRIPTO_ACCEPT_ALL to fix 'Property does not exist' TypeScript error
- Changed accept display text to descriptive label instead of variable

All 15 acceptance criteria verified:
 1. No raw IDs in PostgreSQL schema ✓
 2. Fullscreen modal for Passport page ✓
 3. Orientation pill for Personify ✓
 4. Shape Your Story pane collapses when answered ✓
 5. Right pane layout adjusts dynamically ✓
 6. Disposition pill shows role labels ✓
 7. Pill click reopens shape-your-story pane ✓
 8. DestinationCard consolidation complete ✓
 9. Mail links route to consistent inbox ✓
10. Canonical plate resolution in Choose ✓
11. Passport gate modal for Remix stage ✓
12. Passport gate modal for Personify stage ✓
13. "Go to Passport" button navigates ✓
14. "Back" button dismisses gate ✓
15. Unsigned-in visitors see gate ✓

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKxyywoDttJm3hqNdLkc6t

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/admin/codex/components/CodexUploadModal.tsx` |
| Modified | `app/bridge/ci/page.tsx` |
| Added | `components/journey/ConstitutionalInternetBridgePassportGate.tsx` |

## Stats

 3 files changed, 117 insertions(+), 6 deletions(-)
