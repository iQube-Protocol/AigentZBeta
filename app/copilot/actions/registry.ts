/**
 * Registry Backend Actions (Phase 0: Read-only)
 * 
 * These tools allow the Platform Copilot to inspect the iQube registry,
 * tenants, and Aigents.
 * 
 * LIVE: Connected to QubeBase (Supabase) with fallback to mock data.
 */

import * as QubeBase from "../services/qubebase";

/**
 * List all tenants in the platform
 */
export const listTenantsAction = {
  name: "listTenants",
  description: "List all tenants in the Aigent Z platform. Returns tenant ID, name, slug, and active status.",
  parameters: [
    {
      name: "activeOnly",
      type: "boolean" as const,
      description: "If true, only return active tenants. Defaults to true.",
      required: false,
    },
  ],
  handler: async ({ activeOnly = true }: { activeOnly?: boolean }) => {
    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.listTenants(activeOnly);
      if (result.success && result.tenants.length > 0) {
        return {
          success: true,
          source: "live",
          tenants: result.tenants.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            active: t.active,
            franchiseId: t.franchise_id,
          })),
          count: result.tenants.length,
        };
      }
    }

    // Fallback to mock data
    return {
      success: true,
      source: "mock",
      tenants: [
        {
          id: "tenant_1",
          name: "Kn0w1",
          slug: "kn0w1",
          active: true,
          franchiseId: "franchise_main",
        },
        {
          id: "tenant_2",
          name: "KNYT Books",
          slug: "knyt-books",
          active: true,
          franchiseId: "franchise_main",
        },
      ],
      count: 2,
    };
  },
};

/**
 * Get tenant details by ID or slug
 */
export const getTenantAction = {
  name: "getTenant",
  description: "Get detailed information about a specific tenant by ID or slug.",
  parameters: [
    {
      name: "tenantIdOrSlug",
      type: "string" as const,
      description: "The tenant ID or slug to look up.",
      required: true,
    },
  ],
  handler: async ({ tenantIdOrSlug }: { tenantIdOrSlug: string }) => {
    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.getTenant(tenantIdOrSlug);
      if (result.success && result.tenant) {
        return {
          success: true,
          source: "live",
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
            active: result.tenant.active,
            franchiseId: result.tenant.franchise_id,
            chains: result.tenant.chains || ["polygon"],
            createdAt: result.tenant.created_at,
          },
        };
      }
    }

    // Fallback to mock data
    return {
      success: true,
      source: "mock",
      tenant: {
        id: "tenant_1",
        name: "Kn0w1",
        slug: "kn0w1",
        active: true,
        franchiseId: "franchise_main",
        chains: ["bitcoin", "ethereum", "polygon"],
        features: {
          agenticWallet: true,
          smartMenu: true,
          didQube: true,
        },
        createdAt: new Date().toISOString(),
      },
    };
  },
};

/**
 * List Aigents for a tenant
 */
export const listAigentsForTenantAction = {
  name: "listAigentsForTenant",
  description: "List all Aigents (AI agents) configured for a specific tenant.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to list Aigents for.",
      required: true,
    },
  ],
  handler: async ({ tenantId }: { tenantId: string }) => {
    // TODO: Implement actual Aigent listing from registry
    return {
      success: true,
      tenantId,
      aigents: [
        {
          id: "aigent_1",
          name: "Content Curator",
          type: "AigentQube",
          status: "active",
          capabilities: ["content_analysis", "recommendation"],
        },
        {
          id: "aigent_2",
          name: "Payment Orchestrator",
          type: "AigentQube",
          status: "active",
          capabilities: ["payment_processing", "invoice_generation"],
        },
      ],
      count: 2,
    };
  },
};

/**
 * List iQubes for a tenant by type
 */
export const listIQubesForTenantAction = {
  name: "listIQubesForTenant",
  description: "List all iQubes of a specific type for a tenant. Types include DataQube, ContentQube, ToolQube, ModelQube, AigentQube, WalletQube.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to list iQubes for.",
      required: true,
    },
    {
      name: "iQubeType",
      type: "string" as const,
      description: "The type of iQube to filter by. Options: DataQube, ContentQube, ToolQube, ModelQube, AigentQube, WalletQube, or 'all' for all types.",
      required: false,
    },
  ],
  handler: async ({ tenantId, iQubeType = "all" }: { tenantId: string; iQubeType?: string }) => {
    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const typeFilter = iQubeType === "all" ? undefined : iQubeType;
      const result = await QubeBase.listIQubes(tenantId, typeFilter);
      if (result.success && result.iqubes.length > 0) {
        return {
          success: true,
          source: "live",
          tenantId,
          iQubeType,
          iQubes: result.iqubes.map(iq => ({
            id: iq.id,
            type: iq.iqube_type,
            name: iq.name,
            description: iq.description,
            status: "active",
            instanceType: iq.instance_type,
            businessModel: iq.business_model,
            scores: {
              sensitivity: iq.sensitivity_score,
              accuracy: iq.accuracy_score,
              verifiability: iq.verifiability_score,
              risk: iq.risk_score,
            },
          })),
          count: result.iqubes.length,
        };
      }
    }

    // Fallback to mock data
    return {
      success: true,
      source: "mock",
      tenantId,
      iQubeType,
      iQubes: [
        {
          id: "iqube_1",
          type: "DataQube",
          name: "Customer Registry",
          status: "active",
          metadata: {
            schema: "customer_v1",
            recordCount: 1543,
          },
        },
        {
          id: "iqube_2",
          type: "WalletQube",
          name: "Primary Agentic Wallet",
          status: "active",
          metadata: {
            chains: ["bitcoin", "polygon"],
            addresses: {
              bitcoin: "bc1q...",
              polygon: "0x...",
            },
          },
        },
        {
          id: "iqube_3",
          type: "ToolQube",
          name: "Payment Processor",
          status: "active",
          metadata: {
            mcp: true,
            riskRating: "low",
          },
        },
      ],
      count: 3,
    };
  },
};

/**
 * Export all registry actions
 */
export const registryActions = [
  listTenantsAction,
  getTenantAction,
  listAigentsForTenantAction,
  listIQubesForTenantAction,
];
