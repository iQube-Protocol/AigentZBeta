/**
 * Governance & Logging Actions (Phase 5)
 * 
 * These tools provide:
 * - Event logging as EventQubes
 * - Simulation/dry-run mode
 * - RBAC enforcement
 * - Rate limits and value caps
 * - Audit trail
 * 
 * LIVE: Connected to QubeBase (Supabase) with fallback to mock data.
 */

import * as QubeBase from "../services/qubebase";

/**
 * Log an event
 */
export const logEventAction = {
  name: "governance_log_event",
  description: "Log an event to the EventQube audit trail. All significant operations should be logged.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID for the event.",
      required: true,
    },
    {
      name: "eventType",
      type: "string" as const,
      description: "Type of event: 'action', 'workflow', 'error', 'security', 'payment', 'identity'.",
      required: true,
    },
    {
      name: "action",
      type: "string" as const,
      description: "The action that was performed.",
      required: true,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "The Persona ID that performed the action.",
      required: false,
    },
    {
      name: "details",
      type: "string" as const,
      description: "JSON string of additional event details.",
      required: false,
    },
    {
      name: "severity",
      type: "string" as const,
      description: "Severity level: 'info', 'warning', 'error', 'critical'.",
      required: false,
    },
  ],
  handler: async ({ tenantId, eventType, action, personaId, details, severity }: {
    tenantId: string;
    eventType: string;
    action: string;
    personaId?: string;
    details?: string;
    severity?: string;
  }) => {
    const parsedDetails = details ? JSON.parse(details) : {};

    // Use live QubeBase logging
    const result = await QubeBase.logEvent({
      tenantId,
      eventType,
      action,
      personaId,
      details: parsedDetails,
      severity,
    });

    if (result.success && result.event) {
      return {
        success: true,
        source: QubeBase.isQubeBaseConfigured() ? "live" : "console",
        event: {
          id: result.event.id,
          tenantId: result.event.tenant_id,
          eventType: result.event.event_type,
          action: result.event.action,
          personaId: result.event.persona_id || "system",
          details: result.event.details,
          severity: result.event.severity,
          timestamp: result.event.created_at,
          eventQubeId: `eventqube_${tenantId}`,
        },
        message: `Event logged: ${eventType}/${action}`,
      };
    }

    return {
      success: false,
      error: result.error,
      message: `Failed to log event: ${result.error}`,
    };
  },
};

/**
 * Get audit trail
 */
export const getAuditTrailAction = {
  name: "governance_get_audit_trail",
  description: "Retrieve the audit trail of events for a tenant. Useful for compliance and debugging.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to get audit trail for.",
      required: true,
    },
    {
      name: "eventType",
      type: "string" as const,
      description: "Optional filter by event type.",
      required: false,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "Optional filter by Persona ID.",
      required: false,
    },
    {
      name: "startDate",
      type: "string" as const,
      description: "Optional start date (ISO format).",
      required: false,
    },
    {
      name: "limit",
      type: "number" as const,
      description: "Maximum number of events to return (default: 50).",
      required: false,
    },
  ],
  handler: async ({ tenantId, eventType, personaId, startDate, limit }: {
    tenantId: string;
    eventType?: string;
    personaId?: string;
    startDate?: string;
    limit?: number;
  }) => {
    const maxLimit = limit || 50;

    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.getAuditTrail({
        tenantId,
        eventType,
        personaId,
        limit: maxLimit,
      });
      
      if (result.success) {
        return {
          success: true,
          source: "live",
          tenantId,
          filters: { eventType, personaId, startDate, limit: maxLimit },
          events: result.events.map(e => ({
            id: e.id,
            eventType: e.event_type,
            action: e.action,
            personaId: e.persona_id,
            details: e.details,
            severity: e.severity,
            timestamp: e.created_at,
          })),
          count: result.events.length,
        };
      }
    }

    // Fallback to mock data
    const mockEvents = [
      {
        id: "event_1",
        eventType: "action",
        action: "wallet_send_qct",
        personaId: "persona_alice",
        details: { amount: "100", to: "bob@aigent" },
        severity: "info",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "event_2",
        eventType: "workflow",
        action: "flow_deploy_agentic_wallet",
        personaId: "persona_admin",
        details: { chains: ["polygon", "bitcoin"] },
        severity: "info",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "event_3",
        eventType: "security",
        action: "identity_create_kybe_did",
        personaId: "persona_admin",
        details: { purpose: "primary_identity" },
        severity: "warning",
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        id: "event_4",
        eventType: "payment",
        action: "wallet_send_qoyn",
        personaId: "persona_alice",
        details: { amount: "50", chain: "bitcoin" },
        severity: "info",
        timestamp: new Date(Date.now() - 14400000).toISOString(),
      },
    ];

    let filtered = mockEvents;
    if (eventType) filtered = filtered.filter(e => e.eventType === eventType);
    if (personaId) filtered = filtered.filter(e => e.personaId === personaId);
    filtered = filtered.slice(0, maxLimit);

    return {
      success: true,
      source: "mock",
      tenantId,
      filters: { eventType, personaId, startDate, limit: maxLimit },
      events: filtered,
      count: filtered.length,
      totalEvents: mockEvents.length,
    };
  },
};

