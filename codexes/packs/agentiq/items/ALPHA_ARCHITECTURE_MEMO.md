# AgentiQ Alpha Architecture Memo

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06  
**Version:** alpha-1.0

---

## Mission

Launch the first coherent, governed, end-to-end alpha of the AgentiQ ecosystem by packaging and aligning existing assets into a visible closed loop.

This is not just an AgentiQ OS release. It is the first market-facing demonstration of the complete AgentiQ ecosystem flywheel:

> Build in AgentiQ OS → Ingest through the Registry Ingestion Factory → Organize in the Registry → Compose in Studio → Deliver in metaMe Runtime → Generate signal in KNYT → Progress users through PCS → Reward inside the KNYT cartridge → Feed insight back into future supply

---

## Canonical launch line

> This alpha does not just release an OS. It reveals the first complete governed loop of the AgentiQ ecosystem — from open contribution, to governed intake, to composed experience, to live participation, to PCS-driven progression, to contained economic reward, and back into future supply.

---

## Canonical positioning block

> AgentiQ OS opens the public upstream build layer. AgentiQ governs the proprietary platform layer. metaMe governs the personal sovereignty and experience layer. KNYT is the first live world where participation, signal, PCS, and contained tokenized economics set the whole flywheel in motion.

---

## Four-cartridge topology

```
┌─────────────────────────────────────────────────────────────────┐
│  AgentiQ OS Cartridge + Codex                                   │
│  Role: public upstream build and contributor zone               │
│  Lead Aigent: Aigent C                                          │
│  Assets: SDK, CLI, packaging standards, contribution guides,    │
│          submission path, public docs, templates                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AgentiQ Cartridge + Codex                                      │
│  Role: proprietary platform operations and governance zone      │
│  Lead Aigent: Aigent Z                                          │
│  Assets: Registry Ingestion Factory, Registry ops,             │
│          orchestration logic, private workflows, policies,      │
│          internal platform intelligence                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  metaMe Cartridge + Codex                                       │
│  Role: personal sovereignty, Runtime, Studio, progression zone  │
│  Lead Aigent: metaMe                                            │
│  Assets: Runtime and Studio alpha surfaces, experience model,   │
│          matrix, ladder, goals, strategy,                       │
│          next-best-pathway logic, PCS progression guidance      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  KNYT Cartridge + Codex                                         │
│  Role: first live world, signal economy, PCS proving ground,    │
│        contained tokenized pilot economy                        │
│  Lead Aigent: Kn0w1                                             │
│  Assets: participation services, lore/narrative context,        │
│          signal layer, remix/contribution proving ground,       │
│          $KNYT reward logic, KNYT-side PCS cues                 │
└─────────────────────────────────────────────────────────────────┘
```

Cross-cutting Aigent: **Marketa** — launch, growth, activation, onboarding, commercial framing, ecosystem storytelling.

---

## Aigent role map

| Aigent | Home cartridge | Core responsibility | Escalates to |
|--------|---------------|---------------------|-------------|
| Aigent C | AgentiQ OS | Builder onboarding, contribution guidance | Aigent Z |
| Aigent Z | AgentiQ | Platform governance, orchestration, routing | metaMe Guardian |
| metaMe | metaMe | Sovereignty guidance, experience progression | (sovereign — no escalation) |
| Kn0w1 | KNYT | In-world guidance, participation, $KNYT economy | Aigent Z or metaMe |
| Marketa | Cross-cutting | Activation, launch, growth, commercial narrative | Aigent Z |

### Handoff chain

```
Marketa opens the door
  → Kn0w1 runs the KNYT world
    → metaMe aligns the user's sovereignty path
      → Aigent C receives emerging builders
        → Aigent Z governs the platform
```

### Routing priority

1. metaMe Guardian (policy veto — sovereign authority)
2. Active cartridge lead Aigent
3. Aigent Z (system orchestrator)
4. Aigent C (default handler)

---

## Economic model

### Core rail: QriptoCent (Q¢)

QriptoCent is the base transaction and operational rail of the AgentiQ OS and platform layer.

Use for: pricing, settlement, metering, operational logic, base ecosystem economics.

Technical implementation: `qc_balances` table, DVN (Digital Value Network) transaction flow, `SmartWalletDrawer` Q¢ path.

### Cartridge-contained economy: $KNYT

$KNYT is a local cartridge-contained economy inside the KNYT Cartridge.

Use for: participation rewards, contribution rewards, local treasury dynamics, contained PCS economics experimentation.

Technical implementation: `app/types/knyt.ts` (KnytBalance, KnytPricing), `app/api/codex/knyt/*`, `supabase/migrations/20260329*_knyt_*`.

