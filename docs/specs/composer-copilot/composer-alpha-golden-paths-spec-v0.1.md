# Composer Alpha Golden Paths Spec v0.1

## Objective

Deliver a believable alpha of `Composer Copilot` that demonstrates continuous Studio-native experience design, not just prompt filtering.

## Alpha strategy

Do not start with maximum generality.

Start with two strong golden paths:

1. `Image-led experience design`
2. `Video-led experience design`

The image path should be the primary alpha.
The video path should be the higher-impact secondary path.

## Why image first

Image generation is:

- cheaper
- faster
- easier to demo repeatedly
- less sensitive to rate limits
- highly useful for article and capsule experiences
- a natural place to demonstrate portrait and landscape variants

## Why video still matters

Video generation is:

- high impact
- strategically important
- a strong showcase path

But it is also:

- expensive
- slower
- more fragile operationally

So it should not be the only alpha path.

## Provider model for alpha

Supported for both image and video:

- `OpenAI`
- `Venice`

Reserved and stubbed:

- `Anthropic`

## Golden Path A: Image-led article or capsule

### User story

The user wants to build a Qriptopian article or image-led experience and needs hero imagery or supporting visuals.

### Expected flow

1. User states intent in Composer.
2. Copilot infers article/image-led experience intent.
3. Copilot recommends relevant templates.
4. Copilot explains image-provider options.
5. Copilot recommends first-pass prompts.
6. Copilot explicitly plans:
   - portrait variant
   - landscape variant
7. Copilot injects values into the customizer.
8. Resources reflect chosen provider, assets, and future cost stubs.
9. Preview shows orientation-aware outputs.
10. ExQube is created/selected.
11. Parity/review/deployment path remains available.

### Alpha acceptance criteria

- template recommendation is relevant
- provider recommendation is understandable
- portrait/landscape planning is explicit
- prompts can be injected into Customizer
- selected provider and assets appear in Resources

## Golden Path B: Video-led experience

### User story

The user wants to create a short video-led experience.

### Expected flow

1. User states video intent in Composer.
2. Copilot recommends video-capable templates.
3. Copilot explains OpenAI vs Venice options.
4. Copilot explains curated/community tradeoffs when relevant.
5. Copilot recommends a concise first-pass video prompt.
6. Copilot injects prompt and settings into Customizer.
7. Resources reflect selected skill/provider, trust posture, and future cost stubs.
8. Preview reflects video-led experience structure.
9. ExQube is created/selected.
10. Review covers parity/surface/DVN/deployment implications.

### Alpha acceptance criteria

- correct video template recommendation
- usable provider comparison
- provider constraints surfaced clearly
- prompt guidance is concise and concrete
- handoff into Customizer is real, not merely advisory

## Required alpha capabilities

### 1. Continuous conversation

The copilot must maintain continuity across:

- Intent
- Template
- Customizer
- Resources
- Experiences
- Preview
- Parity Review
- Deployment

### 2. Actionable recommendations

The copilot must do more than explain.
It should be able to:

- set or narrow template choices
- recommend skills/providers
- suggest prompt values
- prefill configuration state
- open the right Studio tab when needed

### 3. Resource explanation

The copilot must explain:

- what skill/provider was selected
- why it was selected
- what trust/risk posture it implies
- what costs are expected later
- what user data or resources may be needed

### 4. Review awareness

The copilot must understand:

- Design Parity
- Surface Planning
- DVN Receipts
- deployment pathway implications

## Live context stubs required in alpha

Even if not fully used, alpha should reserve these fields:

- `personaContext`
- `activeDataQubes`
- `activeContentQubes`
- `orientationAssetPlan`
- `providerCandidates`
- `generationCostEnvelope`
- `deploymentTargetState`

## Suggested KB slices for alpha

### Composer process KB

- Studio phases
- what each tab means
- when to move between tabs

### Template KB

- available Studio templates
- what each template is best for

### Provider and skill KB

- OpenAI image/video notes
- Venice image/video notes
- curated/community distinctions where applicable
- known constraints and cost notes

### Design and deployment KB

- DesignQube summary meaning
- surface planning meaning
- parity meaning
- DVN receipt meaning
- MCP deployment notes

## Proposed phased rollout

### Phase 1: Composer alpha skeleton

- Composer system prompt v1
- session-context builder
- image/video provider KB pack
- template recommendation continuity

### Phase 2: Golden path actions

- prompt injection into Customizer
- provider/skill selection guidance
- resource summarization
- orientation-aware image planning

### Phase 3: Review and deployment path

- parity-aware guidance
- DVN/surface-plan awareness
- MCP deployment guidance

## Success definition

Alpha is successful if a user can:

- say what kind of experience they want
- receive relevant template recommendations
- understand image/video provider differences
- get first-pass prompt help
- carry those decisions into Customizer and Resources
- review parity/deployment implications without losing context