/**
 * Check RBAC permissions
 */
export const checkPermissionsAction = {
  name: "governance_check_permissions",
  description: "Check if a Persona has permission to perform a specific action. Use before executing sensitive operations.",
  parameters: [
    {
      name: "personaId",
      type: "string" as const,
      description: "The Persona ID to check permissions for.",
      required: true,
    },
    {
      name: "action",
      type: "string" as const,
      description: "The action to check permission for.",
      required: true,
    },
    {
      name: "resource",
      type: "string" as const,
      description: "The resource the action is being performed on.",
      required: false,
    },
  ],
  handler: async ({ personaId, action, resource }: {
    personaId: string;
    action: string;
    resource?: string;
  }) => {
    // TODO: Implement actual RBAC check against QubeBase
    // Mock permission matrix
    const adminActions = [
      "registry_create_tenant",
      "identity_create_kybe_did",
      "mcp_register_toolqube",
      "governance_set_rate_limit",
    ];
    
    const writeActions = [
      "wallet_send_qct",
      "wallet_send_qoyn",
      "identity_create_persona",
      "smartmenu_publish",
    ];

    const isAdmin = personaId.includes("admin");
    const isAdminAction = adminActions.includes(action);
    const isWriteAction = writeActions.includes(action);

    let allowed = true;
    let reason = "Permission granted";

    if (isAdminAction && !isAdmin) {
      allowed = false;
      reason = "Action requires admin role";
    }

    return {
      success: true,
      check: {
        personaId,
        action,
        resource: resource || "global",
        allowed,
        reason,
        role: isAdmin ? "admin" : "user",
        checkedAt: new Date().toISOString(),
      },
    };
  },
};

/**
 * Set rate limit
 */
export const setRateLimitAction = {
  name: "governance_set_rate_limit",
  description: "Set rate limits for a Persona or tenant. Requires admin role.",
  parameters: [
    {
      name: "targetType",
      type: "string" as const,
      description: "Target type: 'persona' or 'tenant'.",
      required: true,
    },
    {
      name: "targetId",
      type: "string" as const,
      description: "The Persona ID or tenant ID to set limits for.",
      required: true,
    },
    {
      name: "action",
      type: "string" as const,
      description: "The action to rate limit (or 'all' for global limit).",
      required: true,
    },
    {
      name: "maxPerHour",
      type: "number" as const,
      description: "Maximum calls per hour.",
      required: true,
    },
    {
      name: "maxValuePerDay",
      type: "string" as const,
      description: "Maximum value (in QCT) per day for payment actions.",
      required: false,
    },
  ],
  handler: async ({ targetType, targetId, action, maxPerHour, maxValuePerDay }: {
    targetType: string;
    targetId: string;
    action: string;
    maxPerHour: number;
    maxValuePerDay?: string;
  }) => {
    // TODO: Implement actual rate limit setting
    const limitId = `limit_${Date.now()}`;

    return {
      success: true,
      operation: "set_rate_limit",
      rateLimit: {
        id: limitId,
        targetType,
        targetId,
        action,
        maxPerHour,
        maxValuePerDay: maxValuePerDay || null,
        status: "active",
        createdAt: new Date().toISOString(),
      },
      message: `Rate limit set: ${maxPerHour}/hour for ${action} on ${targetType} ${targetId}`,
    };
  },
};

