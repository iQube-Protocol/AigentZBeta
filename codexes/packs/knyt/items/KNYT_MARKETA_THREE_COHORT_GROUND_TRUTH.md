# Marketa — Three-Cohort Campaign Ground Truth

**Canonical operating reference. Three parallel campaigns, zero overlap.**
Last verified: 2026-04-17

---

## Overview

Marketa manages three fully independent campaign cohorts simultaneously.
They share no contacts. They use separate tables, separate send scripts, and separate engagement tracking. No suppression or dedup is required between them.

| | KS Prospects | KNYT Codex | KNYT Partners |
|---|---|---|---|
| **DB table** | `ks_backers_staging` | `nakamoto_knyt_personas` | `avl_partners` |
| **Size** | 3,267 | 3,748 | 18 |
| **Overlap with others** | Zero | Zero | Zero |
| **Sequence length** | 8 emails | Per sub-cohort | 2 waves |
| **E1 status** | ✅ Sent 17 Apr | Partial — see sub-cohort table | ⏳ Not yet sent |
| **Engagement tracking** | `engagement_status` + `suppression_status` | `campaign_state` | Manual |
| **Webhook attribution** | `CustomID: stg_<id>\|N` | `CustomID: <investor_id>\|<seq>` | — |

---

## Cohort 1 — KS Prospects (3,267)

**Who they are:** People who pledged to or engaged with the metaKnyt Kickstarter campaign but are not in the canonical KNYT investor CRM. Quarantined in staging pending campaign completion.

**Source:** `ks_backers_staging`
- `cohort_id = 'ks_backers'`
- `campaign_id = 'knyt_ks_campaign'`
- Filter on `suppression_status = 'active'` at every send

**The 8-email sequence — targeting chain:**

| Email | Eligible `engagement_status` | Post-send status |
|---|---|---|
| 1 | `not_contacted` | `sent` |
| 2 | `sent`, `opened` | `email_2_sent` |
| 3 | `email_2_sent`, `opened` | `email_3_sent` |
| 4 | `email_3_sent`, `clicked` | `email_4_sent` |
| 5 | `email_4_sent` | `email_5_sent` |
| 6 | all active (48h urgency blast) | `email_6_sent` |
| 7 | `email_6_sent` | `email_7_sent` |
| 8 | all active (post-campaign continuity) | `email_8_sent` |

**Send command:**
```bash
node scripts/send-ks-prospects-sequence.js --email N [--dry-run]
```
Always run `--dry-run` first to confirm contact count before firing.

**Current status:** Email 1 sent 17 Apr to 3,267 contacts. Email 2 ready to send when timing is right (targets: `sent` + `opened`).

**Suppression:** A contact who bounces, spams, or unsubscribes has `suppression_status` set to `suppressed` automatically by the Mailjet webhook. They are excluded from all future sends. No manual action needed.

**Mailjet template env vars:** `MAILJET_TEMPLATE_KS_PROSPECTS_01` through `_08`

---

## Cohort 2 — KNYT Codex (3,748)

**Who they are:** The canonical KNYT investor CRM — legacy investors, reactivation candidates, and general supporters. These are the core investor relationships. Richer data, more personalised sequences.

**Source:** `nakamoto_knyt_personas`
- Filter: `campaign_state NOT IN ('backed', 'opted_out')`

**Sub-cohorts — send status as of 17 Apr 2026:**

| Sub-cohort | Size | E1 Status | Notes |
|---|---|---|---|
| `top_shelf` | 13 | ✅ All sent | Complete |
| `zero_knyt` | 144 | ✅ 143 sent | 1 contact (Gisclerc Morisset) reverted to null cohort — will be re-cohorted properly before next send |
| `reactivation` | 3,344 | ⏳ Not yet sent | Cleared — dry-run before firing |
| `general` | 91 | ⏳ Not yet sent | Cleared — dry-run before firing |

