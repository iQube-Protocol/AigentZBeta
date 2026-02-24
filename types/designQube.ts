export type DesignQubeThemeMode = "light" | "dark";

// =============================================================================
// DESIGNQUBE SUB-GROUP TYPES
// =============================================================================

// Visual styling parameters
export type VisualStyleParams = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    background: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
      inverse: string;
    };
    border: string;
    shadow: string;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary?: string;
      mono?: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  animations: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
    easing: {
      ease: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };
};

// Audio styling parameters
export type AudioStyleParams = {
  voice: VoiceProfile;
  soundEffects: {
    enabled: boolean;
    library: string[];
    volume: number;
    triggers: Array<{
      event: string;
      sound: string;
      volume?: number;
    }>;
  };
  music: {
    enabled: boolean;
    style: string;
    mood: string;
    volume: number;
    autoplay: boolean;
  };
  feedback: {
    hover: boolean;
    click: boolean;
    success: boolean;
    error: boolean;
  };
};

// Text styling and tone parameters
export type TextStyleParams = {
  formatting: TextStyleSpec;
  tone: {
    personality: string;
    formality: 'formal' | 'casual' | 'professional' | 'friendly';
    urgency: 'low' | 'medium' | 'high';
    empathy: 'low' | 'medium' | 'high';
    clarity: 'simple' | 'technical' | 'academic';
  };
  content: {
    maxLength: number;
    readingLevel: string;
    language: string;
    accessibility: {
      dyslexicFont: boolean;
      highContrast: boolean;
      largeText: boolean;
    };
  };
  localization: {
    enabled: boolean;
    supportedLanguages: string[];
    fallbackLanguage: string;
  };
};

// Spatial (3D/AR/VR) parameters
export type SpatialStyleParams = {
  threeD: {
    enabled: boolean;
    perspective: number;
    depth: number;
    transforms: {
      rotateX: number;
      rotateY: number;
      rotateZ: number;
      scale: number;
    };
  };
  ar: {
    enabled: boolean;
    tracking: 'plane' | 'image' | 'face';
    anchors: string[];
  };
  vr: {
    enabled: boolean;
    immersion: 'none' | 'inline' | 'immersive-vr' | 'immersive-ar';
    controllers: boolean;
    handTracking: boolean;
  };
  zAxis: {
    enabled: boolean;
    stacking: boolean;
    parallax: boolean;
    depthLayers: number;
  };
};

// Voice profile for multi-modal styling
export type VoiceProfile = {
  persona?: string;
  accent?: string;
  pace?: "slow" | "normal" | "fast";
  pitch?: "low" | "medium" | "high";
  tone?: "neutral" | "warm" | "professional" | "casual" | "energetic";
  ttsHints?: Record<string, any>;
};

// Text styling for reader CSS details
export type TextStyleSpec = {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  maxWidth?: string;
  paragraphSpacing?: string;
  hyphenation?: "none" | "auto" | "manual";
  textAlign?: "left" | "center" | "right" | "justify";
  textRendering?: "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision";
  fontSmoothing?: "auto" | "never" | "always";
  cssText?: string;
};

// =============================================================================
// ENHANCED STYLEQUBE & STRUCTUREQUBE
// =============================================================================

// Enhanced StyleQube with sub-groups
export type StyleQube = {
  id: string;
  name: string;
  source: string;
  themes: string[];
  summary: {
    primaryAccent?: string;
    surface?: string;
    typography?: string;
    radius?: string;
    motion?: string;
  };
  // New sub-group structure
  visual: VisualStyleParams;
  audio: AudioStyleParams;
  text: TextStyleParams;
  spatial: SpatialStyleParams;
  // Legacy compatibility
  tokenRefs: {
    colors?: string[];
    typography?: string[];
    radius?: string[];
  };
  version: string;
};

