# KNYT Campaign Deployment Handoff

## Purpose
This document is the deployment handoff for Claude to wire the KNYT campaign bundle into the KNYT codex as an admin-gated campaign resource.

The campaign docs are already in the repo. This handoff describes how to expose them cleanly in the product.

---

## 1. Campaign bundle files
The following files now form the core KNYT Campaign bundle under `codexes/packs/knyt/items/`:

1. `KNYT_CAMPAIGN_OPERATOR_BRIEF.md`
2. `KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md`
3. `KNYT_CAMPAIGN_COPY_PACK.md`
4. `KNYT_CAMPAIGN_OPERATIONS.md`
5. `KNYT_CAMPAIGN_DEPLOYMENT_HANDOFF.md`
6. `KNYT_MARKETA_ACTIVATION_PLAN.md`
7. `KNYT_MARKETA_CAMPAIGN_OPERATING_BRIEF.md`
8. `KNYT_PARTNER_AND_IN_PRODUCT_COPY_PACK.md`
9. `KNYT_30_DAY_ACTIVATION_CALENDAR_AND_SEGMENTATION.md`
10. `KNYT_CRM_FIELD_SCHEMA_AND_TAGGING_MODEL.md`
11. `KNYT_CAMPAIGN_DASHBOARD_SPEC.md`
12. `KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md`
13. `KNYT_LAUNCH_DAY_RUNBOOK_AND_PARTNER_ACTIVATION.md`

### Additional canonicalization handoff
The following companion doc should also remain in the repo to support canonical persistence:
- `KNYT_CAMPAIGN_AUTODRIVE_CANONICALIZATION.md`

That means the full repo set is:
- **13 core campaign docs**
- **1 AutoDrive canonicalization handoff doc**

---

## 2. Desired product outcome
Expose the core campaign docs inside the **KNYT Codex** under a new:
- **admin-gated tab**
- label: **KNYT Campaign**
- audience: internal campaign operators and authorized Aigent stakeholders only

This tab should function like the existing admin-only KNYT document surfaces and should be browsable as a document bundle.

---

## 3. Recommended implementation

## Step 1 — add a collection to `codexes/packs/knyt/collections.json`
Add a new collection like:

```json
{
  "id": "col_knyt_campaign",
  "title": "KNYT Campaign",
  "items": [
    "items/KNYT_CAMPAIGN_OPERATOR_BRIEF.md",
    "items/KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md",
    "items/KNYT_CAMPAIGN_COPY_PACK.md",
    "items/KNYT_CAMPAIGN_OPERATIONS.md",
    "items/KNYT_CAMPAIGN_DEPLOYMENT_HANDOFF.md",
    "items/KNYT_MARKETA_ACTIVATION_PLAN.md",
    "items/KNYT_MARKETA_CAMPAIGN_OPERATING_BRIEF.md",
    "items/KNYT_PARTNER_AND_IN_PRODUCT_COPY_PACK.md",
    "items/KNYT_30_DAY_ACTIVATION_CALENDAR_AND_SEGMENTATION.md",
    "items/KNYT_CRM_FIELD_SCHEMA_AND_TAGGING_MODEL.md",
    "items/KNYT_CAMPAIGN_DASHBOARD_SPEC.md",
    "items/KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md",
    "items/KNYT_LAUNCH_DAY_RUNBOOK_AND_PARTNER_ACTIVATION.md"
  ]
}
```

### Optional later additions
If revision tracking docs are added, append them here.

---

## Step 2 — add a new admin-only tab to `data/codex-configs.ts`
Inside `KNYT_CODEX.tabs`, add a new tab after `experience-pack`.

### Recommended tab config
```ts
{
  id: 'campaign',
  label: 'KNYT Campaign',
  slug: 'campaign',
  enabled: true,
  adminOnly: true,
  order: 11,
  type: 'static',
  config: {
    component: 'AgentiqCartridgeTab',
    props: {
      packId: 'knyt',
      collectionId: 'col_knyt_campaign',
      defaultPath: 'items/KNYT_CAMPAIGN_OPERATOR_BRIEF.md'
    }
  },
  metadata: {
    icon: 'Megaphone',
    description: 'KNYT campaign activation docs — operator brief, blueprint, copy, operations, launch runbook',
    color: 'rose'
  }
}
```

### Note on ordering
Because current KNYT admin tabs end at `experience-pack` order 10, use order 11 for campaign.

---

## Step 3 — confirm admin gating
The tab should remain hidden from non-admin users.

### Intended audience
- product owner
- Marketa
- Aigent Z
- Aigent C where relevant
- Kn0w1 where relevant
- other explicitly authorized internal Aigent stakeholders

### Rule
This is a campaign operating bundle, not a public-facing end-user surface.

---

## 4. Recommended default reading order
Inside the collection, the default reading sequence should be:

1. `KNYT_CAMPAIGN_OPERATOR_BRIEF.md`
2. `KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md`
3. `KNYT_CAMPAIGN_COPY_PACK.md`
4. `KNYT_CAMPAIGN_OPERATIONS.md`
5. `KNYT_CAMPAIGN_DEPLOYMENT_HANDOFF.md`
6. `KNYT_MARKETA_ACTIVATION_PLAN.md`
7. `KNYT_MARKETA_CAMPAIGN_OPERATING_BRIEF.md`
8. `KNYT_PARTNER_AND_IN_PRODUCT_COPY_PACK.md`
9. `KNYT_30_DAY_ACTIVATION_CALENDAR_AND_SEGMENTATION.md`
10. `KNYT_CRM_FIELD_SCHEMA_AND_TAGGING_MODEL.md`
11. `KNYT_CAMPAIGN_DASHBOARD_SPEC.md`
12. `KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md`
13. `KNYT_LAUNCH_DAY_RUNBOOK_AND_PARTNER_ACTIVATION.md`

---

## 5. Revision logging recommendation
This bundle should become a live working set as campaign signal comes in.

### Recommendation
Create a campaign revision flow using either:
- a dedicated `KNYT_CAMPAIGN_REVISION_LOG.md`
- or append dated revision notes to a future learnings doc

### Minimal revision format
```md
## YYYY-MM-DD — Revision note
- What changed
- Why it changed
- What signal triggered the change
- Who approved it
```

### Rule
Do not overwrite important campaign learning silently. Keep a visible revision trail once the campaign is live.

---

## 6. Claude deployment checklist
Before closing deployment, Claude should confirm:
- [ ] all 13 core KNYT campaign docs exist in `codexes/packs/knyt/items/`
- [ ] `col_knyt_campaign` exists in `codexes/packs/knyt/collections.json`
- [ ] KNYT Campaign tab exists in `data/codex-configs.ts`
- [ ] tab is `adminOnly: true`
- [ ] defaultPath points to `KNYT_CAMPAIGN_OPERATOR_BRIEF.md`
- [ ] tab renders correctly in the KNYT codex
- [ ] non-admin users do not see the tab
- [ ] admin users can browse all campaign docs in order
- [ ] the companion AutoDrive canonicalization handoff remains available for canonical persistence workflow

---

## 7. Canonical deployment line
**Treat the KNYT Campaign bundle as a live admin-gated operating resource inside the KNYT codex: concise operator brief first, full blueprint behind it, copy and operations alongside it, and revision logging added as campaign signal accumulates.**