/**
 * Get rate limit status
 */
export const getRateLimitStatusAction = {
  name: "governance_get_rate_limit_status",
  description: "Get current rate limit status and usage for a Persona or tenant.",
  parameters: [
    {
      name: "targetType",
      type: "string" as const,
      description: "Target type: 'persona' or 'tenant'.",
      required: true,
    },
    {
      name: "targetId",
      type: "string" as const,
      description: "The Persona ID or tenant ID to check.",
      required: true,
    },
  ],
  handler: async ({ targetType, targetId }: {
    targetType: string;
    targetId: string;
  }) => {
    // TODO: Implement actual rate limit status check
    return {
      success: true,
      status: {
        targetType,
        targetId,
        limits: [
          {
            action: "wallet_send_qct",
            maxPerHour: 100,
            usedThisHour: 12,
            remainingThisHour: 88,
            maxValuePerDay: "10000",
            usedValueToday: "450.00",
            remainingValueToday: "9550.00",
          },
          {
            action: "mcp_invoke_toolqube",
            maxPerHour: 50,
            usedThisHour: 5,
            remainingThisHour: 45,
          },
        ],
        overallStatus: "healthy",
        nextReset: new Date(Date.now() + 3600000).toISOString(),
      },
    };
  },
};

/**
 * Enable simulation mode
 */
export const setSimulationModeAction = {
  name: "governance_set_simulation_mode",
  description: "Enable or disable simulation mode for a tenant. When enabled, all write operations are simulated without execution.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to set simulation mode for.",
      required: true,
    },
    {
      name: "enabled",
      type: "boolean" as const,
      description: "Whether to enable (true) or disable (false) simulation mode.",
      required: true,
    },
    {
      name: "duration",
      type: "string" as const,
      description: "Optional duration for simulation mode (e.g., '1h', '24h', 'permanent').",
      required: false,
    },
  ],
  handler: async ({ tenantId, enabled, duration }: {
    tenantId: string;
    enabled: boolean;
    duration?: string;
  }) => {
    // TODO: Implement actual simulation mode setting
    const expiresAt = duration === "permanent" 
      ? null 
      : duration === "24h"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      success: true,
      operation: "set_simulation_mode",
      simulationMode: {
        tenantId,
        enabled,
        duration: duration || "1h",
        expiresAt,
        setAt: new Date().toISOString(),
      },
      message: enabled 
        ? `Simulation mode ENABLED for ${tenantId}. All write operations will be simulated.`
        : `Simulation mode DISABLED for ${tenantId}. Operations will execute normally.`,
      warning: enabled 
        ? "No actual changes will be made while simulation mode is active."
        : null,
    };
  },
};

/**
 * Get governance summary
 */
export const getGovernanceSummaryAction = {
  name: "governance_get_summary",
  description: "Get a summary of governance status for a tenant including rate limits, simulation mode, and recent security events.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to get governance summary for.",
      required: true,
    },
  ],
  handler: async ({ tenantId }: { tenantId: string }) => {
    // TODO: Implement actual governance summary retrieval
    return {
      success: true,
      summary: {
        tenantId,
        simulationMode: {
          enabled: false,
          expiresAt: null,
        },
        rateLimits: {
          activeCount: 3,
          status: "healthy",
          nearLimitActions: [],
        },
        security: {
          recentAlerts: 0,
          lastSecurityEvent: null,
          mfaEnabled: true,
        },
        compliance: {
          auditTrailEnabled: true,
          retentionDays: 90,
          lastAuditExport: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: {
          actionsToday: 156,
          workflowsToday: 12,
          paymentsToday: 45,
          totalValueToday: "2340.50 QCT",
        },
        generatedAt: new Date().toISOString(),
      },
    };
  },
};

/**
 * Export all governance actions
 */
export const governanceActions = [
  logEventAction,
  getAuditTrailAction,
  checkPermissionsAction,
  setRateLimitAction,
  getRateLimitStatusAction,
  setSimulationModeAction,
  getGovernanceSummaryAction,
];
