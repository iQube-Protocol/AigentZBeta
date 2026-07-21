/**
 * gateway.ts — the metaMe Threshold Gateway catalogue + read-only dispatch
 * (PRD-THR-001 §8). This is the MCP surface the Threshold Companion (the user's
 * agent) speaks to. Increment 1 exposes ONLY the unauthenticated, read-only
 * slice: `list_services`, `inspect_threshold_link`, the discovery resources, and
 * the conversational prompts. The authenticated crossing tools (the
 * Constitutional Handshake, Agent Card, delegation, service entry) are declared
 * in the PRD and land in later increments; they are NOT listed here yet so every
 * advertised tool is functional.
 *
 * Kept dependency-light on purpose (no MCP SDK) — the JSON-RPC transport is a
 * thin hand-rolled handler in app/api/threshold/mcp/route.ts, which keeps the
 * SSR bundle lean (the platform sits near the Amplify output-size cap).
 */

import { serviceRegistrySnapshot } from './serviceRegistry';
import { journeyRegistrySnapshot, getJourney } from './journeyRegistry';
import { buildThresholdLink, type ThresholdLinkManifest } from './thresholdLink';
import type { ScopedSession } from './gatewaySession';

// ── Context injected by the route (keeps this module I/O-light + testable) ──

export interface InvitationInfo {
  invitationId: string; // T2-safe id/label — never a raw persona/T0 id
  initiatingService: string;
  institution?: string;
  requestedRole: string;
  requestedCapabilities: string[];
  status: string;
  onboarded: boolean;
  expiresAt?: string | null;
}

export interface GatewayContext {
  origin: string;
  gatewayUrl: string;
  /** Resolve a public capability-URL invitation code to its (T2-safe) metadata. */
  resolveInvitation?: (code: string) => Promise<InvitationInfo | null>;
  /**
   * The scoped session resolved from a presented `Authorization: Bearer` (the
   * Constitutional Handshake bearer), or null/undefined when the Companion is
   * unauthenticated. Additive: Increment 1's read-only tools ignore it; the
   * authenticated crossing tools (later increments) gate on it. Its presence
   * NEVER widens the read-only surface.
   */
  session?: ScopedSession | null;
}

// ── Catalogue ───────────────────────────────────────────────────────────────

export const SERVER_INFO = { name: 'metaMe Threshold Gateway', version: '0.1.0' } as const;
export const PROTOCOL_VERSION = '2025-06-18';

export function listTools() {
  return [
    {
      name: 'list_journeys',
      description:
        'List the five constitutional journeys a principal chooses AFTER their Polity Passport is issued — Citizen, Entrepreneur, Researcher, Creative, Technical. Each is a goal (not a service menu): it activates an Experience Guide, has a progressive Sovereignty Ladder converging on the Founder Office, and progressively unlocks services. Present these first; services are destinations within a journey.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'list_services',
      description:
        'The platform-facing service registry beneath the journeys: the metaMe services reachable after crossing the Threshold, each with the capability scope a crossing must request. Prefer list_journeys for the first conversation; use this to inspect the concrete services a journey unlocks. polity-passport is the constitutional root (the front door itself).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'inspect_threshold_link',
      description:
        'Inspect a Threshold Link (crossing invitation) by its code. Returns the requested role, requested capabilities, initiating service, and a signed manifest — so you can explain the crossing to your principal BEFORE any authentication. Reveals only the invitation\'s own metadata; no persona identifiers.',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string', description: 'The Threshold Link / invitation code (e.g. pinv-… or x409-…).' } },
        required: ['code'],
        additionalProperties: false,
      },
    },
  ];
}

export function listResources() {
  return [
    { uri: 'metame://institution/charter', name: 'metaMe Threshold — charter', mimeType: 'text/markdown' },
    { uri: 'metame://onboarding/current', name: 'The crossing — current steps', mimeType: 'text/markdown' },
    { uri: 'metame://journeys', name: 'Journey registry (user-facing)', mimeType: 'application/json' },
    { uri: 'metame://services', name: 'Service registry (platform-facing)', mimeType: 'application/json' },
  ];
}

