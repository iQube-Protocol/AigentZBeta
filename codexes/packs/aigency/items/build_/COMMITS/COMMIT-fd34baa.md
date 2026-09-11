# Commit Brief: `fd34baa` — Qriptopian Cartridge v3.1 refinement — Store, Qriptopia, Admin reorder + Community Correspondent

| Field | Value |
|-------|-------|
| SHA | [`fd34baa`](https://github.com/iQube-Protocol/AigentZBeta/commit/fd34baa4a7e05b89c58e3e360219aeff46868e44) |
| Author | Claude |
| Date | 2026-05-26T19:55:50Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Qriptopian Cartridge v3.1 refinement — Store, Qriptopia, Admin reorder + Community Correspondent

Implements the v3.1 operator refinements on top of yesterday's v3
restructure. Pure config changes plus one new tab component.

Store group (now 3 sub-tabs, no nesting):
  - Premium Content (unchanged)
  - KNYT (NEW, promoted to its own sub-tab — renders KnytStoreBundlesTab
    directly, no host wrapper)
  - Affiliates & Partners (now a stub for future partners; KNYT lives
    outside)

Qriptopia group (4 sub-tabs, reordered):
  - Features (NEW first slot — reuses FeaturesTab so the Qriptopia
    group travels cleanly when mirrored into metaMe)
  - Qriptopian Pulse (existing stub, now second)
  - Community Correspondent (NEW — renamed from "Community"; renders
    a new QriptoCommunityCorrespondentTab component that shows the
    three-pill structure Canon · Community · Correspondent with branch
    blurbs and a "wiring in progress" note per pill. Real surface, not
    a blank page; data pipe lands when the cartridge-parameterized
    Living Canon refactor + Qriptopian Pulse publish wiring ships)
  - PCS Ladder (existing stub, now fourth)

Admin group (6 sub-tabs, reordered):
  - Magazine and Codex Admin first (was fifth) — existing
    QriptopianAdminTab; anchors the admin surface as the most-used
    content management view
  - Pulse Admin (with moderation duties — see backlog)
  - Premium Admin, Partners Admin, Polity Admin, Edit (unchanged)

Net-new files:
  app/triad/components/codex/tabs/QriptoCommunityCorrespondentTab.tsx
    - 130-line component: three-pill nav (Canon / Community /
      Correspondent), branch metadata, switchable content panel.
      No live data pipe yet — branch panel shows blurb + "wiring in
      progress" note so the surface is recognizably the right one,
      not a placeholder.
  codexes/packs/agentiq/updates/2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md
    - Scopes the three deferred substantial pieces:
        1. myCanvas → Pulse publish for note entries + cartridge
           separation at publish point (KNYT vs Qripto remixes route
           to their own Pulse only)
        2. Cartridge-parameterized Living Canon template refactor
           (KnytLivingCanonTemplate → accept cartridge prop; the
           single ~50-line diff that unblocks real Qriptopian
           Community Correspondent data)
        3. Pulse Admin moderation actions (delete / reject Pulse
           submissions, list view, bulk actions, admin gating)
      Includes recommended sequencing and prereqs.

Sister-agent integration: this PR only touches QRIPTO_CODEX tabs +
adds two files; no overlap with the persona asset graph / access
requests / admin grants work that landed on dev in parallel.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Implements the v3.1 operator refinements on top of yesterday's v3
restructure. Pure config changes plus one new tab component.

Store group (now 3 sub-tabs, no nesting):
  - Premium Content (unchanged)
  - KNYT (NEW, promoted to its own sub-tab — renders KnytStoreBundlesTab
    directly, no host wrapper)
  - Affiliates & Partners (now a stub for future partners; KNYT lives
    outside)

Qriptopia group (4 sub-tabs, reordered):
  - Features (NEW first slot — reuses FeaturesTab so the Qriptopia
    group travels cleanly when mirrored into metaMe)
  - Qriptopian Pulse (existing stub, now second)
  - Community Correspondent (NEW — renamed from "Community"; renders
    a new QriptoCommunityCorrespondentTab component that shows the
    three-pill structure Canon · Community · Correspondent with branch
    blurbs and a "wiring in progress" note per pill. Real surface, not
    a blank page; data pipe lands when the cartridge-parameterized
    Living Canon refactor + Qriptopian Pulse publish wiring ships)
  - PCS Ladder (existing stub, now fourth)

Admin group (6 sub-tabs, reordered):
  - Magazine and Codex Admin first (was fifth) — existing
    QriptopianAdminTab; anchors the admin surface as the most-used
    content management view
  - Pulse Admin (with moderation duties — see backlog)
  - Premium Admin, Partners Admin, Polity Admin, Edit (unchanged)

Net-new files:
  app/triad/components/codex/tabs/QriptoCommunityCorrespondentTab.tsx
    - 130-line component: three-pill nav (Canon / Community /
      Correspondent), branch metadata, switchable content panel.
      No live data pipe yet — branch panel shows blurb + "wiring in
      progress" note so the surface is recognizably the right one,
      not a placeholder.
  codexes/packs/agentiq/updates/2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md
    - Scopes the three deferred substantial pieces:
        1. myCanvas → Pulse publish for note entries + cartridge
           separation at publish point (KNYT vs Qripto remixes route
           to their own Pulse only)
        2. Cartridge-parameterized Living Canon template refactor
           (KnytLivingCanonTemplate → accept cartridge prop; the
           single ~50-line diff that unblocks real Qriptopian
           Community Correspondent data)
        3. Pulse Admin moderation actions (delete / reject Pulse
           submissions, list view, bulk actions, admin gating)
      Includes recommended sequencing and prereqs.

Sister-agent integration: this PR only touches QRIPTO_CODEX tabs +
adds two files; no overlap with the persona asset graph / access
requests / admin grants work that landed on dev in parallel.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/QriptoCommunityCorrespondentTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md` |
| Modified | `data/codex-configs.ts` |

## Stats

 6 files changed, 414 insertions(+), 46 deletions(-)
