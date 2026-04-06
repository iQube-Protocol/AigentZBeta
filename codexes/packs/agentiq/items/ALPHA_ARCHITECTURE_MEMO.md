# AgentiQ Alpha — Architecture Memo

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

> Full detail: `docs/alpha/architecture-memo.md`  
> This is the codex-surfaced summary for stakeholder reference.

---

## Canonical launch line

> This alpha does not just release an OS. It reveals the first complete governed loop of the AgentiQ ecosystem — from open contribution, to governed intake, to composed experience, to live participation, to PCS-driven progression, to contained economic reward, and back into future supply.

---

## Four-cartridge topology

```
AgentiQ OS Cartridge
  Role: public upstream build zone
  Lead: Aigent C
  Assets: SDK, packaging standards, contribution guides, submission path

AgentiQ Cartridge
  Role: proprietary platform governance
  Lead: Aigent Z
  Assets: Registry Ingestion Factory, Registry, orchestration, private policies

metaMe Cartridge
  Role: sovereignty, Runtime, Studio, progression
  Lead: metaMe
  Assets: experience model, matrix, ladder, goals, NBE logic, PCS path

KNYT Cartridge
  Role: first live world, signal economy, PCS proving ground
  Lead: Kn0w1
  Assets: participation services, lore, $KNYT reward logic, remix lineage
```

---

## Aigent role map

| Aigent | Home | Responsibility | Escalates to |
|--------|------|---------------|-------------|
| Aigent C | AgentiQ OS | Builder onboarding, contribution guidance | Aigent Z |
| Aigent Z | AgentiQ | Platform governance, routing, orchestration | metaMe Guardian |
| metaMe | metaMe | Sovereignty, experience progression | Sovereign — no escalation |
| Kn0w1 | KNYT | In-world guidance, $KNYT economy | Aigent Z or metaMe |
| Marketa | Cross-cutting | Activation, launch, growth, narrative | Aigent Z |

### Handoff chain

```
Marketa opens the door
  → Kn0w1 runs the KNYT world
    → metaMe aligns the user's sovereignty path
      → Aigent C receives emerging builders
        → Aigent Z governs the platform
```

---

## Economic split

| | QriptoCent (Q¢) | $KNYT |
|--|----------------|-------|
| Scope | Platform-wide base rail | KNYT cartridge only |
| Purpose | Operations, pricing, settlement | Participation rewards, local economy |
| Experimental | No — production rail | Yes — PCS economics proving ground |

---

## PCS ladder

```
participant → community → correspondent → operator → creator → upstream contributor
```

- KNYT is the proving ground for stages 1–3
- metaMe governs the full ladder and next-best-pathway logic

---

## Flywheel

```
1. Builder contributes via AgentiQ OS
2. Submission enters Factory (intake → validate → trust score)
3. Accepted supply enters Registry
4. Supply composed in Studio
5. Experience delivered in metaMe Runtime
6. User enters KNYT
7. User participates (votes, likes, sparks, remixes)
8. Signal generated
9. PCS progression visible
10. $KNYT reward distributed
11. Signal informs future supply
12. → Back to step 1
```

---

## Key codebase references

| Concern | Location |
|---------|----------|
| SDK | `packages/agentiq-sdk/` |
| Factory | `services/registry/`, `types/registryIngestion.ts` |
| Codex config | `types/codex.ts`, `data/codex-configs.ts` |
| Studio | `components/composer/`, `services/composer/` |
| Runtime | `app/components/content/SmartTriadSurfaces.tsx` |
| Experience model | migration `20260402000000_experience_model_journey_state.sql` |
| KNYT economy | `app/api/codex/knyt/`, `app/types/knyt.ts` |
| Aigent charters | `.claude/agents/` |
