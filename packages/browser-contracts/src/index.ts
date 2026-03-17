import { z } from "zod";

export const browserShellToRuntimeTypes = [
  "browser.open.request",
  "browser.close.request",
  "browser.minimize.request",
  "browser.expand.request",
  "browser.focus.changed",
  "browser.takeover.request",
  "browser.resume.request",
  "browser.surface.bounds.changed",
  "browser.drawer.refresh.request",
  "browser.extract.request",
  "browser.save.request",
] as const;

export const browserRuntimeToShellTypes = [
  "browser.mount",
  "browser.unmount",
  "browser.surface.state",
  "browser.step.update",
  "browser.takeover.state",
  "browser.badges.update",
  "browser.drawer.data",
  "browser.action.status",
  "browser.error",
] as const;

export type BrowserShellToRuntimeType = (typeof browserShellToRuntimeTypes)[number];
export type BrowserRuntimeToShellType = (typeof browserRuntimeToShellTypes)[number];

export const browserProviderSchema = z.enum(["browserbase", "mock"]);
export const browserMountModeSchema = z.enum(["overlay", "docked", "panel"]);
export const browserOpenModeSchema = z.enum(["open", "search", "research"]);
export const browserTrustModeSchema = z.enum(["managed", "private-managed", "self-hosted"]);
export const browserPrivacyModeSchema = z.enum(["standard", "sensitive", "sealed"]);
export const browserExecutionModeSchema = z.enum(["playwright", "stagehand", "browser_use"]);
export const browserSessionStatusSchema = z.enum(["active", "suspended", "closed", "error"]);
export const browserShellSurfaceStateSchema = z.enum(["expanded", "minimized", "hidden", "docked"]);
export const browserStepStatusSchema = z.enum(["idle", "running", "waiting", "completed", "error"]);
export const browserHistoryActionSchema = z.enum([
  "session_created",
  "session_mounted",
  "navigate",
  "back",
  "forward",
  "refresh",
  "extract",
  "act",
  "submit",
  "download",
  "takeover_start",
  "takeover_end",
  "resume",
  "save",
  "close",
  "error",
]);

export const browserArtifactTypeSchema = z.enum([
  "extract",
  "screenshot",
  "download",
  "trace",
  "har",
  "pdf",
  "summary",
  "dom_snapshot",
]);

export const surfaceBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

export const browserBadgeStateSchema = z.object({
  sessionId: z.string(),
  trustMode: browserTrustModeSchema,
  privacyMode: browserPrivacyModeSchema,
  executionMode: browserExecutionModeSchema,
  activeAgentLabel: z.string(),
  domain: z.string().optional(),
  provider: browserProviderSchema.optional(),
});

export const browserStepStateSchema = z.object({
  sessionId: z.string(),
  stepId: z.string(),
  label: z.string(),
  status: browserStepStatusSchema,
  message: z.string().optional(),
  actor: z.enum(["user", "agent", "system"]).default("system"),
  timestamp: z.string(),
});

export const browserMountPayloadSchema = z.object({
  sessionId: z.string(),
  provider: browserProviderSchema,
  mountMode: browserMountModeSchema,
  liveView: z.object({
    type: z.literal("iframe"),
    url: z.string(),
  }),
  chrome: z.object({
    title: z.string(),
    domain: z.string().optional(),
    trustMode: browserTrustModeSchema,
    privacyMode: browserPrivacyModeSchema,
    executionMode: browserExecutionModeSchema,
    activeAgentLabel: z.string(),
  }),
  capabilities: z.object({
    canTakeover: z.boolean(),
    canResize: z.boolean(),
    canMinimize: z.boolean(),
    canDock: z.boolean(),
  }),
});

export const browserSurfaceStateSchema = z.object({
  sessionId: z.string(),
  mounted: z.boolean(),
  mountMode: browserMountModeSchema,
  shellSurfaceState: browserShellSurfaceStateSchema,
  focused: z.boolean(),
  takeoverActive: z.boolean(),
  visible: z.boolean(),
  bounds: surfaceBoundsSchema,
  lastMountedAt: z.string().nullable().optional(),
});

export const browserSessionSchema = z.object({
  sessionId: z.string(),
  tenantId: z.string().optional(),
  personaId: z.string().optional(),
  userId: z.string().optional(),
  provider: browserProviderSchema,
  providerSessionId: z.string(),
  executionMode: browserExecutionModeSchema,
  trustMode: browserTrustModeSchema,
  privacyMode: browserPrivacyModeSchema,
  status: browserSessionStatusSchema,
  currentUrl: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentDomain: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().nullable().optional(),
});

export const browserHistoryEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  actionType: browserHistoryActionSchema,
  actorType: z.enum(["user", "agent", "system"]),
  actorId: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  intent: z.string().nullable().optional(),
  stepLabel: z.string().nullable().optional(),
  details: z.record(z.any()).default({}),
  receiptRef: z.string().nullable().optional(),
  occurredAt: z.string(),
});

export const browserArtifactSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  artifactType: browserArtifactTypeSchema,
  sourceUrl: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  storagePath: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
  receiptRef: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const browserReceiptSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  receiptType: z.string(),
  receiptHash: z.string(),
  receiptUri: z.string().nullable().optional(),
  payload: z.record(z.any()).default({}),
  createdAt: z.string(),
});

