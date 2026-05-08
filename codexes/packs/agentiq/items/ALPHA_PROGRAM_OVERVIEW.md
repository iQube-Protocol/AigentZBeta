# AgentiQ Alpha Program — Overview

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-05-08 (Phase 1 IAM spine landed)

> **2026-05-08 milestone — Identity & Access Management spine LIVE on dev.** The foundation that every alpha workstream depends on (persona-aware ownership, admin-gated tabs, cross-cartridge identity propagation, byte-level content enforcement) is now shipped, validated 25/25 unit + 4/4 live, and load-bearing for the four content-delivery proxies (`ACCESS_SPINE_ENFORCE=1`). The protocol's four-layer sovereignty model (DIDQube + DVN + blakQube + Auto-Drive) and the runtime spine that delivers it (`getActivePersona` → `personaSessionToken` → `evaluateAccess`) are stable. Detailed plan + Phase 2–5 sequencing in `updates/2026-05-05_unified-identity-content-access-foundation-plan.md`.

---

## What this is

The AgentiQ Alpha Closed-Loop Launch Program is the first market-facing demonstration of the complete AgentiQ ecosystem flywheel. It is not a standalone OS release. It is the first live proof that the full loop works:

> Build in AgentiQ OS → Ingest through the Registry Ingestion Factory → Organize in the Registry → Compose in Studio → Deliver in metaMe Runtime → Generate signal in KNYT → Progress through PCS → Reward inside KNYT → Feed insight back into future supply

---

## Mission

Launch a coherent, governed, end-to-end alpha by packaging and aligning existing assets. The primary task is alignment, packaging, integration, and demo coherence — not greenfield invention.

---

## The four cartridges

| Cartridge | Role | Lead Aigent |
|-----------|------|-------------|
| AgentiQ OS | Public upstream build and contributor zone | Aigent C |
| AgentiQ | Proprietary platform operations and governance | Aigent Z |
| metaMe | Personal sovereignty, Runtime, Studio, progression | metaMe |
| KNYT | First live world, signal economy, PCS proving ground | Kn0w1 |

Cross-cutting Aigent: **Marketa** — activation, launch, growth, ecosystem storytelling.

---

## Economic model

**QriptoCent (Q¢)** is the base platform rail — used for pricing, settlement, metering, and operational logic across the whole ecosystem.

**$KNYT** is the KNYT cartridge-local economy — used for participation rewards, contribution rewards, local treasury, and contained PCS economics experimentation.

These are distinct and must not be conflated.

---

## Acceptance gates

| Gate | What it proves |
|------|---------------|
| 1 — Structural coherence | All four cartridges exist as real homes with scoped assets |
| 2 — Builder coherence | A builder can enter AgentiQ OS, understand what to build, and submit |
| 3 — Governance coherence | Contributions visibly move through governed intake |
| 4 — Production coherence | Accepted supply reaches Studio and Runtime |
| 5 — Sovereignty coherence | metaMe governs goals, ladder, strategy, next-best-step |
| 6 — KNYT coherence | KNYT has real participation, signal, and contained rewards |
| 7 — Economic coherence | Q¢ and $KNYT are clearly distinguished |
| 8 — Flywheel coherence | The full loop is understandable and demonstrable |

---

## What is in scope

- AgentiQ OS public alpha package
- Registry Ingestion Factory intake path
- Registry visibility of accepted supply
- Studio composition proof
- metaMe Runtime proof
- KNYT participation signal package
- PCS ascent path visibility
- QriptoCent base rail framing
- $KNYT contained reward loop
- End-to-end golden-path demo
- Cartridge/codex boundary implementation
- In-stack onboarding

## What is out of scope

- Full trust score system
- Full risk/value research layer
- Enterprise governance suite
- Generalized marketplace maturity
- Finalized ecosystem-wide fair-launch tokenomics

---

## Related documents

- See **Architecture Memo** tab for topology, flywheel, and Aigent role map
- See **Build Plan** tab for gate-by-gate status and workstream assignments
- See **Asset Map** tab for canonical file-to-cartridge mapping
- See `docs/alpha/` for full detail on all alpha artifacts
