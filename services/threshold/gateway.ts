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

import { createHash } from 'crypto';
import { serviceRegistrySnapshot, listServices, getService, knownCapabilities } from './serviceRegistry';
import { journeyRegistrySnapshot } from './journeyRegistry';
import { buildThresholdLink, type ThresholdLinkManifest } from './thresholdLink';
import { hasScope, type ScopedSession } from './gatewaySession';
import { crossingReceipt, welcomePayload, WELCOME_MESSAGE } from './welcome';
import type { IrlAdapter } from './irlAdapter';
import type { CompanionInstallBrief } from '../companion/extensionArtifact';
import { supportedBridgeIds, type NavigatorState } from './constitutionalNavigator';
import {
  fingerprintExchangeArtifact,
  type DepositArtifactMcpArgs,
  type DeclareArtifactFreezeMcpArgs,
  type SignExchangeInstrumentMcpArgs,
  type EstablishDelegationMcpArgs,
  type ConfirmOperatorAssistedArtifactMcpArgs,
  type getExchangeStateForMcp,
  type depositExchangeArtifactViaMcp,
  type declareArtifactFreezeViaMcp,
  type signExchangeInstrumentViaMcp,
  type establishDelegationViaMcp,
  type confirmOperatorAssistedArtifactViaMcp,
} from './mcpConstitutionalActs';

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
  /** Build the Companion install brief (SPEC-MMC-003 §3.2) — the artifact
   *  reference, its integrity values, and the human steps. Injected by the
   *  route because it reads the checked-in extension source from disk; the
   *  gateway module itself stays I/O-light and unit-testable. */
  companionInstall?: () => CompanionInstallBrief;
  /**
   * The composed constitutional-navigator state (2026-08-26) — Passport,
   * sponsorship/delegation, CAS + Reciprocal Exchange grants, and the
   * caller's journey stage, unioned per services/threshold/
   * constitutionalNavigator.ts. Injected by the route (needs the
   * service-role Supabase client and the resolved session) so this module
   * stays I/O-light. `opts.bridge` selects which journey to compose against
   * — see `supportedBridgeIds()` for what's wired.
   */
  resolveNavigatorState?: (opts?: { bridge?: string }) => Promise<NavigatorState | null>;
  /**
   * MCP-completable constitutional rituals for the OCSGA / Boundary
   * Research Journey Spine (Surface Independence, 2026-08-26) — injected by
   * the route (needs the service-role Supabase client + the resolved
   * session), each bound to services/threshold/mcpConstitutionalActs.ts's
   * corresponding function. Every one of these calls the SAME canonical
   * service (services/research/reciprocalExchange.ts,
   * services/delegation/delegationGrantStore.ts) the native UI calls —
   * this context only carries the T0<->T2-resolved binding, never a
   * parallel implementation. Absent when no session is resolved.
   */
  mcpActs?: {
    getExchangeState: () => ReturnType<typeof getExchangeStateForMcp>;
    depositArtifact: (args: DepositArtifactMcpArgs) => ReturnType<typeof depositExchangeArtifactViaMcp>;
    declareFreeze: (args: DeclareArtifactFreezeMcpArgs) => ReturnType<typeof declareArtifactFreezeViaMcp>;
    signInstrument: (args: SignExchangeInstrumentMcpArgs) => ReturnType<typeof signExchangeInstrumentViaMcp>;
    establishDelegation: (args: EstablishDelegationMcpArgs) => ReturnType<typeof establishDelegationViaMcp>;
    /** Journey Spine channel convergence (2026-08-28) — adopts a
     *  custodially-registered (operator-assisted) artifact as the bound
     *  principal's own attested evidence. Confirmation-only: never performed
     *  by an operator, never inferred from conversation. */
    confirmOperatorAssistedArtifact: (
      args: ConfirmOperatorAssistedArtifactMcpArgs,
    ) => ReturnType<typeof confirmOperatorAssistedArtifactViaMcp>;
  };
}

// ── Catalogue ───────────────────────────────────────────────────────────────

export const SERVER_INFO = { name: 'metaMe Threshold Gateway', version: '0.1.0' } as const;
export const PROTOCOL_VERSION = '2025-06-18';