### The split

| | QriptoCent (Q¢) | $KNYT |
|--|----------------|-------|
| Scope | Platform-wide base rail | KNYT cartridge only |
| Purpose | Operations, pricing, settlement | Participation rewards, local economy |
| Transferable | Yes, across platform | Contained within KNYT |
| Experimental | No — production rail | Yes — PCS economics proving ground |

This split allows live experimentation with PCS economics without prematurely locking ecosystem-wide tokenomics.

---

## Progressive Creative Sovereignty (PCS)

PCS is the ascension logic of the ecosystem. It describes the path by which users become upstream contributors.

### Stage ladder

```
participant → community → correspondent → operator → creator → upstream contributor
```

### Runtime truth

metaMe is the governed home of the user's goals, matrix, ladder, strategy, and next-best-pathway logic.

### Proving ground

KNYT is the PCS proving ground for the first three stages (participant → community → correspondent). Signal and participation in KNYT directly informs the broader PCS pathway managed by metaMe.

---

## Flywheel

```
1. Builder packages contribution in AgentiQ OS (SDK + packaging standards)
2. Submission enters Registry Ingestion Factory (intake → validation → trust scoring)
3. Accepted supply enters Registry (publication, trust band, discoverability)
4. Supply is composed in Studio (ComposerStudio + registry mapping)
5. Experience is delivered in metaMe Runtime (SmartTriad + CodexPanelDynamic)
6. User enters KNYT (Kn0w1-guided world)
7. User participates: votes, likes, sparks, remixes, contributes
8. Participation generates downstream signal (knyt.vote, knyt.remix, etc.)
9. PCS progression is visible (metaMe: goals, ladder, next-best-step)
10. Actions rewarded with $KNYT (contained cartridge economy)
11. Signal informs future supply curation (feeds back into step 1)
```

---

## Delivery model

### Delivery team

| Partner | Role |
|---------|------|
| Product owner | Scope control, approvals, final decisions, sequencing |
| Claude | Primary packaging and implementation partner |
| Codex | Primary integration and stitching partner |
| Lovable | Thin-client/shell support (metaMe Runtime, Qriptopian) |
| ChatGPT | Architecture, specs, workbacks, messaging, review/QA |

### Process model

```
Product defines → delivery team builds → internal Aigents operationalize
```

---

## Acceptance gates (alpha)

| Gate | Name | Criterion |
|------|------|-----------|
| 1 | Structural coherence | All four cartridges/codices exist as real homes with scoped assets |
| 2 | Builder coherence | A builder can understand what AgentiQ OS is, what to build, how to submit |
| 3 | Governance coherence | Contributions visibly move through governed intake |
| 4 | Production coherence | Accepted supply reaches Studio and Runtime |
| 5 | Sovereignty coherence | metaMe clearly governs goals, ladder, strategy, next-best-step |
| 6 | KNYT coherence | KNYT feels like a real world with participation and contained economics |
| 7 | Economic coherence | Q¢ is clearly the base rail; $KNYT is clearly the local KNYT economy |
| 8 | Flywheel coherence | The full closed loop is understandable and demonstrable |

---

## Out of scope for alpha

- Full trust score system
- Full risk/value research layer
- Enterprise governance suite
- Generalized marketplace maturity
- Finalized ecosystem-wide fair-launch tokenomics

---

## Key codebase references

| Concern | Location |
|---------|----------|
| SDK (AgentiQ OS public API) | `packages/agentiq-sdk/` |
| Registry Ingestion Factory | `services/registry/`, `types/registryIngestion.ts` |
| Cartridge/Codex config model | `types/codex.ts`, `data/codex-configs.ts` |
| Studio composition | `components/composer/`, `services/composer/` |
| Runtime delivery | `app/components/content/SmartTriadSurfaces.tsx` |
| Experience model | `supabase/migrations/20260402000000_experience_model_journey_state.sql` |
| KNYT signal economy | `app/api/codex/knyt/`, `app/types/knyt.ts` |
| Aigent charters | `.claude/agents/` |
| Agent harness specs | `docs/agent-harness/` |

---

## Related documents

- `docs/alpha/asset-placement-map.md` — canonical file-to-cartridge mapping
- `docs/alpha/build-plan.md` — full implementation plan with gate-by-gate status
- `docs/agent-harness/metaproof-core.md` — role hierarchy and NBE contract
- `docs/agent-harness/aigent-z-aigent-c-contract.md` — routing and handoff rules
- `docs/agent-harness/journey-state-schema.md` — JourneyState and ExperienceModel interfaces
- `docs/agent-harness/studio-artifact-schema.md` — StudioArtifact and Codex↔Studio sync
