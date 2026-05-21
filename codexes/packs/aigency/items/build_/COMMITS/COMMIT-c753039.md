# Commit Brief: `c753039` — knyt: gate GN + Ep #0 like every other episode; document PDF render pipeline

| Field | Value |
|-------|-------|
| SHA | [`c753039`](https://github.com/iQube-Protocol/AigentZBeta/commit/c753039de38ce5113b3a76764de26de1c5bdd780) |
| Author | Claude |
| Date | 2026-05-18T23:35:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
knyt: gate GN + Ep #0 like every other episode; document PDF render pipeline

Two changes in one commit:

(1) Payment-gate fix for GN (ep -1) and Episode #0 (ep 0):

  Removed two leftover free-content bypasses in KnytTab that were
  letting non-owners (and unsigned visitors) open the GN and Ep #0
  PDF viewers without triggering the payment modal:

    - isEpisodeLocked: the `episodeNumber <= 0 && pdf_lite_url`
      early-return treated BOTH ep -1 (GN) and ep 0 (Episode #0,
      "Gen Zero Divided by One") as free. Under the canonical
      convention ep 0 is a real paid episode, and the GN itself is
      now a paid ContentQube (Agentic Graphic Novel Qripto bundle).
      Removed; ownership path now applies uniformly.

    - Scrolls grid `isGnFree` flag: same story for the per-card
      cardAccess.evaluate gating override. Removed; manualOwned is
      now the sole signal.

  Result: GN and Ep #0 now route through the payment gate exactly
  like Ep #1..#12 for non-owners and not-signed-in visitors.

(2) Progress report:

  Added 2026-05-18_pdf-contentqube-large-file-render-pipeline.md
  to codexes/packs/agentiq/updates/ documenting the full
  investigation + the Node-based compress-pdf pipeline that
  unblocked the 395 MB GN render. Captures (a) what didn't work,
  (b) the working pattern, (c) forward-looking implications for
  every PDF ContentQube that ships at scale. Registered in
  collections.json under col_updates.
```

## Body

Two changes in one commit:

(1) Payment-gate fix for GN (ep -1) and Episode #0 (ep 0):

  Removed two leftover free-content bypasses in KnytTab that were
  letting non-owners (and unsigned visitors) open the GN and Ep #0
  PDF viewers without triggering the payment modal:

    - isEpisodeLocked: the `episodeNumber <= 0 && pdf_lite_url`
      early-return treated BOTH ep -1 (GN) and ep 0 (Episode #0,
      "Gen Zero Divided by One") as free. Under the canonical
      convention ep 0 is a real paid episode, and the GN itself is
      now a paid ContentQube (Agentic Graphic Novel Qripto bundle).
      Removed; ownership path now applies uniformly.

    - Scrolls grid `isGnFree` flag: same story for the per-card
      cardAccess.evaluate gating override. Removed; manualOwned is
      now the sole signal.

  Result: GN and Ep #0 now route through the payment gate exactly
  like Ep #1..#12 for non-owners and not-signed-in visitors.

(2) Progress report:

  Added 2026-05-18_pdf-contentqube-large-file-render-pipeline.md
  to codexes/packs/agentiq/updates/ documenting the full
  investigation + the Node-based compress-pdf pipeline that
  unblocked the 395 MB GN render. Captures (a) what didn't work,
  (b) the working pattern, (c) forward-looking implications for
  every PDF ContentQube that ships at scale. Registered in
  collections.json under col_updates.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/KnytTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-18_pdf-contentqube-large-file-render-pipeline.md` |

## Stats

 4 files changed, 198 insertions(+), 13 deletions(-)
