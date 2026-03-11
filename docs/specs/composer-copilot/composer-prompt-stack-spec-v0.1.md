# Composer Prompt Stack Spec v0.1

## Goal

Define a reusable prompt architecture for `Composer Copilot` that fits the existing stack and can later generalize to other copilot agents such as metaMe Runtime and Qriptopian.

## Design principle

Do not solve this with one giant system prompt.

Use a layered prompt stack plus a separate knowledge layer.

## Proposed prompt layers

### 1. Platform base prompt

Purpose:

- define iQube worldview
- define tenant/policy/trust/risk norms
- define tool-calling discipline
- define multi-tenant and identity behavior

Current reference:

- [route.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/api/copilotkit/[[...path]]/route.ts)

This should remain global.

### 2. Agent role prompt

Purpose:

- define what makes `Composer Copilot` distinct
- define its workflow scope and behavior
- define what “good guidance” looks like in Studio

This is where Composer becomes:

- master experience designer
- Studio workflow guide
- template/skill/resource/parity/deployment advisor

### 3. Domain or tenant augmentation

Purpose:

- inject codex or tenant-specific context
- inject domain design rules
- inject franchise-specific content norms
- inject trust/risk or style constraints that vary by tenant

Examples:

- metaKnyts
- Qriptopian
- tenant creative packs
- design or brand rules

### 4. Live session context

Purpose:

- inject the current Studio working state per turn

This should be generated, not handwritten.

It should include:

- current phase
- selected template
- customization state
- resource state
- DesignQube state
- ExperienceQube state
- preview status
- parity status
- receipts status
- deployment status

And should reserve stubs for:

- persona context
- active DataQubes
- active ContentQubes
- voice readiness
- cost envelope

### 5. Retrieved knowledge context

Purpose:

- inject the smallest relevant slice of KB content

This should be treated separately from the prompt stack.
It should not be hardcoded into the agent prompt except for behavioral instructions on how to use it.

## What belongs in prompt vs knowledge base

### Put in prompt

- role and behavior
- Studio phase model
- guidance principles
- tradeoff explanation rules
- risk/trust/cost communication rules
- continuity requirements

### Put in knowledge base

- template catalog detail
- provider/skill comparison detail
- DesignQube reference material
- deployment details
- current operational constraints
- domain/franchise material

## Proposed ownership model

### Platform prompt ownership

- platform/backend team

### Agent role prompt ownership

- Studio/product design team

### Domain augmentation ownership

- tenant/domain owners

### Session context ownership

- Studio frontend + orchestration layer

### Knowledge pack ownership

- Studio/product + operations teams

## Proposed file layout

This is a recommendation for implementation after planning.

```text
app/copilots/prompts/platform/base.ts
app/copilots/prompts/agents/composer.ts
app/copilots/prompts/domains/metame.ts
app/copilots/prompts/domains/qriptopian.ts
app/copilots/prompts/domains/metaknyts.ts
services/copilot/context/buildComposerSessionContext.ts
services/copilot/kb/composerKnowledgePack.ts
services/copilot/kb/providerKnowledgePack.ts
services/copilot/kb/deploymentKnowledgePack.ts
```

## Runtime assembly model

The effective Composer prompt should be assembled as:

`platform base`
`+ composer agent role`
`+ domain augmentation`
`+ live session context`
`+ retrieved KB snippets`

Where:

- the first three are relatively stable
- the fourth changes every turn
- the fifth is retrieval-driven and scoped

## Suggested integration path with existing stack

### Existing platform base

Use the current platform prompt in:

- [route.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/api/copilotkit/[[...path]]/route.ts)

### Existing prompt service pattern

Use the layering idea from:

- [nakamotoCoreClient.ts](/Users/hal1/CascadeProjects/AigentZBeta/app/services/nakamoto/nakamotoCoreClient.ts)

But do not tie Composer to Nakamoto-specific storage.
Instead, use the same conceptual model:

- root prompt
- tenant augmentations
- effective prompt assembly

### Existing Studio state source

Live session context should be built from:

- [ComposerStudio.tsx](/Users/hal1/CascadeProjects/AigentZBeta/components/composer/ComposerStudio.tsx)

Initially that can be in-memory.

## Alpha implementation recommendation

For alpha, do not build the full generic prompt-management system first.

Instead:

1. keep the current platform base prompt
2. add a Composer-specific agent prompt layer
3. add an in-memory Composer session-context builder
4. add a small Composer KB pack for templates, providers, and workflow knowledge

That is enough to demonstrate a true continuous Composer copilot.

## Phase progression

### Phase 1

- Composer prompt layer
- in-memory session context
- hardcoded KB pack

### Phase 2

- tenant/domain prompt augmentations
- stored KB docs
- retrieval pipeline

### Phase 3

- generalized agent prompt registry for Runtime, Qriptopian, and other copilots

## Success criteria

This prompt stack is successful if:

- Composer behaves differently from the platform copilot
- Composer maintains continuity across Studio phases
- Composer can reason over templates, skills, resources, and deployment
- domain context can be layered in without rewriting the agent prompt
- future copilot agents can reuse the same architecture
