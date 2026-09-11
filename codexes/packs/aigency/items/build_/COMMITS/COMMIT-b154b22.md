# Commit Brief: `b154b22` — Correct v0.3 ruling identifier and companion-corpus status claims

| Field | Value |
|-------|-------|
| SHA | [`b154b22`](https://github.com/iQube-Protocol/AigentZBeta/commit/b154b22e2fb12948b00ba50bb9f25e9201aa1061) |
| Author | Claude |
| Date | 2026-08-05T00:48:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Correct v0.3 ruling identifier and companion-corpus status claims

- Renumber the quantum/substrate ruling from CR-14 to CR-17 across
  00-editorial-register.md, BOOK_DOCTRINE_LINEAGE.md, the v0.3 manuscript
  front matter/notes, and the companion doc. Verified CR-15/16/17 were
  unused anywhere in the repo before choosing 17, and confirmed zero
  remaining CR-14 references in the constitutional-internet project.

- Correct the companion doc's commentary framing: Experience Sovereignty,
  COYN Thesis, and The Polity are canonical constitutional commentary
  (citable, registered), consistent with items/commentary/README.md's own
  rule that only The Constitution of the Agentic Polity carries individually
  ratified status among Polity Papers. Separately, verified directly against
  2026-07-17_polity-experience-sovereignty-canonization.md that the derived
  invariants inv.polity.207-234 are recorded at status: proposed, not
  ratified -- stated precisely rather than asserting ratification.

- Correct the companion doc's claim about The Genie in the Lamp and The
  Constitutional Internet for Agents. An exhaustive search of every branch
  in this repository for CI-AGENT-EDITION, BL-17, Genie in the Lamp, Action
  Boundary, and Paper VI returned no matches. The companion now states this
  as a factual-location gap -- these may exist outside this repository or
  in an uncommitted session -- rather than asserting deposit that cannot be
  verified, and rather than the prior overcorrection of asserting they do
  not exist at all.

- Added an explicit deletion-scope confirmation for v0.2 lines 4967-5960,
  based on the line-for-line comparison already performed when v0.3 was
  built: the deleted block is interleaved dialogue plus a word-for-word
  duplicate draft of the retained integrated Epilogue. No unique intended
  narrative passage was lost.

Re-validated after the identifier change: 24 chapters, one Epilogue, zero
residual CR-14 or dialogue markers, collections.json parses.
```

## Body

- Renumber the quantum/substrate ruling from CR-14 to CR-17 across
  00-editorial-register.md, BOOK_DOCTRINE_LINEAGE.md, the v0.3 manuscript
  front matter/notes, and the companion doc. Verified CR-15/16/17 were
  unused anywhere in the repo before choosing 17, and confirmed zero
  remaining CR-14 references in the constitutional-internet project.

- Correct the companion doc's commentary framing: Experience Sovereignty,
  COYN Thesis, and The Polity are canonical constitutional commentary
  (citable, registered), consistent with items/commentary/README.md's own
  rule that only The Constitution of the Agentic Polity carries individually
  ratified status among Polity Papers. Separately, verified directly against
  2026-07-17_polity-experience-sovereignty-canonization.md that the derived
  invariants inv.polity.207-234 are recorded at status: proposed, not
  ratified -- stated precisely rather than asserting ratification.

- Correct the companion doc's claim about The Genie in the Lamp and The
  Constitutional Internet for Agents. An exhaustive search of every branch
  in this repository for CI-AGENT-EDITION, BL-17, Genie in the Lamp, Action
  Boundary, and Paper VI returned no matches. The companion now states this
  as a factual-location gap -- these may exist outside this repository or
  in an uncommitted session -- rather than asserting deposit that cannot be
  verified, and rather than the prior overcorrection of asserting they do
  not exist at all.

- Added an explicit deletion-scope confirmation for v0.2 lines 4967-5960,
  based on the line-for-line comparison already performed when v0.3 was
  built: the deleted block is interleaved dialogue plus a word-for-word
  duplicate draft of the retained integrated Epilogue. No unique intended
  narrative passage was lost.

Re-validated after the identifier change: 24 chapters, one Epilogue, zero
residual CR-14 or dialogue markers, collections.json parses.

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/polity-core/items/commentary/constitutional-internet/00-editorial-register.md` |
| Modified | `codexes/packs/polity-core/items/commentary/constitutional-internet/01-controlling-manuscript-v0.3-companion.md` |
| Modified | `codexes/packs/polity-core/items/commentary/constitutional-internet/01-controlling-manuscript-v0.3.md` |
| Modified | `codexes/packs/polity-core/items/commentary/constitutional-internet/BOOK_DOCTRINE_LINEAGE.md` |

## Stats

 4 files changed, 52 insertions(+), 26 deletions(-)
