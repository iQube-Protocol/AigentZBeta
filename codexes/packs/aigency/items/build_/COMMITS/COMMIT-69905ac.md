# Commit Brief: `69905ac` — sprint 3 — agent genesis wizard inside the passport bureau apply tab

| Field | Value |
|-------|-------|
| SHA | [`69905ac`](https://github.com/iQube-Protocol/AigentZBeta/commit/69905ac588a277e89adb4b56c4343271de721835) |
| Author | Claude |
| Date | 2026-06-13T16:47:32Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 3 — agent genesis wizard inside the passport bureau apply tab

shipped (per 2026-06-13 hackathon plan §sprint 3 — non-technical user
path):

PassportBureauApplyTab now exposes two paths in the participant flow:

1. 'Genesis a new agent' (recommended, default) — sponsor a brand-new
   polity_bound agent. user provides:
     - agent display name (e.g. Aletheon)
     - slug (lowercase, 3-41 chars; auto-sanitises on type)
     - their Citizen Passport ID (the sponsor anchor)
   button posts to /api/agents/genesis which provisions
   agent_root_identity + a stable card url at
   /api/agents/<slug>/agent-card.json. on success the wizard auto-fills
   agentCardUrl so the remainder of the participant submit flow works
   unchanged. a notice surfaces the live card url to the operator.

2. 'Paste existing Agent Card URL' — the legacy path. unchanged for
   agents imported from external A2A hosts.

handleGenesisAgent validates locally, posts to genesis with proper
bearer headers, and on failure surfaces the server error (including the
pre-migration 503 naming 20260613200000_agent_genesis_polity_bound.sql).

this closes the loop: a citizen with a claimed passport can now sponsor
Aletheon end-to-end inside the passport cartridge, with no curl
required. follow-up sprint adds: skills/capabilities capture in the
genesis form (today the card defaults to skills:[]), and the agent
persona creation step after the participant passport is issued.
```

## Body

shipped (per 2026-06-13 hackathon plan §sprint 3 — non-technical user
path):

PassportBureauApplyTab now exposes two paths in the participant flow:

1. 'Genesis a new agent' (recommended, default) — sponsor a brand-new
   polity_bound agent. user provides:
     - agent display name (e.g. Aletheon)
     - slug (lowercase, 3-41 chars; auto-sanitises on type)
     - their Citizen Passport ID (the sponsor anchor)
   button posts to /api/agents/genesis which provisions
   agent_root_identity + a stable card url at
   /api/agents/<slug>/agent-card.json. on success the wizard auto-fills
   agentCardUrl so the remainder of the participant submit flow works
   unchanged. a notice surfaces the live card url to the operator.

2. 'Paste existing Agent Card URL' — the legacy path. unchanged for
   agents imported from external A2A hosts.

handleGenesisAgent validates locally, posts to genesis with proper
bearer headers, and on failure surfaces the server error (including the
pre-migration 503 naming 20260613200000_agent_genesis_polity_bound.sql).

this closes the loop: a citizen with a claimed passport can now sponsor
Aletheon end-to-end inside the passport cartridge, with no curl
required. follow-up sprint adds: skills/capabilities capture in the
genesis form (today the card defaults to skills:[]), and the agent
persona creation step after the participant passport is issued.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` |

## Stats

 1 file changed, 108 insertions(+), 7 deletions(-)
