/**
 * Venture iQube — TypeScript type definitions
 *
 * Source of truth: codexes/packs/agentiq/updates/2026-06-01_venture-iqube-schema-v0.4.md
 *                  (and the v0.3, v0.2, v0.1 doc lineage referenced therein)
 *
 * The runtime Zod validator at services/iqube/ventureQubeSchema.ts must stay
 * in lockstep with the shapes here. When you extend a field, update both.
 *
 * v0.4 (2026-06-01) adds the nested `ventures[].myCartridge` block per
 * myCartridge PRD v0.2 §27 — captures the operator's intent for their own
 * cartridge (identity, purpose, tabs, Triad: Cartridge + Copilot + Wallet,
 * audience, activation catalogue opt-in). MVP: 1 venture per persona;
 * platform sys-admins may exceed.
 */

export type VentureQubeSchemaVersion =
  | "venture-iqube/v0.1"
  | "venture-iqube/v0.2"
  | "venture-iqube/v0.3"
  | "venture-iqube/v0.4";

export type CartridgeSlugV04 =
  | "metame"
  | "knyt"
  | "qriptopian"
  | "marketa"
  | "agentiq-os"
  | "venture-lab"
  | "mvl"
  | "moneypenny"
  | "studio"
  | "iqube-registry"
  | "legal-metacommons";

export type SpecialistId =
  | "marketa"
  | "quill"
  | "kn0w1"
  | "aigent-z"
  | "aigent-c"
  | "aigent-nakamoto"
  | "moneypenny"
  | "metaye";

export type CartridgeCategory =
  | "community"
  | "venture"
  | "knowledge"
  | "creative"
  | "media"
  | "franchise"
  | "learning"
  | "research"
  | "professional"
  | "private";

export type CartridgeVisibility = "public" | "private" | "invite-only" | "member-only";

export type CartridgeAudienceKind = "open" | "gated" | "franchise" | "inner-circle";

export type CartridgeAudienceSize = "1-10" | "10-100" | "100-1k" | "1k-10k" | "10k+";

export type CartridgeTabTemplateId =
  | "pulse-v1"
  | "codex-v1"
  | "experience-v1"
  | "active-v1"
  | "wallet-v1"
  | "ledger-v1"
  | "community-v1"
  | "members-v1"
  | "venture-v1"
  | "settings-v1"
  | "admin-v1"
  | "overview-v1";

export type CartridgeTabVisibility = "public" | "member" | "admin" | "invite" | "token-gated";

export type CartridgeCopilotSource = "aigentMe" | "cartridge-copilot" | "specialist";

export type CartridgeKbIngestSource = "mycanvas" | "myworkspace" | "uploads" | "codex" | "json_blob";

export type CartridgeKbEmbeddingScope = "cartridge" | "domain";

export type TokenId = "q-cent" | "usdc" | "knyt";

export type CartridgeRole =
  | "owner"
  | "admin"
  | "editor"
  | "contributor"
  | "member"
  | "partner"
  | "franchisee"
  | "correspondent"
  | "guest";

export type CartridgeReceiptKind =
  | "created"
  | "tab_visibility"
  | "member_invited"
  | "crypto_send"
  | "payment_request"
  | "reward_payout"
  | "codex_published"
  | "activation_submitted"
  | "activation_reviewed";

// ─── v0.1 / v0.2 / v0.3 shared shapes ─────────────────────────────────────

export interface VentureQubeOperator {
  displayLabel: string;
  archetype: string;
  tagline?: string;
  fioHandle?: string;
}

export interface VentureQubeStrategy {
  headline: string;
  thesis: string;
  currentStage?: string;
  blockers?: string[];
  constraints?: string[];
}

export interface VentureQubeObjective {
  id: string;
  title: string;
  summary?: string;
  impact: string;
  effort: string;
  horizon?: string;
  successCriteria?: string[];
  dependencies?: string[];
  specialistHint?: string;
}

export interface VentureQubePartner {
  name: string;
  role?: string;
  status?: string;
}

// ─── v0.4 myCartridge nested block ────────────────────────────────────────

export interface CartridgeTabSpec {
  slug: string;
  templateId: CartridgeTabTemplateId;
  visibility: CartridgeTabVisibility;
  primary: boolean;
  tokenGate?: { tokenId: TokenId; minBalance: string };
}

export interface CartridgeIdentity {
  configured: true;
  slug: string;
  title: string;
  description: string;
  purpose: string;
  category: CartridgeCategory;
  visibility: CartridgeVisibility;
  // T0 — server-only; the spine resolves this from the active persona,
  // not from the JSON. Included in the type for completeness but the
  // ingest validator strips it from any client-supplied payload.
  ownerPersonaId?: string;
}

