# Commit Brief: `fdfa189` — VentureCockpit: surface KPI editor from cockpit chips + header

| Field | Value |
|-------|-------|
| SHA | [`fdfa189`](https://github.com/iQube-Protocol/AigentZBeta/commit/fdfa189ed53b94ff096128b60de5effd9e6be081) |
| Author | Claude |
| Date | 2026-05-24T08:15:26Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
VentureCockpit: surface KPI editor from cockpit chips + header

Adds three affordances so the operator can discover and use the
ActiveKpisEditor straight from the cockpit:

- Edit KPIs button in the cockpit header (SlidersHorizontal icon),
  visible whenever onEditKpis is wired through layoutProps
- Add KPIs CTA chip in the KPIs row when no rich KPIs are declared,
  rendered alongside the legacy StatChip fallback so the row reads as
  a coherent strip + advertises the next step
- ChevronRight on every rich KpiChip so clickability is visible at a
  glance (the chip was already a button + onSelect→KpiDetailLayout,
  but had no affordance signalling that)

Wires onEditKpis through RightPaneLayoutProps and mounts the editor
in AigentMeWelcomeSplitTab (kpisEditorOpen state) so saves re-fetch
ventureProgress silently.
```

## Body

Adds three affordances so the operator can discover and use the
ActiveKpisEditor straight from the cockpit:

- Edit KPIs button in the cockpit header (SlidersHorizontal icon),
  visible whenever onEditKpis is wired through layoutProps
- Add KPIs CTA chip in the KPIs row when no rich KPIs are declared,
  rendered alongside the legacy StatChip fallback so the row reads as
  a coherent strip + advertises the next step
- ChevronRight on every rich KpiChip so clickability is visible at a
  glance (the chip was already a button + onSelect→KpiDetailLayout,
  but had no affordance signalling that)

Wires onEditKpis through RightPaneLayoutProps and mounts the editor
in AigentMeWelcomeSplitTab (kpisEditorOpen state) so saves re-fetch
ventureProgress silently.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |
| Modified | `components/metame/welcome/layouts/types.ts` |

## Stats

 3 files changed, 64 insertions(+), 1 deletion(-)
