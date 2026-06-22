/**
 * Venture iQube — runtime Zod validator
 *
 * Single source of truth for shape validation across the ingest route,
 * the CartridgeSetupWizard (Phase 6), and any downstream callers that
 * accept a Venture iQube payload.
 *
 * Keep this in lockstep with types/ventureQube.ts. The TypeScript types
 * are the static contract; this is the runtime check.
 *
 * v0.4 (2026-06-01) — adds the nested ventures[].myCartridge block per
 * myCartridge PRD v0.2 §27. The legacy top-level `smartTriad` key is
 * rejected with a migration error.
 */

import { z } from "zod";

import type {
  VentureQube,
  VentureQubeSchemaVersion,
  CartridgeSlugV04,
} from "@/types/ventureQube";

// ─── Enums ────────────────────────────────────────────────────────────────

export const schemaVersionEnum = z.enum([
  "venture-iqube/v0.1",
  "venture-iqube/v0.2",
  "venture-iqube/v0.3",
  "venture-iqube/v0.4",
  "venture-iqube/v1.0",
]);

export const cartridgeSlugV04Enum = z.enum([
  "metame",
  "knyt",
  "qriptopian",
  "marketa",
  "agentiq-os",
  "venture-lab",
  "mvl",
  "moneypenny",
  "studio",
  "iqube-registry",
  "legal-metacommons",
]);

export const specialistIdEnum = z.enum([
  "marketa",
  "quill",
  "kn0w1",
  "aigent-z",
  "aigent-c",
  "aigent-nakamoto",
  "moneypenny",
  "metaye",
]);

export const cartridgeCategoryEnum = z.enum([
  "community",
  "venture",
  "knowledge",
  "creative",
  "media",
  "franchise",
  "learning",
  "research",
  "professional",
  "private",
]);

export const cartridgeVisibilityEnum = z.enum(["public", "private", "invite-only", "member-only"]);

export const cartridgeTabTemplateIdEnum = z.enum([
  "pulse-v1",
  "codex-v1",
  "experience-v1",
  "active-v1",
  "wallet-v1",
  "ledger-v1",
  "community-v1",
  "members-v1",
  "venture-v1",
  "settings-v1",
  "admin-v1",
  "overview-v1",
]);

export const cartridgeTabVisibilityEnum = z.enum([
  "public",
  "member",
  "admin",
  "invite",
  "token-gated",
]);

export const cartridgeCopilotSourceEnum = z.enum(["aigentMe", "cartridge-copilot", "specialist"]);

export const cartridgeKbIngestSourceEnum = z.enum([
  "mycanvas",
  "myworkspace",
  "uploads",
  "codex",
  "json_blob",
]);

export const tokenIdEnum = z.enum(["q-cent", "usdc", "knyt"]);

export const cartridgeRoleEnum = z.enum([
  "owner",
  "admin",
  "editor",
  "contributor",
  "member",
  "partner",
  "franchisee",
  "correspondent",
  "guest",
]);

// ─── v0.4 myCartridge nested block ────────────────────────────────────────

const cartridgeTabSpecSchema = z.object({
  slug: z.string().min(1).max(128),
  templateId: cartridgeTabTemplateIdEnum,
  visibility: cartridgeTabVisibilityEnum,
  primary: z.boolean(),
  tokenGate: z
    .object({
      tokenId: tokenIdEnum,
      minBalance: z.string(),
    })
    .optional(),
});

const cartridgeTriadConfigSchema = z.object({
  copilot: z.object({
    source: cartridgeCopilotSourceEnum,
    cartridgeCopilotPersonaId: z.string().optional(),
    promptContext: z.string().max(4000),
  }),
  knowledgeBase: z.object({
    ingestSources: z.array(cartridgeKbIngestSourceEnum),
    embeddingScope: z.enum(["cartridge", "domain"]),
    jsonBlob: z
      .object({
        uri: z.string().min(1),
        uploadedAt: z.string(),
        sizeBytes: z.number().int().nonnegative(),
      })
      .optional(),
  }),
  codex: z.object({
    enabled: z.boolean(),
    rootTabSlug: z.literal("codex"),
    registryEligible: z.boolean().optional(),
    mintingEnabled: z.boolean().optional(),
  }),
  wallet: z.object({
    enabled: z.boolean(),
    tokenWhitelist: z.array(tokenIdEnum),
    primitives: z.object({
      cryptoSend: z.boolean(),
      cryptoReceive: z.boolean(),
      paymentRequest: z.boolean(),
      rewardPayout: z.boolean(),
    }),
  }),
});

