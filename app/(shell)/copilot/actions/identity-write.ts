/**
 * Identity Write Actions (Phase 1)
 * 
 * These tools allow the Platform Copilot to create and manage
 * identity structures: Personas, KybeDID, Root DID, and proxies.
 * 
 * Identity Hierarchy (Privacy-First):
 * - Persona (Primary) - Default identity sharing surface
 * - Root DID Proxy - Revocable real-world ID for day-to-day
 * - Root DID - High-assurance for regulated contexts
 * - KybeDID - Proof-of-personhood anchor (rarely shared)
 * 
 * LIVE: Connected to QubeBase (Supabase) with fallback to mock data.
 */

import * as QubeBase from "../services/qubebase";

/**
 * Create a Persona
 */
export const createPersonaAction = {
  name: "identity_create_persona",
  description: "Create a new Persona for a tenant. Personas are the primary identity sharing surface and may be pseudonymous, semi-anonymous, or branded.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to create the Persona for.",
      required: true,
    },
    {
      name: "name",
      type: "string" as const,
      description: "Display name for the Persona.",
      required: true,
    },
    {
      name: "type",
      type: "string" as const,
      description: "Persona type: 'pseudonymous', 'semi-anonymous', or 'branded'.",
      required: false,
    },
    {
      name: "fioHandle",
      type: "string" as const,
      description: "Fio handle for the Persona (e.g., 'username@aigent').",
      required: false,
    },
  ],
  handler: async ({ tenantId, name, type, fioHandle }: {
    tenantId: string;
    name: string;
    type?: string;
    fioHandle?: string;
  }) => {
    const handle = fioHandle || `${name.toLowerCase().replace(/\s+/g, "")}@aigent`;
    const identityState = type === "branded" ? "identifiable" : type === "pseudonymous" ? "anonymous" : "semi_anonymous";

    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.createPersona({
        fioHandle: handle,
        defaultState: identityState,
        appOrigin: "aigent-z",
      });
      
      if (result.success && result.persona) {
        // Log the event
        await QubeBase.logEvent({
          tenantId,
          eventType: "identity",
          action: "identity_create_persona",
          personaId: result.persona.id,
          details: { name, fioHandle: handle, type: identityState },
        });

        return {
          success: true,
          source: "live",
          operation: "create_persona",
          persona: {
            id: result.persona.id,
            tenantId,
            name,
            type: result.persona.default_identity_state,
            fioHandle: result.persona.fio_handle,
            walletLinked: false,
            createdAt: result.persona.created_at,
          },
          message: `Persona "${name}" created with Fio handle ${handle}`,
        };
      }
      
      if (result.error) {
        return {
          success: false,
          source: "live",
          operation: "create_persona",
          error: result.error,
          message: `Failed to create persona: ${result.error}`,
        };
      }
    }

    // Fallback to mock
    const personaId = `persona_${Date.now()}`;
    return {
      success: true,
      source: "mock",
      operation: "create_persona",
      persona: {
        id: personaId,
        tenantId,
        name,
        type: type || "semi-anonymous",
        fioHandle: handle,
        walletLinked: false,
        cohortId: "cohort_new_users",
        createdAt: new Date().toISOString(),
      },
      message: `Persona "${name}" created with Fio handle ${handle} (mock)`,
    };
  },
};

/**
 * Create a KybeDID
 */
