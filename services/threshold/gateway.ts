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

import { serviceRegistrySnapshot, listServices, getService, knownCapabilities } from './serviceRegistry';
import { journeyRegistrySnapshot } from './journeyRegistry';
import { buildThresholdLink, type ThresholdLinkManifest } from './thresholdLink';
import { hasScope, type ScopedSession } from './gatewaySession';
import { crossingReceipt, welcomePayload, WELCOME_MESSAGE } from './welcome';
import type { IrlAdapter } from './irlAdapter';

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
  /** The IRL read adapter (public open corpus), injected by the route. Present
   *  only where the gateway can reach the app's public routes. */
  irl?: IrlAdapter;
  /** Begin an incremental service crossing (session upgrade) — returns the human
   *  authorize URL. Injected by the route (creates the upgrade handshake). */
  beginServiceUpgrade?: (service: string, missingCapabilities: string[]) => Promise<{ authorizeUrl: string } | null>;
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
    {
      name: 'explain_primitive',
      description:
        'Define a metaMe / Polity constitutional primitive (e.g. "standing", "delegation", "citizenship", "personhood", "authority", "reputation", "Polity Passport") AUTHORITATIVELY and CONSTITUTIONAL-FIRST. Returns Layer 1 — the verbatim ratified defining invariants (the constitutional meaning, canonical statements leading) — then Layer 2, the operational resolver model, clearly labelled as a ranking projection and NOT the definition. Also returns `distinctions` (e.g. Standing is personhood-bound and is NOT reputation). Lead your answer with Layer 1; use Layer 2 only if the principal asks how the term is calculated. Public + read-only; no crossing required.',
      inputSchema: {
        type: 'object',
        properties: { term: { type: 'string', description: 'The constitutional primitive / term to define.' } },
        required: ['term'],
        additionalProperties: false,
      },
    },
    {
      name: 'read_experiment_results',
      description:
        'Read the PUBLISHED, hash-committed IRL experiment result records (T2-safe, no persona data) so you can independently verify them: recompute sha256 over the verbatim results JSON and compare to the anchored content hash. Optional `experiment` id filter (e.g. "EXP-P1", "IRV-001"). Public + read-only; no crossing required — this is the reviewer-exercisable verification surface.',
      inputSchema: {
        type: 'object',
        properties: { experiment: { type: 'string', description: 'Optional experiment id filter, e.g. EXP-P1.' } },
        additionalProperties: false,
      },
    },
    // ── Authenticated crossing tools (require a scoped session from the crossing) ──
    {
      name: 'get_crossing_status',
      description:
        'After the crossing, report the current session: whether it is active, the exact capability scope the principal authorized, and which services are now reachable vs still need more scope. Requires an authenticated session (present your bearer). Reveals only the T2 principal/agent references — never persona identifiers.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'request_service_capabilities',
      description:
        'Check whether the crossing already holds the scope to enter a named service; if not, learn exactly which additional capabilities an incremental crossing must request. This PREPARES a request — your principal authorizes any new scope in the browser. Requires an authenticated session.',
      inputSchema: {
        type: 'object',
        properties: { service: { type: 'string', description: 'A service id from list_services (e.g. irl, devon).' } },
        required: ['service'],
        additionalProperties: false,
      },
    },
    {
      name: 'propose_delegation',
      description:
        'Draft an incremental delegation proposal for a set of capabilities so you can explain to your principal exactly what would be requested and its bounds. This only PREPARES a proposal — you cannot grant it; your principal authorizes via a crossing in the browser. Requires an authenticated session.',
      inputSchema: {
        type: 'object',
        properties: { capabilities: { type: 'array', items: { type: 'string' }, description: 'The capabilities to propose.' } },
        required: ['capabilities'],
        additionalProperties: false,
      },
    },
    // ── IRL service adapter — read surface (requires research.read) ──
    {
      name: 'list_shared_documents',
      description:
        "List the Invariant Research Lab's shared research artifacts (its public open corpus index), so you can help your principal navigate them. Requires the research.read capability, granted by entering the Researcher journey / the IRL service.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'read_shared_document',
      description:
        "Read a specific shared IRL research document by its repo-relative path (e.g. foundation/PARTICIPATION_overview.md). Returns the raw markdown from IRL's public, persona-free corpus. Requires the research.read capability.",
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Repo-relative path within the IRL pack (e.g. foundation/…​.md).' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
    {
      name: 'submit_review',
      description:
        'Submit an experiment result / review to the Invariant Research Lab under your principal\'s AUTHORIZED IRL delegation. Requires the research.submit capability AND an IRL submission agreement from the incremental IRL crossing (request_service_capabilities("irl") first). Each submission re-passes the x409 gate + the delegated TTL/action budget; a receipt is issued.',
      inputSchema: {
        type: 'object',
        properties: {
          experiment: { type: 'string', description: 'One of: EXP-P1, EXP-P2, EXP-P3, IRV-001, IPV-001.' },
          provider: { type: 'string', description: 'The model provider used.' },
          model: { type: 'string', description: 'The model id used.' },
          results: { description: 'The result payload (verbatim; content-hashed on submit).' },
          aggregates: { type: 'object', description: 'Optional aggregate metrics.' },
        },
        required: ['experiment', 'provider', 'model', 'results'],
        additionalProperties: false,
      },
    },
  ];
}