export function listTools() {
  return [
    {
      name: 'list_journeys',
      description:
        'List the five constitutional journeys a principal chooses AFTER their Polity Passport is issued — Citizen, Entrepreneur, Researcher, Creative, Technical. Each is a goal (not a service menu): it activates an Threshold Guide, has a progressive Sovereignty Ladder converging on the Founder Office, and progressively unlocks services. Present these first; services are destinations within a journey.',
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
      name: 'get_navigator_state',
      description:
        'The constitutional navigator: answers "what should my principal do next" for a specific bridge/programme, composed from their REAL current state — Passport (usable/not-usable), agent sponsorship + bounded delegation, research-lab and Reciprocal Artifact Exchange grants, and their exact position in that journey (current stage, what evidence is still missing, and why the next stage matters, in the journey\'s own words). This is a NAVIGATOR over the existing journey — it never advances or mutates anything; it only reads and explains. Only ONE bridge is wired in this increment: "ocsga" (the Boundary Research / Reciprocal Artifact Exchange crossing). Omit `bridge` to use the session\'s own initiating service. Requires an authenticated session.',
      inputSchema: {
        type: 'object',
        properties: { bridge: { type: 'string', description: 'Which bridge/journey to resolve against (currently: "ocsga"). Defaults to the session\'s initiating service.' } },
        additionalProperties: false,
      },
    },
    // ── OCSGA / Boundary Research MCP-completable rituals (Surface Independence, 2026-08-26) ──
    // Every tool below writes to the EXACT SAME canonical service a native
    // IRL OS surface writes to — never a parallel evidence store. Each
    // requires the `research.exchange.write` (or `delegation.grant`)
    // capability from an incremental `irl` crossing, and each REQUIRES
    // `declarationConfirmed: true` — you must show your principal the exact
    // declaration text and obtain their explicit assent before calling.
    // Native IRL OS surfaces remain fully valid alternatives; these tools
    // only remove the requirement to navigate there when this MCP session
    // can lawfully complete the same stage.
    {
      name: 'get_exchange_state',
      description:
        "Read your principal's current Reciprocal Artifact Exchange state (OCSGA Boundary Research): whether they have deposited an artifact (and, if it was registered on their behalf by an operator, whether it is still pending their own confirmation — pendingPrincipalAttestation), whether it is freeze-declared, whether it is signed, and the same for the counterparty (subject to disclosure policy). ALSO returns the canonical freezeDeclarationText and exchangeInstrumentClauses — the exact text to present your principal BEFORE calling declare_artifact_freeze or sign_exchange_instrument (never paraphrase or assume this text). Read-only. Requires an authenticated session with research.read.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'deposit_exchange_artifact',
      description:
        "Deposit (or replace) your principal's research artifact into their active Reciprocal Artifact Exchange — the SAME act the native Exchange workspace's deposit form performs. Requires explicit declaration/consent BEFORE calling (declarationConfirmed: true) and the research.exchange.write capability. Compute contentHash first with fingerprint_exchange_artifact.",
      inputSchema: {
        type: 'object',
        properties: {
          declarationConfirmed: { type: 'boolean', description: 'Must be true. Set only after showing your principal what is about to be deposited and obtaining explicit assent.' },
          title: { type: 'string' },
          artifactClass: { type: 'string' },
          description: { type: 'string' },
          sourceType: { type: 'string', enum: ['upload', 'repository-commit', 'immutable-reference', 'manifest'] },
          sourceReference: { type: 'string', description: 'Repo-relative path, storage path, CID, or manifest URI — never a mutable branch URL for a repository-commit artifact.' },
          contentHash: { type: 'string', description: 'sha256 hex — get this from fingerprint_exchange_artifact.' },
          repositoryCommit: { type: 'string', description: 'Required when sourceType is repository-commit — the pinned commit SHA.' },
          storageReference: { type: 'string' },
          mimeType: { type: 'string' },
          ownershipDeclaration: { type: 'string', description: "Your principal's statement of ownership/authorship over this artifact." },
          rightsForExchange: { type: 'string', description: 'What rights your principal grants the counterparty for this exchange.' },
        },
        required: ['declarationConfirmed', 'title', 'artifactClass', 'sourceType', 'sourceReference', 'contentHash', 'ownershipDeclaration', 'rightsForExchange'],
        additionalProperties: false,
      },
    },
    {
      name: 'confirm_operator_assisted_artifact',
      description:
        "Adopt, as your principal's OWN attested evidence, a research artifact that an authorized operator custodially registered on their behalf (used when your principal could not themselves reach a deposit surface). This is your principal's own constitutional act — it never runs on any operator's or agent's say-so alone. The artifact's content/fingerprint is untouched; only the pending-confirmation flag clears. Until confirmed (by this tool or the native Exchange workspace), the artifact CANNOT be frozen or signed by any caller, including the registering operator. Requires explicit declaration/consent (declarationConfirmed: true) and the research.exchange.write capability. A no-op (still ok:true) if nothing is pending.",
      inputSchema: {
        type: 'object',
        properties: {
          declarationConfirmed: { type: 'boolean', description: 'Must be true. Set only after showing your principal exactly which artifact was registered on their behalf (title, fingerprint, who registered it and on what authority) and obtaining their explicit assent to adopt it as their own.' },
        },
        required: ['declarationConfirmed'],
        additionalProperties: false,
      },
    },
    {
      name: 'fingerprint_exchange_artifact',
      description:
        'Compute the canonical sha256 fingerprint for artifact content, deterministically — the SAME algorithm the platform uses everywhere else. Pure/stateless: no write, no principal resolution required. Pass exactly one of content (utf8 text) or contentBase64 (binary). Use the result as contentHash for deposit_exchange_artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'UTF-8 text content to fingerprint.' },
          contentBase64: { type: 'string', description: 'Base64-encoded binary content to fingerprint.' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'declare_artifact_freeze',
      description:
        "Declare your principal's deposited artifact frozen — the SAME act as the native Exchange workspace's Freeze Declaration button, writing the SAME attestation record (there is exactly one canonical freeze act in this platform; this both declares AND attests it — see get_navigator_state's note on this journey). Requires explicit declaration/consent (declarationConfirmed: true) and the research.exchange.write capability. Requires an artifact already deposited.",
      inputSchema: {
        type: 'object',
        properties: {
          declarationConfirmed: { type: 'boolean', description: 'Must be true. Set only after presenting the exact freeze-declaration text to your principal and obtaining explicit assent.' },
        },
        required: ['declarationConfirmed'],
        additionalProperties: false,
      },
    },
    {
      name: 'sign_exchange_instrument',
      description:
        "Sign the reciprocal Exchange Instrument on your principal's behalf — the constitutional act that commits them to the crossing. Writes an authenticated-principal MCP attestation to the SAME exchange_attestations table a native browser signature would write to (labelled origin_channel='mcp', never represented as a wallet signature) — it satisfies this stage on equal terms with native signing. Requires explicit declaration/consent (declarationConfirmed: true), the research.exchange.write capability, and that the freeze was already declared. Requires an authenticated session.",
      inputSchema: {
        type: 'object',
        properties: {
          declarationConfirmed: { type: 'boolean', description: 'Must be true. Set only after presenting the exact Exchange Instrument clauses to your principal and obtaining explicit assent to each.' },
        },
        required: ['declarationConfirmed'],
        additionalProperties: false,
      },
    },
    {
      name: 'establish_delegation',
      description:
        "Establish bounded delegation from your principal to an agent, directly through this MCP session — no browser visit required. Grants the SAFE FLOOR only (L1_EXPERIMENTAL trust band, knowledge_retrieval-class actions, capped TTL); for a broader grant your principal must use the native Delegate surface. Writes to the SAME delegation_grants ledger the native ceremony writes to. Requires explicit declaration/consent (declarationConfirmed: true) and the delegation.grant capability.",
      inputSchema: {
        type: 'object',
        properties: {
          declarationConfirmed: { type: 'boolean', description: 'Must be true. Set only after explaining exactly what bounded authority is being delegated and obtaining explicit assent.' },
          agentRootDid: { type: 'string', description: "The delegate agent's root DID." },
          purpose: { type: 'string', description: 'Why this delegation is being granted (e.g. "assist with Boundary Research artifact review").' },
        },
        required: ['declarationConfirmed', 'agentRootDid', 'purpose'],
        additionalProperties: false,
      },
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
    {
      name: 'get_companion_install',
      description:
        'Get everything your principal needs to install the metaMe Companion — the browser-side surface of the crossing they just made — while it is still pre-release and NOT in the Chrome Web Store. Returns a download URL for the extension bundle, its sha256 integrity values, the pinned extension ID to check after loading, the exact chrome://extensions steps, and the pairing step. IMPORTANT: you CANNOT install it; no MCP tool, page, or script can add an extension to a browser. Hand your principal the artifact and the steps, tell them plainly that the install is theirs to perform, and confirm afterwards. Requires an authenticated session.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
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
          experiment: { type: 'string', description: 'One of: EXP-P1, EXP-P2, EXP-P3, EXP-011, EXP-012, IRV-001, IPV-001. (EXP-011 / EXP-012 were chartered as EXP-P2 / EXP-P3 and renumbered 2026-07-27 when the P-slots were reserved for the four foundational experiments; EXP-P4 is reserved and has no results.)' },
          provider: { type: 'string', description: 'The model provider used.' },
          model: { type: 'string', description: 'The model id used.' },
          results: { description: 'The result payload (verbatim; content-hashed on submit).' },
          aggregates: { type: 'object', description: 'Optional aggregate metrics.' },
        },
        required: ['experiment', 'provider', 'model', 'results'],
        additionalProperties: false,
      },
    },
    {
      name: 'upload_content_asset',
      description:
        'Upload a content asset (cover, thumbnail, document, media) to Autonomys storage. Supports two input methods: fileBase64 (for JSON-RPC clients) or file (for connector actions with native binary). Exactly one must be provided. Supported roles: cover, thumbnail, hero, social, pdf, video, audio, attachment. Requires the content.asset.upload capability (granted at crossing time if the persona holds admin privilege). Assets may be bundled: multiple assets with the same role coexist (unbounded); setPrimary:true establishes a primary cover for the content.',
      inputSchema: {
        type: 'object',
        properties: {
          fileBase64: { type: 'string', description: 'File content as base64-encoded string (for JSON-RPC clients).' },
          file: { type: 'string', description: 'File content as raw binary (for connector/action layer; implementation-specific encoding).' },
          fileName: { type: 'string', description: 'Original filename (e.g., "cover.jpg"). Used to determine MIME type.' },
          domain: { type: 'string', description: 'Domain/series name (e.g., "metaKnyts", "qriptopian").' },
          role: { type: 'string', enum: ['cover', 'thumbnail', 'hero', 'social', 'pdf', 'video', 'audio', 'attachment'], description: 'Asset role/category.' },
          contentId: { type: 'string', description: 'Optional content ID to associate with this asset.' },
          bind: { type: 'boolean', description: 'Whether to bind the asset to the specified contentId (default: true).' },
          bundleId: { type: 'string', description: 'Optional bundle identifier for grouping multiple assets. Assets with the same bundleId coexist (unbounded).' },
          bundleLabel: { type: 'string', description: 'Optional human-readable label for the bundle.' },
          bundleType: { type: 'string', description: 'Optional bundle classification (e.g. "covers", "chapters", "background").' },
          bundleOrder: { type: 'number', description: 'Optional sequence position within the bundle (for ordered collections).' },
          assetUse: { type: 'string', description: 'Optional classification of how this asset is used (e.g. "primary", "fallback", "alternate").' },
          setPrimary: { type: 'boolean', description: 'If true, establish this asset as the primary cover/cover_image for its content.' },
        },
        required: ['fileName', 'domain', 'role'],
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
  'get_navigator_state',
  'get_exchange_state',
  'deposit_exchange_artifact',
  'confirm_operator_assisted_artifact',
  'fingerprint_exchange_artifact',
  'declare_artifact_freeze',
  'sign_exchange_instrument',
  'establish_delegation',
  'get_passport_status',
  'create_or_link_agent_card',
  'request_agent_passport',
  'activate_agent_passport',
  'propose_delegation',
  'request_service_capabilities',
  'get_companion_install',
  'enter_service',
  'accept_lab_invitation',
  'list_shared_documents',
  'read_shared_document',
  'submit_review',
  'send_qubetalk_message',
  'upload_content_asset',
]);

/** Authenticated tools IMPLEMENTED in this increment. They are a subset of
 *  HANDSHAKE_TOOLS (so the route still 401-challenges a bearer-less call); with a
 *  valid session, callTool executes them instead of the "handshake required"
 *  fallback. The remaining HANDSHAKE_TOOLS land in later increments. */
const AUTHENTICATED_TOOLS = new Set([
  'get_crossing_status',
  'get_navigator_state',
  'get_exchange_state',
  'deposit_exchange_artifact',
  'confirm_operator_assisted_artifact',
  'fingerprint_exchange_artifact',
  'declare_artifact_freeze',
  'sign_exchange_instrument',
  'establish_delegation',
  'request_service_capabilities',
  'propose_delegation',
  'get_companion_install',
  'list_shared_documents',
  'read_shared_document',
  'submit_review',
  'upload_content_asset',
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

    if (name === 'get_navigator_state') {
      if (!ctx.resolveNavigatorState) return { ...text('The constitutional navigator is unavailable on this gateway.'), isError: true };
      const bridge = typeof args.bridge === 'string' && args.bridge.trim() ? args.bridge.trim() : undefined;
      const state = await ctx.resolveNavigatorState({ bridge });
      if (!state) return { ...text('The navigator could not resolve state right now (the platform database is unavailable). Nothing below is derivable — try again shortly.'), isError: true };
      if (!state.resolvable) {
        return { ...text(`Could not resolve your principal's constitutional state: ${state.reason}`), isError: true };
      }
      return text({
        ...state,
        supportedBridges: supportedBridgeIds(),
        note:
          'This is a NAVIGATOR over the journey, not the journey itself — it never advances or authorizes anything. `nextAct` (when present) names the single next stage and who performs it (PRINCIPAL/DELEGATE/EITHER); a constitutional act (Passport, delegation, freeze, signature) is always the principal\'s own — you may explain and prepare it, never perform it.',
      });
    }

    // ── OCSGA / Boundary Research MCP-completable rituals (Surface Independence, 2026-08-26) ──
    if (name === 'get_exchange_state') {
      if (!ctx.mcpActs) return { ...text('The exchange surface is unavailable on this gateway.'), isError: true };
      const result = await ctx.mcpActs.getExchangeState();
      if (!result.ok) return { ...text(result.error), isError: true };
      return text(result);
    }

    if (name === 'fingerprint_exchange_artifact') {
      const result = fingerprintExchangeArtifact({
        content: typeof args.content === 'string' ? args.content : undefined,
        contentBase64: typeof args.contentBase64 === 'string' ? args.contentBase64 : undefined,
      });
      if (!result.ok) return { ...text(result.error), isError: true };
      return text(result);
    }

    if (
      name === 'deposit_exchange_artifact' ||
      name === 'confirm_operator_assisted_artifact' ||
      name === 'declare_artifact_freeze' ||
      name === 'sign_exchange_instrument' ||
      name === 'establish_delegation'
    ) {
      if (!hasScope(s, 'research.exchange.write') && !(name === 'establish_delegation' && hasScope(s, 'delegation.grant'))) {
        return {
          ...text(
            `This action needs the ${name === 'establish_delegation' ? 'delegation.grant' : 'research.exchange.write'} capability, which a base crossing does not grant. Enter the Researcher journey and authorize the IRL delegation first (request_service_capabilities("irl")). Only the human authorizes.`,
          ),
          isError: true,
        };
      }
      if (!ctx.mcpActs) return { ...text('The exchange/delegation write surface is unavailable on this gateway.'), isError: true };

      if (name === 'deposit_exchange_artifact') {
        const result = await ctx.mcpActs.depositArtifact({
          declarationConfirmed: args.declarationConfirmed === true,
          title: String(args.title ?? ''),
          artifactClass: String(args.artifactClass ?? ''),
          description: typeof args.description === 'string' ? args.description : undefined,
          sourceType: args.sourceType as DepositArtifactMcpArgs['sourceType'],
          sourceReference: String(args.sourceReference ?? ''),
          contentHash: String(args.contentHash ?? ''),
          repositoryCommit: typeof args.repositoryCommit === 'string' ? args.repositoryCommit : undefined,
          storageReference: typeof args.storageReference === 'string' ? args.storageReference : undefined,
          mimeType: typeof args.mimeType === 'string' ? args.mimeType : undefined,
          ownershipDeclaration: String(args.ownershipDeclaration ?? ''),
          rightsForExchange: String(args.rightsForExchange ?? ''),
        });
        if (!result.ok) return { ...text(result.error), isError: true };
        return text(result);
      }

      if (name === 'confirm_operator_assisted_artifact') {
        const result = await ctx.mcpActs.confirmOperatorAssistedArtifact({ declarationConfirmed: args.declarationConfirmed === true });
        if (!result.ok) return { ...text(result.error), isError: true };
        return text(result);
      }

      if (name === 'declare_artifact_freeze') {
        const result = await ctx.mcpActs.declareFreeze({ declarationConfirmed: args.declarationConfirmed === true });
        if (!result.ok) return { ...text(result.error), isError: true };
        return text(result);
      }

      if (name === 'sign_exchange_instrument') {
        const result = await ctx.mcpActs.signInstrument({ declarationConfirmed: args.declarationConfirmed === true });
        if (!result.ok) return { ...text(result.error), isError: true };
        return text(result);
      }

      // establish_delegation
      const result = await ctx.mcpActs.establishDelegation({
        declarationConfirmed: args.declarationConfirmed === true,
        agentRootDid: String(args.agentRootDid ?? ''),
        purpose: String(args.purpose ?? ''),
      });
      if (!result.ok) return { ...text(result.error), isError: true };
      return text(result);
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

    // ── Companion install (SPEC-MMC-003 §3.2) — artifact + steps, never an install ──
    // Session-gated but capability-free on purpose: the Companion is the same
    // principal's own browser surface, and PRD-MMC-001 §4.1 is explicit that the
    // install "grants nothing beyond identity-only" — it holds no session until
    // the human pairs it with their own. So there is no authority to delegate
    // here and nothing for a capability to bound. The gate that matters is that
    // this is discoverable only AFTER a human-authorized crossing.
    if (name === 'get_companion_install') {
      if (!ctx.companionInstall) return { ...text('The Companion artifact is unavailable on this gateway.'), isError: true };
      const brief = ctx.companionInstall();
      return text({
        ...brief,
        constitutionalBoundary:
          'Installing and pairing are HUMAN acts. You may hand over the artifact, the integrity values, and the steps, and you may ' +
          'confirm the result — you cannot add the extension to a browser, and you must not imply that you can. Pairing uses your ' +
          'principal\'s own signed-in session, read in their own tab; it never passes through you.',
        storeListingNote:
          'The Companion is not yet registered with the Chrome Web Store, so there is no "Add to Chrome" button and no auto-update. ' +
          'The developer-mode load below is the supported path until a listing exists; do not invent a store URL.',
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

    // ── Content asset upload — authenticated, requires content.asset.upload capability ──
    if (name === 'upload_content_asset') {
      // Authorize via scope: the crossing grants content.asset.upload only if the
      // persona carries admin privilege at crossing time. (Revocation: if
      // admin rights are revoked, new crossings will not grant the capability.)
      if (!hasScope(s, 'content.asset.upload')) {
        return {
          ...text('This action requires content.asset.upload capability. You do not hold this authorization.'),
          isError: true,
        };
      }

      const fileBase64 = typeof args.fileBase64 === 'string' ? args.fileBase64 : null;
      const file = typeof args.file === 'string' ? args.file : null;
      const fileName = typeof args.fileName === 'string' ? args.fileName : null;
      const domain = typeof args.domain === 'string' ? args.domain : null;
      const role = typeof args.role === 'string' ? args.role : null;
      const contentId = typeof args.contentId === 'string' ? args.contentId : undefined;
      const bind = args.bind === false ? false : true;

      // Bundle metadata parameters (optional)
      const bundleId = typeof args.bundleId === 'string' ? args.bundleId : undefined;
      const bundleLabel = typeof args.bundleLabel === 'string' ? args.bundleLabel : undefined;
      const bundleType = typeof args.bundleType === 'string' ? args.bundleType : undefined;
      const bundleOrder = typeof args.bundleOrder === 'number' ? args.bundleOrder : undefined;
      const assetUse = typeof args.assetUse === 'string' ? args.assetUse : undefined;
      const setPrimary = args.setPrimary === true;

      if (!fileName || !domain || !role) {
        return {
          ...text('Missing required parameters: fileName, domain, role'),
          isError: true,
        };
      }

      // Validate exactly one of file or fileBase64 is supplied
      if (!file && !fileBase64) {
        return {
          ...text('Must supply either file or fileBase64, not neither'),
          isError: true,
        };
      }
      if (file && fileBase64) {
        return {
          ...text('Cannot supply both file and fileBase64 — provide only one'),
          isError: true,
        };
      }

      // Infer MIME type from fileName
      const mimeTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
      };
      const ext = '.' + fileName.split('.').pop()?.toLowerCase();
      let mimeType = mimeTypeMap[ext] || 'application/octet-stream';

      // Decode file (from base64 or already-decoded buffer)
      let fileBytes: ArrayBuffer;
      try {
        if (fileBase64) {
          // JSON-RPC path: decode from base64
          fileBytes = Buffer.from(fileBase64, 'base64').buffer;
        } else if (file) {
          // Connector action path: file is already a base64-encoded representation of bytes
          // (from multipart adapter that encoded the binary before calling)
          fileBytes = Buffer.from(file, 'base64').buffer;
        } else {
          return {
            ...text('Invalid file parameter.'),
            isError: true,
          };
        }
      } catch {
        return {
          ...text('Invalid encoding for file parameter.'),
          isError: true,
        };
      }

      // Forward to the canonical /api/content/assets/upload endpoint
      // Do not duplicate upload/storage logic — the canonical endpoint owns that.
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', new Blob([fileBytes], { type: mimeType }), fileName);
        uploadFormData.append('fileName', fileName);
        uploadFormData.append('domain', domain);
        uploadFormData.append('role', role);
        uploadFormData.append('bind', bind ? 'true' : 'false');

        if (contentId) {
          uploadFormData.append('contentId', contentId);
        }

        // Bundle metadata — forward to canonical endpoint for unbounded asset model
        if (bundleId) {
          uploadFormData.append('bundleId', bundleId);
        }
        if (bundleLabel) {
          uploadFormData.append('bundleLabel', bundleLabel);
        }
        if (bundleType) {
          uploadFormData.append('bundleType', bundleType);
        }
        if (bundleOrder !== undefined) {
          uploadFormData.append('bundleOrder', String(bundleOrder));
        }
        if (assetUse) {
          uploadFormData.append('assetUse', assetUse);
        }
        if (setPrimary) {
          uploadFormData.append('setPrimary', 'true');
        }

        // Route to the canonical content assets endpoint
        const uploadUrl = `${ctx.origin}/api/content/assets/upload`;
        const uploadResp = await fetch(uploadUrl, {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          return {
            ...text(`Upload failed: ${uploadResp.status} ${uploadResp.statusText}. ${errText}`),
            isError: true,
          };
        }

        const uploadResult = await uploadResp.json();
        // Return the canonical endpoint response directly — no synthesis
        return text(uploadResult);
      } catch (err) {
        return {
          ...text(`Upload error: ${err instanceof Error ? err.message : String(err)}`),
          isError: true,
        };
      }
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
            '6. **Choose a journey** — Citizen, Entrepreneur, Researcher, Creative, or Technical. Each activates an Threshold Guide and a progressive Sovereignty Ladder converging on the Founder Office; services are destinations reached within the chosen journey (see `metame://journeys`).\n\n' +
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
