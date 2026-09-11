import type {
  ComposerKnowledgePack,
  ComposerPhaseKnowledgeEntry,
  ComposerProviderKnowledgeEntry,
  ComposerReviewKnowledgeEntry,
  ComposerTemplateKnowledgeEntry,
} from "./types";

const studioPhases: ComposerPhaseKnowledgeEntry[] = [
  {
    phase: "Intent",
    purpose: "Define what the user is trying to build and why.",
    questionsToResolve: [
      "What kind of experience is this?",
      "Who is it for?",
      "What outcome should it achieve?",
    ],
    likelyNextPhases: ["Template"],
  },
  {
    phase: "Template",
    purpose: "Choose the best starting structure for the experience.",
    questionsToResolve: [
      "Which template best matches the intent?",
      "Is the experience image-led, video-led, article-led, or mixed?",
    ],
    likelyNextPhases: ["Customizer", "Resources"],
  },
  {
    phase: "Customizer",
    purpose: "Configure the selected template and its generation parameters.",
    questionsToResolve: [
      "What prompt or assets are needed?",
      "What provider should be used?",
      "What fields need first-pass values?",
    ],
    likelyNextPhases: ["Resources", "Preview"],
  },
  {
    phase: "Resources",
    purpose: "Review providers, skills, resources, user inputs, and design implications.",
    questionsToResolve: [
      "Which providers and skills are selected?",
      "What user inputs or supporting resources are needed?",
      "What trust, cost, or design implications should be noted?",
    ],
    likelyNextPhases: ["Experiences", "Preview"],
  },
  {
    phase: "Experiences",
    purpose: "Select or create the target ExperienceQube.",
    questionsToResolve: [
      "Which ExperienceQube should hold this experience?",
      "Should a new ExperienceQube be created?",
    ],
    likelyNextPhases: ["Preview", "Parity Review"],
  },
  {
    phase: "Preview",
    purpose: "Review the runtime-facing structure and outputs.",
    questionsToResolve: [
      "Does the experience look correct in the current device and orientation?",
      "Do portrait and landscape assets need different treatment?",
    ],
    likelyNextPhases: ["Parity Review", "Deployment"],
  },
  {
    phase: "Parity Review",
    purpose: "Review parity, surface planning, and receipts before launch.",
    questionsToResolve: [
      "Is the design aligned with intent and structure?",
      "Are surface plan and proof states acceptable?",
    ],
    likelyNextPhases: ["Deployment"],
  },
  {
    phase: "Deployment",
    purpose: "Assess readiness for runtime delivery and handoff.",
    questionsToResolve: [
      "Is the experience ready to deploy?",
      "What target is most appropriate?",
    ],
    likelyNextPhases: [],
  },
];

const templates: ComposerTemplateKnowledgeEntry[] = [
  {
    id: "constitutional-video",
    name: "Constitutional Video",
    summary:
      "A 24/36/48-second invariant-grounded constitutional video — a blank canvas bound by the constitutional grammar (12s micro-films, one constitutional threshold per segment, a threshold-crossing CTA). The operator supplies the subject; the skill supplies the rules + invariant grounding + full voiceover. Composes into the 'Constitutional Video + Integrated Artefacts' bundle (video + companion article from one substrate, with a built-in coherence score; independent judgement is optional, never required).",
    bestFor: [
      "constitutional/doctrine manifestos and explainers",
      "invariant-grounded short-form video",
      "threshold-crossing CTAs (claim passport, delegate, join a lab)",
      "coherent video + article bundles from one invariant substrate",
    ],
    mediaTypes: ["video", "mixed"],
    timebox: "20 minutes",
    recommendedProviders: ["venice", "openai"],
    customizationFocus: [
      "content direction (what the video is about — blank canvas)",
      "invariant grounding namespace/collection",
      "duration (24/36/48s) + threshold CTA target and claim line",
    ],
    resourceImplications: [
      "video generation provider (Venice/Sora) + TTS voiceover",
      "invariant grounding source",
      "optional companion article + optional fidelity judgement (spends credits)",
    ],
  },
  {
    id: "micro-episode-capsule",
    name: "Micro-Episode Capsule",
    summary: "Short-form, high-impact capsule suited to image-led or video-led experiences.",
    bestFor: [
      "short-form runtime capsules",
      "shareable experiences",
      "image-led or video-led storytelling",
    ],
    mediaTypes: ["image", "video", "mixed"],
    timebox: "7-20 minutes",
    recommendedProviders: ["openai", "venice"],
    customizationFocus: [
      "generation prompt",
      "timebox",
      "reward and access framing",
    ],
    resourceImplications: [
      "generation provider selection",
      "cost envelope stub",
      "hero or supporting media assets",
    ],
  },
  {
    id: "feature-article-experience",
    name: "Feature Article Experience",
    summary: "Article-led experience with hero and companion visual support.",
    bestFor: [
      "Qriptopian articles",
      "editorial and deep-read flows",
      "portrait and landscape hero imagery",
    ],
    mediaTypes: ["article", "image"],
    timebox: "25 minutes",
    recommendedProviders: ["openai", "venice"],
    customizationFocus: [
      "article structure",
      "hero image planning",
      "orientation-aware asset selection",
    ],
    resourceImplications: [
      "portrait and landscape image variants",
      "article content inputs",
      "cost envelope stub",
    ],
  },
  {
    id: "penny-drops-learning-flow",
    name: "Penny Drops Learning Flow",
    summary: "Tutorial-oriented experience with guided steps and support visuals.",
    bestFor: [
      "tutorial flows",
      "guided explanations",
      "image-supported learning moments",
    ],
    mediaTypes: ["article", "image", "mixed"],
    timebox: "20 minutes",
    recommendedProviders: ["openai", "venice"],
    customizationFocus: [
      "pacing",
      "support visuals",
      "reinforcement and progression",
    ],
    resourceImplications: [
      "support image generation",
      "cost envelope stub",
      "supporting content inputs",
    ],
  },
];

