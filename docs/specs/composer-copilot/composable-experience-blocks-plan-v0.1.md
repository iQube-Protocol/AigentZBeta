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

### Phase 4 Third Implementation Slice

The next concrete Phase `4` slice should be:

1. resolve explicit bundle sequencing state from the active ExperienceQube
2. attach completed/active/next block state to bundle-aware packets
3. render bundle progress in the Experience viewer so composition becomes operational, not just descriptive
4. keep bundle execution packet-driven before introducing new template/customizer branches

Status:

- complete
- bundle-aware packets now carry completed/active/next block sequencing state
- skill-backed experiences now show bundle progress alongside article context and next actions

### Phase 4 Planned Follow-on

### Phase 4 Fourth Implementation Slice

The next concrete Phase `4` slice should be:

1. make bundle preset application drive Customizer entry, not just metadata persistence
2. resolve the active bundle block into a preferred template step
3. open the active ExperienceQube on that step when a bundle is applied
4. show a bundle progress/jump control inside Customizer so the user can move intentionally between blocks

Status:

- complete
- applying `Image + Article` or `Video + Article` now opens the active ExperienceQube into Customizer on the preferred bundle step
- Customizer now shows active bundle progress and can jump to the current bundle block directly

### Phase 4 Fifth Implementation Slice

The next concrete Phase `4` slice should be:

1. make `Article Draft` a first-class editable block inside the existing Customizer/resources flow
2. persist article draft title, prompt, and scaffold state into session data as well as ExperienceQube config/metadata
3. let packet assembly consume those persisted article fields directly
4. keep the flow additive so bundle-aware copy editing works without introducing new template branches yet

Status:

- complete
- the editable generation panel now supports bundle-aware article draft editing
- article title, prompt, scaffold outputs, and takeaway count now persist through session save and ExperienceQube update paths
- packet/runtime bundle briefs now consume persisted article-draft fields instead of relying only on fallback metadata

### Phase 4 Sixth Implementation Slice

The next concrete Phase `4` slice should be:

1. turn the article block into an operational draft-review surface rather than only an input form
2. derive a structured draft artifact from the saved article block inputs
3. persist that artifact with the ExperienceQube so packet/runtime can reuse it
4. keep the first pass deterministic until dedicated copy-generation adapters are introduced

Status:

- complete
- Customizer now renders a bundle-aware article draft review surface with deck, opening, sections, takeaways, glossary, and next action
- the generated article draft artifact now persists in `configuration.article_draft.generated`
- packet/runtime bundle briefs now surface the same generated draft artifact for review outside Customizer

### Phase 4-A Bundle Authoring

The bundled Phase `4-A` authoring drop should include:

1. dedicated bundle-template identity for:
   - `Image + Article`
   - `Video + Article`
2. an explicit bundle block status model:
   - `not_started`
   - `in_progress`
   - `ready_for_review`
   - `accepted`
3. a bundle-aware Customizer shell with a block rail instead of only a banner
4. article-block review actions:
   - accept
   - refine
   - regenerate

Status:

- complete
- bundle presets now carry dedicated bundle-template identity into ExperienceQube state
- bundle sequencing now resolves explicit block statuses rather than only inferred completion
- Customizer now renders a block rail / authoring shell for active bundles
- article review controls now support accept, refine, and regenerate transitions

### Phase 4-B Bundle Entry + Handoff

The next concrete Phase `4` slice should be:

1. surface bundle templates directly in the `Template` tab instead of only under `Resources`
2. let the active bundle block declare which underlying template flow should own that block
3. allow Customizer to hand off into that target flow when the current template does not support the active block directly
4. keep the handoff scoped to the active ExperienceQube so bundle editing remains continuous rather than spawning disconnected drafts

Status:

- complete
- `Template` now surfaces `Image + Article` and `Video + Article` bundle authoring entries directly
- bundle-aware Customizer now resolves the owning flow template for the active block
- when the active block belongs to a different template, Customizer can open the correct flow while preserving the active ExperienceQube edit session

### Phase 4-C Bundle Block Controls

The next concrete Phase `4` slice should be:

1. extend bundle block controls to image, video, and deployment blocks (not just article draft)
2. make block status transitions explicit for media + deployment
3. ensure each active block can reopen its owning flow for refinement

Status:

- complete
- image/video/deployment blocks now expose explicit `Continue`/`Mark Locked`/`Review Deployment` controls
- bundle block status updates persist through the same block-status contract
- media and deployment blocks can reopen their owning flow without losing the active ExperienceQube context

