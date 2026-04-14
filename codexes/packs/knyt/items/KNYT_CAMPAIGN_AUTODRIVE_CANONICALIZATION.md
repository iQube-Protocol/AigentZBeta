# KNYT Campaign AutoDrive Canonicalization Handoff

## Purpose
This document instructs Claude to treat the full KNYT Campaign document bundle as **KNYT Codex-grade canonical material** and commit it to **AutoDrive as the canonical encrypted genesis set** for the KNYT Activation Campaign.

This is not primarily about access restriction. The admin-gated codex tab is sufficient for current agent and admin access.

The AutoDrive commit is about:
- survivability
- canonical persistence
- recovery
- provenance of the genesis campaign plan set

---

## 1. Canonical requirement
The full KNYT Campaign bundle should be treated as a **canonical genesis document set** for the campaign.

That means these docs should exist in two places:

1. **repo / codex pack surface**
   - for operational use inside the admin-gated KNYT Campaign tab
2. **AutoDrive encrypted canonical storage**
   - for survivability and canonical persistence

### Canonical rule
**The KNYT Campaign bundle should be both codex-browsable and AutoDrive-canonical.**

---

## 2. Full 13-document genesis set
Claude should commit the entire bundle, not just a subset.

### Required document set
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

### This AutoDrive set should be treated as
- the **canonical genesis campaign bundle**
- the initial reference set against which later revisions are understood

---

## 3. Deployment expectation for Claude
Claude should use the **existing AutoDrive / canonical asset commit pattern already present in the stack** rather than inventing a new storage pattern just for this campaign bundle.

### Rule
Use the existing KNYT canonical storage conventions wherever possible, including:
- encryption before commit
- canonical metadata / manifest shape already used for KNYT codex-grade assets
- traceable reference to the campaign bundle as a named collection or genesis set

### Important note
Do not create a one-off ad hoc campaign storage mechanism if the repo already has an established pattern for canonical KNYT asset persistence.

---

## 4. Naming recommendation
Claude should persist the AutoDrive set using a stable canonical name, such as:

- `knyt_campaign_genesis_set`
- `knyt_activation_campaign_genesis_bundle`

### Recommendation
Prefer a name that clearly indicates:
- KNYT
- campaign
- genesis / canonical initial set

---

## 5. Encryption requirement
These docs should be committed to AutoDrive as **encrypted files**.

### Why
The goal is not merely public mirroring. The goal is survivable canonical persistence with the same seriousness as other codex-grade KNYT assets.

### Current access rule
- admin-gated codex tab controls current live operational access
- AutoDrive encrypted commit provides durable canonical persistence underneath

---

## 6. Manifest / reference recommendation
Claude should create or update the appropriate manifest / reference object so the AutoDrive-stored campaign bundle can be:
- identified later
- audited later
- reloaded later
- revised later as the campaign evolves

### Minimum metadata to preserve
- bundle name
- genesis timestamp
- list of included documents
- commit / content hashes if supported by the current pattern
- approval / authority note if supported by the current pattern

---

## 7. Revision model
This initial AutoDrive commit should be treated as the **genesis set**, not the final frozen state forever.

### Recommendation
Subsequent meaningful revisions should be handled as:
- a revision log document in the codex bundle
- and, when appropriate, later canonical revisions or snapshots in AutoDrive

### Rule
Do not silently overwrite the significance of the genesis set. Preserve the distinction between:
- **genesis bundle**
- **later revision snapshots**

---

## 8. Relationship to the admin-gated tab
The admin-gated KNYT Campaign tab remains the live operational surface for:
- admins
- Marketa
- Aigent Z
- Aigent C where relevant
- Kn0w1 where relevant
- other authorized agent stakeholders

### AutoDrive role
AutoDrive is the canonical persistence layer beneath this, not the main browsing layer.

### Canonical line
**Admin gating controls working access. AutoDrive secures canonical survivability.**

---

## 9. Claude execution checklist
Claude should not close this task until the following are true:

- [ ] all 13 KNYT campaign docs exist in the repo bundle
- [ ] all 13 docs are exposed through the admin-gated `KNYT Campaign` codex tab
- [ ] all 13 docs are committed to AutoDrive as encrypted files
- [ ] the AutoDrive set is named and recorded as the canonical genesis bundle
- [ ] manifest / metadata references are stored using the existing KNYT canonical pattern
- [ ] the distinction between genesis set and future revisions is preserved

---

## 10. Canonical instruction to Claude
**Treat the full 13-document KNYT Campaign bundle as KNYT Codex-grade material. Surface it in the admin-gated KNYT Campaign tab for live operator use, and commit the same full set to AutoDrive as encrypted files as the canonical genesis set of the KNYT Activation Campaign blueprint and plan docs.**