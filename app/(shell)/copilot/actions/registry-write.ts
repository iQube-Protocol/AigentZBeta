/**
 * Registry Write Actions (Phase 1)
 * 
 * These tools allow the Platform Copilot to create and modify
 * tenants, iQubes, and Aigent configurations.
 * 
 * LIVE: Connected to QubeBase (Supabase) with fallback to mock data.
 */

import * as QubeBase from "../services/qubebase";

/**
 * Create a new tenant
 */
export const createTenantAction = {
  name: "registry_create_tenant",
  description: "Create a new tenant in the Aigent Z platform. Requires platform_admin role.",
  parameters: [
    {
      name: "name",
      type: "string" as const,
      description: "The display name for the tenant.",
      required: true,
    },
    {
      name: "slug",
      type: "string" as const,
      description: "URL-friendly slug for the tenant (lowercase, no spaces).",
      required: true,
    },
    {
      name: "franchiseId",
      type: "string" as const,
      description: "The franchise ID this tenant belongs to.",
      required: false,
    },
    {
      name: "chains",
      type: "string" as const,
      description: "Comma-separated list of blockchain chains to enable (e.g., 'bitcoin,polygon,base').",
      required: false,
    },
  ],
  handler: async ({ name, slug, franchiseId, chains }: { 
    name: string; 
    slug: string; 
    franchiseId?: string;
    chains?: string;
  }) => {
    const chainList = chains ? chains.split(",").map(c => c.trim()) : ["polygon"];

    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.createTenant({
        name,
        slug,
        franchiseId,
        chains: chainList,
      });
      
      if (result.success && result.tenant) {
        // Log the event
        await QubeBase.logEvent({
          tenantId: result.tenant.id,
          eventType: "action",
          action: "registry_create_tenant",
          details: { name, slug, chains: chainList },
        });

        return {
          success: true,
          source: "live",
          operation: "create_tenant",
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
            franchiseId: result.tenant.franchise_id,
            chains: result.tenant.chains,
            active: result.tenant.active,
            createdAt: result.tenant.created_at,
          },
          message: `Tenant "${name}" created successfully with ID ${result.tenant.id}`,
        };
      }
      
      if (result.error) {
        return {
          success: false,
          source: "live",
          operation: "create_tenant",
          error: result.error,
          message: `Failed to create tenant: ${result.error}`,
        };
      }
    }

    // Fallback to mock
    const tenantId = `tenant_${Date.now()}`;
    return {
      success: true,
      source: "mock",
      operation: "create_tenant",
      tenant: {
        id: tenantId,
        name,
        slug,
        franchiseId: franchiseId || "franchise_main",
        chains: chainList,
        active: true,
        createdAt: new Date().toISOString(),
      },
      message: `Tenant "${name}" created successfully with ID ${tenantId} (mock)`,
    };
  },
};

/**
 * Create a new iQube
 */
export const createIQubeAction = {
  name: "registry_create_iQube",
  description: "Create a new iQube (DataQube, ContentQube, ToolQube, ModelQube, AigentQube, or WalletQube) for a tenant.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to create the iQube for.",
      required: true,
    },
    {
      name: "type",
      type: "string" as const,
      description: "The type of iQube: DataQube, ContentQube, ToolQube, ModelQube, AigentQube, or WalletQube.",
      required: true,
    },
    {
      name: "name",
      type: "string" as const,
      description: "Display name for the iQube.",
      required: true,
    },
    {
      name: "description",
      type: "string" as const,
      description: "Description of the iQube's purpose.",
      required: false,
    },
  ],
  handler: async ({ tenantId, type, name, description }: {
    tenantId: string;
    type: string;
    name: string;
    description?: string;
  }) => {
    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.createIQube({
        tenantId,
        type,
        name,
        description,
      });
      
      if (result.success && result.iqube) {
        // Log the event
        await QubeBase.logEvent({
          tenantId,
          eventType: "action",
          action: "registry_create_iQube",
          details: { type, name, iQubeId: result.iqube.id },
        });

        return {
          success: true,
          source: "live",
          operation: "create_iQube",
          iQube: {
            id: result.iqube.id,
            tenantId: result.iqube.tenant_id,
            type: result.iqube.iqube_type,
            name: result.iqube.name,
            description: result.iqube.description,
            status: "active",
            createdAt: result.iqube.created_at,
          },
          message: `${type} "${name}" created successfully with ID ${result.iqube.id}`,
        };
      }
      
      if (result.error) {
        return {
          success: false,
          source: "live",
          operation: "create_iQube",
          error: result.error,
          message: `Failed to create iQube: ${result.error}`,
        };
      }
    }

    // Fallback to mock
    const iQubeId = `iqube_${Date.now()}`;
    return {
      success: true,
      source: "mock",
      operation: "create_iQube",
      iQube: {
        id: iQubeId,
        tenantId,
        type,
        name,
        description: description || "",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      message: `${type} "${name}" created successfully with ID ${iQubeId} (mock)`,
    };
  },
};

/**
 * Link an Aigent to an iQube
 */
export const linkAigentToIQubeAction = {
  name: "registry_link_aigent_to_iQube",
  description: "Link an Aigent to an iQube, establishing a relationship in the registry.",
  parameters: [
    {
      name: "aigentId",
      type: "string" as const,
      description: "The Aigent ID to link.",
      required: true,
    },
    {
      name: "iQubeId",
      type: "string" as const,
      description: "The iQube ID to link to.",
      required: true,
    },
    {
      name: "relationshipType",
      type: "string" as const,
      description: "Type of relationship: 'owns', 'uses', 'manages', 'created'.",
      required: false,
    },
  ],
  handler: async ({ aigentId, iQubeId, relationshipType }: {
    aigentId: string;
    iQubeId: string;
    relationshipType?: string;
  }) => {
    // TODO: Implement actual linking in registry
    const linkId = `link_${Date.now()}`;
    
    return {
      success: true,
      operation: "link_aigent_to_iQube",
      link: {
        id: linkId,
        aigentId,
        iQubeId,
        relationshipType: relationshipType || "uses",
        createdAt: new Date().toISOString(),
      },
      message: `Aigent ${aigentId} linked to iQube ${iQubeId} with relationship "${relationshipType || "uses"}"`,
    };
  },
};

/**
 * Update iQube metadata
 */
export const updateIQubeMetadataAction = {
  name: "registry_update_iQube_metadata",
  description: "Update the metadata of an existing iQube.",
  parameters: [
    {
      name: "iQubeId",
      type: "string" as const,
      description: "The iQube ID to update.",
      required: true,
    },
    {
      name: "name",
      type: "string" as const,
      description: "New name for the iQube (optional).",
      required: false,
    },
    {
      name: "description",
      type: "string" as const,
      description: "New description for the iQube (optional).",
      required: false,
    },
    {
      name: "status",
      type: "string" as const,
      description: "New status: 'active', 'inactive', 'archived' (optional).",
      required: false,
    },
  ],
  handler: async ({ iQubeId, name, description, status }: {
    iQubeId: string;
    name?: string;
    description?: string;
    status?: string;
  }) => {
    // TODO: Implement actual metadata update in registry
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (status) updates.status = status;
    
    return {
      success: true,
      operation: "update_iQube_metadata",
      iQubeId,
      updates,
      updatedAt: new Date().toISOString(),
      message: `iQube ${iQubeId} metadata updated: ${Object.keys(updates).join(", ")}`,
    };
  },
};

/**
 * Export all registry write actions
 */
export const registryWriteActions = [
  createTenantAction,
  createIQubeAction,
  linkAigentToIQubeAction,
  updateIQubeMetadataAction,
];
