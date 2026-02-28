import { z } from "zod";

export const MetaMeEnvelopeSchemaVersion = "metame.envelope.v1" as const;

export const MetaMeEnvelopeTypeSchema = z.enum([
  "prompt",
  "inference",
  "iqube_ref",
  "action",
  "system",
]);
export type MetaMeEnvelopeType = z.infer<typeof MetaMeEnvelopeTypeSchema>;

export const MetaMeEnvelopeIntentSchema = z.enum([
  "be",
  "earn",
  "play",
  "make",
  "share",
  "wallet",
  "task",
  "reward",
  "find",
  "unknown",
]);
export type MetaMeEnvelopeIntent = z.infer<typeof MetaMeEnvelopeIntentSchema>;

export const MetaMeEnvelopeChannelTypeSchema = z.enum([
  "runtime",
  "group",
  "dm",
  "system",
]);
export type MetaMeEnvelopeChannelType = z.infer<typeof MetaMeEnvelopeChannelTypeSchema>;

export const MetaMeEnvelopeThreadSchema = z.object({
  channel_type: MetaMeEnvelopeChannelTypeSchema,
  channel_id: z.string().min(1),
  thread_id: z.string().min(1),
});
export type MetaMeEnvelopeThread = z.infer<typeof MetaMeEnvelopeThreadSchema>;

export const MetaMeEnvelopeSenderSchema = z.object({
  agent_id: z.string().min(1).optional(),
  persona_id: z.string().min(1).optional(),
  display_name: z.string().min(1).optional(),
  xmtp_inbox_id: z.string().min(1).optional(),
  did: z.string().min(1).optional(),
});
export type MetaMeEnvelopeSender = z.infer<typeof MetaMeEnvelopeSenderSchema>;

export const MetaMeEnvelopeActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  params: z.record(z.unknown()).optional(),
});
export type MetaMeEnvelopeAction = z.infer<typeof MetaMeEnvelopeActionSchema>;

export const MetaMeEnvelopeInferenceSchema = z.object({
  provider_id: z.string().min(1).optional(),
  model_id: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});
export type MetaMeEnvelopeInference = z.infer<typeof MetaMeEnvelopeInferenceSchema>;

export const MetaMeEnvelopePayloadSchema = z.object({
  text: z.string().optional(),
  iqube_refs: z.array(z.string().min(1)).optional(),
  action: MetaMeEnvelopeActionSchema.optional(),
  inference: MetaMeEnvelopeInferenceSchema.optional(),
  data: z.record(z.unknown()).optional(),
});
export type MetaMeEnvelopePayload = z.infer<typeof MetaMeEnvelopePayloadSchema>;

export const MetaMeEnvelopeMetaSchema = z.object({
  source: z.enum(["xmtp", "qubetalk", "runtime_shell", "ios_app", "server"]),
  timestamp: z.string().min(1),
  trust_score: z.number().min(0).max(10).optional(),
  reliability_score: z.number().min(0).max(10).optional(),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  request_id: z.string().min(1).optional(),
  trace_id: z.string().min(1).optional(),
});
export type MetaMeEnvelopeMeta = z.infer<typeof MetaMeEnvelopeMetaSchema>;

export const MetaMeRuntimeEnvelopeSchema = z.object({
  schema_version: z.literal(MetaMeEnvelopeSchemaVersion),
  envelope_id: z.string().min(1),
  type: MetaMeEnvelopeTypeSchema,
  intent: MetaMeEnvelopeIntentSchema,
  thread: MetaMeEnvelopeThreadSchema,
  sender: MetaMeEnvelopeSenderSchema,
  payload: MetaMeEnvelopePayloadSchema,
  meta: MetaMeEnvelopeMetaSchema,
});
export type MetaMeRuntimeEnvelope = z.infer<typeof MetaMeRuntimeEnvelopeSchema>;

