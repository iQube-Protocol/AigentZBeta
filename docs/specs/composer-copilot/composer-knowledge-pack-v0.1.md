# Composer Knowledge Pack v0.1

## Purpose

Define the first knowledge pack for `Composer Copilot`.

This is the companion to [composer-system-prompt-v0.1.md](/Users/hal1/CascadeProjects/AigentZBeta/docs/specs/composer-copilot/composer-system-prompt-v0.1.md).

It is designed for an initial in-memory or hardcoded alpha implementation before a full retrieval pipeline exists.

## Design rule

Do not overload the system prompt with catalogs and operational detail.

Put stable reference knowledge here instead.

## Alpha objectives

The knowledge pack should allow Composer Copilot to reason about:

- Studio workflow phases
- template selection
- OpenAI vs Venice for image and video
- image orientation planning
- resource implications
- review/deployment concepts

## Proposed knowledge slices

### 1. Studio process knowledge

Purpose:

- explain what each Studio phase means
- help the copilot move users from one phase to the next

Minimum entries:

- `Intent`
- `Template`
- `Customizer`
- `Resources`
- `Experiences`
- `Preview`
- `Parity Review`
- `Deployment`

### 2. Template knowledge

Purpose:

- describe what each template is best for
- support recommendation and filtering

Initial entries should cover at least the currently visible Studio templates such as:

- `Micro-Episode Capsule`
- `Feature Article Experience`
- `Penny Drops Learning Flow`

Each template entry should include:

- `id`
- `name`
- `summary`
- `bestFor`
- `mediaTypes`
- `timebox`
- `recommendedProviders`
- `customizationFocus`
- `resourceImplications`

### 3. Provider and skill knowledge

Purpose:

- support OpenAI vs Venice comparison for image and video
- preserve room for curated/community distinctions

Initial alpha providers:

- `OpenAI`
- `Venice`

Reserved only:

- `Anthropic`

Each provider entry should include:

- `id`
- `name`
- `supports`
- `strengths`
- `watchouts`
- `costNotes`
- `operationalNotes`
- `orientationSupport`

### 4. Orientation-aware asset knowledge

Purpose:

- help the copilot plan for portrait and landscape outputs

Minimum entries:

- when to recommend both portrait and landscape
- article hero use cases
- capsule/preview use cases
- orientation-specific prompt reminders

### 5. Resource and policy knowledge

Purpose:

- let Composer explain resources in Studio language

Minimum entries:

- what Skills represent
- what resources appear in the `Resources` tab
- how cost stubs should be explained in alpha
- how trust/risk/provenance should be described in plain language

### 6. Review and deployment knowledge

Purpose:

- let Composer discuss parity, surface planning, DVN receipts, and deployment

Minimum entries:

- what `Design Parity` means
- what `Surface Planning` means
- what `DVN Receipts` mean
- what deployment review should cover
- what MCP-backed deployment means at a high level

### 7. Domain augmentation stubs

Purpose:

- allow domain-specific creative guidance later without reshaping the KB model

Initial stubs:

- `Qriptopian`
- `metaKnyts`
- future tenant/domain packs

### 8. Persona and data context stubs

Purpose:

- reserve the structure for later personalization

Initial stubs:

- `personaContext`
- `activeDataQubes`
- `activeContentQubes`

These do not need rich entries yet, but the KB contract should acknowledge them.

## Suggested alpha schema

```ts
type ComposerKnowledgePack = {
  studioPhases: StudioPhaseEntry[];
  templates: TemplateKnowledgeEntry[];
  providers: ProviderKnowledgeEntry[];
  orientationGuidance: OrientationGuidanceEntry[];
  resourceGuidance: ResourceGuidanceEntry[];
  reviewAndDeployment: ReviewKnowledgeEntry[];
  domainStubs: DomainStubEntry[];
  personalizationStubs: PersonalizationStubEntry[];
};
```

## Suggested entry shapes

### Studio phase entry

```ts
type StudioPhaseEntry = {
  phase: string;
  purpose: string;
  questionsToResolve: string[];
  likelyNextPhases: string[];
};
```

### Template entry

```ts
type TemplateKnowledgeEntry = {
  id: string;
  name: string;
  summary: string;
  bestFor: string[];
  mediaTypes: ("image" | "video" | "article" | "mixed")[];
  timebox?: string;
  recommendedProviders: string[];
  customizationFocus: string[];
  resourceImplications: string[];
};
```

### Provider entry

```ts
type ProviderKnowledgeEntry = {
  id: string;
  name: string;
  supports: ("image" | "video")[];
  strengths: string[];
  watchouts: string[];
  costNotes: string[];
  operationalNotes: string[];
  orientationSupport: string[];
};
```

## Alpha seed content

### Studio phases

#### Intent

