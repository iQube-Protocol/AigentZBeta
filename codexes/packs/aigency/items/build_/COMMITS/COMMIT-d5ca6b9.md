# Commit Brief: `d5ca6b9` — knyt characters: align 0-indexed convention end-to-end + score-based character matching

| Field | Value |
|-------|-------|
| SHA | [`d5ca6b9`](https://github.com/iQube-Protocol/AigentZBeta/commit/d5ca6b9bfead1c6656a83ee1f589786faadee208) |
| Author | Claude |
| Date | 2026-05-19T01:30:21Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
knyt characters: align 0-indexed convention end-to-end + score-based character matching

Two coordinated fixes for the codex Characters tab + store KNYT Cards tab.

(1) Convention: characters in codex_media_assets are 0-indexed, not 1.

  Probed live data 2026-05-18: codex_media_assets.character_poster +
  powers_sheet rows live at episode_number = 0..12 (DB ep 0 =
  Deji Ifada/Kn0w1; DB ep 12 = final Kn0w1). The historical comment in
  /api/codex/owned/route.ts that said "characters are 1-indexed (DB ep
  1..13)" was stale. Every consumer that subtracted 1 was dropping the
  first character (Deji) and leaving a blank at the end:
    - /api/knyt/thumbnails (store KNYT Cards grid)
    - /api/codex/owned (character ownership lookup uploadedByDbEp.get(ep+1))
    - /api/codex/knyt-cards (displayNumber synthesis)
    - /api/admin/codex/canonical (admin reference + indexing range)
    - KnytTab.derivedCharacterGroups (codex characters tab displayNumber)
  All five now treat episode_number as the display number directly.

(2) Character row picker: score-based combined-title match.

  codex_characters has multiple rows sharing terra_name (e.g. two
  "Deji Ifada" rows whose digiterras are "The Courier" vs "Kn0w1" —
  representing different narrative phases). The old fuzzy-substring
  matcher broke on the first terra hit and inherited the wrong digiterra.
  Replacement matcher: combines all asset titles for a given
  episode_number (front + back), scores each character row by whether
  terra (+1) and digiterra (+2) are present in the combined text, picks
  the highest score; ties resolved by longest digiterra match. Behaviour
  by example:
    - Ep 0 ("Deji (Deji Ifada) front" + "Deji Kn0w1 back"):
       deji_ifada_2 (digi "Kn0w1") wins score 3 vs deji_ifada
       (digi "The Courier") score 1. ✓ Label = Kn0w1.
    - Ep 6 ("Kn0w1 (The Courier) front" + "Deji Courier back"):
       both deji_ifada and deji_ifada_2 tie at score 2; "the courier"
       (11 chars) beats "kn0w1" (5) on length. ✓ Label = The Courier.
    - Ep 12 ("Kn0w1 front" + "Kn0w1 back"):
       only deji_ifada_2 matches (terra not in title, digi yes).
       ✓ Label = Kn0w1.

Result: Codex characters tab labels the first card as Deji Ifada/Kn0w1
correctly; ownership badge resolves through /api/codex/owned which now
finds the ep 0 character row. Store KNYT Cards grid renders all 13
characters (Deji at slot #0, Kn0w1 at slot #12) with no missing slot.
```

## Body

Two coordinated fixes for the codex Characters tab + store KNYT Cards tab.

(1) Convention: characters in codex_media_assets are 0-indexed, not 1.

  Probed live data 2026-05-18: codex_media_assets.character_poster +
  powers_sheet rows live at episode_number = 0..12 (DB ep 0 =
  Deji Ifada/Kn0w1; DB ep 12 = final Kn0w1). The historical comment in
  /api/codex/owned/route.ts that said "characters are 1-indexed (DB ep
  1..13)" was stale. Every consumer that subtracted 1 was dropping the
  first character (Deji) and leaving a blank at the end:
    - /api/knyt/thumbnails (store KNYT Cards grid)
    - /api/codex/owned (character ownership lookup uploadedByDbEp.get(ep+1))
    - /api/codex/knyt-cards (displayNumber synthesis)
    - /api/admin/codex/canonical (admin reference + indexing range)
    - KnytTab.derivedCharacterGroups (codex characters tab displayNumber)
  All five now treat episode_number as the display number directly.

(2) Character row picker: score-based combined-title match.

  codex_characters has multiple rows sharing terra_name (e.g. two
  "Deji Ifada" rows whose digiterras are "The Courier" vs "Kn0w1" —
  representing different narrative phases). The old fuzzy-substring
  matcher broke on the first terra hit and inherited the wrong digiterra.
  Replacement matcher: combines all asset titles for a given
  episode_number (front + back), scores each character row by whether
  terra (+1) and digiterra (+2) are present in the combined text, picks
  the highest score; ties resolved by longest digiterra match. Behaviour
  by example:
    - Ep 0 ("Deji (Deji Ifada) front" + "Deji Kn0w1 back"):
       deji_ifada_2 (digi "Kn0w1") wins score 3 vs deji_ifada
       (digi "The Courier") score 1. ✓ Label = Kn0w1.
    - Ep 6 ("Kn0w1 (The Courier) front" + "Deji Courier back"):
       both deji_ifada and deji_ifada_2 tie at score 2; "the courier"
       (11 chars) beats "kn0w1" (5) on length. ✓ Label = The Courier.
    - Ep 12 ("Kn0w1 front" + "Kn0w1 back"):
       only deji_ifada_2 matches (terra not in title, digi yes).
       ✓ Label = Kn0w1.

Result: Codex characters tab labels the first card as Deji Ifada/Kn0w1
correctly; ownership badge resolves through /api/codex/owned which now
finds the ep 0 character row. Store KNYT Cards grid renders all 13
characters (Deji at slot #0, Kn0w1 at slot #12) with no missing slot.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/admin/codex/canonical/route.ts` |
| Modified | `app/api/codex/knyt-cards/route.ts` |
| Modified | `app/api/codex/owned/route.ts` |
| Modified | `app/api/knyt/thumbnails/route.ts` |
| Modified | `app/triad/components/codex/tabs/KnytTab.tsx` |

## Stats

 6 files changed, 70 insertions(+), 39 deletions(-)
