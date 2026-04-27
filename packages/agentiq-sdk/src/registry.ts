/**
 * @agentiqos/agentiq-sdk — AigentQube Registry Client
 *
 * Wraps POST /api/codex/agentiq-os/registry-draft to generate structured
 * Registry submission drafts (AigentQube, SkillQube, WorkflowQube, ConnectorQube).
 */

import type { SDKConfig } from './types';

export type QubeType = 'AigentQube' | 'SkillQube' | 'WorkflowQube' | 'ConnectorQube';

export interface PolicyBinding {
  policyId: string;
  policyType: 'access' | 'delegation' | 'disclosure';
  policyName: string;
  enforced: boolean;
  parameters?: Record<string, unknown>;
}

export interface AigentQubeRegistration {
  /** Display label for the asset */
  label: string;
  /** Qube type — defaults to AigentQube */
  type?: QubeType;
  /** Human-readable description of what this asset does */
  description?: string;
  /** Capability identifiers (e.g. 'knowledge_retrieval', 'document_creation') */
  capabilities?: string[];
  /** Policy bindings attached to this asset */
  policyBindings?: PolicyBinding[];
  /** Trust band — defaults to L1_EXPERIMENTAL */
  trustBand?: string;
  /** Root DiD of the registering agent */
  rootDid?: string;
  /** LLM temperature when this asset is invoked as an Aigent */
  temperature?: number;
  /** Discovery tags */
  tags?: string[];
}

export interface RegistryDraftResult {
  ok: boolean;
  draft: Record<string, unknown>;
  qube_type: QubeType;
  persona_id: string;
  instructions: string[];
}

function resolveUrl(config: SDKConfig): string {
  const url =
    config.apiUrl ??
    (typeof process !== 'undefined' ? process.env['AGENTIQ_API_URL'] : undefined);
  if (!url) {
    throw new Error(
      'apiUrl is required. Pass it in config or set the AGENTIQ_API_URL environment variable.',
    );
  }
  return url.replace(/\/$/, '');
}

export class AigentQubeRegistry {
  private readonly apiUrl: string;
  private readonly personaId: string | undefined;

  constructor(config: SDKConfig = {}) {
    this.apiUrl = resolveUrl(config);
    this.personaId = config.personaId;
  }

  /**
   * Generate a Registry draft manifest for an asset.
   * Phase 1: returns a structured scaffold — fill TODOs before submitting.
   */
  async draft(registration: AigentQubeRegistration): Promise<RegistryDraftResult> {
    const res = await fetch(`${this.apiUrl}/api/codex/agentiq-os/registry-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: this.personaId,
        qube_type: registration.type ?? 'AigentQube',
        name: registration.label,
        description: registration.description ?? '',
        capabilities: registration.capabilities ?? [],
        tags: registration.tags ?? [],
        trust_band: registration.trustBand ?? 'L1_EXPERIMENTAL',
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(`Registry draft failed (HTTP ${res.status}): ${body.error ?? res.statusText}`);
    }

    return res.json() as Promise<RegistryDraftResult>;
  }

  /**
   * Alias for draft() — generate and register in one call.
   * Emits a receipt-eligible OrchestrationEvent on the server.
   */
  async register(registration: AigentQubeRegistration): Promise<RegistryDraftResult> {
    return this.draft(registration);
  }
}
