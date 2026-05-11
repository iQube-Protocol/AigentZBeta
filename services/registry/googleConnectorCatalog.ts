/**
 * services/registry/googleConnectorCatalog.ts — Aigent Me Phase 6.b
 *
 * Seeds Google Workspace connectors as first-class ConnectorQube assets in
 * the Ingestion Factory registry. They become discoverable + composable
 * alongside Studio skills (services/composer/studioSkillCatalog.ts) and
 * Marketa campaign channels (services/campaign/channelRegistry.ts).
 *
 * Per the operator's locked instruction: "google workflow tools would
 * also be made available as workflowQubes in the ingestion factory and
 * the key thing here is ensuring they can be used in concert with other
 * skills and tools in the factory."
 *
 * Shape — ConnectorQube (types/registryIngestion.ts L345):
 *   - assetClass: 'ConnectorQube'
 *   - authScheme: 'oauth2'
 *   - endpointUrl: '/api/connectors/execute' (invocation gateway delegates here)
 *   - capabilities[]: declares the operations + their schemas
 *
 * The catalogue here is the SEED. Operators publish each entry to the
 * live registry via the existing `/api/registry/intake` flow when ready.
 * The catalogue gives the intake flow a known-good source.
 */

import type {
  ConnectorQube,
  TrustBand,
  PolicyClass,
  WrapperStrategy,
  CapabilityDescriptor,
  RegistryAssetSummary,
} from '@/types/registryIngestion';
import {
  listGoogleConnectors,
  type GoogleConnector,
} from '@/services/google/connectors';

// ─────────────────────────────────────────────────────────────────────────
// Shared registry defaults.
// ─────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'metame';
const PUBLICATION_STATUS = 'seed'; // operator promotes to 'published' via intake
const CREATED_BY = 'aigent-me';
const NOW = () => new Date().toISOString();

const SHARED_TAGS = ['google-workspace', 'aigent-me', 'phase-6b'];

function makeCapabilities(connector: GoogleConnector): CapabilityDescriptor[] {
  return [
    {
      name: 'execute',
      description: connector.description,
      inputSchema: connector.inputSchema as Record<string, unknown>,
      outputSchema: connector.outputSchema as Record<string, unknown>,
      // approval / scopes / source travel as tags so the Factory can
      // filter without a schema change. The route-layer second-tier gate
      // is the authoritative enforcement; this just makes them visible.
      tags: [
        connector.requiresApproval ? 'requires-approval' : 'no-approval',
        `source:${connector.source}`,
        ...connector.requiredScopes.map((s) => `scope:${s}`),
      ],
    },
  ];
}

function policyClassFor(connector: GoogleConnector): PolicyClass {
  // Approval-required connectors gate via the canonical
  // 'human_approval_required' class. Everything else stays in the
  // 'secret_bound' class because they use OAuth bearer tokens.
  return connector.requiresApproval ? 'human_approval_required' : 'secret_bound';
}

function trustBandFor(_connector: GoogleConnector): TrustBand {
  // Seed at L3 (production candidate) and let operators bump on promote.
  return 'L3_PRODUCTION_CANDIDATE';
}

function wrapperStrategyFor(_connector: GoogleConnector): WrapperStrategy {
  // 'http' — every connector dispatches via /api/connectors/execute over HTTPS.
  return 'http';
}

// ─────────────────────────────────────────────────────────────────────────
// Catalogue.
// ─────────────────────────────────────────────────────────────────────────

export function buildGoogleConnectorCatalog(): ConnectorQube[] {
  const connectors = listGoogleConnectors();
  const now = NOW();
  return connectors.map((c): ConnectorQube => ({
    // c.id is already `google.<area>.<verb>` (e.g. 'google.gmail.draft');
    // do NOT re-prefix or asset ids end up doubled (`google.google.…`).
    assetId: c.id,
    tenantId: TENANT_ID,
    assetClass: 'ConnectorQube',
    name: c.label,
    slug: c.id.replace(/\./g, '-'),
    description: c.description,
    sourceId: undefined,
    intakeId: undefined,
    currentVersion: '0.1.0',
    trustBand: trustBandFor(c),
    publicationStatus: PUBLICATION_STATUS,
    policyClass: policyClassFor(c),
    wrapperStrategy: wrapperStrategyFor(c),
    interfaceSchema: {
      inputs: c.inputSchema,
      outputs: c.outputSchema,
    },
    capabilities: makeCapabilities(c),
    endpointUrl: '/api/connectors/execute',
    authScheme: 'oauth2',
    tags: [...SHARED_TAGS, c.category, c.source],
    metadata: {
      connectorId: c.id,
      requiredScopes: c.requiredScopes,
      requiresApproval: c.requiresApproval,
      category: c.category,
      source: c.source,
    },
    createdBy: CREATED_BY,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Convenience: lookup a single connector's ConnectorQube projection.
 * Returns null when the connector id is unknown.
 */
export function getGoogleConnectorQube(connectorId: string): ConnectorQube | null {
  return buildGoogleConnectorCatalog().find((q) => (q.metadata as { connectorId?: string }).connectorId === connectorId) ?? null;
}

/**
 * Projection used by the Factory's `/api/registry/assets` list endpoint.
 * Surfaces every Google connector as a `RegistryAssetSummary` so they
 * appear alongside live registry rows (with `publicationStatus: 'seed'`
 * so operators can distinguish them and choose to promote via intake).
 *
 * This is the bridge from the static catalog → the Factory UI without
 * requiring a database write. Operators can later run intake on any
 * entry to lift it from seed → published.
 */
export function listGoogleConnectorAssetSummaries(): RegistryAssetSummary[] {
  return buildGoogleConnectorCatalog().map((q): RegistryAssetSummary => ({
    assetId: q.assetId,
    assetClass: q.assetClass,
    name: q.name,
    slug: q.slug,
    description: q.description,
    iconUrl: q.iconUrl,
    currentVersion: q.currentVersion,
    trustBand: q.trustBand,
    publicationStatus: q.publicationStatus,
    policyClass: q.policyClass,
    tags: q.tags,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  }));
}
