export type SmartTriadPrimitiveClass = 'core' | 'iqube_mcp_app';

export interface SmartTriadPrimitive {
  id: string;
  action: string;
  class: SmartTriadPrimitiveClass;
  title: string;
  description: string;
  transport: 'http' | 'mcp';
  endpoint?: string;
  mcpTool?: string;
  firstClass: true;
  policy: {
    iQube: string[];
    diDQube: string[];
  };
}

const CORE_PRIMITIVES: SmartTriadPrimitive[] = [
  {
    id: 'triad_purchase_content',
    action: 'triad_purchase_content',
    class: 'core',
    title: 'Purchase Content',
    description: 'SmartTriad purchase orchestration for paid SmartContent.',
    transport: 'http',
    endpoint: '/api/content/triad/purchase',
    firstClass: true,
    policy: {
      iQube: ['content_access', 'pricing_tier'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'triad_configure_experience',
    action: 'triad_configure_experience',
    class: 'core',
    title: 'Configure Experience',
    description: 'Build SmartTriad menu + drawer manifest for current experience.',
    transport: 'http',
    endpoint: '/api/content/triad/configure',
    firstClass: true,
    policy: {
      iQube: ['experience_manifest'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'triad_browse_library',
    action: 'triad_browse_library',
    class: 'core',
    title: 'Browse Library',
    description: 'Loads owned content and content recommendations for a persona.',
    transport: 'http',
    endpoint: '/api/content/triad/library',
    firstClass: true,
    policy: {
      iQube: ['library_content'],
      diDQube: ['persona_required'],
    },
  },
  {
    id: 'triad_recommend_content',
    action: 'triad_recommend_content',
    class: 'core',
    title: 'Recommend Content',
    description: 'Returns SmartContent candidates based on intent and modality.',
    transport: 'http',
    endpoint: '/api/content/triad/recommend',
    firstClass: true,
    policy: {
      iQube: ['content_recommendation'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'triad_agent_chat',
    action: 'triad_agent_chat',
    class: 'core',
    title: 'Agent Chat',
    description: 'Copilot route for SmartTriad contextual chat responses.',
    transport: 'http',
    endpoint: '/api/content/triad/chat',
    firstClass: true,
    policy: {
      iQube: ['chat_context'],
      diDQube: ['persona_optional'],
    },
  },
];

const IQUBE_MCP_PRIMITIVES: SmartTriadPrimitive[] = [
  {
    id: 'mcp_pill_get',
    action: 'mcp.pill.get',
    class: 'iqube_mcp_app',
    title: 'Pill Get',
    description: 'Generate an L0 pill artifact for third-party messengers.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'pill.get',
    firstClass: true,
    policy: {
      iQube: ['experience_qube', 'messaging_capsule'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'mcp_capsule_get',
    action: 'mcp.capsule.get',
    class: 'iqube_mcp_app',
    title: 'Capsule Get',
    description: 'Generate an L1 capsule artifact for web micro previews.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'capsule.get',
    firstClass: true,
    policy: {
      iQube: ['experience_qube', 'liquid_ui_capsule'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'mcp_mini_runtime_get',
    action: 'mcp.mini_runtime.get',
    class: 'iqube_mcp_app',
    title: 'Mini Runtime Get',
    description: 'Generate an L2 mini-runtime payload with Liquid UI constraints.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'mini_runtime.get',
    firstClass: true,
    policy: {
      iQube: ['runtime_capsule', 'liquid_ui_surface'],
      diDQube: ['persona_or_wallet_by_intent'],
    },
  },
  {
    id: 'mcp_codex_entry',
    action: 'mcp.codex.entry',
    class: 'iqube_mcp_app',
    title: 'Codex Entry',
    description: 'Generate an L3 codex deep-link payload for explicit entry intents.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'codex.entry',
    firstClass: true,
    policy: {
      iQube: ['codex_entry'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'mcp_invite_create',
    action: 'mcp.invite.create',
    class: 'iqube_mcp_app',
    title: 'Invite Create',
    description: 'Generate invite artifacts for shareable ExperienceQube flows.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'invite.create',
    firstClass: true,
    policy: {
      iQube: ['invite_link'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'mcp_share_compose',
    action: 'mcp.share.compose',
    class: 'iqube_mcp_app',
    title: 'Share Compose',
    description: 'Compose provider-specific share payloads for pills/capsules.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'share.compose',
    firstClass: true,
    policy: {
      iQube: ['share_artifact'],
      diDQube: ['persona_optional'],
    },
  },
  {
    id: 'mcp_next_best',
    action: 'mcp.next.best',
    class: 'iqube_mcp_app',
    title: 'Next Best',
    description: 'Depth-aware orchestration that enforces one-step ladder escalation.',
    transport: 'mcp',
    endpoint: '/api/mcp/experience-qube',
    mcpTool: 'next.best',
    firstClass: true,
    policy: {
      iQube: ['experience_router'],
      diDQube: ['persona_optional'],
    },
  },
];

export const SMARTTRIAD_PRIMITIVES: SmartTriadPrimitive[] = [
  ...CORE_PRIMITIVES,
  ...IQUBE_MCP_PRIMITIVES,
];

export function getSmartTriadPrimitiveByAction(action: string): SmartTriadPrimitive | undefined {
  return SMARTTRIAD_PRIMITIVES.find((primitive) => primitive.action === action);
}

export function listSmartTriadPrimitives(): SmartTriadPrimitive[] {
  return SMARTTRIAD_PRIMITIVES;
}

export function listFirstClassIQubeMcpPrimitives(): SmartTriadPrimitive[] {
  return SMARTTRIAD_PRIMITIVES.filter((primitive) => primitive.class === 'iqube_mcp_app');
}
