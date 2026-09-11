# Commit Brief: `7dd0dd2` — fix admin-tab visibility: CRM tenant↔cartridge slug alias + 3 more mirrors

| Field | Value |
|-------|-------|
| SHA | [`7dd0dd2`](https://github.com/iQube-Protocol/AigentZBeta/commit/7dd0dd25d255305b4fdf91669cc202577476edf2) |
| Author | Claude |
| Date | 2026-05-26T04:19:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix admin-tab visibility: CRM tenant↔cartridge slug alias + 3 more mirrors

Two-part fix for the missing admin tab in metaMe activation surfaces.

Part 1 — the slug-mismatch root cause
-------------------------------------
The grants resolver was returning the raw `crm_tenants.slug` value
back to the UI. The UI gate (`CodexTab.adminOfCartridge`) checks
against the cartridge slug used in `data/codex-configs.ts`. These two
namespaces aren't identical: CRM has 'knyt' but the cartridge is
'knyt-codex'; CRM has 'qriptopian' but the cartridge is 'qripto'.
The mirror declarations used cartridge slugs, so a KNYT-admin
persona's grants response contained 'knyt' and never matched
'knyt-codex' — the gate stayed closed.

Adds TENANT_SLUG_TO_CARTRIDGE_SLUG inside the resolver:
  knyt        → knyt-codex
  qriptopian  → qripto
  (agentiq-os, venture-lab, metame, marketa direct-pass for clarity)

Tenants without an alias entry pass through as-is, so a future tenant
whose slug happens to equal its cartridge slug Just Works.

Backlog (already tracked) will replace this static map with a join
table when multi-tenant cartridges arrive — single hook point at the
top of services/access/cartridgeAdminGrants.ts.

Canary additions
----------------
tests/cartridge-admin-grants.test.ts grows three more cases:
  - CRM 'knyt' → cartridge 'knyt-codex'
  - CRM 'qriptopian' → cartridge 'qripto'
  - unknown tenant slug passes through unchanged
Now at 10/10 passing.

Part 2 — additional mirrors in METAME_CODEX
-------------------------------------------
The prior commit only wired KNYT Admin into the Order of Metayé
group. Three more groups in metaMe needed parallel mirrors so the
chief-of-staff unlock covers every cartridge that has admin content:

- agentiqos group → adds "AgentiQ OS Admin" tab with
  agentiqOsAdminTabsForMetameAgentiqos() subTabs (filters
  AGENTIQ_OS_CARTRIDGE.tabs by adminOnly === true && no group).
  Gated by adminOfCartridge: 'agentiq-os'.

- qriptopia group → adds "Qriptopian Admin" tab with
  qriptoAdminTabsForMetameQriptopia() subTabs (Qripto's admin tabs
  also live flat at top-level under adminOnly). Gated by
  adminOfCartridge: 'qripto'.

- vl group → adds "VL Admin" tab with
  ventureLabAdminTabsForMetameVl() subTabs. Venture Lab doesn't yet
  have a dedicated adminOnly tabGroup on its own cartridge, so we
  ship a single placeholder child entry — when VL grows a proper
  admin surface, swap the stub for the clone pattern. Gated by
  adminOfCartridge: 'venture-lab'.

Every mirror follows the same protocol established with KNYT: drop
the source's adminOnly: true (the global-admin gate is replaced by
the per-cartridge gate), set adminOfCartridge to the cartridge slug
the persona must admin, reassign group, prefix slug to avoid
collisions inside metaMe's namespace.

Expected visibility outcomes
----------------------------
- Persona admin of cartridge X sees the X Admin tab as a sibling in
  the corresponding metaMe activation group, with X's admin sub-tabs
  rendering as a tier-3 row beneath it (the prior commit's tier-3
  regression fix is what makes the third row appear).
- Persona NOT admin of cartridge X — every gated tab silently hidden
  by the filter pipeline (top-level via getEnabledTabs, subTabs via
  the activeSubTabs filter — defense in depth).