**Send order:** top_shelf → zero_knyt → reactivation → general. Never fire all cohorts simultaneously.

**Send commands (other agent's script):**
```bash
# Always dry-run first
python3 scripts/send_campaign_sequence.py --sequence knyt_reactivation_v1 --cohort reactivation --dry-run
python3 scripts/send_campaign_sequence.py --sequence knyt_general_v1 --cohort general --dry-run

# Then live
python3 scripts/send_campaign_sequence.py --sequence knyt_reactivation_v1 --cohort reactivation --channel email_mailjet
python3 scripts/send_campaign_sequence.py --sequence knyt_general_v1 --cohort general --channel email_mailjet
```

**Engagement tracking:** `campaign_state` advances automatically via the Mailjet webhook:
`unsent → sent → opened → clicked → backed / opted_out`

**Important:** Cohort and campaign_state fields are **locked** in the Investor Directory UI during active campaign. Changes must go through the cohort assignment script or a deliberate SQL with documented reason.

---

## Cohort 3 — KNYT Partners (18)

**Who they are:** The 18 AVL (Aligned Venture Lab) strategic partners. These are relationship-led activations, not broadcast emails. Two waves planned.

**Source:** `avl_partners` table

**Wave plan:**

| Wave | Target | Timing | Goal |
|---|---|---|---|
| Wave 1 | All 18 partners | Immediate next priority | Initial activation — ask for signal/share/backing |
| Wave 2 | Responders from Wave 1 | After ≥3 responses | Deeper engagement, co-activation ask |

**Managed via:** Outreach tab → Relationship Builder → Partners panel
**Status:** Not yet launched. This is the remaining blocker on the programme critical path.

---

## Rules Marketa Must Hold

1. **Never cross-send.** The three cohorts are separate. A contact in one cohort never receives the sequence of another.
2. **Always dry-run first.** Before any live send, run `--dry-run` (KS Prospects) or preview the count to confirm targeting is correct.
3. **Respect suppression.** The webhook handles bounces/unsubs automatically. Do not manually re-add suppressed contacts.
4. **Sub-cohort order matters.** For KNYT Codex, always fire top_shelf before general. Sequence integrity depends on it.
5. **Partner waves are relationship-led.** No bulk blast to partners — each message should be personalised or semi-personalised.
6. **KS Prospects E6 and E8 are blasts.** Emails 6 and 8 target all active contacts. Treat these as urgency/continuity triggers, not sequence steps — time them deliberately.

---

## Operator Surfaces — Where to Work With Marketa

| Task | Surface |
|---|---|
| Campaign orchestration overview | **Aigent Marketa cartridge** → Campaigns tab |
| KS Prospects — monitor + compose | **KNYT Codex → Outreach tab** (RelationshipBuilderTab) |
| KNYT Codex investors — view CRM | **KNYT Codex → Investors tab** (InvestorDirectoryTab) |
| Partner outreach | **KNYT Codex → Outreach tab** → Partners panel |
| Agent coordination (Marketa ↔ Claude) | **Venture Lab α → Relationship Builder tab** → QubeTalk feed |
| Fire KS Prospects emails | Terminal: `node scripts/send-ks-prospects-sequence.js --email N` |
| Fire KNYT Codex emails | Terminal: `python3 scripts/send_campaign_sequence.py --cohort X` |

The Marketa cartridge is the **command centre** — dashboard, campaign status, partner overview. The KNYT Codex tabs are the **execution surfaces** for specific data and sends.

---

## What's Next (as of 17 Apr 2026)

| Cohort | Next action |
|---|---|
| KS Prospects | Fire Email 2 — targets: `engagement_status IN ('sent', 'opened')` |
| KNYT Codex — reactivation | Dry-run then fire: 3,344 contacts cleared |
| KNYT Codex — general | Dry-run then fire: 91 contacts cleared |
| KNYT Partners | Launch Wave 1 — 18 partner activation outreach |
