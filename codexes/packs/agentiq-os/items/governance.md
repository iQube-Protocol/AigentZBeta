# AgentiQ OS Governance

## Open / Proprietary Boundary

AgentiQ OS operates an explicit open/proprietary boundary. This is not a moral position — it is an operational doctrine.

### What Is Open

| Asset | License | Location |
|-------|---------|---------|
| Protocol specs (iQube, Qripto, Aigent) | iQube Protocol License | This cartridge + public repo |
| AgentiQ OS SDK (`@agentiqos/agentiq-sdk`) | iQube Protocol License | `packages/agentiq-sdk` → public mirror |
| Pack content (docs, KB) | iQube Protocol License | `codexes/packs/agentiq-os/` → public mirror |
| Developer reference docs | iQube Protocol License | This cartridge |
| Registry trust band definitions | iQube Protocol License | Publicly documented |

### What Is Proprietary

| Asset | Reason |
|-------|--------|
| AgentiQ Platform (cartridge renderer, multi-codex viewer) | Contains engineering KB and system architecture |
| nanOS Cartridge | Proprietary production operating layer — Population Console, Aigent Z copilot, CRM, Experience Matrix, commercial rails |
| Engineering KB (`codexes/packs/aigency/`) | Internal architecture, PRs, decisions |
| Admin tooling and CRM routes | Operator-sensitive |
| Supabase schema and RLS policies | Security-sensitive |

### The Canonical Rule
> Open and closed are not moral categories. The trust layer should be uncompromising; the payload layer pragmatic. Custody and control should be separated. Working state is not canonical state.

---

## Registry Governance

The Registry is the on-chain and off-chain asset ledger for all published Qubes.

### Submission Process

```
Developer publishes SkillQube / AigentQube
         │
         ▼
L1_EXPERIMENTAL (unreviewed, visible to community)
         │
    Community review
         │
         ▼
L2_VERIFIED_COMMUNITY (community-reviewed, production-safe for low-stakes)
         │
    Formal review panel
         │
         ▼
L3_PRODUCTION_CANDIDATE → L4_PRODUCTION_APPROVED
         │
    iQube Protocol core team
         │
         ▼
L5_CORE_SOVEREIGN (immutable, protocol-level)
```

### Trust Band Policy
- Developers may submit at L1 or L2 by self-declaration
- L3+ requires a review panel pass
- L5 is reserved for protocol-level assets and requires iQube Protocol core team approval
- Trust band downgrades are permanent for the current version; publish a new version to re-submit

---

## Public Repo Sync

The AgentiQ OS content pack is automatically mirrored to the public `iQube-Protocol/AgentiQ-OS` repository on every push to `dev`.

**What is mirrored:**
- `codexes/packs/agentiq-os/items/` → `docs/`
- `packages/agentiq-sdk/` → `packages/agentiq-sdk/`
- `collections.json`, `meta.json`

**What is never mirrored:**
- React components, API routes, Supabase schema
- Engineering KB (`codexes/packs/aigency/`)
- Any file outside the declared mirror scope

The sync is one-way: AigentZBeta → AgentiQ OS repo. The public repo has no access to AigentZBeta.

---

## Contributing

Contributions to the open layer follow the standard iQube Protocol contribution flow:

1. Fork `iQube-Protocol/AgentiQ-OS`
2. Submit a PR against `main`
3. A reviewer from the iQube Protocol core team approves
4. Content is reviewed and merged
5. Protocol changes that affect AgentiQ OS contracts are announced in the Qriptopian feed

Protocol-level changes (iQube, Qripto, Aigent protocol specs) require an additional architecture review before merge.
