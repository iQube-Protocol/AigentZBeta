# Composer Phase 3 Plan v0.1

## Purpose

Carry the current Composer alpha from Phase 2 persistence and CRM readiness into a quasi production-ready deployment and orchestration layer.

Phase 3 should answer:

- how an ExperienceQube gets deployed as a standalone block
- how deployment targets are modeled consistently
- how artifact selection is separated from delivery and transport
- how trust, cost, and readiness influence deployment decisions
- how Studio, runtime, thin client, MCP, Discord, and future adapters share one contract

## 1. Phase 3 Goal

Phase 3 makes the current image and video golden paths deployable.

This is not yet full multi-block composition.

It is the stage where the current blocks become:

- deployment-aware
- proof-aware
- target-aware
- trust-and-cost-aware
- artifact-aware
- adapter-aware

## 1.1 Universal Deployment Manager

Phase 3 should now be treated as a universal deployment manager, not a Discord-first deployment layer.

The core model should be:

1. `artifact selection`
- what is being deployed

2. `delivery mode`
- how that artifact should be consumed

3. `destination adapter`
- where and through what transport it is being delivered

The deployment manager should therefore support the same deployment contract across:

- Studio preview
- launcher / experience viewer
- metaMe runtime
- metaMe runtime thin client
- MCP app dispatch
- Discord
- later: XMTP
- later: AA API

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
- artifact selection
- delivery mode
- dispatch mode
- delivery payload
- status / errors
- receipt and lifecycle hook integration

### B. Artifact Resolution

Deployment should choose one explicit artifact instead of implicitly reusing whatever preview image happens to be available.

Artifact classes should include:

- `generated_image`
- `generated_video`
- `experience_card`
- `runtime_experience`
- `thin_client_runtime`
- `context_image` as last-resort fallback only

The system should always know:

- which artifact was selected
- why it was selected
- what URL was actually deployed
- what preview media was used in the deployment proof

### C. Delivery Modes

Delivery mode is distinct from destination target.

Initial modes should include:

- `asset_link`
- `inline_asset`
- `inline_experience`
- `browser_launch`
- `thin_client_handoff`

These should work across multiple destinations instead of being hardcoded to one messenger.

### D. Destination Adapters

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

Initial delivery variants currently modeled in code map onto the broader delivery-mode system and should evolve toward it:

- `asset_link`
- `discord_asset_inline`
- `discord_experience_inline`
- `runtime_thin_client`

Later adapters should include:

- `xmtp`
- `aa_api`
- other transport-specific adapters

### E. Trust-and-Cost Routing

The deployment layer should be able to reason about:

- trust posture
- provider availability
- inferred marginal cost
- target suitability

Initial Phase 3 requirement:

- surface routing inputs
- keep provider binding strict for generation
- prepare a routing envelope for later ClawRouter-style selection

### F. Proof and Lifecycle

Deployment should update:

- ExperienceQube lifecycle summary
- persona media delivery targets
- CRM contribution hooks
- deployment receipts or dispatch metadata where available
- deployment artifact proof

## 2.1 Universal Deployment Contract

The generic deployment manager should eventually persist:

- `artifact_type`
- `artifact_url`
- `preview_media_url`
- `launch_url`
- `delivery_mode`
- `destination_type`
- `destination_adapter`
- `transport_tool`
- `variant`
- `status`
- `warnings`
- `errors`
- `receipt/proof`

## 3. First Implementation Slice

The first concrete Phase 3 implementation should be:

1. define a shared deployment block/service
2. route Studio provider dispatch through that block
3. normalize deployment target metadata
4. preserve deployment results in a consistent response shape
5. add a trust-and-cost routing envelope that scores targets by readiness, trust, and cost posture
6. separate artifact resolution from deployment target selection

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

## 4.2 Deployment Validation Matrix

Each delivery pattern should be validated against the same matrix:

1. `generated image -> asset link`
2. `generated image -> inline asset`
3. `generated image -> runtime thin client`
4. `generated video -> asset link`
5. `generated video -> inline asset`
6. `generated video -> runtime thin client`
7. `experience card -> inline experience`
8. `experience card -> runtime thin client`

For each:

- inspector preview must match the deployed artifact
- deployment proof must record the correct artifact and delivery mode
- destination URL or inline media must match the selected generated asset, not fallback context art

## 4.3 Current Status

### 4.3.1 Completed Enough

- `3A` Deployment state + persistence
- `3B` Trust-cost orchestration
- `3C` Deployment remediation / proof UX foundation

### 4.3.2 Deferred 3C Backlog

The following `3C` items remain open, but are now explicitly deferred so Phase `3D` can proceed without blocking on the same video/runtime loop:

