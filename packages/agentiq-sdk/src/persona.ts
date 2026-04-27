/**
 * @agentiqos/agentiq-sdk — Persona Creation Client
 *
 * Creates bounded developer personas anchored to a Root DiD.
 * Wraps POST /api/iqube/persona on your AgentiQ OS instance.
 */

import type { SDKConfig } from './types';

export interface PersonaCreateOptions {
  /** Human-readable display name */
  displayName: string;
  /** Disclosure level — defaults to 'pseudo' */
  identifiability?: 'anonymous' | 'pseudo' | 'identified';
  /** Cartridge or application scope for this persona */
  appOrigin?: string;
}

export interface CreatedPersona {
  /** Bounded persona ID */
  id: string;
  /** Root DiD — enduring accountability anchor */
  rootDid: string;
  displayName: string;
  identifiability: string;
  appOrigin: string;
  createdAt: string;
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

export class PersonaCreation {
  private readonly apiUrl: string;

  constructor(config: SDKConfig = {}) {
    this.apiUrl = resolveUrl(config);
  }

  async create(options: PersonaCreateOptions): Promise<CreatedPersona> {
    const res = await fetch(`${this.apiUrl}/api/iqube/persona`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: options.displayName,
        identifiability: options.identifiability ?? 'pseudo',
        appOrigin: options.appOrigin ?? 'agentiq-os-cartridge',
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(`Persona creation failed (HTTP ${res.status}): ${body.error ?? res.statusText}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const id = (data['id'] ?? data['persona_id'] ?? '') as string;

    return {
      id,
      rootDid: (data['rootDid'] ?? data['root_did'] ?? `did:iqube:${id}`) as string,
      displayName: options.displayName,
      identifiability: (data['identifiability'] ?? options.identifiability ?? 'pseudo') as string,
      appOrigin: (data['appOrigin'] ?? data['app_origin'] ?? options.appOrigin ?? 'agentiq-os-cartridge') as string,
      createdAt: (data['createdAt'] ?? data['created_at'] ?? new Date().toISOString()) as string,
    };
  }

  /** Static convenience — create a persona without instantiating the class. */
  static async create(options: PersonaCreateOptions, config: SDKConfig = {}): Promise<CreatedPersona> {
    return new PersonaCreation(config).create(options);
  }
}
