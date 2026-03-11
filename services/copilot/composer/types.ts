export type ComposerStudioPhase =
  | "Intent"
  | "Template"
  | "Customizer"
  | "Resources"
  | "Experiences"
  | "Preview"
  | "Parity Review"
  | "Deployment";

export type ComposerExperienceTab =
  | "Template"
  | "Customizer"
  | "Resources"
  | "Experiences";

export type ComposerResourceSubTab = "Experience" | "Design";

export type ComposerParityTab =
  | "Design Parity"
  | "Surface Planning"
  | "DVN Receipts";

export type ComposerInteractionMode = "text" | "voice" | "mixed";

export type ComposerMediaMode = "image" | "video" | "article" | "mixed";

export type ComposerPreviewDevice = "mobile" | "tablet" | "desktop";

export type ComposerPreviewOrientation = "portrait" | "landscape";

export type ComposerStatus = "idle" | "loading" | "pending" | "ready" | "error";

export interface ComposerSessionIdentity {
  sessionId: string;
  timestamp: string;
  tenantId?: string;
  userId?: string;
  personaId?: string;
}

export interface ComposerPersonaContext {
  id?: string;
  name?: string;
  role?: string;
  goals?: string[];
}

export interface ComposerActivatedQube {
  id: string;
  name: string;
  summary?: string;
}

export interface ComposerUserContext {
  personaContext?: ComposerPersonaContext;
  activeDataQubes?: ComposerActivatedQube[];
  activeContentQubes?: ComposerActivatedQube[];
}

export interface ComposerStudioContext {
  currentPhase: ComposerStudioPhase;
  activeExperienceTab?: ComposerExperienceTab;
  activeResourceSubTab?: ComposerResourceSubTab;
  activeParityTab?: ComposerParityTab;
  interactionMode?: ComposerInteractionMode;
}

export interface ComposerTemplateContext {
  selectedTemplateId?: string;
  selectedTemplateName?: string;
  candidateTemplateIds?: string[];
  inferredIntent?: string;
  inferredMediaMode?: ComposerMediaMode;
}

export interface ComposerSuggestedPrompts {
  imagePortrait?: string;
  imageLandscape?: string;
  video?: string;
}

export interface ComposerCustomizationContext {
  fields?: Record<string, string | number | boolean | null>;
  suggestedPrompt?: string;
  suggestedPrompts?: ComposerSuggestedPrompts;
  unresolvedQuestions?: string[];
}

export interface ComposerSelectedResource {
  id: string;
  name: string;
  type: string;
  provider?: string;
}

export interface ComposerGenerationCostEnvelope {
  status?: "stubbed" | "estimated" | "known";
  notes?: string[];
}

export interface ComposerResourceContext {
  selectedProviders?: string[];
  selectedSkills?: string[];
  selectedResources?: ComposerSelectedResource[];
  requiredUserInputs?: string[];
  generationCostEnvelope?: ComposerGenerationCostEnvelope;
}

export interface ComposerOrientationAssetPlan {
  portraitNeeded?: boolean;
  landscapeNeeded?: boolean;
  notes?: string[];
}

export interface ComposerDesignContext {
  activeDesignQubeId?: string;
  activeDesignQubeName?: string;
  designSummary?: string[];
  orientationAssetPlan?: ComposerOrientationAssetPlan;
}

export interface ComposerExperienceContext {
  selectedExperienceQubeId?: string;
  selectedExperienceQubeName?: string;
  availableExperienceQubeIds?: string[];
}

export interface ComposerPreviewContext {
  device?: ComposerPreviewDevice;
  orientation?: ComposerPreviewOrientation;
  runtimeLoaded?: boolean;
  previewStatus?: ComposerStatus;
}

export interface ComposerReviewContext {
  parityStatus?: ComposerStatus;
  surfacePlanStatus?: ComposerStatus;
  dvnReceiptStatus?: ComposerStatus;
  blockers?: string[];
}

export interface ComposerDeploymentTargetState {
  targets?: string[];
  recommendedTarget?: string;
}