- purpose: define what the user is trying to build
- questions:
  - what kind of experience is this
  - who is it for
  - what outcome should it achieve

#### Template

- purpose: choose the best starting structure
- questions:
  - which template best matches the intent
  - is the experience image-led, video-led, article-led, or mixed

#### Customizer

- purpose: configure the selected template and generation parameters
- questions:
  - what prompt or assets are needed
  - what provider should be used
  - what fields need first-pass values

#### Resources

- purpose: review skills, resources, provider choices, user data needs, cost stubs, and DesignQube implications

#### Experiences

- purpose: select or create the target ExperienceQube

#### Preview

- purpose: view runtime-facing outputs and structure

#### Parity Review

- purpose: review design parity, surface planning, and receipts

#### Deployment

- purpose: assess readiness and handoff for runtime delivery

### Template seeds

#### Micro-Episode Capsule

- best for:
  - short-form, high-impact experiences
  - image-led and video-led capsules
  - social/shareable runtime experiences
- media types:
  - image
  - video
  - mixed
- recommended providers:
  - OpenAI
  - Venice
- customization focus:
  - generation prompt
  - timebox
  - reward/access framing

#### Feature Article Experience

- best for:
  - article-led experiences
  - hero imagery
  - deep-read or editorial flows
- media types:
  - article
  - image
- recommended providers:
  - OpenAI
  - Venice
- customization focus:
  - article structure
  - portrait/landscape hero assets
  - companion visuals

#### Penny Drops Learning Flow

- best for:
  - tutorial and guided learning experiences
  - image-supported explanations
- media types:
  - article
  - image
  - mixed
- recommended providers:
  - OpenAI
  - Venice
- customization focus:
  - pacing
  - support visuals
  - guidance and reinforcement

### Provider seeds

#### OpenAI

- supports:
  - image
  - video
- strengths:
  - strong general-purpose quality
  - useful for high-impact multimodal generation
- watchouts:
  - video cost and rate limits can affect reliability
- cost notes:
  - video should be treated as high-cost
  - image should still surface future cost awareness
- operational notes:
  - alpha should explain provider constraints plainly
- orientation support:
  - can support portrait and landscape planning in the Composer workflow

#### Venice

- supports:
  - image
  - video
- strengths:
  - useful fallback or primary option when OpenAI video is constrained
  - should be compared directly in Composer recommendations
- watchouts:
  - capability details should be treated as operational KB and updated over time
- cost notes:
  - surface as provider-specific cost posture when available
- operational notes:
  - suitable as a video and image alpha path
- orientation support:
  - should be treated as usable for portrait and landscape planning in alpha

### Orientation guidance seeds

- for Qriptopian article imagery, recommend:
  - one portrait variant
  - one landscape variant
- explain that portrait and landscape may be used in different runtime contexts
- prompt drafting should note framing and composition differences by orientation

### Review and deployment seeds

#### Design Parity

- aligns the designed experience against DIS, CM, and parity expectations

#### Surface Planning

- clarifies which modules and surfaces are being used for the selected device/orientation

#### DVN Receipts

- indicate that key actions and outputs can be tied to proof-ready records

#### Deployment

- should cover whether the experience is ready for MCP-backed or other delivery paths

## Suggested implementation path

### Phase 1

Store this as an in-memory pack, likely in a single module such as:

```text
services/copilot/kb/composerKnowledgePack.ts
```

### Phase 2

Split into slices:

```text
services/copilot/kb/composer/templates.ts
services/copilot/kb/composer/providers.ts
services/copilot/kb/composer/review.ts
services/copilot/kb/composer/domains/qriptopian.ts
services/copilot/kb/composer/domains/metaknyts.ts
services/copilot/kb/composer/economics.ts
```

Add:

- `Qriptopian` base context pack
- `metaKnyts` override pack layered within Qriptopian
- inference economics knowledge:
  - cost posture by provider/skill
  - payment expectations
  - creator-paid vs user-paid execution framing
- ownership/provenance knowledge:
  - creator persona association
  - generated asset storage
  - receipt linkage expectations

### Phase 3

Move toward retrieval-backed storage and tenant/domain overlays.

Add:

- trust-and-cost routing knowledge for ClawRouter-style orchestration
- broader `metaMe` context overlays above Qriptopian/metaKnyts

## Retrieval guidance

When retrieval exists, Composer Copilot should receive:

- the smallest relevant template slice
- the smallest relevant provider slice
- orientation guidance when image planning is active
- review/deployment guidance when parity or deployment is active

It should not receive the full pack on every turn.

## Success criteria

The knowledge pack is successful if Composer Copilot can:

- explain what each Studio phase means
- recommend templates with reasons
- compare OpenAI and Venice meaningfully
- explicitly plan portrait and landscape image variants
- explain resources and future cost placeholders
- discuss parity, surface planning, receipts, and deployment in Studio terms