export const createKybeDIDAction = {
  name: "identity_create_kybe_did",
  description: "Issue a KybeDID (proof-of-personhood anchor) for a tenant. KybeDIDs are rarely shared directly; use attestations instead. Requires elevated permissions.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to issue the KybeDID for.",
      required: true,
    },
    {
      name: "purpose",
      type: "string" as const,
      description: "Purpose of the KybeDID (e.g., 'primary_identity', 'backup').",
      required: false,
    },
  ],
  handler: async ({ tenantId, purpose }: {
    tenantId: string;
    purpose?: string;
  }) => {
    // Try live QubeBase first
    if (QubeBase.isQubeBaseConfigured()) {
      const result = await QubeBase.createKybeIdentity({});
      
      if (result.success && result.kybe) {
        // Log the event (security level)
        await QubeBase.logEvent({
          tenantId,
          eventType: "security",
          action: "identity_create_kybe_did",
          details: { kybeDidId: result.kybe.kybe_did, purpose: purpose || "primary_identity" },
          severity: "warning",
        });

        return {
          success: true,
          source: "live",
          operation: "create_kybe_did",
          kybeDid: {
            did: result.kybe.kybe_did,
            tenantId,
            purpose: purpose || "primary_identity",
            proofOfPersonhood: true,
            proofOfLife: true,
            issuedAt: result.kybe.issued_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
          warning: "KybeDID should rarely be shared directly. Use proof-of-personhood attestations instead.",
          message: `KybeDID issued: ${result.kybe.kybe_did}`,
        };
      }
      
      if (result.error) {
        return {
          success: false,
          source: "live",
          operation: "create_kybe_did",
          error: result.error,
          message: `Failed to create KybeDID: ${result.error}`,
        };
      }
    }

    // Fallback to mock
    const kybeDidId = `kybe:did:aigent:${Date.now()}`;
    return {
      success: true,
      source: "mock",
      operation: "create_kybe_did",
      kybeDid: {
        did: kybeDidId,
        tenantId,
        purpose: purpose || "primary_identity",
        proofOfPersonhood: true,
        proofOfLife: true,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      warning: "KybeDID should rarely be shared directly. Use proof-of-personhood attestations instead.",
      message: `KybeDID issued: ${kybeDidId} (mock)`,
    };
  },
};

/**
 * Create a Root DID
 */
export const createRootDIDAction = {
  name: "identity_create_root_did",
  description: "Create a Root DID anchored to a KybeDID. Root DIDs are for high-assurance, regulated contexts (banking, medical, government).",
  parameters: [
    {
      name: "kybeDidId",
      type: "string" as const,
      description: "The KybeDID to anchor this Root DID to.",
      required: true,
    },
    {
      name: "label",
      type: "string" as const,
      description: "Label for this Root DID (e.g., 'Primary Identity', 'Business Identity').",
      required: true,
    },
  ],
  handler: async ({ kybeDidId, label }: {
    kybeDidId: string;
    label: string;
  }) => {
    // TODO: Implement actual Root DID creation
    const rootDidId = `root:did:aigent:${Date.now()}`;
    
    return {
      success: true,
      operation: "create_root_did",
      rootDid: {
        did: rootDidId,
        kybeDidId,
        label,
        reputation: {
          score: 500,
          level: "new",
        },
        createdAt: new Date().toISOString(),
      },
      message: `Root DID "${label}" created and anchored to KybeDID`,
    };
  },
};

/**
 * Issue a Root DID Proxy
 */
export const issueRootDIDProxyAction = {
  name: "identity_issue_root_did_proxy",
  description: "Issue a revocable Root DID proxy for day-to-day interactions where identifiability is needed but sovereignty is required.",
  parameters: [
    {
      name: "rootDidId",
      type: "string" as const,
      description: "The Root DID to issue a proxy for.",
      required: true,
    },
    {
      name: "purpose",
      type: "string" as const,
      description: "Purpose of this proxy (e.g., 'daily_transactions', 'business_contacts').",
      required: true,
    },
    {
      name: "expirationDays",
      type: "number" as const,
      description: "Number of days until the proxy expires (default: 365).",
      required: false,
    },
  ],
  handler: async ({ rootDidId, purpose, expirationDays }: {
    rootDidId: string;
    purpose: string;
    expirationDays?: number;
  }) => {
    // TODO: Implement actual Root DID proxy issuance
    const proxyId = `proxy:did:aigent:${Date.now()}`;
    const expDays = expirationDays || 365;
    
    return {
      success: true,
      operation: "issue_root_did_proxy",
      proxy: {
        proxyDid: proxyId,
        rootDidId,
        purpose,
        revocable: true,
        status: "active",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString(),
      },
      message: `Root DID proxy issued for "${purpose}". Proxy is revocable and expires in ${expDays} days.`,
    };
  },
};

/**
 * Link Root DID to Wallet
 */
export const linkRootDIDToWalletAction = {
  name: "identity_link_root_did_to_wallet",
  description: "Link a Root DID to an Agentic Wallet for identity-verified transactions.",
  parameters: [
    {
      name: "rootDidId",
      type: "string" as const,
      description: "The Root DID to link.",
      required: true,
    },
    {
      name: "walletId",
      type: "string" as const,
      description: "The wallet ID to link to.",
      required: true,
    },
  ],
  handler: async ({ rootDidId, walletId }: {
    rootDidId: string;
    walletId: string;
  }) => {
    // TODO: Implement actual Root DID to wallet linking
    return {
      success: true,
      operation: "link_root_did_to_wallet",
      rootDidId,
      walletId,
      linkedAt: new Date().toISOString(),
      message: `Root DID linked to wallet ${walletId} for identity-verified transactions`,
    };
  },
};

/**
 * Get proof-of-personhood attestation from KybeDID
 */
export const getProofOfPersonhoodAction = {
  name: "identity_get_proof_of_personhood",
  description: "Generate a proof-of-personhood attestation from a KybeDID. This is the preferred way to prove personhood without sharing the KybeDID directly.",
  parameters: [
    {
      name: "tenantId",
      type: "string" as const,
      description: "The tenant ID to get the attestation for.",
      required: true,
    },
    {
      name: "purpose",
      type: "string" as const,
      description: "Purpose of the attestation (e.g., 'service_access', 'age_verification').",
      required: true,
    },
  ],
  handler: async ({ tenantId, purpose }: {
    tenantId: string;
    purpose: string;
  }) => {
    // TODO: Implement actual attestation generation from KybeDID
    const attestationId = `attest_${Date.now()}`;
    
    return {
      success: true,
      operation: "get_proof_of_personhood",
      attestation: {
        id: attestationId,
        tenantId,
        type: "proof-of-personhood",
        purpose,
        valid: true,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      },
      message: `Proof-of-personhood attestation generated for "${purpose}". Valid for 24 hours.`,
    };
  },
};

/**
 * Export all identity write actions
 */
export const identityWriteActions = [
  createPersonaAction,
  createKybeDIDAction,
  createRootDIDAction,
  issueRootDIDProxyAction,
  linkRootDIDToWalletAction,
  getProofOfPersonhoodAction,
];
