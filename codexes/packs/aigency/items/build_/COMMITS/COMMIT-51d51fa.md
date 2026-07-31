# Commit Brief: `51d51fa` — Qriptopian Cartridge v3 restructure + KNYT Pulse rename

| Field | Value |
|-------|-------|
| SHA | [`51d51fa`](https://github.com/iQube-Protocol/AigentZBeta/commit/51d51fae303507f02a72d2fd6eb7e0679f7decbe) |
| Author | Claude |
| Date | 2026-05-26T17:53:08Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Qriptopian Cartridge v3 restructure + KNYT Pulse rename

Implements the v3 brief locked with the operator. Qriptopian goes
from a flat 9-tab cartridge to 5 first-class menu items, each grouping
related surfaces under tabGroups.

  data/codex-configs.ts — QRIPTO_CODEX bumped to 2.0.0:
    1. Codex          — Magazines (existing 'codex' tab relabelled +
                        keeps the issue-number toggle, now scoped to
                        canonical magazine editions instead of acting
                        as a global cartridge filter), Papers (stub),
                        Polity (stub).
    2. Live Magazine  — Features, PennyDrops, Scrolls, Kn0wdZ re-homed.
    3. Store          — Premium Content (stub), Affiliates & Partners
                        (renders KnytStoreBundlesTab directly via the
                        new QriptoAffiliatesPartnersTab host; future
                        partners stack alongside at the same tier).
    4. Qriptopia      — Community (21 Sats cluster mirror, stub),
                        Qriptopian Pulse (publishing surface mirror of
                        KNYT Pulse, stub), PCS Ladder (clone of
                        OrderTab pattern, stub).
    5. Admin          — first-class, admin-gated. Five tabs: Pulse
                        Admin, Premium Admin, Partners Admin, Polity
                        Admin (rewards + PCS status ascension), and
                        Magazine and Codex Admin (retains the existing
                        QriptopianAdminTab content management). Edit
                        (QriptopianEditTab) re-homed alongside.

  app/triad/components/codex/tabs/QriptoAffiliatesPartnersTab.tsx
    — new thin host that renders KnytStoreBundlesTab as the first
      partner section; future partners drop in as additional <section>
      blocks at the same tier per the agreed brief.

  app/triad/components/codex/TabRenderer.tsx
    — register QriptoAffiliatesPartnersTab.

  data/codex-configs.ts — KNYT Pulse rename:
    The 'community-content' tab in KNYT_CODEX (Order group) gets
    relabelled "Community" → "KNYT Pulse". slug also moves to 'pulse'.
    id stays 'community-content' for permalink stability. Component
    (KnytCommunityContentTab) unchanged.

  codexes/packs/agentiq/updates/2026-05-26_knyt-pulse-21sats-handoff-backlog.md
    — captures the deferred KNYT Pulse ↔ 21 Sats voting handoff
      nuance flagged by the operator: general content vs 21-Sats-
      specific content separation, proposed post_kind discriminator
      shape, prereqs, open questions for scoping. Registered in
      agentiq/collections.json col_updates.

What's stubbed today vs net-new:
  Stub via PlaceholderTab + props (no new component files): Papers,
  Polity, Premium Content, Community (21 Sats mirror), Qriptopian
  Pulse, PCS Ladder, Pulse Admin, Premium Admin, Partners Admin,
  Polity Admin. All navigable, render a "Coming soon" panel with the
  agreed description so the cartridge is fully usable today.
  Real component (one file): QriptoAffiliatesPartnersTab.
  Reused existing: KnytStoreBundlesTab, KnytCommunityContentTab,
  FeaturesTab, PennyDropsTab, QriptoScrollsTab, Kn0wdZTab,
  QriptopianEditTab, QriptopianAdminTab.

Removed: the old 'rewards' (placeholder) and 'qriptopia' (vision)
tabs — replaced by the new Qriptopia group's three sub-tabs.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Implements the v3 brief locked with the operator. Qriptopian goes
from a flat 9-tab cartridge to 5 first-class menu items, each grouping
related surfaces under tabGroups.

  data/codex-configs.ts — QRIPTO_CODEX bumped to 2.0.0:
    1. Codex          — Magazines (existing 'codex' tab relabelled +
                        keeps the issue-number toggle, now scoped to
                        canonical magazine editions instead of acting
                        as a global cartridge filter), Papers (stub),
                        Polity (stub).
    2. Live Magazine  — Features, PennyDrops, Scrolls, Kn0wdZ re-homed.
    3. Store          — Premium Content (stub), Affiliates & Partners
                        (renders KnytStoreBundlesTab directly via the
                        new QriptoAffiliatesPartnersTab host; future
                        partners stack alongside at the same tier).
    4. Qriptopia      — Community (21 Sats cluster mirror, stub),
                        Qriptopian Pulse (publishing surface mirror of
                        KNYT Pulse, stub), PCS Ladder (clone of
                        OrderTab pattern, stub).
    5. Admin          — first-class, admin-gated. Five tabs: Pulse
                        Admin, Premium Admin, Partners Admin, Polity
                        Admin (rewards + PCS status ascension), and
                        Magazine and Codex Admin (retains the existing
                        QriptopianAdminTab content management). Edit
                        (QriptopianEditTab) re-homed alongside.

  app/triad/components/codex/tabs/QriptoAffiliatesPartnersTab.tsx
    — new thin host that renders KnytStoreBundlesTab as the first
      partner section; future partners drop in as additional <section>
      blocks at the same tier per the agreed brief.

  app/triad/components/codex/TabRenderer.tsx
    — register QriptoAffiliatesPartnersTab.

  data/codex-configs.ts — KNYT Pulse rename:
    The 'community-content' tab in KNYT_CODEX (Order group) gets
    relabelled "Community" → "KNYT Pulse". slug also moves to 'pulse'.
    id stays 'community-content' for permalink stability. Component
    (KnytCommunityContentTab) unchanged.

  codexes/packs/agentiq/updates/2026-05-26_knyt-pulse-21sats-handoff-backlog.md
    — captures the deferred KNYT Pulse ↔ 21 Sats voting handoff
      nuance flagged by the operator: general content vs 21-Sats-
      specific content separation, proposed post_kind discriminator
      shape, prereqs, open questions for scoping. Registered in
      agentiq/collections.json col_updates.

What's stubbed today vs net-new:
  Stub via PlaceholderTab + props (no new component files): Papers,
  Polity, Premium Content, Community (21 Sats mirror), Qriptopian
  Pulse, PCS Ladder, Pulse Admin, Premium Admin, Partners Admin,
  Polity Admin. All navigable, render a "Coming soon" panel with the
  agreed description so the cartridge is fully usable today.
  Real component (one file): QriptoAffiliatesPartnersTab.
  Reused existing: KnytStoreBundlesTab, KnytCommunityContentTab,
  FeaturesTab, PennyDropsTab, QriptoScrollsTab, Kn0wdZTab,
  QriptopianEditTab, QriptopianAdminTab.

Removed: the old 'rewards' (placeholder) and 'qriptopia' (vision)
tabs — replaced by the new Qriptopia group's three sub-tabs.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/QriptoAffiliatesPartnersTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-26_knyt-pulse-21sats-handoff-backlog.md` |
| Modified | `data/codex-configs.ts` |

## Stats

 6 files changed, 436 insertions(+), 47 deletions(-)
