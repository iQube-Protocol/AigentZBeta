export type DesignQubeThemeMode = "light" | "dark";

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
  styleQube?: Record<string, any>;
  layoutQube?: Record<string, any>;
  references?: DesignQubeReference[];
  styleBrief?: string;
  updatedAt?: string;
};
