# Composer Session Context Spec v0.1

## Purpose

Define the first structured session-context contract for `Composer Copilot`.

This context is intended to be injected on every turn as the `live session context` layer in the Composer prompt stack.

It is designed for alpha and should remain simple enough to build from in-memory Studio state.

## Design goals

- preserve continuity across Studio phases
- give the copilot enough context to make concrete recommendations
- reserve space for persona, DataQube, and ContentQube context
- support image and video generation paths
- support review and deployment discussion without requiring deep backend orchestration

## Core principle

The UI may stay simple, but the session context cannot be shallow.

The copilot needs enough structured state to understand:

- what the user is trying to build
- where they are in Studio
- what has already been selected
- what remains unresolved
- what provider, resource, orientation, parity, and deployment implications already exist

## Suggested shape

```ts
type ComposerSessionContext = {
  sessionIdentity: ComposerSessionIdentity;
  userContext: ComposerUserContext;
  studioContext: ComposerStudioContext;
  templateContext: ComposerTemplateContext;
  customizationContext: ComposerCustomizationContext;
  resourceContext: ComposerResourceContext;
  designContext: ComposerDesignContext;
  experienceContext: ComposerExperienceContext;
  previewContext: ComposerPreviewContext;
  reviewContext: ComposerReviewContext;
  deploymentContext: ComposerDeploymentContext;
};
```

## Session identity

```ts
type ComposerSessionIdentity = {
  sessionId: string;
  tenantId?: string;
  userId?: string;
  personaId?: string;
  timestamp: string;
};
```

## User context

```ts
type ComposerUserContext = {
  personaContext?: {
    id?: string;
    name?: string;
    role?: string;
    goals?: string[];
  };
  activeDataQubes?: Array<{
    id: string;
    name: string;
    summary?: string;
  }>;
  activeContentQubes?: Array<{
    id: string;
    name: string;
    summary?: string;
  }>;
};
```

These fields may be empty or omitted in alpha.

## Studio context

```ts
type ComposerStudioContext = {
  currentPhase:
    | "Intent"
    | "Template"
    | "Customizer"
    | "Resources"
    | "Experiences"
    | "Preview"
    | "Parity Review"
    | "Deployment";
  activeExperienceTab?: "Template" | "Customizer" | "Resources" | "Experiences";
  activeResourceSubTab?: "Experience" | "Design";
  activeParityTab?: "Design Parity" | "Surface Planning" | "DVN Receipts";
  interactionMode?: "text" | "voice" | "mixed";
};
```

## Template context

```ts
type ComposerTemplateContext = {
  selectedTemplateId?: string;
  selectedTemplateName?: string;
  candidateTemplateIds?: string[];
  inferredIntent?: string;
  inferredMediaMode?: "image" | "video" | "article" | "mixed";
};
```

## Customization context

```ts
type ComposerCustomizationContext = {
  fields?: Record<string, string | number | boolean | null>;
  suggestedPrompt?: string;
  suggestedPrompts?: {
    imagePortrait?: string;
    imageLandscape?: string;
    video?: string;
  };
  unresolvedQuestions?: string[];
};
```

## Resource context

```ts
type ComposerResourceContext = {
  selectedProviders?: string[];
  selectedSkills?: string[];
  selectedResources?: Array<{
    id: string;
    name: string;
    type: string;
    provider?: string;
  }>;
  requiredUserInputs?: string[];
  generationCostEnvelope?: {
    status?: "stubbed" | "estimated" | "known";
    notes?: string[];
  };
};
```

## Design context

```ts
type ComposerDesignContext = {
  activeDesignQubeId?: string;
  activeDesignQubeName?: string;
  designSummary?: string[];
  orientationAssetPlan?: {
    portraitNeeded?: boolean;
    landscapeNeeded?: boolean;
    notes?: string[];
  };
};
```

## Experience context

```ts
type ComposerExperienceContext = {
  selectedExperienceQubeId?: string;
  selectedExperienceQubeName?: string;
  availableExperienceQubeIds?: string[];
};
```

## Preview context

```ts
type ComposerPreviewContext = {
  device?: "mobile" | "tablet" | "desktop";
  orientation?: "portrait" | "landscape";
  runtimeLoaded?: boolean;
  previewStatus?: "idle" | "loading" | "ready" | "error";
};
```

## Review context

```ts
type ComposerReviewContext = {
  parityStatus?: "idle" | "pending" | "ready";
  surfacePlanStatus?: "idle" | "pending" | "ready";
  dvnReceiptStatus?: "idle" | "pending" | "ready";
  blockers?: string[];
};
```

## Deployment context

```ts
type ComposerDeploymentContext = {
  deploymentTargetState?: {
    targets?: string[];
    recommendedTarget?: string;
  };
  deploymentReady?: boolean;
  notes?: string[];
};
```

## Alpha requirements

For alpha, the context builder must at minimum provide:

- current phase
- selected template
- current customization values
- selected providers and skills
- active DesignQube
- active ExperienceQube
- preview device/orientation/status
- parity/surface/DVN summary state

It should also include empty stubs for:

- personaContext
- activeDataQubes
- activeContentQubes
- generationCostEnvelope
- deploymentTargetState

## Recommended builder behavior

The builder should:

- prefer concrete values over verbose summaries
- include only the most relevant fields for the active phase
- keep optional sections present but sparse
- avoid serializing huge UI trees or raw component state

## Suggested output format

For prompt assembly, the builder should produce both:

1. a typed object for app logic
2. a compact text block for LLM injection

Example:

```text
[Studio Session Context]
Phase: Customizer
Active tab: Customizer
Selected template: Micro-Episode Capsule
Inferred media mode: video
Selected providers: Venice
Selected skills: venice-video
Active DesignQube: Qriptopian Guidance
Preview: mobile portrait ready
Parity: idle
DVN receipts: idle
Persona context: none
Active DataQubes: none
Active ContentQubes: none
```

## Success criteria

This context spec is successful if it enables Composer Copilot to:

- maintain continuity across phases
- compare providers meaningfully
- reason about portrait and landscape assets
- explain resource and review implications
- reserve space for future personalization without redesigning the context model