const myCartridgeBlockSchema = z.object({
  configured: z.literal(true),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "slug must be URL-safe lowercase with dashes"),
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(2000),
  purpose: z.string().min(1).max(4000),
  category: cartridgeCategoryEnum,
  visibility: cartridgeVisibilityEnum,
  // Reject any client-supplied ownerPersonaId — T0 / spine-resolved only.
  ownerPersonaId: z.never().optional(),
  audience: z.object({
    kind: z.enum(["open", "gated", "franchise", "inner-circle"]),
    estimatedSize: z.enum(["1-10", "10-100", "100-1k", "1k-10k", "10k+"]),
    languages: z.array(z.string().min(2).max(8)),
  }),
  template: z.union([cartridgeTabTemplateIdEnum, z.literal("custom")]),
  tabs: z.array(cartridgeTabSpecSchema).min(1).max(24),
  smartTriad: cartridgeTriadConfigSchema,
  specialists: z.object({
    available: z.array(specialistIdEnum).max(3, "free tier caps available specialists at 3 — payment-gated above"),
    primary: specialistIdEnum.optional(),
  }),
  activeTab: z.object({
    slug: z.string().min(1).max(128),
    catalogId: z.string().min(1).max(128),
    metrics: z.array(z.string()).max(16),
    actions: z.array(z.string()).max(16),
  }),
  membershipModel: z.object({
    rolesEnabled: z.array(cartridgeRoleEnum),
    invitePolicy: z.enum(["owner-only", "admin-allowed", "public-request"]),
    membershipReceipts: z.boolean(),
  }),
  stateChangeReceipts: z.object({
    enabled: z.boolean(),
    receiptKinds: z.array(
      z.enum([
        "created",
        "tab_visibility",
        "member_invited",
        "crypto_send",
        "payment_request",
        "reward_payout",
        "codex_published",
        "activation_submitted",
        "activation_reviewed",
      ]),
    ),
  }),
  triadNomenclature: z.literal("v0.2"),
  catalogueOptIn: z.boolean().optional(),
});

// ─── Shared (v0.1 → v0.4) shapes ──────────────────────────────────────────

const operatorSchema = z.object({
  displayLabel: z.string().min(1).max(200),
  archetype: z.string().min(1).max(200),
  tagline: z.string().max(280).optional(),
  fioHandle: z.string().max(128).optional(),
});

const strategySchema = z.object({
  headline: z.string().min(1).max(280),
  thesis: z.string().min(1).max(8000),
  currentStage: z.string().max(64).optional(),
  blockers: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

const objectiveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(280),
  summary: z.string().max(2000).optional(),
  impact: z.string().min(1).max(64),
  effort: z.string().min(1).max(64),
  horizon: z.string().max(64).optional(),
  successCriteria: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  specialistHint: z.string().max(64).optional(),
});

const partnerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  status: z.string().max(64).optional(),
});

const ventureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  tagline: z.string().max(280).optional(),
  stage: z.string().max(64).optional(),
  cartridgeBindings: z.array(z.string()).optional(),
  northStarKpi: z.string().max(280).optional(),
  objectives: z.array(objectiveSchema),
  partners: z.array(partnerSchema).optional(),
  notes: z.string().max(8000).optional(),
  myCartridge: myCartridgeBlockSchema.optional(),
});

const planActionSchema = z.object({
  title: z.string().min(1).max(280),
  ventureId: z.string().min(1),
  objectiveId: z.string().optional(),
  owner: z.string().optional(),
  due: z.string().optional(),
  blocker: z.string().optional(),
});

const planHorizonSchema = z.object({
  focus: z.string().min(1).max(2000),
  actions: z.array(planActionSchema),
});

