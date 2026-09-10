import {
  SOURCE_PRECEDENCE,
  type DiscoveryDescriptor,
  type DiscoveryOpenness,
} from './discoverySchema';

export const AGENT_MANIFEST_URI = 'metame://agent-manifest';

const components: DiscoveryDescriptor[] = [
  {
    id: 'polity', name: 'Polity', layer: 'constitutional',
    description: 'The constitutional order in which human citizens retain sovereignty and agents exercise only delegated authority.',
    openness: ['public-document'], maturity: ['ratified'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'Polity Core Constitution', ref: 'read_public_document(cartridge:"polity-core", id:"constitution")', authority: 'ratified-canon' }],
    mcpRoutes: ['metame://public-knowledge', 'list_public_documents', 'read_public_document'], accessRequirements: ['none for published canon'],
  },
  {
    id: 'polity-passport', name: 'Polity Passport / personhood continuity', layer: 'identity',
    description: 'Establishes personhood-bound constitutional continuity without requiring public disclosure of sovereign identity attributes.',
    openness: ['public-spec', 'authenticated'], maturity: ['operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'Crossing orientation', ref: 'metame://onboarding/current', authority: 'implemented-system-documentation' }],
    mcpRoutes: ['get_passport_status', 'get_crossing_status'], accessRequirements: ['Constitutional Handshake for personal state'],
  },
  {
    id: 'persona-spine', name: 'Identity and Persona Spine', layer: 'identity',
    description: 'Separates sovereign personhood, identity context, and active persona; persona context participates in resource-entitlement decisions.',
    openness: ['public-spec', 'authenticated'], maturity: ['operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'AgentiQ identity and sovereignty guide', ref: 'read_public_document(cartridge:"agentiq-os", id:"identity-sovereignty")', authority: 'implemented-system-documentation' }],
    mcpRoutes: ['get_persona_state', 'list_available_personas', 'request_persona_switch'], accessRequirements: ['Constitutional Handshake', 'explicit principal authorization for a fresh persona crossing'],
  },
  {
    id: 'delegation-standing', name: 'Delegation and Standing', layer: 'constitutional',
    description: 'Delegation bounds an agent\'s authority. Standing is a constitutional relation and is not reputation, identity, citizenship, or an agent-owned power.',
    openness: ['public-document', 'authenticated'], maturity: ['ratified', 'operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'Polity Core and primitive router', ref: 'explain_primitive', authority: 'ratified-canon' }],
    mcpRoutes: ['explain_primitive', 'propose_delegation', 'establish_delegation'], accessRequirements: ['none for definition', 'explicit principal authority for delegation acts'],
  },
  {
    id: 'iqube-protocol-registry', name: 'iQube Protocol and Registry', layer: 'registry',
    description: 'The protocol and registry for typed sovereign data objects. Registry existence and safe metadata do not imply payload entitlement.',
    openness: ['public-spec', 'public-registry', 'persona-restricted'], maturity: ['implemented', 'operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'AgentiQ protocols', ref: 'read_public_document(cartridge:"agentiq-os", id:"protocols")', authority: 'normative-specification' }],
    mcpRoutes: ['list_accessible_iqubes', 'get_accessible_iqube', 'read_accessible_iqube_text'], accessRequirements: ['iqube.read', 'resource-level persona/role entitlement for restricted payloads'],
    implementationNote: 'The current MCP projection is persona-scoped; broader public iQube Card browsing is a separate planned exposure over the existing registry legibility service.',
  },
  {
    id: 'qripto-protocol', name: 'Qripto Protocol / DVN', layer: 'protocol',
    description: 'Trust, payment, receipt, and verification protocol surfaces, including DVN receipt concepts.',
    openness: ['public-spec'], maturity: ['implemented'], mcpExposure: 'implemented-not-exposed',
    canonicalSources: [{ label: 'AgentiQ protocols', ref: 'read_public_document(cartridge:"agentiq-os", id:"protocols")', authority: 'normative-specification' }],
    mcpRoutes: ['explain_primitive'], accessRequirements: ['none for public specification'],
  },
  {
    id: 'agentiq-nanos', name: 'AgentiQ OS, nanOS, Runtime and Studio', layer: 'runtime',
    description: 'AgentiQ OS supplies public protocol and reference patterns. Production nanOS, metaMe Runtime, metaMe Studio, and aigentMe include operational platform surfaces whose internals may remain proprietary.',
    openness: ['public-spec', 'public-source', 'proprietary-implementation'], maturity: ['implemented', 'operational'], mcpExposure: 'implemented-not-exposed',
    canonicalSources: [
      { label: 'AgentiQ OS stack overview', ref: 'read_public_document(cartridge:"agentiq-os", id:"stack-overview")', authority: 'normative-specification' },
      { label: 'nanOS boundary', ref: 'read_public_document(cartridge:"agentiq-os", id:"what-is-nanos")', authority: 'implemented-system-documentation' },
    ],
    mcpRoutes: ['list_public_capabilities', 'read_public_document'], accessRequirements: ['none for published references', 'platform authorization for native operational surfaces'],
  },
  {
    id: 'devon-dcir-crystal', name: 'DevOn, DCIR and Crystal', layer: 'development',
    description: 'Development, constitutional implementation/reasoning, and evidence/state systems. Their canonical status and exposure must be read from routed sources rather than inferred from names.',
    openness: ['public-document', 'proprietary-implementation'], maturity: ['implemented', 'experimental'], mcpExposure: 'implemented-not-exposed',
    canonicalSources: [{ label: 'Constitutional primitive router', ref: 'explain_primitive', authority: 'implemented-system-documentation' }],
    mcpRoutes: ['explain_primitive', 'search_public_knowledge'], accessRequirements: ['none for public explanations', 'native authorization for non-public implementation'],
  },
  {
    id: 'irl-os', name: 'IRL OS and Invariant Registry', layer: 'research',
    description: 'Research methodology, experiments, evidence, and canonical invariant records. Public registry metadata is distinct from restricted experimental payloads.',
    openness: ['public-registry', 'public-document', 'cohort-restricted', 'confidential-bilateral'], maturity: ['operational', 'experimental'], mcpExposure: 'preview',
    canonicalSources: [{ label: 'IRL public corpus', ref: 'list_public_documents(cartridge:"irl-os")', authority: 'experimental-evidence' }],
    mcpRoutes: ['list_shared_documents', 'read_shared_document', 'explain_primitive'], accessRequirements: ['none for public evidence', 'service and resource entitlement for restricted material'],
    implementationNote: 'Canonical invariant APIs exist natively; direct bulk MCP registry tools are planned and must adapt those APIs rather than duplicate them.',
  },
  {
    id: 'qriptopian', name: 'Qriptopian', layer: 'public-knowledge',
    description: 'Published essays, papers, and narrative context. It is explanatory/public knowledge and does not silently outrank ratified canon.',
    openness: ['public-document'], maturity: ['operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'Qriptopian cartridge', ref: 'list_public_documents(cartridge:"qriptopian")', authority: 'explanatory-commentary' }],
    mcpRoutes: ['list_public_documents', 'read_public_document', 'search_public_knowledge'], accessRequirements: ['none'],
  },
  {
    id: 'threshold-mcp', name: 'Threshold MCP', layer: 'bridge',
    description: 'The agent-facing constitutional discovery and action bridge. It exposes only capabilities that are registered and authorized; absence from MCP does not prove absence from the native platform.',
    openness: ['public-spec', 'authenticated'], maturity: ['operational'], mcpExposure: 'available-now',
    canonicalSources: [{ label: 'This discovery manifest', ref: AGENT_MANIFEST_URI, authority: 'operational-state' }],
    mcpRoutes: ['tools/list', 'resources/list', 'prompts/list'], accessRequirements: ['none for discovery', 'tool-specific crossing/capability requirements for authenticated actions'],
  },
];

export interface AgentDiscoveryManifest {
  schemaVersion: '1.0';
  name: 'metaMe Agent Discovery Manifest';
  description: string;
  constitutionalRule: string;
  sourcePrecedence: typeof SOURCE_PRECEDENCE;
  distinctions: string[];
  opennessVocabulary: DiscoveryOpenness[];
  components: DiscoveryDescriptor[];
  navigation: { first: string[]; authenticatedContext: string[]; resourceAccess: string[] };
}

export function agentDiscoveryManifest(): AgentDiscoveryManifest {
  return {
    schemaVersion: '1.0',
    name: 'metaMe Agent Discovery Manifest',
    description: 'metaMe is a Human Agency System and constitutional computing environment for bounded human and agent participation. It combines personhood continuity, personas, delegation, sovereign data, registries, policy, research, agent runtimes, and evidence/standing mechanisms for consequential computation. Maturity varies by component and is declared below.',
    constitutionalRule: 'Agents may discover context, but only the human principal may authorize a change of constitutional authority. Public existence or registry metadata never implies payload entitlement.',
    sourcePrecedence: SOURCE_PRECEDENCE,
    distinctions: [
      'Personhood != Identity != Persona', 'Standing != Reputation', 'Eligibility != Authorization',
      'Authorization != Payload disclosure', 'Registry existence != Resource readability',
      'Public specification != Public source code', 'Implemented != MCP-exposed',
      'Ratified != Proposed', 'Canonical source != Explanatory commentary',
    ],
    opennessVocabulary: [
      'public-spec', 'public-source', 'public-document', 'public-registry', 'authenticated',
      'persona-restricted', 'confidential-bilateral', 'cohort-restricted', 'proprietary-implementation',
    ],
    components,
    navigation: {
      first: [AGENT_MANIFEST_URI, 'metame://public-knowledge', 'list_public_cartridges', 'list_public_capabilities'],
      authenticatedContext: ['get_crossing_status', 'get_persona_state', 'list_available_personas', 'list_services'],
      resourceAccess: ['list_accessible_iqubes', 'get_accessible_iqube', 'read_accessible_iqube_text'],
    },
  };
}