The next broader Phase `4` work should include:

1. dedicated bundle templates for:
   - `Image + Article`
   - `Video + Article`
   - later multi-block `Image + Video + Copy + Deploy`
2. customizer flows that treat bundles as first-class compositions rather than single-block experiences
3. block-aware editing handoff so the user can move intentionally between media, copy, and deployment steps
4. packet/runtime alignment once bundle template and customizer flows are stable

### Phase 4-D Bundle Article Draft Generation

The next concrete Phase `4` slice should be:

1. add a dedicated server-side article draft generation API (`/api/composer/article-draft`)
2. generate structured article drafts from bundle inputs via LLM (title, deck, opening, sections, takeaways, glossary, next action)
3. surface the generated draft in the Customizer review surface
4. fix runtime article preview to consume the generated draft correctly

Status:

- complete
- `/api/composer/article-draft` now generates structured article drafts using the bundle's article title, prompt, codex context, and persona context
- deterministic fallback artifact construction is in place for cases where LLM generation is unavailable
- Customizer draft review surface now consumes LLM-generated output
- runtime article preview flow fixed to render the persisted draft artifact correctly

### Phase 4-E Bundle Output Persistence + Runtime Article Flow

The next concrete Phase `4` slice should be:

1. persist accepted bundle block outputs (article draft artifact, block status) into ExperienceQube configuration
2. ensure packet assembly reads persisted article-draft outputs rather than re-deriving from raw inputs
3. polish the runtime bundle article presentation so it reads cleanly as a runtime surface, not a Studio form
4. align bundle action labels and delivery profile across runtime and Studio

Status:

- complete
- accepted bundle block outputs are now persisted via `experienceBundlePresets` service and reflected in the ExperienceQube packet
- packet route now reads persisted `article_draft.generated` and `article_draft.outputs` directly
- runtime bundle presentation polished: article structure, section rendering, takeaways, and next-action are rendered as a staged surface
- bundle action labels and `runtimeDeliveryProfile` aligned between Studio and runtime client
- bundle article preview flow and article patch typing fixed

### Phase 4-F Runtime Article Delivery

The next concrete Phase `4` slice should be:

1. carry article draft data forward into runtime launch payloads via `runtimeProjectionShared`
2. render article companions alongside skill-backed image/video experiences in the Experience viewer
3. add a full runtime article customization surface so end users can read and interact with bundle articles inside the runtime
4. ensure runtime customization null handling is safe when article fields are absent

Status:

- complete
- `runtimeProjectionShared` now projects article draft fields into runtime launch payloads
- Experience viewer (`ExperienceLiquidRenderer`) now renders article companion panels on skill experiences when a bundle article is present
- `MetaMeRuntimeClient` now includes a full article customization surface (article title, deck, sections, takeaways, glossary, next action) rendered within the runtime shell
- null handling hardened for runtime customization paths where article config is absent
- media generation provider defaults to OpenAI when no explicit provider is configured

### Phase 4-G Image Bundle Generation

The next concrete Phase `4` slice should be:

1. add image generation as a first-class bundle output for `image_article_bundle` experiences
2. generate portrait and landscape image variants from bundle image-generation config at the right point in the lifecycle
3. persist generated image assets against the ExperienceQube via `persistGeneratedAssetsForExperience`
4. trigger image generation on session completion rather than on preset apply, so prompts reflect the final authored state

Status:

- complete
- `requestImageBundleArtifacts` generates portrait and landscape image variants using the bundle's `image_generation` config (provider, portrait prompt, landscape prompt)
- image generation is triggered on session completion (not preset apply) so the prompts reflect the fully authored experience
- generated image assets are persisted against the ExperienceQube and the refreshed experience is set as the active completed state
- bundle preset image config typing and bundled image response typing are both correct

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

- Phase 4 through 4-G is now complete
- the full `Image + Article` bundle golden path is operational:
  - bundle template identity and block status model in place
  - Customizer authoring shell with block rail
  - article draft generation, review, accept/refine/regenerate
  - article draft persisted and consumed by packet and runtime
  - article rendered in runtime as a first-class customization surface
  - image generation triggered on completion with portrait/landscape variants
  - generated image assets persisted against the ExperienceQube
- the `Video + Article` bundle path is structurally aligned but image generation is scoped to image bundles only
- current work is refinement of the `image_article_bundle` golden path, not new phase scope
