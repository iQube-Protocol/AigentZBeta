# Commit Brief: `5a33625` — intent chains commit 8: ExpandedNBEPill chain breadcrumb + ChainDetailDrawer

| Field | Value |
|-------|-------|
| SHA | [`5a33625`](https://github.com/iQube-Protocol/AigentZBeta/commit/5a336253f1cb3238817e7a071d93a61f7750dff1) |
| Author | Claude |
| Date | 2026-06-02T01:24:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 8: ExpandedNBEPill chain breadcrumb + ChainDetailDrawer

UI surfaces for the chain orchestrator. Two deliverables:

1. ExpandedNBEPill chain breadcrumb (spec §8):
   - New optional props: chainBreadcrumb? + onChainBreadcrumbClick?
   - Renders at the top of the pill when present — clickable violet
     button showing chain label + "Step X/N" with hover affordance
   - Click invokes onChainBreadcrumbClick(chain_id) to open the drawer
   - data-pill-chain-id attribute on the root for analytics + tests
   - Layout above the existing pill header — does not disrupt the
     queued / sent / dismiss / mark-complete affordances

2. ChainDetailDrawer (new component):
   - Right-side overlay drawer (max-w-2xl) — opens via breadcrumb
     click + myWorkspace card click (commit 9)
   - Header: template_id title + version + age + cost_qc (when > 0)
     + status badge (Active spinner / Waiting / Completed / Failed
     / Cancelled) + close button
   - Body: reconstructed step history from
     GET /api/intent-chains/[chain_id], one row per
     orchestration_events row, color-coded by completion/failure/wait,
     timestamp + receipt indicator + summary text. Handles every
     chain_* event type plus proposal_drafted + artifact_sent.
   - Footer changes by chain status:
     • active/waiting → "Cancel chain" button calling
       POST /api/intent-chains/[chain_id]/cancel
     • completed/failed/cancelled → like/dislike feedback strip per
       spec §6.7. Like = single click submit. Dislike expands a
       textarea (2000-char max) for "what didn't work" capture.
       Existing feedback rehydrates on open. Receipt receipt_event_id
       not displayed inline (admin surfaces it via Stage 6 receipts
       tab per locked decision §11 #6).
   - All API calls via personaFetch with personaIdHint passthrough
```

## Body

UI surfaces for the chain orchestrator. Two deliverables:

1. ExpandedNBEPill chain breadcrumb (spec §8):
   - New optional props: chainBreadcrumb? + onChainBreadcrumbClick?
   - Renders at the top of the pill when present — clickable violet
     button showing chain label + "Step X/N" with hover affordance
   - Click invokes onChainBreadcrumbClick(chain_id) to open the drawer
   - data-pill-chain-id attribute on the root for analytics + tests
   - Layout above the existing pill header — does not disrupt the
     queued / sent / dismiss / mark-complete affordances

2. ChainDetailDrawer (new component):
   - Right-side overlay drawer (max-w-2xl) — opens via breadcrumb
     click + myWorkspace card click (commit 9)
   - Header: template_id title + version + age + cost_qc (when > 0)
     + status badge (Active spinner / Waiting / Completed / Failed
     / Cancelled) + close button
   - Body: reconstructed step history from
     GET /api/intent-chains/[chain_id], one row per
     orchestration_events row, color-coded by completion/failure/wait,
     timestamp + receipt indicator + summary text. Handles every
     chain_* event type plus proposal_drafted + artifact_sent.
   - Footer changes by chain status:
     • active/waiting → "Cancel chain" button calling
       POST /api/intent-chains/[chain_id]/cancel
     • completed/failed/cancelled → like/dislike feedback strip per
       spec §6.7. Like = single click submit. Dislike expands a
       textarea (2000-char max) for "what didn't work" capture.
       Existing feedback rehydrates on open. Receipt receipt_event_id
       not displayed inline (admin surfaces it via Stage 6 receipts
       tab per locked decision §11 #6).
   - All API calls via personaFetch with personaIdHint passthrough

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/ExpandedNBEPill.tsx` |
| Added | `components/metame/chains/ChainDetailDrawer.tsx` |

## Stats

 2 files changed, 460 insertions(+)