export function listResources() {
  return [
    { uri: 'metame://welcome', name: 'Constitutional Welcome & Citizenship Orientation', mimeType: 'application/json' },
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
      name: 'constitutional_welcome',
      description: 'Deliver the Constitutional Welcome the moment a crossing succeeds: congratulate the principal, tell them they are now a citizen of the Polity, offer the two orientation explanations (Constitutional Internet, citizenship + its limits), present the crossing receipt (service authority: none yet), and lead into the five journeys. Read metame://welcome for the canonical copy.',
      arguments: [],
    },
    {
      name: 'choose_your_journey',
      description: 'After the Polity Passport is issued, help the principal choose one of the five constitutional journeys (Citizen, Entrepreneur, Researcher, Creative, Technical). Present each as a goal with its Sovereignty Ladder, and let the principal pick a purpose — the services follow from the journey.',
      arguments: [],
    },
  ];
}

// ── Read-only dispatch ────────────────────────────────────────────────────────

/** Tools that require the Constitutional Handshake (a valid scoped bearer). Until
 *  the Companion has crossed via the OAuth flow, the MCP route answers a call to
 *  one of these with an HTTP 401 + WWW-Authenticate challenge (the spec trigger
 *  for the client to run the crossing); if the transport still reaches dispatch,
 *  callTool returns an honest "handshake required". */
