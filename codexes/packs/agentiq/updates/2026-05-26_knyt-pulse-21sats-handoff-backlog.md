# KNYT Pulse ↔ 21 Sats Voting Handoff — backlog

**Status:** Reserved · do NOT implement until prioritised
**Companion ship:** Qriptopian Cartridge v3 restructure (2026-05-26) renamed KNYT Order › Community → "KNYT Pulse" and mirrored the same publishing-surface pattern into Qriptopia › Qriptopian Pulse. Both renames are live. **What's NOT live: the explicit voting handoff with separation between general content and 21 Sats-specific content.**

---

## What's already in place

After the v3 restructure:

- **KNYT cartridge**
  - 21 Sats cluster lives at top-level `living-canon` tab (label "21 Sats", liquid-ui template `knyt:living_canon_v1`, dataSource `/api/codex/knyt/living-canon`)
  - Publishing surface lives at `community-content` tab in the Order group (label "**KNYT Pulse**", component `KnytCommunityContentTab`)
- **Qriptopian cartridge**
  - Community sub-tab in Qriptopia group (stub today, will mirror the 21 Sats cluster pattern but qripto-scoped)
  - Pulse sub-tab in Qriptopia group (stub today, will mirror `KnytCommunityContentTab` but publish to Qriptopian)

The two-surface pattern (community/voting cluster + publishing surface) is now symmetric across KNYT and Qriptopian.

---

## What the handoff needs to do

When a contributor publishes a remix / edit / admin-customised piece into KNYT Pulse, the 21 Sats voting cluster must be able to act on it — sparking, voting, curating, promoting to canon. Today the two tabs are wired to separate `/api/codex/knyt/living-canon/*` action endpoints (`like`, `spark`, `curate`, `vote`, `remix`, `contribute`) but there is no explicit "this Pulse post is up for vote in 21 Sats" pipe.

### The nuance flagged by the operator

> "In KNYTs we do still need a separation between general content and 21 Sats specific content but the concept is people remix/edit or create content which the community votes on, remixes is sparked etc where correspondents are the more senior stewards of the content."

So:

- **Some KNYT Pulse content is general** — remixes, episode discussion, fan posts — and should NOT automatically enter the 21 Sats voting pipeline. It lives, gets liked / replied to, and stays in the general feed.
- **Some KNYT Pulse content is 21-Sats-specific** — canonical proposals, sparked variants, correspondent-curated picks — and should be voted on, curated, and (when promoted) absorbed into the canon branch.
- **The author / promoter declares which path a piece is on** when publishing, OR the system infers it from a tag / schema.

Qriptopian Pulse will likely have the same separation (general posts vs polity-track posts), so the design needs to be cartridge-agnostic.

---

## Proposed shape (for scoping when the ticket opens)

1. **`post_kind` field on Pulse rows.** Discriminator that decides whether the post enters the voting pipeline. Values: `general`, `canon-candidate`, `sparked`, `correspondent-curated`. Authors declare at publish; admins can re-tag.

2. **`/api/codex/knyt/living-canon/from-pulse/:postId` route.** Voting cluster fetches Pulse posts where `post_kind !== 'general'` and treats them as first-class voting items. Receives `vote` / `spark` / `curate` / `contribute` actions via the existing endpoints.

3. **Promotion path.** When a Pulse post crosses the vote threshold (configurable), correspondents can promote it into the `canon` branch. A receipt fires (`receipt_kind='living_canon_promotion'`, T2-aliased per spine rules).

4. **UI surface in KNYT Pulse:** post composer carries the kind selector; voted-up posts get a 21 Sats badge inline.

5. **UI surface in 21 Sats cluster:** Community sub-tab paginates `from-pulse` posts alongside direct 21 Sats submissions, distinguishable by source.

6. **Same shape for Qriptopian.** The cartridge-agnostic split means the qripto-side `living-canon` endpoints (when wired) reuse the same `from-pulse` pattern with `cartridge: 'qripto'`.

---

## Prereqs before opening the ticket

1. **Qriptopian Cartridge v3 restructure ships and stabilises.** Renames must be in production for ≥ 1 week with no regression reports against KNYT Pulse navigation.
2. **Decide the discriminator field name.** `post_kind` is a placeholder — could be `voting_track`, `pipeline`, `branch`, etc. The 21 Sats `LivingCanonBranchConfig` already uses "branch" terminology (`canon` / `community` / `correspondent`) so picking a non-colliding name matters.
3. **Decide whether the kind selector lives in the Pulse composer or in a separate "submit to 21 Sats" action**. The first is simpler; the second matches the existing `LivingCanonBranchConfig` separation.
4. **Receipt taxonomy review.** Adding `living_canon_promotion` to the receipt spine needs the same T0/T1/T2 audit every receipt-bearing action goes through.

---

## Open questions for the scoping pass

- Does the qripto-side Community + Pulse pair need to ship its own `/api/codex/qripto/living-canon/*` endpoints from day one, or can it ride on a shared cartridge-keyed handler?
- Where do we put the `post_kind` UI in the existing `KnytCommunityContentTab` without redesigning it?
- Does promotion to canon trigger a new `content_qubes` row, or does it stay inside the living-canon table with a `canonical: true` flag?
- Q¢ implications: does a Pulse contributor get rewarded when their post gets promoted? At what tier?

---

## Status board

| Item | Status | Blocked on |
|---|---|---|
| KNYT Community → KNYT Pulse rename | ✅ Shipped 2026-05-26 | — |
| Qriptopian Pulse stub | ✅ Shipped 2026-05-26 (placeholder content) | — |
| `post_kind` discriminator on Pulse rows | ⏸ Backlog | This ticket opens |
| `from-pulse` voting route | ⏸ Backlog | Discriminator decision |
| Promotion + receipt path | ⏸ Backlog | Route lands |
| Qriptopian-side mirror | ⏸ Backlog | KNYT-side proven |

When opening this ticket, link this document and mark it **"Re-validate prereqs before scoping"** — the Pulse surfaces will have accumulated real traffic by then and the discriminator question may have answered itself.
