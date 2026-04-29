/**
 * Runtime Takeover System
 *
 * A cartridge can declare a RuntimeTakeoverConfig to personalise the metaMe
 * Runtime surface for its users. The takeover:
 *   1. Activates on arrival (welcome screen) or via the runtime toggle
 *   2. Persists for the session — signals feed back to the cartridge's Runtime
 *      tab state which re-triggers inference, keeping content fresh
 *   3. Draws content from SmartContent, ExperienceQubes, and Codex entries
 *      across one or more cartridges
 *   4. Calls an LLM proactively (not user-triggered) to infer a personalised
 *      content manifest + welcome narrative
 *
 * Precedence order when multiple takeovers are active:
 *   cartridge-specific (priority 1–9) > metaMe default (priority 10)
 *
 * Attach to CodexConfig via the optional `runtimeTakeover` field.
 */

// ─── State Fields ─────────────────────────────────────────────────────────────

/** Identifiers for live state fields the LLM inference call may receive. */
export type RuntimeStateField =
  | 'journey_stage'         // e.g. prospect → zero
  | 'patronage_stage'       // KNYT patronage axis label
  | 'pcs_stage'             // KNYT PCS axis label
  | 'signal_counts'         // { like, spark, curate, vote, remix, contribute }
  | 'knyt_balance'          // total $KNYT granted (pending + settled)
  | 'nbe'                   // active NBEPlan or null
  | 'recent_participation'  // last N user actions
  | 'active_elections'      // open Living Canon votes
  | 'qc_balance'            // Q¢ balance (cross-cartridge)
  | 'persona_badges'        // earned badge list
  | 'experience_depth';     // current L0–L3 depth label

// ─── Content Scope ────────────────────────────────────────────────────────────

export type TakeoverContentType = 'smart-content' | 'experience' | 'codex';

export interface TakeoverContentScope {
  /** Which content source types the LLM may select from. */
  types: TakeoverContentType[];
  /** Slugs of cartridges whose content is eligible (can include multiple). */
  cartridgeSlugs: string[];
  /** Hard cap on capsules returned in a single manifest. */
  maxCapsules: number;
  /** Whether the LLM should designate one capsule as the hero/featured slot. */
  pinHero: boolean;
}

// ─── Experience Matrix ────────────────────────────────────────────────────────

export interface ExperienceAxis {
  id: string;
  label: string;
  /** Ordered from entry to sovereign stage. */
  stages: string[];
  /** Which RuntimeStateField contains this axis value for the active persona. */
  stateField: RuntimeStateField;
}

export interface TakeoverExperienceMatrix {
  axes: ExperienceAxis[];
  /**
   * Optional per-cell descriptions fed to the LLM as context.
   * Key format: `${axis1StageIndex}:${axis2StageIndex}` (e.g. "1:2")
   */
  cellDescriptions?: Record<string, string>;
}

// ─── Signal Write-back ────────────────────────────────────────────────────────

export interface TakeoverSignalTarget {
  /** Action name matching the runtime signal emitted (e.g. 'like', 'view', 'complete'). */
  action: string;
  /** API endpoint that receives the signal for this action. */
  endpoint: string;
  /** If true, a successful signal triggers a manifest re-inference. */
  triggersReInference?: boolean;
}

// ─── Inference Config ─────────────────────────────────────────────────────────

export interface TakeoverInferenceConfig {
  /** Agent persona key used in /api/codex/chat (e.g. 'aigent-kn0w1'). */
  agentPersona: string;
  /** KB domain for the chat route (e.g. 'metaKnyts'). */
  domain: string;
  /** Which state fields to include in the proactive prompt. */
  stateFields: RuntimeStateField[];
  /** Route that returns the live cartridge state for a given personaId. */
  stateEndpoint: string;
  /**
   * Additional instruction appended to the system prompt.
   * Use for cartridge-specific tone, focus, or constraints.
   */
  promptConstraints?: string;
  /**
   * Optional copy prefix variants for different entry points.
   * If omitted the LLM generates the opening freely.
   */
  welcomeVariants?: {
    onArrival?: string;  // Welcome screen takeover on sign-in / arrival
    onToggle?: string;   // Mid-session toggle activation
    onReturn?: string;   // User returns after absence (session resume)
  };
  /** Token budget for the manifest response (default 500). */
  maxTokens?: number;
}