- Global uber/platform admin sees every mirror (isGlobalAdmin
  short-circuit in the resolver + the filter).
```

## Body

Two-part fix for the missing admin tab in metaMe activation surfaces.

Part 1 — the slug-mismatch root cause
-------------------------------------
The grants resolver was returning the raw `crm_tenants.slug` value
back to the UI. The UI gate (`CodexTab.adminOfCartridge`) checks
against the cartridge slug used in `data/codex-configs.ts`. These two
namespaces aren't identical: CRM has 'knyt' but the cartridge is
'knyt-codex'; CRM has 'qriptopian' but the cartridge is 'qripto'.
The mirror declarations used cartridge slugs, so a KNYT-admin
persona's grants response contained 'knyt' and never matched
'knyt-codex' — the gate stayed closed.

Adds TENANT_SLUG_TO_CARTRIDGE_SLUG inside the resolver:
  knyt        → knyt-codex
  qriptopian  → qripto
  (agentiq-os, venture-lab, metame, marketa direct-pass for clarity)

Tenants without an alias entry pass through as-is, so a future tenant
whose slug happens to equal its cartridge slug Just Works.

Backlog (already tracked) will replace this static map with a join
table when multi-tenant cartridges arrive — single hook point at the
top of services/access/cartridgeAdminGrants.ts.

Canary additions
----------------
tests/cartridge-admin-grants.test.ts grows three more cases:
  - CRM 'knyt' → cartridge 'knyt-codex'
  - CRM 'qriptopian' → cartridge 'qripto'
  - unknown tenant slug passes through unchanged
Now at 10/10 passing.

Part 2 — additional mirrors in METAME_CODEX
-------------------------------------------
The prior commit only wired KNYT Admin into the Order of Metayé
group. Three more groups in metaMe needed parallel mirrors so the
chief-of-staff unlock covers every cartridge that has admin content:

- agentiqos group → adds "AgentiQ OS Admin" tab with
  agentiqOsAdminTabsForMetameAgentiqos() subTabs (filters
  AGENTIQ_OS_CARTRIDGE.tabs by adminOnly === true && no group).
  Gated by adminOfCartridge: 'agentiq-os'.

- qriptopia group → adds "Qriptopian Admin" tab with
  qriptoAdminTabsForMetameQriptopia() subTabs (Qripto's admin tabs
  also live flat at top-level under adminOnly). Gated by
  adminOfCartridge: 'qripto'.

- vl group → adds "VL Admin" tab with
  ventureLabAdminTabsForMetameVl() subTabs. Venture Lab doesn't yet
  have a dedicated adminOnly tabGroup on its own cartridge, so we
  ship a single placeholder child entry — when VL grows a proper
  admin surface, swap the stub for the clone pattern. Gated by
  adminOfCartridge: 'venture-lab'.

Every mirror follows the same protocol established with KNYT: drop
the source's adminOnly: true (the global-admin gate is replaced by
the per-cartridge gate), set adminOfCartridge to the cartridge slug
the persona must admin, reassign group, prefix slug to avoid
collisions inside metaMe's namespace.

Expected visibility outcomes
----------------------------
- Persona admin of cartridge X sees the X Admin tab as a sibling in
  the corresponding metaMe activation group, with X's admin sub-tabs
  rendering as a tier-3 row beneath it (the prior commit's tier-3
  regression fix is what makes the third row appear).
- Persona NOT admin of cartridge X — every gated tab silently hidden
  by the filter pipeline (top-level via getEnabledTabs, subTabs via
  the activeSubTabs filter — defense in depth).
- Global uber/platform admin sees every mirror (isGlobalAdmin
  short-circuit in the resolver + the filter).

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |
| Modified | `services/access/cartridgeAdminGrants.ts` |
| Modified | `tests/cartridge-admin-grants.test.ts` |

## Stats

 3 files changed, 200 insertions(+), 7 deletions(-)