export interface CartridgeAudience {
  kind: CartridgeAudienceKind;
  estimatedSize: CartridgeAudienceSize;
  languages: string[];
}

export interface CartridgeCopilotConfig {
  source: CartridgeCopilotSource;
  cartridgeCopilotPersonaId?: string;
  promptContext: string;
}

export interface CartridgeKnowledgeBaseConfig {
  ingestSources: CartridgeKbIngestSource[];
  embeddingScope: CartridgeKbEmbeddingScope;
  jsonBlob?: {
    uri: string;
    uploadedAt: string;
    sizeBytes: number;
  };
}

export interface CartridgeCodexConfig {
  enabled: boolean;
  rootTabSlug: "codex";
  registryEligible?: boolean;
  mintingEnabled?: boolean;
}

export interface CartridgeWalletConfig {
  enabled: boolean;
  tokenWhitelist: TokenId[];
  primitives: {
    cryptoSend: boolean;
    cryptoReceive: boolean;
    paymentRequest: boolean;
    rewardPayout: boolean;
  };
}

export interface CartridgeTriadConfig {
  copilot: CartridgeCopilotConfig;
  knowledgeBase: CartridgeKnowledgeBaseConfig;
  codex: CartridgeCodexConfig;
  wallet: CartridgeWalletConfig;
}

export interface CartridgeSpecialistsConfig {
  available: SpecialistId[];
  primary?: SpecialistId;
}

export interface CartridgeActiveTab {
  slug: string;
  catalogId: string;
  metrics: string[];
  actions: string[];
}

export interface CartridgeMembershipModelConfig {
  rolesEnabled: CartridgeRole[];
  invitePolicy: "owner-only" | "admin-allowed" | "public-request";
  membershipReceipts: boolean;
}

export interface CartridgeStateChangeReceiptsConfig {
  enabled: boolean;
  receiptKinds: CartridgeReceiptKind[];
}

export interface MyCartridgeBlock extends CartridgeIdentity {
  audience: CartridgeAudience;
  template: CartridgeTabTemplateId | "custom";
  tabs: CartridgeTabSpec[];
  smartTriad: CartridgeTriadConfig;
  specialists: CartridgeSpecialistsConfig;
  activeTab: CartridgeActiveTab;
  membershipModel: CartridgeMembershipModelConfig;
  stateChangeReceipts: CartridgeStateChangeReceiptsConfig;
  // Pins the {Cartridge, Copilot, Wallet} Triad shape. Legacy "smartTriad"
  // top-level alias is rejected at ingest with a migration error.
  triadNomenclature: "v0.2";
  // Activation Catalogue opt-in toggled at wizard save. When true and
  // visibility === 'public', the active tab enters the approval chain
  // at `pending_metame` (MVP) or `pending_registry` (post-pilot).
  catalogueOptIn?: boolean;
}

// ─── Top-level venture wrapper (v0.1 → v0.4) ───────────────────────────────

export interface VentureQubeVenture {
  id: string;
  name: string;
  tagline?: string;
  stage?: string;
  cartridgeBindings?: string[];
  northStarKpi?: string;
  objectives: VentureQubeObjective[];
  partners?: VentureQubePartner[];
  notes?: string;
  // v0.4: nested myCartridge configuration block per myCartridge PRD §27.
  // MVP rule: at most one venture entry carries `myCartridge` per persona;
  // platform sys-admins may exceed.
  myCartridge?: MyCartridgeBlock;
}

export interface VentureQubeKpiRow {
  name: string;
  metric: string;
  current?: string | number | null;
  target: string | number;
  horizon: string;
  ventureId?: string;
}

export interface VentureQubePlanAction {
  title: string;
  ventureId: string;
  objectiveId?: string;
  owner?: string;
  due?: string;
  blocker?: string;
}

export interface VentureQubePlanHorizon {
  focus: string;
  actions: VentureQubePlanAction[];
}

export interface VentureQube {
  schemaVersion: VentureQubeSchemaVersion;
  emittedAt?: string;
  operator: VentureQubeOperator;
  strategy: VentureQubeStrategy;
  ventures: VentureQubeVenture[];
  plan: Record<string, VentureQubePlanHorizon>;
  specialistPreferences?: Record<string, string>;
  kpiBoard?: VentureQubeKpiRow[];
}

// Convenience alias — most callers care only about the v0.4 shape.
export type VentureQubeV04 = VentureQube & { schemaVersion: "venture-iqube/v0.4" };
