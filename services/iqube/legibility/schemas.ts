/**
 * iQube Agent Legibility Profile v0.1 — Zod schemas
 *
 * Runtime validation for every payload emitted by the legibility
 * routes. Every route MUST run its response through `safeParse`
 * before serialisation; a validation failure logs the issue and
 * returns a 500 with `{ error: 'Invalid iQubeCard response' }`
 * (PRD §11) rather than leaking a malformed contract.
 *
 * The types in `types/iqube/legibility.ts` are the compile-time
 * contract; these schemas are the runtime contract. They MUST stay
 * in lockstep — any field added to the type must be added here,
 * and vice versa. The pair acts as the safety belt that keeps
 * agent-readable JSON from drifting into private-data territory.
 */

import { z } from 'zod';
import type {
  IQubeCard,
  IQubeCatalog,
  IQubeActionsResponse,
  IQubePolicyResponse,
} from '@/types/iqube/legibility';

// ── Primitive enums ─────────────────────────────────────────────────────

export const IQubePrimitiveTypeSchema = z.enum([
  'DataQube',
  'ContentQube',
  'ToolQube',
  'ModelQube',
  'AigentQube',
  'ClusterQube',
]);

export const IQubeLifecycleStateSchema = z.enum([
  'draft',
  'wip',
  'canonized',
  'deprecated',
  'archived',
]);

export const IQubeVisibilityStateSchema = z.enum([
  'private',
  'public_meta_private_payload',
  'public',
  'unlisted',
]);

export const IQubeAccessGatingSchema = z.enum([
  'open',
  'token',
  'payment',
  'persona',
  'did',
  'allowlist',
  'role',
  'custom',
]);

export const IQubeIdentityStateSchema = z.enum([
  'anonymous',
  'pseudonymous',
  'identifiable',
  'delegated',
]);

export const IQubeAgentActionSchema = z.enum([
  'discover',
  'read_meta',
  'read_summary',
  'request_access',
  'read_payload',
  'derive_summary',
  'transform',
  'cite',
  'propose_update',
  'mint_derivative',
  'fork',
  'record_receipt',
  'revoke_access',
  'audit_state',
]);

// ── Composite shapes ────────────────────────────────────────────────────

export const IQubeRegistryRefSchema = z.object({
  canonical_url: z.string().url(),
  registry_id: z.string().optional(),
  content_hash: z.string().optional(),
  metadata_hash: z.string().optional(),
  provenance_receipts: z.array(z.string()).optional(),
});

export const IQubeMetaSummarySchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  creator_identity_state: IQubeIdentityStateSchema,
  owner_identity_state: IQubeIdentityStateSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  canonicalized_at: z.string().optional(),
});

export const IQubeAccessSummarySchema = z.object({
  gating: z.array(IQubeAccessGatingSchema),
  requires_authentication: z.boolean(),
  requires_payment: z.boolean(),
  requires_token: z.boolean(),
  private_payload_available: z.boolean(),
  payload_disclosure: z.enum(['none', 'summary_only', 'policy_mediated', 'open']),
});

export const IQubeAgentPermissionsSchema = z.object({
  allowed_actions: z.array(IQubeAgentActionSchema),
  disallowed_actions: z.array(IQubeAgentActionSchema).optional(),
  requires_policy_check: z.array(IQubeAgentActionSchema).optional(),
  requires_dvn_receipt: z.array(IQubeAgentActionSchema).optional(),
});

export const IQubePolicyRefSchema = z.object({
  policy_url: z.string().url(),
  policy_id: z.string().optional(),
  dvn_required_for_state_change: z.boolean(),
  state_change_verbs: z.array(IQubeAgentActionSchema),
});

export const IQubeSupportedInterfacesSchema = z.object({
  a2a: z.string().url().optional(),
  mcp: z.string().url().optional(),
  api_catalog: z.string().url().optional(),
  runtime_url: z.string().url().optional(),
  studio_url: z.string().url().optional(),
}).optional();

export const IQubeCardLinksSchema = z.object({
  self: z.string(),
  actions: z.string().optional(),
  policy: z.string().optional(),
  request_access: z.string().optional(),
  canonical_content: z.string().optional(),
}).optional();

// ── Top-level ───────────────────────────────────────────────────────────

