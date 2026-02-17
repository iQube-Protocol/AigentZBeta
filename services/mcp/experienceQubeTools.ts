export type ExperienceDepth = 'L0' | 'L1' | 'L2' | 'L3';

export type ExperienceQubeTool =
  | 'pill.get'
  | 'capsule.get'
  | 'mini_runtime.get'
  | 'codex.entry'
  | 'invite.create'
  | 'share.compose'
  | 'next.best';

export interface ExperienceMcpRequest {
  tool: ExperienceQubeTool;
  input?: Record<string, unknown>;
  tenantId?: string;
  personaId?: string;
}

export interface ExperienceMcpResponse {
  schema: 'metame.mcp.response.v0';
  experience_id: string;
  depth: ExperienceDepth;
  artifact: {
    title: string;
    body: string;
    share_text: string;
    tags: string[];
  };
  cta: {
    primary?: {
      type: 'deepen' | 'stay' | 'share';
      label: string;
      target: 'url' | 'provider_action' | 'mcp_tool';
      value: string;
    };
    secondary: Array<{
      type: 'stay' | 'share';
      label: string;
      target: 'url' | 'provider_action' | 'mcp_tool';
      value: string;
    }>;
  };
  ladder: {
    allowed_next_depth: ExperienceDepth | null;
    reason: string;
  };
  telemetry: {
    receipt_events: string[];
    recommended_next_intent: 'share' | 'invite' | 'ask' | 'collect' | 'follow' | 'join';
  };
}

const NEXT_DEPTH: Record<ExperienceDepth, ExperienceDepth | null> = {
  L0: 'L1',
  L1: 'L2',
  L2: 'L3',
  L3: null,
};

function defaultExperienceId(input?: Record<string, unknown>): string {
  const explicit = typeof input?.experience_id === 'string' ? input.experience_id : null;
  return explicit || 'exp_metaknyt';
}

function buildResponse(params: {
  experienceId: string;
  depth: ExperienceDepth;
  title: string;
  body: string;
  shareText: string;
  tags: string[];
  primary?: ExperienceMcpResponse['cta']['primary'];
  secondary?: ExperienceMcpResponse['cta']['secondary'];
  telemetryEvents: string[];
  nextIntent: ExperienceMcpResponse['telemetry']['recommended_next_intent'];
}): ExperienceMcpResponse {
  return {
    schema: 'metame.mcp.response.v0',
    experience_id: params.experienceId,
    depth: params.depth,
    artifact: {
      title: params.title,
      body: params.body,
      share_text: params.shareText,
      tags: params.tags,
    },
    cta: {
      primary: params.primary,
      secondary: params.secondary ?? [],
    },
    ladder: {
      allowed_next_depth: NEXT_DEPTH[params.depth],
      reason:
        NEXT_DEPTH[params.depth] === null
          ? 'L3 reached; no deeper step available.'
          : `Escalation is limited to one step: ${params.depth} -> ${NEXT_DEPTH[params.depth]}.`,
    },
    telemetry: {
      receipt_events: params.telemetryEvents,
      recommended_next_intent: params.nextIntent,
    },
  };
}

function runPillGet(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  const topic = typeof input?.topic === 'string' ? input.topic : 'metaKnyt';
  return buildResponse({
    experienceId,
    depth: 'L0',
    title: `Quick pulse: ${topic}`,
    body: 'A short in-thread teaser that can be consumed without leaving the messenger.',
    shareText: `Check this out in ${topic} on metaMe.`,
    tags: ['pill', 'L0', 'qubetalk'],
    primary: {
      type: 'deepen',
      label: 'Open capsule',
      target: 'mcp_tool',
      value: 'capsule.get',
    },
    secondary: [
      {
        type: 'share',
        label: 'Share pill',
        target: 'mcp_tool',
        value: 'share.compose',
      },
    ],
    telemetryEvents: ['pill_shown', 'cta_presented'],
    nextIntent: 'share',
  });
}

function runCapsuleGet(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  return buildResponse({
    experienceId,
    depth: 'L1',
    title: 'Capsule preview',
    body: 'Structured summary with mobile-first layout and one-step deepen path.',
    shareText: 'Open this capsule and continue the Qriptopian strand.',
    tags: ['capsule', 'L1', 'web-micro'],
    primary: {
      type: 'deepen',
      label: 'Continue',
      target: 'mcp_tool',
      value: 'mini_runtime.get',
    },
    secondary: [
      {
        type: 'share',
        label: 'Share pill',
        target: 'mcp_tool',
        value: 'share.compose',
      },
    ],
    telemetryEvents: ['capsule_opened', 'cta_presented'],
    nextIntent: 'ask',
  });
}

