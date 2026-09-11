# Commit Brief: `41c69e5` — myCanvas → Pulse publish + cartridge split end-to-end

| Field | Value |
|-------|-------|
| SHA | [`41c69e5`](https://github.com/iQube-Protocol/AigentZBeta/commit/41c69e5e2541419c0984af0d68a7ae27a9b652ab) |
| Author | Claude |
| Date | 2026-05-26T20:49:13Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
myCanvas → Pulse publish + cartridge split end-to-end

Implements item 1 from codexes/packs/agentiq/updates/
2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md per the
operator's "Proceed" decision: notes ride community_generated_content
with stubbed image/Q¢ so they can graduate into rich-media creations
via Studio exQubes.

  supabase/migrations/20260526030000_pulse_cartridge_split.sql (new)
    - cartridge column on community_generated_content
      ('knyt' | 'qripto', DEFAULT 'knyt' for back-compat)
    - skill CHECK widened to accept 'note' alongside 'article'/'story'
    - qripto_publication_states + qripto_publication_state_log tables
      mirroring the knyt_publication_states pair (shared
      knyt_canon_branch + knyt_publication_state enums so both
      cartridges share the Canon / Community / Correspondent
      vocabulary)
    - RLS + indexes + updated_at trigger

  app/api/community-content/generate/route.ts
    - Accept body.cartridge ('knyt' | 'qripto', default 'knyt')
    - Stamp it on every new community_generated_content row

  app/api/community-content/[id]/publish/route.ts
    - Read row.cartridge and route the publication-state record to
      knyt_publication_states OR qripto_publication_states accordingly
    - Include cartridge in the response so callers can echo it back

  app/api/mycanvas/entries/[id]/publish-to-pulse/route.ts (new)
    - End-to-end publish for note entries: validates owner, materialises
      a community_generated_content row (skill='note', qc_cost=0,
      image_url=null, status='draft', cartridge=body.cartridge), flips
      to 'shared', mirrors into the matching publication_states table,
      and stamps the originating myCanvas entry's metaJson with
      contentId + cartridge + publishedAt so the existing republish
      path becomes idempotent.
    - Refuses entryType != 'note' (experience_derived already has
      /api/community-content/[id]/publish via metaJson.contentId).

  services/mycanvas/canvasService.ts
    - updateEntry patch now accepts metaJson so the publish-to-pulse
      route can write the contentId stamp through the canonical
      service.

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - New Publish button on note entries in the editor header. Opens
      a cartridge picker (KNYT Pulse / Qriptopian Pulse). Disabled
      while publishing. Re-styled emerald when already published
      (idempotent re-publish supported).
    - On success, the entry's metaJson is patched in local state so
      the badge updates without a refetch.

End-to-end test path:
  1. Create a 'note' entry in myCanvas
  2. Click Publish → pick "KNYT Pulse" or "Qriptopian Pulse"
  3. Row lands in community_generated_content with skill='note',
     cartridge stamped, status='shared'
  4. Matching {cartridge}_publication_states row written so the
     Living Canon surfaces (KnytLivingCanonTemplate today, qripto
     mirror once cartridge-parameterized refactor lands) accept it
     as a valid publication

Unblocks backlog items 2 (cartridge-parameterised Living Canon) and
3 (Pulse Admin moderation) — both depend on the cartridge column +
qripto_publication_states landing here.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Implements item 1 from codexes/packs/agentiq/updates/
2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md per the
operator's "Proceed" decision: notes ride community_generated_content
with stubbed image/Q¢ so they can graduate into rich-media creations
via Studio exQubes.

  supabase/migrations/20260526030000_pulse_cartridge_split.sql (new)
    - cartridge column on community_generated_content
      ('knyt' | 'qripto', DEFAULT 'knyt' for back-compat)
    - skill CHECK widened to accept 'note' alongside 'article'/'story'
    - qripto_publication_states + qripto_publication_state_log tables
      mirroring the knyt_publication_states pair (shared
      knyt_canon_branch + knyt_publication_state enums so both
      cartridges share the Canon / Community / Correspondent
      vocabulary)
    - RLS + indexes + updated_at trigger

  app/api/community-content/generate/route.ts
    - Accept body.cartridge ('knyt' | 'qripto', default 'knyt')
    - Stamp it on every new community_generated_content row

  app/api/community-content/[id]/publish/route.ts
    - Read row.cartridge and route the publication-state record to
      knyt_publication_states OR qripto_publication_states accordingly
    - Include cartridge in the response so callers can echo it back

  app/api/mycanvas/entries/[id]/publish-to-pulse/route.ts (new)
    - End-to-end publish for note entries: validates owner, materialises
      a community_generated_content row (skill='note', qc_cost=0,
      image_url=null, status='draft', cartridge=body.cartridge), flips
      to 'shared', mirrors into the matching publication_states table,
      and stamps the originating myCanvas entry's metaJson with
      contentId + cartridge + publishedAt so the existing republish
      path becomes idempotent.
    - Refuses entryType != 'note' (experience_derived already has
      /api/community-content/[id]/publish via metaJson.contentId).

  services/mycanvas/canvasService.ts
    - updateEntry patch now accepts metaJson so the publish-to-pulse
      route can write the contentId stamp through the canonical
      service.

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - New Publish button on note entries in the editor header. Opens
      a cartridge picker (KNYT Pulse / Qriptopian Pulse). Disabled
      while publishing. Re-styled emerald when already published
      (idempotent re-publish supported).
    - On success, the entry's metaJson is patched in local state so
      the badge updates without a refetch.

End-to-end test path:
  1. Create a 'note' entry in myCanvas
  2. Click Publish → pick "KNYT Pulse" or "Qriptopian Pulse"
  3. Row lands in community_generated_content with skill='note',
     cartridge stamped, status='shared'
  4. Matching {cartridge}_publication_states row written so the
     Living Canon surfaces (KnytLivingCanonTemplate today, qripto
     mirror once cartridge-parameterized refactor lands) accept it
     as a valid publication

Unblocks backlog items 2 (cartridge-parameterised Living Canon) and
3 (Pulse Admin moderation) — both depend on the cartridge column +
qripto_publication_states landing here.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/community-content/[id]/publish/route.ts` |
| Modified | `app/api/community-content/generate/route.ts` |
| Added | `app/api/mycanvas/entries/[id]/publish-to-pulse/route.ts` |
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |
| Modified | `services/mycanvas/canvasService.ts` |
| Added | `supabase/migrations/20260526030000_pulse_cartridge_split.sql` |

## Stats

 7 files changed, 461 insertions(+), 13 deletions(-)