// Enhanced StructureQube with content modules and big-screen
export type StructureQube = {
  id: string;
  name: string;
  source: string;
  breakpoints: {
    mobile: { maxWidth: 640; columns: 1 };
    tablet: { maxWidth: 1024; minWidth: 641; columns: 2 };
    desktop: { maxWidth: 1919; minWidth: 1025; columns: 3 };
    bigScreen: { minWidth: 1920; columns: 4 }; // NEW: conference/widescreen
  };
  templates: string[];
  contentModules: Array<{
    id: string;
    name: string;
    type: 'header' | 'content' | 'sidebar' | 'footer' | 'modal' | 'overlay';
    responsive: boolean;
    breakpoints: string[];
    priority: number;
  }>;
  templateSelection: {
    priority: string[];
    byModality: Record<string, string[]>;
    byDensity: Record<string, string[]>;
    bySurface: Record<string, string[]>;
  };
  layoutRules: string[];
  componentPriorities: {
    navigation: number;
    content: number;
    interactive: number;
    decorative: number;
  };
  version: string;
};

// Guides/Briefs structure
export type GuidesBriefs = {
  styleGuide: {
    css: string[];
    brandGuidelines: string[];
    lookBooks: string[];
  };
  experienceGuide: {
    who: {
      audience: string;
      demographics: string[];
      needs: string[];
    };
    what: {
      delivery: string[];
      mechanics: string[];
      touchpoints: string[];
    };
    wow: {
      differentiators: string[];
      innovations: string[];
      emotionalImpact: string[];
    };
    metrics: {
      success: string[];
      kpis: string[];
      measurement: string[];
    };
  };
  smartTriadFormatting: {
    cssSystem: string; // stub for future CSS system
    systemPrompt: string; // stub for future system prompt
  };
};

// DesignQube source extraction metadata
export type DesignQubeSource = {
  id: string;
  type: "style-guide" | "css" | "figma" | "xd" | "freeform";
  label: string;
  location: string;
  extractedAt: string;
  coverage: string[];
};

export type DesignQubeManifest = {
  schemaVersion?: string;
  designQubeId?: string;
  name?: string;
  authorityLevel?: string;
  themes?: string[];
  paths?: {
    tokens?: string;
    components?: string;
    constraints?: string;
    templateMap?: string;
    referencesIndex?: string;
    styleBrief?: string;
    structureQube?: string;
    sources?: string;
    copilotHints?: string;
  };
};

export type DesignQubeReference = {
  id: string;
  file: string;
  title?: string;
  tags?: string[];
  themeHint?: string;
  notes?: string;
  templateId?: string;
  dataUrl?: string;
  thumbnailUrl?: string;
};

export type DesignQubeTokens = {
  meta?: {
    schemaVersion?: string;
    authority_level?: string;
  };
  themes?: {
    light?: Record<string, any>;
    dark?: Record<string, any>;
  };
  typography?: Record<string, any>;
  radius?: Record<string, any>;
  spacing?: Record<string, any>;
  shadow?: Record<string, any>;
};

export type DesignQubeConstraints = {
  actions?: {
    maxPrimary?: number;
  };
  material?: {
    glass?: {
      enabled?: boolean;
      blurPx?: number;
      alpha?: number;
      borderAlpha?: number;
      surfaces?: string[];
    };
  };
  navigation?: Record<string, any>;
  currencyDisplay?: {
    wallet?: string;
    content?: string;
    offers?: string;
  };
};

export type DesignQube = {
  id: string;
  name: string;
  authorityLevel?: string;
  sourcePath: string;
  manifest?: DesignQubeManifest;
  tokens?: DesignQubeTokens;
  constraints?: DesignQubeConstraints;
  components?: Record<string, any>;
  templates?: Record<string, any>;
  designIntent?: Record<string, any>;
  constraintManifest?: Record<string, any>;
  // Updated with enhanced sub-groups
  styleQube?: StyleQube;
  structureQube?: StructureQube;
  // New guides/briefs panel
  guidesBriefs?: GuidesBriefs;
  // Copilot integration
  sources?: DesignQubeSource[];
  copilotHints?: Record<string, any>;
  references?: DesignQubeReference[];
  styleBrief?: string;
  updatedAt?: string;
};
