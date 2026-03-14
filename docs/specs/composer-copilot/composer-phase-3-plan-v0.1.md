# Composer Phase 3 Plan v0.1

## Purpose

Carry the current Composer alpha from Phase 2 persistence and CRM readiness into a quasi production-ready deployment and orchestration layer.

Phase 3 should answer:

- how an ExperienceQube gets deployed as a standalone block
- how deployment targets are modeled consistently
- how trust, cost, and readiness influence deployment decisions
- how runtime, MCP, and Discord delivery share one contract

## 1. Phase 3 Goal

Phase 3 makes the current image and video golden paths deployable.

This is not yet full multi-block composition.

It is the stage where the current blocks become:

- deployment-aware
- proof-aware
- target-aware
- trust-and-cost-aware

## 2. Core Workstreams

### A. Deployment Block

Create a standalone deployment function/block that can be reused by:

- image experiences
- video experiences
- article experiences
- later multi-block composed experiences

Minimum contract:

- source `experienceId`
- `personaId`
- deployment target
- dispatch mode
- delivery payload
- status / errors
- receipt and lifecycle hook integration

### B. Deployment Targets

Phase 3 deployment targets should start with:

- `studio_preview`
- `runtime_launch`
- `mcp_app`
- `discord_mcp`

Each target should carry:

- label
- target type
- provider or channel requirements
- readiness state
- resulting publish/launch URL if available

### C. Trust-and-Cost Routing

The deployment layer should be able to reason about:

- trust posture
- provider availability
- inferred marginal cost
- target suitability

Initial Phase 3 requirement:

- surface routing inputs
- keep provider binding strict for generation
- prepare a routing envelope for later ClawRouter-style selection

### D. Proof and Lifecycle

Deployment should update:

- ExperienceQube lifecycle summary
- persona media delivery targets
- CRM contribution hooks
- deployment receipts or dispatch metadata where available

## 3. First Implementation Slice

The first concrete Phase 3 implementation should be:

1. define a shared deployment block/service
2. route Studio provider dispatch through that block
3. normalize deployment target metadata
4. preserve deployment results in a consistent response shape
5. add a trust-and-cost routing envelope that scores targets by readiness, trust, and cost posture

## 4. Shared Deployment Contract

### Input

- `experienceId`
- `personaId`
- `tenantId`
- `target`
- `mode`
- `message`
- `channelId`
- `inviteUrl`
- `publishUrl`
- `thumbnailUrl`
- `titleOverride`
- `campaignId`

### Output

- `ok`
- `target`
- `mode`
- `provider`
- `providerDispatch`
- `publishUrl`
- `launchUrl`
- `status`
- `warnings`
- `errors`

## 4.1 Routing Envelope

The first routing envelope is not full automatic orchestration.

It should:

- score deployment candidates
- explain why a target is recommended
- surface trust and cost posture in simple terms
- show blockers before live dispatch

Initial candidates:

- `studio_preview`
- `runtime_launch`
- `mcp_app`
- `discord_mcp`

## 5. Phase 3 Exit Criteria

Phase 3 is complete enough when:

- deployment is a standalone reusable unit
- runtime / MCP / Discord deployment share one contract
- deployment state is visible in Studio
- lifecycle and CRM hooks reflect deployment actions
- trust-and-cost routing inputs are modeled and ready for stricter orchestration

## 6. Follow-on Phase

Once Phase 3 is in place, the next step is:

- extract image, video, article, and deployment into production-grade composable blocks
- then assemble richer multi-block experiences from those finished units
