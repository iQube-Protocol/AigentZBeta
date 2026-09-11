# Commit Brief: `1ae9df0` — feat(downloads): ship Agent Runbook + flip menu entry to available

| Field | Value |
|-------|-------|
| SHA | [`1ae9df0`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ae9df032f56c2c026b9f6a6f11fc61e16b2f7e3) |
| Author | Claude |
| Date | 2026-06-03T16:39:17Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(downloads): ship Agent Runbook + flip menu entry to available

Adds the Polity Papers Experience Sovereignty series Agent Runbook
as a downloadable Markdown asset for off-platform agents. Sourced
from operator-provided text; converted to Markdown for native LLM
ingestion (better than PDF for ChatGPT/Claude/etc.).

public/downloads/aigentme-agent-runbook.md — full runbook with:
- Corrected operating stack (Registry → nanOS → Studio → Catalogue
  → Runtime)
- Agent role / boundaries / decision tree (16 nodes)
- Handoff map (aigentMe / Cartridge CoPilot / Registry / nanOS /
  Studio Composer / Runtime)
- Experience Vibing workflow (14 steps)
- Cartridge / Tab / Capsule / Pill decision guidance
- All 5 publishing routes
- iQube preparation guidance
- Mini-RFP guidance
- 9 machine-readable JSON brief templates (Experience Intent,
  Cartridge Creation, Tab Creation, Cartridge Contribution, iQube
  Preparation, Handoff Recommendation, Runtime Activation, Mini-RFP,
  Catalogue/Runtime Status)
- iQube Card profile JSON for runbook self-registration

DownloadsMenu — runbook entry flipped from comingSoon to available,
description tightened, expanded purpose copy. Experience Operator
Manual stays comingSoon pending operator-supplied text.
```

## Body

Adds the Polity Papers Experience Sovereignty series Agent Runbook
as a downloadable Markdown asset for off-platform agents. Sourced
from operator-provided text; converted to Markdown for native LLM
ingestion (better than PDF for ChatGPT/Claude/etc.).

public/downloads/aigentme-agent-runbook.md — full runbook with:
- Corrected operating stack (Registry → nanOS → Studio → Catalogue
  → Runtime)
- Agent role / boundaries / decision tree (16 nodes)
- Handoff map (aigentMe / Cartridge CoPilot / Registry / nanOS /
  Studio Composer / Runtime)
- Experience Vibing workflow (14 steps)
- Cartridge / Tab / Capsule / Pill decision guidance
- All 5 publishing routes
- iQube preparation guidance
- Mini-RFP guidance
- 9 machine-readable JSON brief templates (Experience Intent,
  Cartridge Creation, Tab Creation, Cartridge Contribution, iQube
  Preparation, Handoff Recommendation, Runtime Activation, Mini-RFP,
  Catalogue/Runtime Status)
- iQube Card profile JSON for runbook self-registration

DownloadsMenu — runbook entry flipped from comingSoon to available,
description tightened, expanded purpose copy. Experience Operator
Manual stays comingSoon pending operator-supplied text.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/downloads/DownloadsMenu.tsx` |
| Added | `public/downloads/aigentme-agent-runbook.md` |

## Stats

 2 files changed, 689 insertions(+), 4 deletions(-)