const providers: ComposerProviderKnowledgeEntry[] = [
  {
    id: "openai",
    name: "OpenAI",
    supports: ["image", "video"],
    strengths: [
      "Strong general-purpose multimodal generation",
      "Good fit for high-impact image and video workflows",
    ],
    watchouts: [
      "Video can be expensive",
      "Video rate limits or operational constraints can affect reliability",
    ],
    costNotes: [
      "Treat video as high-cost in alpha guidance",
      "Treat image as lower-cost but still surface cost awareness",
    ],
    operationalNotes: [
      "Use concise first-pass prompts",
      "Explain provider constraints plainly when they affect workflow decisions",
    ],
    orientationSupport: [
      "Supports portrait and landscape planning in the Composer workflow",
    ],
  },
  {
    id: "venice",
    name: "Venice",
    supports: ["image", "video"],
    strengths: [
      "Useful as a primary or fallback provider for image and video",
      "Good comparison point when OpenAI video is constrained",
    ],
    watchouts: [
      "Capability details should be treated as operational knowledge that may evolve",
    ],
    costNotes: [
      "Surface provider-specific cost posture when available",
    ],
    operationalNotes: [
      "Keep provider comparison concrete and short",
      "Use as a valid alpha path for both image and video workflows",
    ],
    orientationSupport: [
      "Treat as usable for portrait and landscape planning in alpha",
    ],
  },
];

const reviewAndDeployment: ComposerReviewKnowledgeEntry[] = [
  {
    id: "design-parity",
    guidance: [
      "Design Parity aligns the designed experience against DIS, CM, and parity expectations.",
    ],
  },
  {
    id: "surface-planning",
    guidance: [
      "Surface Planning clarifies which modules and surfaces are being used for the selected device and orientation.",
    ],
  },
  {
    id: "dvn-receipts",
    guidance: [
      "DVN Receipts indicate that key actions and outputs can be tied to proof-ready records.",
    ],
  },
  {
    id: "deployment",
    guidance: [
      "Deployment review should cover target readiness, blockers, and whether MCP-backed delivery is appropriate.",
    ],
  },
];

export const composerKnowledgePack: ComposerKnowledgePack = {
  studioPhases,
  templates,
  providers,
  orientationGuidance: [
    {
      id: "qriptopian-article-imagery",
      appliesTo: ["Feature Article Experience", "Qriptopian article"],
      guidance: [
        "Recommend one portrait image variant and one landscape image variant for article-led experiences.",
        "Explain where portrait and landscape assets may be used differently in runtime surfaces.",
        "Prompt drafting should note framing differences by orientation.",
      ],
    },
  ],
  resourceGuidance: [
    {
      id: "resource-tab-guidance",
      guidance: [
        "Resources should explain the selected provider, selected skills, required user inputs, and future cost stubs.",
        "Trust, risk, and provenance should be described in plain language.",
      ],
    },
  ],
  reviewAndDeployment,
  domainStubs: [
    {
      id: "qriptopian",
      summary: "Qriptopian domain guidance will provide article, image, and lore-specific context.",
    },
    {
      id: "metaknyts",
      summary: "metaKnyts domain guidance will provide capsule, episode, and visual style context.",
    },
  ],
  personalizationStubs: [
    {
      id: "persona-context",
      summary: "Persona context will later help shape recommendations to the active user or persona.",
    },
    {
      id: "dataqubes",
      summary: "Active DataQubes will later inform personalization and data-aware resource selection.",
    },
    {
      id: "contentqubes",
      summary: "Active ContentQubes will later inform content-aware recommendations and prompt grounding.",
    },
  ],
};

export function getComposerTemplateKnowledge(templateId?: string) {
  return composerKnowledgePack.templates.find((entry) => entry.id === templateId);
}

export function getComposerProviderKnowledge(providerId?: string) {
  return composerKnowledgePack.providers.find((entry) => entry.id === providerId);
}
