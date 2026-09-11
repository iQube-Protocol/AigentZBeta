/**
 * Shared, T2-safe vocabulary for Threshold discovery projections.
 *
 * Domain registries remain canonical for their own records. These types only
 * describe how those records are presented to an external agent, so public
 * knowledge, iQube Cards, IRL invariants, and service discovery can converge
 * without creating a second registry or a second maturity vocabulary.
 */

export type DiscoverySourceAuthority =
  | 'ratified-canon'
  | 'normative-specification'
  | 'implemented-system-documentation'
  | 'operational-state'
  | 'experimental-evidence'
  | 'proposed-work'
  | 'explanatory-commentary'
  | 'historical-or-deprecated';

export type DiscoveryOpenness =
  | 'public-spec'
  | 'public-source'
  | 'public-document'
  | 'public-registry'
  | 'authenticated'
  | 'persona-restricted'
  | 'confidential-bilateral'
  | 'cohort-restricted'
  | 'proprietary-implementation';

export type DiscoveryMaturity =
  | 'ratified'
  | 'implemented'
  | 'operational'
  | 'demonstrated'
  | 'experimental'
  | 'proposed'
  | 'projected'
  | 'historical'
  | 'deprecated';

export type McpExposure = 'available-now' | 'native-only' | 'implemented-not-exposed' | 'preview' | 'planned' | 'deprecated';

export interface DiscoveryReference {
  label: string;
  /** MCP resource URI, tool name, public URL, or repository/path reference. */
  ref: string;
  authority: DiscoverySourceAuthority;
}

export interface DiscoveryDescriptor {
  id: string;
  name: string;
  description: string;
  layer: 'constitutional' | 'identity' | 'protocol' | 'registry' | 'runtime' | 'development' | 'research' | 'public-knowledge' | 'bridge';
  openness: DiscoveryOpenness[];
  maturity: DiscoveryMaturity[];
  mcpExposure: McpExposure;
  canonicalSources: DiscoveryReference[];
  mcpRoutes: string[];
  accessRequirements: string[];
  implementationNote?: string;
}

export const SOURCE_PRECEDENCE: DiscoverySourceAuthority[] = [
  'ratified-canon',
  'normative-specification',
  'implemented-system-documentation',
  'operational-state',
  'experimental-evidence',
  'proposed-work',
  'explanatory-commentary',
  'historical-or-deprecated',
];
