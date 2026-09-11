# Commit Brief: `84f45d6` — fix passport bureau copilot — wire CodexCopilotLayer for polity-passport-bureau-cartridge (aigent-z default)

| Field | Value |
|-------|-------|
| SHA | [`84f45d6`](https://github.com/iQube-Protocol/AigentZBeta/commit/84f45d6040febc440eb1c22ca69ebcb078a5fdb7) |
| Author | Claude |
| Date | 2026-06-13T20:28:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix passport bureau copilot — wire CodexCopilotLayer for polity-passport-bureau-cartridge (aigent-z default)

per 2026-06-13 sprint 8 plan. operator reported the floating copilot
button doesn't render on the polity passport bureau cartridge. root
cause (per Explore agent): copilot mounting is NOT config-driven —
cartridge configs have no copilot property. instead
CodexPanelDynamic.tsx lines 1071-1121 hardcode the renders by
codexId. POLITY_PASSPORT_BUREAU_CARTRIDGE was added 2026-06-10 but
the wiring step was skipped.

fix: two changes in app/triad/components/CodexPanelDynamic.tsx,
mirroring the metame-codex pattern exactly:

  1. add useState near the other copilot opens:
     const [passportCopilotOpen, setPassportCopilotOpen] = useState(false);

  2. add conditional render block (no per-tab gate — visible across
     all 5 passport tabs):
       if codexId === 'polity-passport-bureau-cartridge'
         render CodexCopilotLayer
           - variant: 'floating'
           - accentColor: 'violet' (matches cartridge accent)
           - agent: aigent-z (system orchestrator + cartridge owner)
           - contextId: 'passport-<tab-slug>' so chat state survives tab switches
           - quickPrompts: 5 passport-specific prompts

agent choice: aigent-z is the closest match to 'AgentiQ OS default
agent' — system-orchestrator class, seeded in
20260427000001_agent_did_schema.sql, currently named as the
POLITY_PASSPORT_BUREAU_CARTRIDGE.owner. operator confirmed
placeholder until reassignment.

metaMe agentiqos-passport mirror tab is unaffected — when viewed
through metame-codex the copilot remains aigent-me per the existing
cartridge-scoped pattern.

follow-up (phase B): make copilot config-driven so cartridges can
opt in via a CodexConfig property rather than touching
CodexPanelDynamic. tracked in plan §sprint 8 part A.
```

## Body

per 2026-06-13 sprint 8 plan. operator reported the floating copilot
button doesn't render on the polity passport bureau cartridge. root
cause (per Explore agent): copilot mounting is NOT config-driven —
cartridge configs have no copilot property. instead
CodexPanelDynamic.tsx lines 1071-1121 hardcode the renders by
codexId. POLITY_PASSPORT_BUREAU_CARTRIDGE was added 2026-06-10 but
the wiring step was skipped.

fix: two changes in app/triad/components/CodexPanelDynamic.tsx,
mirroring the metame-codex pattern exactly:

  1. add useState near the other copilot opens:
     const [passportCopilotOpen, setPassportCopilotOpen] = useState(false);

  2. add conditional render block (no per-tab gate — visible across
     all 5 passport tabs):
       if codexId === 'polity-passport-bureau-cartridge'
         render CodexCopilotLayer
           - variant: 'floating'
           - accentColor: 'violet' (matches cartridge accent)
           - agent: aigent-z (system orchestrator + cartridge owner)
           - contextId: 'passport-<tab-slug>' so chat state survives tab switches
           - quickPrompts: 5 passport-specific prompts

agent choice: aigent-z is the closest match to 'AgentiQ OS default
agent' — system-orchestrator class, seeded in
20260427000001_agent_did_schema.sql, currently named as the
POLITY_PASSPORT_BUREAU_CARTRIDGE.owner. operator confirmed
placeholder until reassignment.

metaMe agentiqos-passport mirror tab is unaffected — when viewed
through metame-codex the copilot remains aigent-me per the existing
cartridge-scoped pattern.

follow-up (phase B): make copilot config-driven so cartridges can
opt in via a CodexConfig property rather than touching
CodexPanelDynamic. tracked in plan §sprint 8 part A.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |

## Stats

 1 file changed, 28 insertions(+)