// ─── Anonymous Seed ───────────────────────────────────────────────────────────

export interface TakeoverSeedCapsule {
  type: TakeoverContentType;
  id: string;
  /** For codex type: which codex slug to embed. */
  slug?: string;
  /** For codex type: which tab to open by default. */
  tab?: string;
}

// ─── Main Config ──────────────────────────────────────────────────────────────

export interface RuntimeTakeoverConfig {
  enabled: boolean;
  /**
   * Determines which cartridge wins when multiple are active.
   * Lower number = higher priority. metaMe default = 10.
   */
  priority: number;
  /** Must match the parent CodexConfig.slug. */
  cartridgeSlug: string;
  /** Short name shown in runtime UI (e.g. 'KNYT World'). */
  displayName: string;
  contentScope: TakeoverContentScope;
  experienceMatrix: TakeoverExperienceMatrix;
  signalTargets: TakeoverSignalTarget[];
  inference: TakeoverInferenceConfig;
  /**
   * Static capsule pool shown to unauthenticated visitors or when no
   * personal state is available (Tier 1 / generic experience).
   * The LLM still selects from these but without user-specific context.
   */
  anonymousSeedCapsules?: TakeoverSeedCapsule[];
  /**
   * How many minutes a manifest remains valid before re-inference fires.
   * Re-inference also triggers on any signal marked triggersReInference: true.
   * Default: 30.
   */
  manifestTtlMinutes?: number;
}

// ─── Manifest (LLM response shape) ───────────────────────────────────────────

export interface TakeoverCapsuleRef {
  type: TakeoverContentType;
  id: string;
  /** Hero / featured slot — at most one per manifest. */
  pin?: boolean;
  /** codex type only: slug of the codex to embed. */
  slug?: string;
  /** codex type only: initial tab. */
  tab?: string;
}

export interface TakeoverNextBestAction {
  label: string;
  /** Destination: a cartridge slug, an app route, or an action name. */
  target: string;
  targetType: 'codex' | 'route' | 'action';
  /**
   * Optional tab slug for codex-type targets. Lets the LLM open a specific
   * tab inside the cartridge (e.g. target='knyt-codex', tab='scrolls').
   * Ignored for route / action targets.
   */
  tab?: string;
}

/**
 * RuntimeTakeoverManifest
 *
 * Returned by POST /api/runtime/takeover/infer.
 * Drives the metaMe Runtime welcome screen and session content filter.
 */
export interface RuntimeTakeoverManifest {
  cartridgeSlug: string;
  /** Personalised opening copy rendered on the welcome banner. */
  welcomeNarrative: string;
  /** Ordered capsule list. Length ≤ contentScope.maxCapsules. */
  capsules: TakeoverCapsuleRef[];
  /**
   * Optional UI theme hint for the runtime surface.
   * e.g. 'patronage', 'discovery', 'contributor', 'stewardship'
   */
  theme?: string;
  nextBestAction?: TakeoverNextBestAction;
  /**
   * Which signal action types should trigger a manifest re-inference
   * (in addition to TTL expiry and explicit triggersReInference signals).
   */
  refreshAfterActions?: string[];
  /** ISO timestamp of when this manifest was generated. */
  generatedAt: string;
  /** Whether this manifest is personalised (true) or anonymous seed (false). */
  isPersonalised: boolean;
}

// ─── Session State ────────────────────────────────────────────────────────────

export type TakeoverEntryPoint = 'arrival' | 'toggle' | 'return';

export interface RuntimeTakeoverSession {
  cartridgeSlug: string;
  personaId: string | null;
  manifest: RuntimeTakeoverManifest;
  entryPoint: TakeoverEntryPoint;
  activatedAt: string;
  /** ISO timestamp after which re-inference should fire. */
  expiresAt: string;
  /** Whether the session is actively filtering content. */
  active: boolean;
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface TakeoverInferRequest {
  cartridgeSlug: string;
  personaId?: string;
  entryPoint: TakeoverEntryPoint;
}

export interface TakeoverInferResponse {
  ok: boolean;
  manifest?: RuntimeTakeoverManifest;
  error?: string;
}