const kpiRowSchema = z.object({
  name: z.string().min(1).max(140),
  metric: z.string().min(1).max(280),
  current: z.union([z.string(), z.number(), z.null()]).optional(),
  target: z.union([z.string(), z.number()]),
  horizon: z.string().min(1).max(64),
  ventureId: z.string().optional(),
});

// ─── Top-level VentureQube schema ─────────────────────────────────────────

const REQUIRED_PLAN_HORIZONS = ["today", "next24h", "next7d", "next30d", "next90d"] as const;

export const ventureQubeSchema = z
  .object({
    schemaVersion: schemaVersionEnum,
    emittedAt: z.string().optional(),
    operator: operatorSchema,
    strategy: strategySchema,
    ventures: z.array(ventureSchema).min(1),
    plan: z.record(z.string(), planHorizonSchema),
    specialistPreferences: z.record(z.string(), z.string()).optional(),
    kpiBoard: z.array(kpiRowSchema).optional(),
  })
  .superRefine((value, ctx) => {
    for (const horizon of REQUIRED_PLAN_HORIZONS) {
      if (!(horizon in value.plan)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plan", horizon],
          message: `plan.${horizon} is required`,
        });
      }
    }
    // Legacy "smartTriad" top-level key was the v0.1-era name for the Triad.
    // Per myCartridge PRD v0.2, the Triad lives nested inside each
    // ventures[].myCartridge.smartTriad. Top-level rejection guards against
    // accidental migration drift.
    if ((value as Record<string, unknown>).smartTriad !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smartTriad"],
        message:
          "top-level 'smartTriad' key is deprecated — move the Triad config under ventures[].myCartridge.smartTriad (myCartridge PRD v0.2 §15)",
      });
    }
  });

export type VentureQubeSchemaShape = z.infer<typeof ventureQubeSchema>;

/**
 * Parse + validate a candidate Venture iQube payload.
 *
 * Returns `{ ok: true, data }` when the payload conforms to one of the
 * supported schema versions (v0.1 → v0.4). Returns `{ ok: false, error,
 * issues }` with a flattened Zod issue list on failure.
 */
export function parseVentureQube(payload: unknown):
  | { ok: true; data: VentureQube }
  | { ok: false; error: string; issues: z.ZodIssue[] } {
  const result = ventureQubeSchema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return {
      ok: false,
      error: `${path}: ${first?.message ?? "validation failed"}`,
      issues: result.error.issues,
    };
  }
  return { ok: true, data: result.data as VentureQube };
}

/**
 * True iff `data` is a v0.4 payload AND carries at least one venture with
 * a `myCartridge` block. Convenience helper for callers that need to
 * branch on whether a Cartridge configuration is present.
 */
export function carriesMyCartridge(
  data: VentureQube,
): data is VentureQube & { schemaVersion: "venture-iqube/v0.4" } {
  if (data.schemaVersion !== "venture-iqube/v0.4") return false;
  return data.ventures.some((v) => v.myCartridge !== undefined);
}

// ───────────────────────────────────────────────────────────────────────────
// VentureQube v1.0 — the canonical 13-layer per-venture formation primitive.
// Kept as a SEPARATE schema from the v0.4 operator wrapper above; the two
// validators never share a parse path. Keep in lockstep with the v1.0 section
// of types/ventureQube.ts.
// ───────────────────────────────────────────────────────────────────────────

import type { VentureQubeV1 } from "@/types/ventureQube";

const confidenceScore = z.number().min(0).max(100).nullable();

export const ventureStageEnum = z.enum([
  "concept",
  "validation",
  "formation",
  "launch",
  "growth",
  "scale",
  "institution",
]);

export const founderPathEnum = z.enum(["discover", "validate", "architect"]);

const ventureAgentConsumerEnum = z.enum([
  "aigentMe",
  "devon",
  "marketa",
  "venture-lab",
  "investor-office",
]);

const identityLayerSchema = z.object({
  ventureName: z.string().min(1).max(200),
  ventureSlug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "slug must be URL-safe lowercase with dashes"),
  ventureDescription: z.string().max(8000).optional(),
  stage: ventureStageEnum,
  founderPublicRefs: z.array(z.string()),
  passportPublicRefs: z.array(z.string()).optional(),
  standingPublicRefs: z.array(z.string()).optional(),
  associatedIqubeIds: z.array(z.string()).optional(),
});

