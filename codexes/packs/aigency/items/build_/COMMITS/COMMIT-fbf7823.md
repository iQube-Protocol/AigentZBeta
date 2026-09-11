# Commit Brief: `fbf7823` — docs: AgentiQ Network Costs — first-class reference doc + cartridge collection

| Field | Value |
|-------|-------|
| SHA | [`fbf7823`](https://github.com/iQube-Protocol/AigentZBeta/commit/fbf7823ec47bdba78cd5c3174b688869324baa11) |
| Author | Claude |
| Date | 2026-06-01T12:39:45Z |
| Branch | dev (direct push) |
| Type | `docs` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
docs: AgentiQ Network Costs — first-class reference doc + cartridge collection

New canonical reference at:
  codexes/packs/agentiq/items/AGENTIQ_NETWORK_COSTS.md

Registered as a new first-class cartridge collection
col_network_economics — alongside Architecture and Operators rather
than buried under Updates.

Sections:
1. Four cost layers — PoS, Merkle batcher, BTC anchor, LayerZero
2. K/T policy mechanics, decision matrix, knob bounds
3. Current testnet posture (~$0/day today)
4. Mainnet cost model with explicit assumptions + matrices for both
   Proposed (K=50, T=15min) and Aggressive (K=100, T=30min)
   calibrations across sparse/steady/busy/flood traffic
5. Tuning guidance + anti-patterns
6. Operational SQL — verify cron firing, detect drift backlog,
   identify failed cycles
7. Files + endpoints reference (all paths)
8. Future work backlog candidates

Per CLAUDE.md doc placement: lives under codexes/packs/agentiq/items/
(first-class) not codexes/packs/agentiq/updates/ (point-in-time
records). The doc is the operator's canonical answer to "what does
this network cost to run."
```

## Body

New canonical reference at:
  codexes/packs/agentiq/items/AGENTIQ_NETWORK_COSTS.md

Registered as a new first-class cartridge collection
col_network_economics — alongside Architecture and Operators rather
than buried under Updates.

Sections:
1. Four cost layers — PoS, Merkle batcher, BTC anchor, LayerZero
2. K/T policy mechanics, decision matrix, knob bounds
3. Current testnet posture (~$0/day today)
4. Mainnet cost model with explicit assumptions + matrices for both
   Proposed (K=50, T=15min) and Aggressive (K=100, T=30min)
   calibrations across sparse/steady/busy/flood traffic
5. Tuning guidance + anti-patterns
6. Operational SQL — verify cron firing, detect drift backlog,
   identify failed cycles
7. Files + endpoints reference (all paths)
8. Future work backlog candidates

Per CLAUDE.md doc placement: lives under codexes/packs/agentiq/items/
(first-class) not codexes/packs/agentiq/updates/ (point-in-time
records). The doc is the operator's canonical answer to "what does
this network cost to run."

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/items/AGENTIQ_NETWORK_COSTS.md` |

## Stats

 2 files changed, 242 insertions(+)