export interface ComposerDeploymentContext {
  deploymentTargetState?: ComposerDeploymentTargetState;
  deploymentReady?: boolean;
  notes?: string[];
}

export interface ComposerSessionContext {
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
}

export interface ComposerPromptPart {
  id: string;
  content: string;
}

export interface ComposerTemplateKnowledgeEntry {
  id: string;
  name: string;
  summary: string;
  bestFor: string[];
  mediaTypes: ComposerMediaMode[];
  timebox?: string;
  recommendedProviders: string[];
  customizationFocus: string[];
  resourceImplications: string[];
}

export interface ComposerProviderKnowledgeEntry {
  id: string;
  name: string;
  supports: Array<"image" | "video">;
  strengths: string[];
  watchouts: string[];
  costNotes: string[];
  operationalNotes: string[];
  orientationSupport: string[];
}

export interface ComposerPhaseKnowledgeEntry {
  phase: ComposerStudioPhase;
  purpose: string;
  questionsToResolve: string[];
  likelyNextPhases: ComposerStudioPhase[];
}

export interface ComposerOrientationGuidanceEntry {
  id: string;
  appliesTo: string[];
  guidance: string[];
}

export interface ComposerResourceGuidanceEntry {
  id: string;
  guidance: string[];
}

export interface ComposerReviewKnowledgeEntry {
  id: string;
  guidance: string[];
}

export interface ComposerDomainStubEntry {
  id: string;
  summary: string;
}

export interface ComposerPersonalizationStubEntry {
  id: string;
  summary: string;
}

export interface ComposerKnowledgePack {
  studioPhases: ComposerPhaseKnowledgeEntry[];
  templates: ComposerTemplateKnowledgeEntry[];
  providers: ComposerProviderKnowledgeEntry[];
  orientationGuidance: ComposerOrientationGuidanceEntry[];
  resourceGuidance: ComposerResourceGuidanceEntry[];
  reviewAndDeployment: ComposerReviewKnowledgeEntry[];
  domainStubs: ComposerDomainStubEntry[];
  personalizationStubs: ComposerPersonalizationStubEntry[];
}

export interface BuildComposerSessionContextInput {
  sessionId: string;
  timestamp?: string;
  tenantId?: string;
  userId?: string;
  personaId?: string;
  currentPhase?: ComposerStudioPhase;
  activeExperienceTab?: ComposerExperienceTab;
  activeResourceSubTab?: ComposerResourceSubTab;
  activeParityTab?: ComposerParityTab;
  interactionMode?: ComposerInteractionMode;
  selectedTemplateId?: string;
  selectedTemplateName?: string;
  candidateTemplateIds?: string[];
  inferredIntent?: string;
  inferredMediaMode?: ComposerMediaMode;
  customizationFields?: Record<string, string | number | boolean | null>;
  suggestedPrompt?: string;
  suggestedPrompts?: ComposerSuggestedPrompts;
  unresolvedQuestions?: string[];
  selectedProviders?: string[];
  selectedSkills?: string[];
  selectedResources?: ComposerSelectedResource[];
  requiredUserInputs?: string[];
  generationCostEnvelope?: ComposerGenerationCostEnvelope;
  activeDesignQubeId?: string;
  activeDesignQubeName?: string;
  designSummary?: string[];
  orientationAssetPlan?: ComposerOrientationAssetPlan;
  selectedExperienceQubeId?: string;
  selectedExperienceQubeName?: string;
  availableExperienceQubeIds?: string[];
  previewDevice?: ComposerPreviewDevice;
  previewOrientation?: ComposerPreviewOrientation;
  runtimeLoaded?: boolean;
  previewStatus?: ComposerStatus;
  parityStatus?: ComposerStatus;
  surfacePlanStatus?: ComposerStatus;
  dvnReceiptStatus?: ComposerStatus;
  blockers?: string[];
  deploymentTargets?: string[];
  recommendedDeploymentTarget?: string;
  deploymentReady?: boolean;
  deploymentNotes?: string[];
  personaContext?: ComposerPersonaContext;
  activeDataQubes?: ComposerActivatedQube[];
  activeContentQubes?: ComposerActivatedQube[];
}