const thesisLayerSchema = z.object({
  mission: z.string().max(4000).optional(),
  vision: z.string().max(4000).optional(),
  problemStatement: z.string().max(4000).optional(),
  consequenceThesis: z.string().max(4000).optional(),
  valueProposition: z.string().max(4000).optional(),
  ventureCategory: z.string().max(200).optional(),
  industryTags: z.array(z.string()).optional(),
  marketTags: z.array(z.string()).optional(),
  geographicScope: z.string().max(280).optional(),
});

const intentLayerSchema = z.object({
  founderIntents: z.array(z.string()),
  ventureIntents: z.array(z.string()),
  citizenIntents: z.array(z.string()).optional(),
  commonsIntents: z.array(z.string()).optional(),
});

const signalEvidenceItemSchema = z.object({
  signalId: z.string().min(1),
  signalType: z.string().min(1).max(120),
  signalSource: z.string().min(1).max(200),
  confidenceScore: confidenceScore,
  standingScore: confidenceScore,
  proofOfWorkPotential: confidenceScore.optional(),
  timestamp: z.string(),
});

const signalEvidenceLayerSchema = z.object({
  items: z.array(signalEvidenceItemSchema),
  signalConfidence: confidenceScore,
  opportunityConfidence: confidenceScore,
  demandConfidence: confidenceScore,
  capabilityConfidence: confidenceScore,
});

const archetypeSchema = z.object({
  kind: z.enum([
    "citizen",
    "creator",
    "founder_operator",
    "executive",
    "investor",
    "institution",
    "other",
  ]),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  painPoints: z.array(z.string()).optional(),
  desiredOutcomes: z.array(z.string()).optional(),
  valueReceived: z.string().max(2000).optional(),
  willingnessToPay: z.string().max(280).optional(),
  priorityScore: confidenceScore.optional(),
});

const revenueEngineSchema = z.object({
  engineType: z.enum([
    "subscription",
    "services",
    "licensing",
    "commerce",
    "transaction_fees",
    "intelligence_services",
    "venture_participation",
    "other",
  ]),
  engineName: z.string().min(1).max(200),
  targetArchetypes: z.array(z.string()).optional(),
  pricingModel: z.string().max(2000).optional(),
  pricingAssumptions: z.string().max(2000).optional(),
  priorityLevel: z.number().int().optional(),
  estimatedRevenue: z.string().max(280).optional(),
});

const commercialModelLayerSchema = z.object({
  targetPassports: z.number().int().nonnegative().optional(),
  targetCitizens: z.number().int().nonnegative().optional(),
  targetCreators: z.number().int().nonnegative().optional(),
  targetFounders: z.number().int().nonnegative().optional(),
  targetExecutives: z.number().int().nonnegative().optional(),
  targetInvestors: z.number().int().nonnegative().optional(),
  conversionAssumptions: z.array(z.string()).optional(),
  acquisitionAssumptions: z.array(z.string()).optional(),
  revenueTargets: z.array(z.string()).optional(),
  mrrTargets: z.array(z.string()).optional(),
  arrTargets: z.array(z.string()).optional(),
  growthAssumptions: z.array(z.string()).optional(),
});

const capabilityLayerSchema = z.object({
  requiredCapabilities: z.array(z.string()),
  availableCapabilities: z.array(z.string()),
  capabilityGaps: z.array(z.string()),
  capabilityPriorities: z.array(z.string()),
});

const resourceLayerSchema = z.object({
  requiredPeople: z.array(z.string()).optional(),
  requiredAgents: z.array(z.string()).optional(),
  requiredTools: z.array(z.string()).optional(),
  requiredIqubes: z.array(z.string()).optional(),
  requiredCapital: z.array(z.string()).optional(),
});

const executionPhaseSchema = z.object({
  phaseName: z.string().min(1).max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  objectives: z.array(z.string()),
  deliverables: z.array(z.string()),
  dependencies: z.array(z.string()).optional(),
  successMetrics: z.array(z.string()).optional(),
});

