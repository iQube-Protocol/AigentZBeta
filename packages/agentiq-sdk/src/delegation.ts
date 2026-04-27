/**
 * @agentiq/agentiq-sdk — Delegation Service Client
 *
 * Grant, inspect, and revoke bounded delegation envelopes for Aigent C-OS.
 * Wraps POST/GET/DELETE /api/codex/chat/agentiq-os/delegation.
 */

import type { SDKConfig } from './types';

export interface DelegationGrantOptions {
  /** Persona ID granting the delegation */
  personaId: string;
  /** Cartridge the delegation applies to */
  cartridgeScope?: string;
  /** Explicit action list (e.g. ['knowledge_retrieval', 'draft_document']) */
  allowedActions: string[];
  /** Session duration in hours — defaults to 4 */
  ttlHours?: number;
  /** Trust band ceiling — defaults to L1_EXPERIMENTAL */
  trustBand?: string;
}

export interface PolicyEnvelope {
  allowed_surfaces: string[];
  forbidden_actions: string[];
  disclosure_class: string;
  requires_guardian_approval: boolean;
  cartridge_scope: string;
}

export interface HandoffResult {
  ok: boolean;
  handoff_id: string;
  persona_id: string;
  trust_band: string;
  allowed_actions: string[];
  expires_at: string;
  max_actions: number;
  actions_taken: number;
  policy_envelope: PolicyEnvelope;
  agent_root_did: string;
}

export interface DelegationStateResult {
  active: boolean;
  suspended?: boolean;
  expired?: boolean;
  handoff_id?: string;
  trust_band?: string;
  allowed_actions?: string[];
  expires_at?: string;
  actions_taken?: number;
  max_actions?: number;
  agent_root_did?: string;
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

const DELEGATION_ENDPOINT = '/api/codex/chat/agentiq-os/delegation';

export class DelegationService {
  private readonly apiUrl: string;

  constructor(config: SDKConfig = {}) {
    this.apiUrl = resolveUrl(config);
  }

  /**
   * Grant bounded delegation to Aigent C-OS for the given persona.
   * Creates an immutable PolicyEnvelope — cannot be expanded without a new grant.
   */
  async grant(options: DelegationGrantOptions): Promise<HandoffResult> {
    const res = await fetch(`${this.apiUrl}${DELEGATION_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: options.personaId,
        trust_band: options.trustBand ?? 'L1_EXPERIMENTAL',
        selected_actions: options.allowedActions,
        ttl_hours: options.ttlHours ?? 4,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(`Delegation grant failed (HTTP ${res.status}): ${body.error ?? res.statusText}`);
    }

    return res.json() as Promise<HandoffResult>;
  }

  /**
   * Revoke active delegation for a persona.
   * Emits a receipt-eligible control_returned_to_metame OrchestrationEvent.
   */
  async revoke(personaId: string): Promise<void> {
    const res = await fetch(
      `${this.apiUrl}${DELEGATION_ENDPOINT}?persona_id=${encodeURIComponent(personaId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      throw new Error(`Delegation revoke failed (HTTP ${res.status}): ${res.statusText}`);
    }
  }

  /**
   * Read the current delegation state for a persona.
   */
  async getState(personaId: string): Promise<DelegationStateResult> {
    const res = await fetch(
      `${this.apiUrl}${DELEGATION_ENDPOINT}?persona_id=${encodeURIComponent(personaId)}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to read delegation state (HTTP ${res.status}): ${res.statusText}`);
    }
    return res.json() as Promise<DelegationStateResult>;
  }

  /**
   * Read the last N OrchestrationEvents for a persona's delegation history.
   */
  async getAuditLog(personaId: string): Promise<{ events: unknown[] }> {
    const res = await fetch(
      `${this.apiUrl}${DELEGATION_ENDPOINT}?persona_id=${encodeURIComponent(personaId)}&events=1`,
    );
    if (!res.ok) {
      throw new Error(`Failed to read audit log (HTTP ${res.status}): ${res.statusText}`);
    }
    return res.json() as Promise<{ events: unknown[] }>;
  }
}