- close the runtime handoff completely for video in:
  - `runtime_launch`
  - `runtime_thin_client`
- close launcher parity for saved video so it mirrors image behavior:
  - load saved video first
  - offer regenerate
- stabilize Discord video delivery at the currently supported level:
  - reliable external/open link
  - true native inline video remains a later adapter-specific task
- complete the remaining deployment validation matrix for:
  - `generated_video -> asset link`
  - `generated_video -> runtime thin client`
  - launcher reuse parity for video

These are now treated as late-`3C` backlog, not as blockers for the next deployment-manager bundle.

## 4.4 Next Bundle: Phase 3D

Phase `3D` is now the active next bundle.

It should focus on universal deployment-manager hardening rather than continuing to loop on the same unresolved video/runtime edge cases.

### 4.4.0 Bundle Structure

Phase `3D` is grouped into two logical bundles:

- `3D-A`: adapter contract + enforcement
- `3D-B`: adapter expansion + proof surfaces

### 4.4.1 Objectives

- strengthen the universal deployment contract across all supported targets
- separate supported behavior from scaffolded behavior more clearly in proof/readiness views
- expand destination-adapter coverage beyond today’s partial runtime/Discord paths
- prepare adapter-grade integrations for:
  - `xmtp`
  - `aa_api`
  - future transport-specific deployment adapters

### 4.4.2 Scope

- adapter capability modeling
- adapter-specific warnings / scaffold markers
- proof normalization across supported and unsupported variants
- stronger destination typing and supported-mode declarations
- cleaner handoff contracts between:
  - Composer
  - runtime
  - thin client
  - messenger adapters

### 4.4.2.1 Current Status

The first `3D` slice is now in progress:

- shared deployment results carry explicit adapter capability state:
  - `supported`
  - `limited`
  - `scaffolded`
- active adapters now declare their supported:
  - targets
  - variants
  - modes
- future adapter stubs now exist for:
  - `aa_api`
  - `xmtp`
- routing/readiness now penalizes partial adapters instead of presenting them as equivalent
- inspector proof and saved deployment proof/history now surface capability summaries and constraints
- active `3D-A` work now also includes:
  - target-aware variant support in the inspector
  - normalized proof fields for:
    - `delivery_mode`
    - `destination_adapter`
  - dispatch-time rejection of unsupported target / variant / mode combinations

### 4.4.2.2 Phase 3D-B Focus

`3D-B` now focuses on:

- adapter catalog / coverage visibility in Studio
- adapter-specific fallback and remediation guidance
- clearer separation between:
  - active adapters
  - planned adapters
- proof surfaces that show not just what was selected, but what the recommended fallback path is when an adapter is limited or scaffolded
- planned-adapter onboarding notes for:
  - `aa_api`
  - `xmtp`

### 4.4.3 Exit Criteria

`3D` is complete enough when:

- destination adapters advertise what they actually support
- unsupported/scaffolded variants are explicit in inspector and proof views
- deployment proof is clean and comparable across targets
- future adapters can be added without changing the core artifact/delivery contract

## 5. Phase 3 Exit Criteria

Phase 3 is complete enough when:

- deployment is a standalone reusable unit
- runtime / MCP / Discord deployment share one contract
- artifact resolution is explicit and reliable
- delivery mode is distinct from destination adapter
- deployment state is visible in Studio
- lifecycle and CRM hooks reflect deployment actions
- trust-and-cost routing inputs are modeled and ready for stricter orchestration

## 5.1 Phase 3 Bundle Sequence

To avoid fragmenting deployment work into too many tiny releases, the remaining Phase 3 work should ship as three correlated bundles:

1. `Phase 3A: Deployment State + Persistence`
- deployment block created
- deployment target readiness modeled
- deployment history persisted on ExperienceQubes

2. `Phase 3B: Trust-Cost Orchestration`
- routing envelope surfaced in inspector, Resources, and Parity
- target suitability explained using readiness, trust, and cost posture
- deployment guidance visible outside the dispatch modal

3. `Phase 3C: Production Deployment UX`
- deployment remediation and retry guidance
- clearer lifecycle proof and deployment receipts
- tighter runtime / MCP / Discord handoff
- quick actions to apply the recommended target or retry the selected target
- deployment proof visible both in inspector and in the main Resources flow

4. `Phase 3D: Universal Deployment Manager`
- shared artifact resolver
- delivery-mode normalization
- destination adapter separation
- validation matrix across Studio, runtime, thin client, and external channels

## 6. Follow-on Phase

Once Phase 3 is in place, the next step is:

- extract image, video, article, and deployment into production-grade composable blocks
- then assemble richer multi-block experiences from those finished units