const executionLayerSchema = z.object({
  phases: z.array(executionPhaseSchema),
});

const agentAssignmentSchema = z.object({
  agentType: ventureAgentConsumerEnum,
  agentId: z.string().optional(),
  responsibility: z.string().min(1).max(2000),
  deliverables: z.array(z.string()),
  successMetrics: z.array(z.string()).optional(),
});

const delegationLayerSchema = z.object({
  assignments: z.array(agentAssignmentSchema),
});

// Verification-gated Outcome Accrual Evidence (the refined PoTS). A claim
// accrues nothing to Standing until verificationStatus === 'verified'.
const proofOfOutcomeClaimSchema = z.object({
  claimId: z.string().min(1),
  description: z.string().min(1).max(4000),
  claimedValue: z.string().max(280).optional(),
  timeSavedHours: z.number().nonnegative().optional(),
  riskRepairHours: z.number().nonnegative().optional(),
  riskProfile: z.string().max(280).optional(),
  verificationStatus: z.enum(["claimed", "verified", "rejected"]),
  verifier: z.string().max(280).optional(),
  verifiedAt: z.string().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  accruedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

const outcomeLayerSchema = z.object({
  outcomes: z.array(z.string()).optional(),
  proofOfTimeSaved: z.array(z.string()).optional(),
  proofOfOutcomeClaims: z.array(proofOfOutcomeClaimSchema).optional(),
  standingChanges: z.array(z.string()).optional(),
  lessonsLearned: z.array(z.string()).optional(),
});

const governanceLayerSchema = z.object({
  riskScore: confidenceScore.optional(),
  sensitivityScore: confidenceScore.optional(),
  accuracyScore: confidenceScore.optional(),
  verifiabilityScore: confidenceScore.optional(),
  standingConfidence: confidenceScore.optional(),
  proofOfWorkPotential: confidenceScore.optional(),
  ventureConfidence: confidenceScore.optional(),
});

const institutionalLayerSchema = z.object({
  ventureLabStatus: z.string().max(200).optional(),
  investmentStatus: z.string().max(200).optional(),
  commonsVisibility: z.enum(["private", "commons", "public"]).optional(),
  publicVisibility: z.boolean().optional(),
  institutionalReadiness: confidenceScore.optional(),
  institutionalClassification: z.string().max(200).optional(),
});

export const ventureQubeV1Schema = z.object({
  schemaVersion: z.literal("venture-iqube/v1.0"),
  ventureId: z.string().min(1),
  emittedAt: z.string().optional(),
  lastPath: founderPathEnum.optional(),
  identity: identityLayerSchema,
  thesis: thesisLayerSchema,
  intent: intentLayerSchema,
  signalEvidence: signalEvidenceLayerSchema,
  archetypes: z.array(archetypeSchema),
  revenueArchitecture: z.object({ engines: z.array(revenueEngineSchema) }),
  commercialModel: commercialModelLayerSchema,
  capability: capabilityLayerSchema,
  resource: resourceLayerSchema,
  execution: executionLayerSchema,
  delegation: delegationLayerSchema,
  outcome: outcomeLayerSchema,
  governance: governanceLayerSchema,
  institutional: institutionalLayerSchema,
});

export type VentureQubeV1Shape = z.infer<typeof ventureQubeV1Schema>;

/** Parse + validate a candidate VentureQube v1.0 payload. */
export function parseVentureQubeV1(payload: unknown):
  | { ok: true; data: VentureQubeV1 }
  | { ok: false; error: string; issues: z.ZodIssue[] } {
  const result = ventureQubeV1Schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return {
      ok: false,
      error: `${path}: ${first?.message ?? "validation failed"}`,
      issues: result.error.issues,
    };
  }
  return { ok: true, data: result.data as VentureQubeV1 };
}

// Re-exports so callers don't have to reach into types/ — the schema file
// is the single import point for FE and BE code that wants both the
// runtime validator and the static types.
export type {
  CartridgeSlugV04,
  VentureQube,
  VentureQubeSchemaVersion,
  VentureQubeV1,
};