export const HANDSHAKE_TOOLS = new Set([
  'begin_handshake',
  'authenticate_principal',
  'get_crossing_status',
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

/** Authenticated tools IMPLEMENTED in this increment. They are a subset of
 *  HANDSHAKE_TOOLS (so the route still 401-challenges a bearer-less call); with a
 *  valid session, callTool executes them instead of the "handshake required"
 *  fallback. The remaining HANDSHAKE_TOOLS land in later increments. */
const AUTHENTICATED_TOOLS = new Set([
  'get_crossing_status',
  'request_service_capabilities',
  'propose_delegation',
  'list_shared_documents',
  'read_shared_document',
  'submit_review',
]);

function text(value: unknown) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

function handshakeRequired() {
  return {
    ...text(
      'This action requires the Constitutional Handshake — a scoped session your principal grants by crossing the Threshold. ' +
        'Discover the crossing at /.well-known/oauth-protected-resource and run the OAuth authorization-code flow: your principal ' +
        'signs in and authorizes a bounded delegation in the browser, then you present the resulting bearer here. Only the human authorizes.',
    ),
    isError: true,
  };
}

export async function callTool(name: string, args: Record<string, unknown>, ctx: GatewayContext) {
  if (name === 'list_journeys') {
    return text(journeyRegistrySnapshot());
  }

  if (name === 'list_services') {
    return text(serviceRegistrySnapshot());
  }

  if (name === 'explain_primitive') {
    const term = typeof args.term === 'string' ? args.term.trim() : '';
    if (!term) return { ...text('A term to define is required (e.g. "standing", "delegation", "Polity Passport").'), isError: true };
    if (!ctx.irl) return { ...text('The constitutional canon is unavailable on this gateway.'), isError: true };
    return text(await ctx.irl.definePrimitive(term));
  }

  if (name === 'read_experiment_results') {
    if (!ctx.irl) return { ...text('The IRL results surface is unavailable on this gateway.'), isError: true };
    const experiment = typeof args.experiment === 'string' ? args.experiment.trim() : undefined;
    return text(await ctx.irl.readResults(experiment));
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

  // ── Authenticated dispatch (Increment 3) — session-gated, read/prepare only ──
  // These consume the scoped session minted by the crossing. They report status,
  // resolve service eligibility, and PREPARE incremental delegations — they never
  // mutate the principal's state (that requires a human-authorized crossing) and
  // never touch a T0 identifier (the session carries only T2 refs).
  if (AUTHENTICATED_TOOLS.has(name)) {
    if (!ctx.session) return handshakeRequired();
    const s = ctx.session;

    if (name === 'get_crossing_status') {
      // Eligibility ≠ authority — the two states a service can be in, reported
      // distinctly so a Companion never mistakes "you can enter this" for "your
      // agent may operate here". A service is `authorized` only when the session
      // actually holds its operating capabilities (i.e. an incremental crossing
      // has happened); otherwise it is `eligible` — discoverable, entry offered,
      // but no operational authority yet.
      const svcState = listServices().map((svc) => {
        const capabilitiesHeld = svc.requiredCapabilities.filter((c) => hasScope(s, c));
        const capabilitiesMissing = svc.requiredCapabilities.filter((c) => !hasScope(s, c));
        return {
          id: svc.id,
          title: svc.title,
          role: svc.role,
          status: svc.status,
          capabilitiesHeld,
          capabilitiesMissing,
          authorized: capabilitiesMissing.length === 0,
          agreementRecorded: Boolean(s.serviceAgreements?.[svc.id]),
        };
      });
      const authorized = svcState.filter((x) => x.authorized);
      const eligible = svcState.filter((x) => !x.authorized).map((x) => ({ ...x, authorizationRequired: true }));
      return text({
        crossed: true,
        principal: s.principalPublicRef, // T2 Polity Public Reference — never a persona id
        agent: s.agentAlias, // T2 alias
        initiatingService: s.initiatingService,
        // Constitutional framing: the granted authority + the crossing receipt.
        // A base crossing carries only constitutional-root navigation authority,
        // so `receipt.serviceAuthority` reads "none yet" until a journey is chosen.
        currentAuthority: s.scope,
        crossingReceipt: crossingReceipt(s),
        services: {
          authorized, // operational authority held on this session — can be operated now
          eligible, // discoverable; an incremental crossing is required before operating
        },
        // Back-compat mirrors (older callers): the id lists of the two states.
        reachableServices: authorized.map((x) => x.id),
        pendingServices: eligible.map((x) => ({ id: x.id, missingCapabilities: x.capabilitiesMissing })),
        note:
          'Eligible ≠ authorized. A service under `eligible` is discoverable and you may request entry, but your agent holds NO operational authority within it until an incremental crossing completes — call request_service_capabilities("<id>") and your principal authorizes in the browser. Only services under `authorized` can be operated now. (Journey eligibility is discovery; operational authority is a separate, human-authorized grant.)',
        expiresAt: s.expiresAt,
      });
    }

    if (name === 'request_service_capabilities') {
      const id = typeof args.service === 'string' ? args.service.trim() : '';
      const svc = getService(id);
      if (!svc) return { ...text(`Unknown service: ${id || '(none)'}. Use list_services.`), isError: true };
      const missing = svc.requiredCapabilities.filter((c) => !hasScope(s, c));
      if (missing.length === 0) {
        return text({ service: svc.id, title: svc.title, reachable: true, note: `Your crossing already holds the scope for ${svc.title}.` });
      }
      // Mint the incremental service crossing link — the human authorizes THIS
      // service's delegation in the browser, which upgrades the SAME session.
      const upgrade = ctx.beginServiceUpgrade ? await ctx.beginServiceUpgrade(svc.id, missing) : null;
      return text({
        service: svc.id,
        title: svc.title,
        reachable: false,
        missingCapabilities: missing,
        authorizeUrl: upgrade?.authorizeUrl ?? null,
        howTo: upgrade?.authorizeUrl
          ? `Give your principal this link to authorize entering ${svc.title}: ${upgrade.authorizeUrl}. They sign in and approve the delegation in the browser — you cannot grant it yourself. Once approved, your existing session gains these capabilities.`
          : 'An incremental crossing is required, but the authorize link could not be minted on this gateway. Only the human authorizes.',
      });
    }

    if (name === 'propose_delegation') {
      const caps = Array.isArray(args.capabilities) ? args.capabilities.filter((x): x is string => typeof x === 'string') : [];
      const known = knownCapabilities();
      const recognized = caps.filter((c) => known.has(c));
      const unrecognized = caps.filter((c) => !known.has(c));
      const alreadyHeld = recognized.filter((c) => hasScope(s, c));
      const wouldRequest = recognized.filter((c) => !hasScope(s, c));
      return text({
        proposal: {
          requestedCapabilities: recognized,
          alreadyHeld,
          wouldRequest,
          unrecognized,
          boundary:
            'Read/participate only — a delegation proposed here can never move funds, publish, disclose identity, or delegate onward.',
        },
        humanStep:
          'This is a draft to explain to your principal. To grant the new capabilities, run the crossing (OAuth authorize) requesting `wouldRequest`; ' +
          'your principal authorizes in the browser. You cannot authorize on their behalf.',
      });
    }

    // ── IRL service adapter — read surface, gated on the research.read capability ──
    if (name === 'list_shared_documents' || name === 'read_shared_document') {
      if (!hasScope(s, 'research.read')) {
        return {
          ...text(
            'This action needs the `research.read` capability, which a base crossing does not grant. ' +
              'Enter the Researcher journey and authorize the IRL delegation first (request_service_capabilities("irl")). Only the human authorizes.',
          ),
          isError: true,
        };
      }
      if (!ctx.irl) return { ...text('The IRL adapter is unavailable on this gateway.'), isError: true };
      if (name === 'list_shared_documents') return text(await ctx.irl.listDocuments());
      const path = typeof args.path === 'string' ? args.path : '';
      return text(await ctx.irl.readDocument(path));
    }

    // ── IRL write surface — submit a result under the AUTHORIZED IRL delegation ──
    if (name === 'submit_review') {
      if (!hasScope(s, 'research.submit')) {
        return {
          ...text('This action needs the `research.submit` capability. Enter the Researcher journey and authorize the IRL delegation first (request_service_capabilities("irl")). Only the human authorizes.'),
          isError: true,
        };
      }
      const agreementId = s.serviceAgreements?.irl;
      if (!agreementId) {
        return {
          ...text('You hold research.submit but have no IRL submission agreement on this session. Have your principal authorize the incremental IRL crossing (request_service_capabilities("irl")) — that binds the irl:experiment-result:submit delegation this tool submits under.'),
          isError: true,
        };
      }
      if (!ctx.irl) return { ...text('The IRL adapter is unavailable on this gateway.'), isError: true };
      const result = await ctx.irl.submitResult({
        agreementId,
        experiment: String(args.experiment ?? ''),
        provider: String(args.provider ?? ''),
        model: String(args.model ?? ''),
        results: args.results,
        aggregates: args.aggregates && typeof args.aggregates === 'object' ? (args.aggregates as Record<string, unknown>) : {},
      });
      return text(result);
    }
  }

  if (HANDSHAKE_TOOLS.has(name)) {
    return handshakeRequired();
  }

  return { ...text(`Unknown tool: ${name}`), isError: true };
}

export async function readResource(uri: string, ctx: GatewayContext) {
  if (uri === 'metame://welcome') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(welcomePayload(ctx.session), null, 2) }] };
  }
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
  if (name === 'constitutional_welcome') {
    return messages(
      'Your principal has just crossed the Threshold. Deliver the Constitutional Welcome — read the `metame://welcome` resource for the canonical copy and present it faithfully:\n\n' +
        '1. Congratulate them and state they are now a CITIZEN of the Polity (use the canonical welcome message verbatim).\n' +
        '2. Offer the two orientation explanations — "What is the Constitutional Internet?" and "What does citizenship in the Polity mean?" — in plain language.\n' +
        '3. Make the LIMIT explicit: citizenship establishes personhood continuity; it does NOT grant your agent broad powers. Every additional capability is authorized separately and stays bounded.\n' +
        '4. Show the crossing receipt (Threshold crossed · Passport active · Citizenship active · Agent connection active · Service authority: none yet · Next step: choose a journey).\n' +
        '5. Lead into the five journeys: "Where would you like to begin? Citizen · Entrepreneur · Researcher · Creative · Technical."\n\n' +
        'The orientation can be revisited at any time. Never imply the crossing granted service authority — it did not.\n\n' +
        WELCOME_MESSAGE,
    );
  }
  if (name === 'choose_your_journey') {
    return messages(
      'Your principal\'s Polity Passport is active. Now help them choose a purpose, not a service. Call list_journeys, then present the five constitutional journeys — Citizen, Entrepreneur, Researcher, Creative, Technical — each as a goal with its progressive Sovereignty Ladder (every journey climbs toward the Founder Office). Ask which they want to pursue first. Services are destinations they reach WITHIN the journey they choose — introduce them contextually as the journey progresses, never as an upfront menu.',
    );
  }
  return messages(`Unknown prompt: ${name}`);
}
