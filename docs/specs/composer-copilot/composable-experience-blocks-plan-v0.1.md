# Composable Experience Blocks Plan v0.1

## Purpose

Define how the current Composer golden paths evolve from single-purpose demos into production-grade composable units that can be deployed independently or bundled together into richer experiences.

The core principle is:

**First make one brick truly production-grade. Then compose the wall.**

## 1. Strategic Direction

The long-term objective is not just to ship isolated image, video, or article experiences.

It is to create a library of production-grade experience blocks that can be:

- designed in Studio
- reviewed through Parity
- persisted with receipts and ownership
- deployed independently
- combined into larger experiences like lego bricks

These blocks should be trustworthy, composable, and low-risk because each one has already reached a production-ready maturity level before composition.

## 2. Why finish the current golden path first

The current image and video golden paths should be carried through Phase 3 before broader composition work begins.

Reason:

- composition multiplies instability if the individual blocks are not yet stable
- deployment logic becomes much cleaner when each block already has a clear input/output contract
- ownership, receipts, and runtime persistence should be solved once per block, not improvised inside larger bundles

So the recommended sequence is:

1. complete the current image and video golden paths through Phase 3
2. extract them into production-grade composable blocks
3. compose those blocks into richer multi-step experiences

## 3. Candidate Block Library

### A. Image Generation Block

Purpose:

- generate orientation-aware hero/supporting imagery

Minimum production-ready requirements:

- creator-authored base prompt
- end-user-editable prompt
- portrait and landscape variants
- provider binding
- asset persistence
- receipt linkage
- persona/account ownership
- runtime preview and regeneration loop

### B. Video Generation Block

Purpose:

- generate short-form cinematic or editorial runtime video

Minimum production-ready requirements:

- creator-authored base prompt
- end-user-editable prompt
- provider binding
- stable generation status handling
- playable persisted output
- receipt linkage
- persona/account ownership
- runtime preview and regeneration loop

### C. Article Draft Block

Purpose:

- generate or structure editable article content tied to image/video assets

Minimum production-ready requirements:

- article title
- article prompt
- editable body scaffold
- linkage to generated image/video assets
- receipt/provenance metadata where relevant
- runtime reading surface

### D. Deployment Block

Purpose:

- deploy an ExperienceQube into one or more channels

Minimum production-ready requirements:

- source experience reference
- target channel selection
- policy validation
- deployment status
- receipt capture
- retry/remediation path

This block should remain standalone and reusable.
It should not be embedded ad hoc inside image or video generation logic.

## 4. Example Compound Experiences

### Image + Article

- generate hero/supporting imagery
- generate article structure
- deploy to runtime or Qriptopian

### Video + Article

- generate short cinematic trailer
- generate supporting editorial article
- deploy to runtime or Discord via MCP

### Image + Video + Article + Deploy

- generate visual package
- generate article/copy package
- review parity and receipts
- deploy to runtime, MCP, Discord, or multiple targets

## 5. Phase Mapping

### Phase 1

Status:

- alpha golden path working in bare essence

Includes:

- image path
- video path
- provider-aware generation
- ExperienceQube creation
- runtime preview

### Phase 2

Goal:

- make the current blocks persistent, owned, editable, and context-aware

Includes:

- identity foundation
- creator persona binding
- generated asset persistence
- receipt linkage
- editable prompts and experience names
- codex-aware specialization
- inference economics visibility
- strict provider binding for generation

### Phase 3

Goal:

- make the current blocks quasi production-ready and deployable

Includes:

- deployment block
- runtime deployment
- MCP deployment
- CRM/lifecycle hooks
- trust-and-cost routing
- stronger proof/readiness handling

### Phase 4

Goal:

- assemble compound experiences from production-grade blocks

Includes:

- multi-block composition
- shared state between blocks
- orchestration sequencing
- reusable block contracts

Current activation note:

- Phase `4` should now be treated as the active broader phase after pausing `3D` adapter expansion
- the current single-block image, video, article, and deployment paths should be treated as foundation blocks
- unresolved late-`3C` runtime/launcher/Discord video issues remain backlog, not Phase `4` blockers

### Phase 4 First Implementation Slice

The first concrete Phase `4` slice should be:

1. define a shared `ExperienceBlockManifest`
2. infer current ExperienceQubes into block bundles:
   - image generation
   - video generation
   - article draft
   - deployment
3. surface composition readiness and sequencing in Studio
4. use that manifest as the starting contract for future bundled `Make` flows

Status:

- complete
- Studio now infers block readiness for the active ExperienceQube
- Studio also supports first-pass `Make` bundle preset application for:
  - `Image + Article`
  - `Video + Article`
- this pass persists composition intent into ExperienceQube metadata/configuration without yet changing packet or runtime behavior

### Phase 4 Second Implementation Slice

The next concrete Phase `4` slice should be:

1. read `composition_bundle` from the active ExperienceQube during packet assembly
2. attach bundle-aware article context, sequencing, and next actions to image/video packets
3. render a lightweight bundle brief above skill-backed image/video experiences
4. keep launcher/runtime behavior unchanged until packet-driven bundle behavior is stable

Status:

- complete
- `Image + Article` and `Video + Article` bundle presets now influence packet assembly
- skill-backed experiences now render bundle-aware sequencing and article context in the Experience viewer

## 6. Block Contract Model

Each production-grade block should eventually expose a common contract:

### Inputs

- creator prompt
- end-user prompt override
- provider or skill binding
- active codex context
- persona/account context
- deployment/policy context

### Outputs

- generated artifact refs
- receipt refs
- status
- errors/warnings
- cost metadata
- deployment readiness

### Ownership

- creator persona
- owning experience id
- owning account/runtime scope

### Review

- parity relevance
- policy relevance
- receipt availability

## 7. Immediate Next Recommendation

Do not begin broad block composition yet.

Instead:

1. complete the current image and video blocks through Phase 2 and Phase 3
2. define the deployment block as a standalone reusable unit
3. then extract the common block contract from those completed implementations

That is the lowest-risk and highest-leverage path.

Updated status:

- this recommendation has now effectively been satisfied far enough to proceed
- deployment is now modeled as a standalone reusable unit
- the next step is to move from single-block proof paths into:
  - bundled image/video/copy creation
  - shared block state
  - codex-aware block sequencing