function runMiniRuntimeGet(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  const intent = typeof input?.intent === 'string' ? input.intent : 'join';
  return buildResponse({
    experienceId,
    depth: 'L2',
    title: 'Mini Runtime Capsule',
    body: `Guided liquid-UI capsule ready for intent: ${intent}.`,
    shareText: 'Open this mini runtime to continue in-context.',
    tags: ['mini-runtime', 'L2', 'liquid-ui'],
    primary: {
      type: 'deepen',
      label: 'Enter codex',
      target: 'mcp_tool',
      value: 'codex.entry',
    },
    secondary: [
      {
        type: 'stay',
        label: 'Back to capsule',
        target: 'mcp_tool',
        value: 'capsule.get',
      },
    ],
    telemetryEvents: ['mini_runtime_opened', 'intent_triggered'],
    nextIntent: 'collect',
  });
}

function runCodexEntry(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  return buildResponse({
    experienceId,
    depth: 'L3',
    title: 'Codex entry',
    body: 'Full codex runtime path unlocked by explicit deepen intent.',
    shareText: 'Enter the full codex experience.',
    tags: ['codex', 'L3', 'full-runtime'],
    primary: {
      type: 'stay',
      label: 'Enter now',
      target: 'url',
      value: `/studio/composer/experience/${experienceId}`,
    },
    secondary: [
      {
        type: 'share',
        label: 'Share',
        target: 'mcp_tool',
        value: 'share.compose',
      },
    ],
    telemetryEvents: ['codex_entered'],
    nextIntent: 'share',
  });
}

function runInviteCreate(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  const mode = typeof input?.mode === 'string' ? input.mode : 'pill';
  return buildResponse({
    experienceId,
    depth: 'L1',
    title: 'Invite link created',
    body: `Invite generated for ${mode} landing depth.`,
    shareText: `Join me in ${experienceId} via this invite capsule.`,
    tags: ['invite', 'growth-loop'],
    secondary: [
      {
        type: 'share',
        label: 'Copy share text',
        target: 'provider_action',
        value: 'copy_to_clipboard',
      },
    ],
    telemetryEvents: ['invite_created'],
    nextIntent: 'invite',
  });
}

function runShareCompose(input?: Record<string, unknown>): ExperienceMcpResponse {
  const experienceId = defaultExperienceId(input);
  const provider = typeof input?.provider === 'string' ? input.provider : 'discord';
  return buildResponse({
    experienceId,
    depth: 'L0',
    title: 'Share payload composed',
    body: `Provider-optimized share copy prepared for ${provider}.`,
    shareText: `Open ${experienceId} capsule and share it onward.`,
    tags: ['share', provider],
    secondary: [
      {
        type: 'stay',
        label: 'Another pill',
        target: 'mcp_tool',
        value: 'pill.get',
      },
    ],
    telemetryEvents: ['pill_shared'],
    nextIntent: 'share',
  });
}

function runNextBest(input?: Record<string, unknown>): ExperienceMcpResponse {
  const event = (input?.event as Record<string, unknown>) ?? {};
  const content = (event.content as Record<string, unknown>) ?? {};
  const text = typeof content.text === 'string' ? content.text.toLowerCase() : '';

  if (text.includes('collect') || text.includes('claim') || text.includes('join')) {
    return runMiniRuntimeGet(input);
  }
  if (text.includes('open') || text.includes('more') || text.includes('continue')) {
    return runCapsuleGet(input);
  }
  return runPillGet(input);
}

export function runExperienceQubeTool(request: ExperienceMcpRequest): ExperienceMcpResponse {
  switch (request.tool) {
    case 'pill.get':
      return runPillGet(request.input);
    case 'capsule.get':
      return runCapsuleGet(request.input);
    case 'mini_runtime.get':
      return runMiniRuntimeGet(request.input);
    case 'codex.entry':
      return runCodexEntry(request.input);
    case 'invite.create':
      return runInviteCreate(request.input);
    case 'share.compose':
      return runShareCompose(request.input);
    case 'next.best':
      return runNextBest(request.input);
    default:
      return runPillGet(request.input);
  }
}