export function listPrompts() {
  return [
    {
      name: 'cross_the_threshold',
      description: 'Guide the principal, conversationally, across the metaMe Threshold: inspect the crossing, explain every requested permission, and proceed only on explicit human approval.',
      arguments: [{ name: 'code', description: 'The Threshold Link / invitation code, if the principal has one.', required: false }],
    },
    {
      name: 'get_polity_passport',
      description: 'Explain what a Polity Passport establishes (personhood-bound continuity without public identity exposure) and guide the principal to obtain one.',
      arguments: [],
    },
    {
      name: 'explain_delegation_request',
      description: 'Explain, in plain language, exactly what bounded authority a crossing is asking the principal to delegate to their agent — what it may and may not do — before they authorize.',
      arguments: [{ name: 'capabilities', description: 'The requested capability scope.', required: false }],
    },
    {
      name: 'choose_your_journey',
      description: 'After the Polity Passport is issued, help the principal choose one of the five constitutional journeys (Citizen, Entrepreneur, Researcher, Creative, Technical). Present each as a goal with its Sovereignty Ladder, and let the principal pick a purpose — the services follow from the journey.',
      arguments: [],
    },
  ];
}

// ── Read-only dispatch ────────────────────────────────────────────────────────

/** Tools that require the Constitutional Handshake — declared in the PRD but not
 *  yet wired. Calling one returns a structured, honest "handshake required". */
const HANDSHAKE_TOOLS = new Set([
  'begin_handshake',
  'authenticate_principal',
  'get_passport_status',
  'create_or_link_agent_card',
  'request_agent_passport',
  'activate_agent_passport',
  'propose_delegation',
  'request_service_capabilities',
  'enter_service',
  'accept_lab_invitation',
  'list_shared_documents',
  'read_shared_document',
  'submit_review',
  'send_qubetalk_message',
]);

function text(value: unknown) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

export async function callTool(name: string, args: Record<string, unknown>, ctx: GatewayContext) {
  if (name === 'list_journeys') {
    return text(journeyRegistrySnapshot());
  }

  if (name === 'list_services') {
    return text(serviceRegistrySnapshot());
  }

  if (name === 'inspect_threshold_link') {
    const code = typeof args.code === 'string' ? args.code.trim() : '';
    if (!code) return { ...text('A Threshold Link code is required.'), isError: true };
    if (!ctx.resolveInvitation) return { ...text('Invitation resolution is unavailable on this gateway.'), isError: true };
    const info = await ctx.resolveInvitation(code);
    if (!info) return { ...text('That Threshold Link was not found or has expired.'), isError: true };
    const manifest: ThresholdLinkManifest = buildThresholdLink({
      invitationId: info.invitationId,
      initiatingService: info.initiatingService,
      institution: info.institution,
      requestedRole: info.requestedRole,
      requestedCapabilities: info.requestedCapabilities,
      gatewayUrl: ctx.gatewayUrl,
      expiresAt: info.expiresAt ?? null,
    });
    return text({
      crossing: {
        institution: info.institution ?? null,
        initiatingService: info.initiatingService,
        requestedRole: info.requestedRole,
        requestedCapabilities: info.requestedCapabilities,
        status: info.status,
        alreadyCrossed: info.onboarded,
      },
      constitutionalBoundary:
        'You (the agent) may inspect, prepare, and explain. Establishing personhood, claiming the invitation, and authorizing delegation are HUMAN constitutional acts performed by the signed-in principal.',
      nextStep: info.onboarded
        ? 'This principal has already crossed. Use list_services to see what they can enter.'
        : 'Explain each requested capability to your principal, then (in a subsequent gateway increment) begin the Constitutional Handshake to establish their Polity Passport.',
      manifest,
    });
  }

  if (HANDSHAKE_TOOLS.has(name)) {
    return {
      ...text(
        'This action requires the Constitutional Handshake, which ships in the next Threshold Gateway increment. ' +
          'For now you can inspect_threshold_link and list_services, and explain the crossing to your principal.',
      ),
      isError: true,
    };
  }

  return { ...text(`Unknown tool: ${name}`), isError: true };
}

