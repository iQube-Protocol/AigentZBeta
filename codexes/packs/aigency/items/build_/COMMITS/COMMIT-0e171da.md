# Commit Brief: `0e171da` — Honor public workspace visibility and label My Experiments in IRL OS Workspace

| Field | Value |
|-------|-------|
| SHA | [`0e171da`](https://github.com/iQube-Protocol/AigentZBeta/commit/0e171da6f059d482a676883da940d577955bacb9) |
| Author | Claude |
| Date | 2026-09-02T12:59:22Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Honor public workspace visibility and label My Experiments in IRL OS Workspace

PartnerProgrammesTab's workspace picker previously showed ONLY grant-
scoped workspaces, with no path for an admin-declared visibility:
'public' workspace to appear for a caller with no grant at all -- the
concrete gap behind IRL OS "hiding all private research" even from a
principal with a legitimate, narrower entitlement. The picker now also
includes any workspace whose researchVisibility is 'public', mirroring
the server-side resolver added in the prior commit; no workspace in
the registry declares 'public' today, so this only ever widens what an
explicit admin declaration reaches, never a grant-independent default.
Also labels the existing (now correctly-scoped) programme nav "My
Experiments" per the restoration spec, without duplicating its state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

PartnerProgrammesTab's workspace picker previously showed ONLY grant-
scoped workspaces, with no path for an admin-declared visibility:
'public' workspace to appear for a caller with no grant at all -- the
concrete gap behind IRL OS "hiding all private research" even from a
principal with a legitimate, narrower entitlement. The picker now also
includes any workspace whose researchVisibility is 'public', mirroring
the server-side resolver added in the prior commit; no workspace in
the registry declares 'public' today, so this only ever widens what an
explicit admin declaration reaches, never a grant-independent default.
Also labels the existing (now correctly-scoped) programme nav "My
Experiments" per the restoration spec, without duplicating its state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` |

## Stats

 1 file changed, 46 insertions(+), 3 deletions(-)