// AigentQube governance — Stage 7. Only present on AigentQube cards.
// Validates T1/T2-only shape; T0 leak (personaId / authProfileId / rootDid)
// would fail the Zod schema because no T0 field is keyed here.
export const IQubeAgentGovernanceSchema = z.object({
  root_agent_id: z.string().min(1),
  deployment_id: z.string().optional(),
  persona_alias_commitment: z.string().optional(),
  rights: z.object({
    allowed_actions: z.array(IQubeAgentActionSchema),
    cartridge_scopes: z.array(z.string()),
    tool_scopes: z.array(z.string()),
    data_scopes: z.array(z.string()),
    payment_authority: z
      .object({
        currency: z.enum(['qc', 'usdc', 'usd']),
        max_amount_per_tx: z.number().int().nonnegative(),
        max_amount_per_period: z
          .object({
            amount: z.number().int().nonnegative(),
            period: z.enum(['day', 'week', 'month']),
          })
          .optional(),
      })
      .optional(),
  }),
  constraints: z.object({
    prohibited_actions: z.array(IQubeAgentActionSchema),
    prohibited_cartridges: z.array(z.string()),
    must_disclose_as_agent: z.boolean(),
    requires_human_approval: z.array(IQubeAgentActionSchema),
  }),
  obligations: z.object({
    receipt_required_for: z.array(IQubeAgentActionSchema),
    charter_accepted: z.boolean(),
    charter_version: z.string(),
    trust_band: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
  }),
  revocation: z.object({
    revocable_by: z.array(z.enum(['root_owner', 'cartridge_admin', 'platform_admin'])),
    revocation_receipt_required: z.boolean(),
  }),
});

export const IQubeCardSchema = z.object({
  type: z.literal('iQubeCard'),
  version: z.literal('0.1'),
  iqube_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  primitive_type: IQubePrimitiveTypeSchema,
  lifecycle_state: IQubeLifecycleStateSchema,
  visibility_state: IQubeVisibilityStateSchema,
  registry: IQubeRegistryRefSchema,
  metaqube: IQubeMetaSummarySchema,
  access: IQubeAccessSummarySchema,
  agent_permissions: IQubeAgentPermissionsSchema,
  policy: IQubePolicyRefSchema,
  supported_interfaces: IQubeSupportedInterfacesSchema,
  links: IQubeCardLinksSchema,
  agent_governance: IQubeAgentGovernanceSchema.optional(),
}) satisfies z.ZodType<IQubeCard>;

export const IQubeCatalogEntrySchema = z.object({
  iqube_id: z.string().min(1),
  name: z.string().min(1),
  primitive_type: IQubePrimitiveTypeSchema,
  lifecycle_state: IQubeLifecycleStateSchema,
  visibility_state: IQubeVisibilityStateSchema,
  card_url: z.string(),
  registry_url: z.string().url(),
});

export const IQubeCatalogSchema = z.object({
  type: z.literal('iQubeCatalog'),
  version: z.literal('0.1'),
  generated_at: z.string(),
  registry: z.object({
    name: z.string(),
    canonical_url: z.string().url(),
    description: z.string().optional(),
  }),
  supported_profiles: z.array(z.string()),
  iqubes: z.array(IQubeCatalogEntrySchema),
}) satisfies z.ZodType<IQubeCatalog>;

export const IQubeActionSchema = z.object({
  verb: IQubeAgentActionSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  href: z.string(),
  requires_authentication: z.boolean().optional(),
  requires_policy_check: z.boolean().optional(),
  requires_dvn_receipt: z.boolean().optional(),
});

export const IQubeActionsResponseSchema = z.object({
  iqube_id: z.string().min(1),
  actions: z.array(IQubeActionSchema),
}) satisfies z.ZodType<IQubeActionsResponse>;

export const IQubePolicyResponseSchema = z.object({
  iqube_id: z.string().min(1),
  policy_id: z.string().optional(),
  visibility_state: IQubeVisibilityStateSchema,
  allowed_actions: z.array(IQubeAgentActionSchema),
  requires_policy_check: z.array(IQubeAgentActionSchema),
  requires_dvn_receipt: z.array(IQubeAgentActionSchema),
  private_payload_exposed: z.literal(false),
}) satisfies z.ZodType<IQubePolicyResponse>;

// ── Helper ──────────────────────────────────────────────────────────────

/**
 * Standardised validator. Routes use this so a contract drift never
 * leaks malformed JSON to agents. Returns the parsed value on
 * success; logs the error and returns null on failure (the route
 * then emits a 500 with the PRD-mandated error body).
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  candidate: unknown,
  context: string,
): T | null {
  const result = schema.safeParse(candidate);
  if (!result.success) {
    console.error(`[iqube-legibility] ${context} failed schema validation`, result.error.flatten());
    return null;
  }
  return result.data;
}