export const browserSaveRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  artifactId: z.string().nullable().optional(),
  historyEventId: z.string().nullable().optional(),
  destinationType: z.enum(["estate", "codex", "cartridge"]),
  destinationId: z.string().nullable().optional(),
  savedBy: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
  receiptRef: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const browserCreateSessionRequestSchema = z.object({
  intent: z.string().optional(),
  mountMode: browserMountModeSchema.optional(),
  targetUrl: z.string().optional(),
  url: z.string().optional(),
  query: z.string().optional(),
  openMode: browserOpenModeSchema.optional(),
});

export const browserCreateSessionResponseSchema = z.object({
  session: browserSessionSchema,
  mountPayload: browserMountPayloadSchema,
  surfaceState: browserSurfaceStateSchema,
  badges: browserBadgeStateSchema,
});

export const browserSessionResponseSchema = z.object({
  session: browserSessionSchema,
  mountPayload: browserMountPayloadSchema.optional(),
  surfaceState: browserSurfaceStateSchema.optional(),
  badges: browserBadgeStateSchema.optional(),
});

export const browserNavigateRequestSchema = z.object({
  url: z.string(),
});

export const browserSurfaceStateResponseSchema = z.object({
  surfaceState: browserSurfaceStateSchema,
});

export const browserHistoryResponseSchema = z.object({
  history: z.array(browserHistoryEventSchema),
});

export const browserArtifactsResponseSchema = z.object({
  artifacts: z.array(browserArtifactSchema),
});

export const browserReceiptsResponseSchema = z.object({
  receipts: z.array(browserReceiptSchema),
});

export const browserExtractResponseSchema = z.object({
  sessionId: z.string(),
  artifact: browserArtifactSchema,
});

export const browserSaveResponseSchema = z.object({
  saved: z.literal(true),
  sessionId: z.string(),
  save: browserSaveRecordSchema,
});

export const browserDrawerDataSchema = z.object({
  sessionId: z.string(),
  history: z.array(browserHistoryEventSchema),
  artifacts: z.array(browserArtifactSchema),
  receipts: z.array(browserReceiptSchema),
  refreshedAt: z.string(),
});

export const browserActionStatusSchema = z.object({
  sessionId: z.string(),
  action: z.enum(["drawer_refresh", "extract", "save"]),
  status: z.enum(["running", "completed", "error"]),
  message: z.string(),
});

export const browserTakeoverStateSchema = z.object({
  sessionId: z.string(),
  active: z.boolean(),
});

export const browserErrorPayloadSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string(),
  code: z.string().optional(),
});

export const browserRuntimeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("browser.mount"), payload: browserMountPayloadSchema }),
  z.object({ type: z.literal("browser.unmount"), payload: z.object({ sessionId: z.string() }) }),
  z.object({ type: z.literal("browser.surface.state"), payload: browserSurfaceStateSchema }),
  z.object({ type: z.literal("browser.step.update"), payload: browserStepStateSchema }),
  z.object({ type: z.literal("browser.takeover.state"), payload: browserTakeoverStateSchema }),
  z.object({ type: z.literal("browser.badges.update"), payload: browserBadgeStateSchema }),
  z.object({ type: z.literal("browser.drawer.data"), payload: browserDrawerDataSchema }),
  z.object({ type: z.literal("browser.action.status"), payload: browserActionStatusSchema }),
  z.object({ type: z.literal("browser.error"), payload: browserErrorPayloadSchema }),
]);

export type SurfaceBounds = z.infer<typeof surfaceBoundsSchema>;
export type BrowserBadgeState = z.infer<typeof browserBadgeStateSchema>;
export type BrowserStepState = z.infer<typeof browserStepStateSchema>;
export type BrowserMountPayload = z.infer<typeof browserMountPayloadSchema>;
export type BrowserSurfaceState = z.infer<typeof browserSurfaceStateSchema>;
export type BrowserSession = z.infer<typeof browserSessionSchema>;
export type BrowserHistoryEvent = z.infer<typeof browserHistoryEventSchema>;
export type BrowserArtifact = z.infer<typeof browserArtifactSchema>;
export type BrowserReceipt = z.infer<typeof browserReceiptSchema>;
export type BrowserSaveRecord = z.infer<typeof browserSaveRecordSchema>;
export type BrowserCreateSessionRequest = z.infer<typeof browserCreateSessionRequestSchema>;
export type BrowserCreateSessionResponse = z.infer<typeof browserCreateSessionResponseSchema>;
export type BrowserSessionResponse = z.infer<typeof browserSessionResponseSchema>;
export type BrowserNavigateRequest = z.infer<typeof browserNavigateRequestSchema>;
export type BrowserSurfaceStateResponse = z.infer<typeof browserSurfaceStateResponseSchema>;
export type BrowserHistoryResponse = z.infer<typeof browserHistoryResponseSchema>;
export type BrowserArtifactsResponse = z.infer<typeof browserArtifactsResponseSchema>;
export type BrowserReceiptsResponse = z.infer<typeof browserReceiptsResponseSchema>;
export type BrowserExtractResponse = z.infer<typeof browserExtractResponseSchema>;
export type BrowserSaveResponse = z.infer<typeof browserSaveResponseSchema>;
export type BrowserDrawerDataPayload = z.infer<typeof browserDrawerDataSchema>;
export type BrowserActionStatus = z.infer<typeof browserActionStatusSchema>;
export type BrowserTakeoverState = z.infer<typeof browserTakeoverStateSchema>;
export type BrowserErrorPayload = z.infer<typeof browserErrorPayloadSchema>;
export type BrowserRuntimeEvent = z.infer<typeof browserRuntimeEventSchema>;