export async function readResource(uri: string, ctx: GatewayContext) {
  if (uri === 'metame://journeys') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(journeyRegistrySnapshot(), null, 2) }] };
  }
  if (uri === 'metame://services') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(serviceRegistrySnapshot(), null, 2) }] };
  }
  if (uri === 'metame://institution/charter') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text:
            '# metaMe Threshold\n\nThe constitutional front door. Cross the Threshold with the agent you already use: ' +
            'establish a Polity Passport (personhood-bound continuity without public identity exposure), bind your agent under ' +
            'bounded, revocable delegation, and reach metaMe services through the agent you know. Your agent stays; your sovereignty begins.\n\n' +
            'Only the human authorizes — the agent inspects, prepares, and explains (Principal–Delegate Separation).',
        },
      ],
    };
  }
  if (uri === 'metame://onboarding/current') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text:
            '# The crossing\n\n1. **Inspect** the Threshold Link and explain what metaMe is and what will be requested.\n' +
            '2. **Establish personhood** — the principal obtains a Polity Passport.\n' +
            '3. **Bind the agent** — create/link an Agent Card.\n' +
            '4. **Delegate** — the principal authorizes a bounded scope.\n' +
            '5. **Activate** a revocable Agent Passport.\n' +
            '6. **Choose a journey** — Citizen, Entrepreneur, Researcher, Creative, or Technical. Each activates an Experience Guide and a progressive Sovereignty Ladder converging on the Founder Office; services are destinations reached within the chosen journey (see `metame://journeys`).\n\n' +
            '_This gateway increment supports step 1, journey discovery, and service discovery; the authenticated steps land next._',
        },
      ],
    };
  }
  return { contents: [], isError: true };
}

export function getPrompt(name: string, args: Record<string, unknown>) {
  const code = typeof args.code === 'string' ? args.code : undefined;
  const caps = typeof args.capabilities === 'string' ? args.capabilities : undefined;
  const messages = (body: string) => ({ messages: [{ role: 'user', content: { type: 'text', text: body } }] });

  if (name === 'cross_the_threshold') {
    return messages(
      'You are helping your principal cross the metaMe Threshold — the constitutional front door to metaMe.\n\n' +
        (code ? `There is a Threshold Link code: ${code}. Call inspect_threshold_link with it first.\n\n` : 'If the principal has a Threshold Link code, call inspect_threshold_link with it first.\n\n') +
        'Then, in plain language: (1) explain what metaMe and the Polity Passport establish; (2) explain EACH requested capability and, crucially, what it does NOT permit; (3) make clear that establishing personhood and authorizing delegation are the principal\'s own acts — you only prepare and explain; (4) proceed only after explicit approval. Use list_services to show what becomes reachable after the crossing.',
    );
  }
  if (name === 'get_polity_passport') {
    return messages(
      'Explain to your principal that a Polity Passport establishes personhood-bound continuity WITHOUT requiring public identity exposure — it is the door into metaMe, and the first rung of the Sovereignty Ladder. Then guide them to obtain one. Only the human completes the passport; you assist and explain.',
    );
  }
  if (name === 'explain_delegation_request') {
    return messages(
      'Explain, plainly, the bounded authority this crossing asks your principal to delegate to you' +
        (caps ? ` (requested: ${caps})` : '') +
        '. State clearly what you MAY do and what you MAY NOT do (e.g. no publishing, no committing funds, no delegating another agent, no disclosing identity credentials). Ask for explicit approval before anything is authorized. Only the human authorizes.',
    );
  }
  if (name === 'choose_your_journey') {
    return messages(
      'Your principal\'s Polity Passport is active. Now help them choose a purpose, not a service. Call list_journeys, then present the five constitutional journeys — Citizen, Entrepreneur, Researcher, Creative, Technical — each as a goal with its progressive Sovereignty Ladder (every journey climbs toward the Founder Office). Ask which they want to pursue first. Services are destinations they reach WITHIN the journey they choose — introduce them contextually as the journey progresses, never as an upfront menu.',
    );
  }
  return messages(`Unknown prompt: ${name}`);
}
