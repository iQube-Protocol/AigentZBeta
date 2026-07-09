/**
 * ModelQubes — the Phase 2 constitutional orchestration substrate (CFS-015
 * Strand One + Strand Two Phase Two; the `source: 'modelqube'` slot reserved in
 * modelRouter.ts:20). Server-only.
 *
 * A ModelQube is a **constitutional object** (the P0 model, types/
 * constitutionalObject.ts) that represents one inference capability —
 * provider + model — with its own standing, authority, provenance, and
 * per-reasoning-stage fitness. The Model Router routes each reasoning stage by
 * an INVARIANT-AWARE policy over these objects instead of a hardcoded table:
 * the routing DECISION becomes constitutional data (object-model-driven,
 * standing-ranked, invariant-citing) rather than a literal.
 *
 * This makes the platform's reasoning INVARIANT-INTELLIGENT and SOVEREIGN:
 *   - `inv.engineering.031` "Separate reasoning from inference." — a ModelQube
 *     carries the constitutional fitness; the provider contributes inference
 *     ONLY. Reasoning is the platform's; inference is a swappable object.
 *   - `inv.sovereignty.100` / `inv.sovereignty.102` — sovereignty is a bundle
 *     (model openness, provider choice, no commercial lock-in). The registry is
 *     provider-agnostic and ALWAYS carries an open-weight sovereign floor, so
 *     routing survives any frontier provider becoming unreachable.
 *   - `inv.constitutional.015` "Authority may be delegated; sovereignty may
 *     not." — routing DELEGATES inference to a provider, but the open-weight
 *     floor is the inalienable sovereignty guarantee: never routed away.
 *
 * Behaviour-preserving by construction: the seed registry mirrors the router's
 * former DEFAULT_ROUTES exactly (same provider/model per stage), so `routeFor`
 * returns the identical target — but now with `source: 'modelqube'` and the
 * governing invariants attached. The routing mechanism advances; which model
 * runs does not change until the registry does.
 *
 * PURE + isomorphic (no DB, no clock, no network). The seed registry is
 * in-code; a DB-backed ModelQube store is the natural G2/registry follow-on
 * (fills the same `resolveModelQubeRoute` shape with zero policy change).
 */

import type {
  ConstitutionalObject,
  ObjectRef,
} from '@/types/constitutionalObject';
import { objectRef, standingBandFor } from '@/types/constitutionalObject';
import type {
  ConstitutionalProviderId,
  ReasoningStage,
} from '@/types/constitutional';

// ─── The invariants that govern model routing (cited on every route) ─────────
export const MODEL_ROUTING_INVARIANTS: readonly string[] = [
  'inv.engineering.031', // Separate reasoning from inference.
  'inv.sovereignty.100', // Sovereignty is a bundle: model openness, provider choice.
  'inv.sovereignty.102', // Choose, switch, combine providers free of lock-in.
  'inv.constitutional.015', // Authority may be delegated; sovereignty may not.
];

// ─── The ModelQube payload + object type ─────────────────────────────────────

/**
 * Sovereignty tiers, LEAST → MOST sovereign. `inv.sovereignty.100` frames
 * sovereignty as a BUNDLE (model openness, provider choice, no lock-in):
 *   - `frontier`    — third-party CLOSED-weight (openai, anthropic). Capable,
 *                     fast; sovereign in NEITHER weights nor hosting.
 *   - `open-weight` — third-party-HOSTED open-weight (venice/llama). Weights are
 *                     open; the hosting is still someone else's. Today's floor.
 *   - `self-hosted` — open-weight models we run on our OWN decentralised infra.
 *                     Weights AND hosting sovereign — no third party can deny us
 *                     inference. APEX sovereignty (stubbed; see sovereignNode.ts).
 * The terminal fallback rung must be the most-sovereign CONFIGURED tier: the
 * `self-hosted` apex when our nodes are live, else the `open-weight` API floor.
 */
export type SovereigntyTier = 'frontier' | 'open-weight' | 'self-hosted';

export interface ModelQubePayload {
  provider: ConstitutionalProviderId;
  /** The concrete model id (on the provider's allowlist). */
  model: string;
  tier: SovereigntyTier;
  /** True for the inalienable open-weight sovereign floor (never routed away). */
  sovereignFloor: boolean;
  /**
   * True for a NAMED-but-not-routable provider: it appears in the registry
   * (visible in the Model Routes surface) but is NEVER selected by
   * `resolveModelQubeRoute` and never reaches the router — inert until an
   * adapter + verified endpoint land. Mirrors the sovereignNode apex seam.
   */
  stubbed?: boolean;
  /** For a stub, the honest reason it is not yet routable (operator-facing). */
  stubReason?: string;
  /** Per-stage constitutional fitness (0..1). Absent stage ⇒ not fit. */
  stageFitness: Partial<Record<ReasoningStage, number>>;
}

/** A ModelQube is a constitutional object carrying an inference capability. */
export type ModelQube = ConstitutionalObject<ModelQubePayload>;

// ─── Builder — a ModelQube as a well-formed ConstitutionalObject ─────────────

function modelQube(
  id: string,
  payload: ModelQubePayload,
  standing: number,
): ModelQube {
  return {
    identity: {
      id,
      kind: 'aigent',
      // T2-safe commitment ref — a stable label, never a subject id.
      ref: `modelqube:${id}`,
      displayLabel: `${payload.provider}/${payload.model}`,
    },
    version: { version: 1, status: 'active' },
    standing: { standing, band: standingBandFor(standing), reach: 0 },
    authority: {
      // Only reasoning-fit, standing-bearing objects route; the floor is exempt
      // (it is the sovereignty guarantee, always eligible).
      minStandingToCompose: 'validated',
      ratificationRequired: false,
      governingInvariants: [...MODEL_ROUTING_INVARIANTS],
    },
    // Providers hold NO identity (inv.engineering.031) — the owner is the
    // platform steward commitment, never a subject id.
    ownership: { ownerCommitment: 'platform-steward' },
    provenance: {
      receiptIds: [],
      source: 'authored',
    },
    lifecycle: { state: 'active', order: ['draft', 'active', 'deprecated', 'archived'] },
    dependencies: [],
    payload,
  };
}

// ─── The seed registry — mirrors the router's former DEFAULT_ROUTES ──────────
//
// Fitness makes the former default provider/model win each stage; the
// open-weight floor is fit for EVERY stage at a low weight, so it is the
// sovereign fallback but never displaces a fit frontier qube.

export const CONSTITUTIONAL_MODEL_QUBES: readonly ModelQube[] = [
  modelQube(
    'anthropic-haiku-4-5',
    {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      tier: 'frontier',
      sovereignFloor: false,
      stageFitness: { intent: 0.9, context: 0.9 },
    },
    0.68,
  ),
  modelQube(
    'openai-gpt-4o-mini',
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      tier: 'frontier',
      sovereignFloor: false,
      stageFitness: { capability: 0.9, price: 0.9 },
    },
    0.62,
  ),
  modelQube(
    'anthropic-sonnet-4-6',
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      tier: 'frontier',
      sovereignFloor: false,
      stageFitness: { risk: 0.9, value: 0.9, consequence: 0.95, validation: 0.9 },
    },
    0.82,
  ),
  // The open-weight sovereign floor — fit for every stage at a low weight so it
  // is always an eligible fallback but never the primary route while a fit
  // frontier qube exists. This ModelQube IS the sovereignty guarantee.
  modelQube(
    'venice-llama-3-3-70b',
    {
      provider: 'venice',
      model: 'llama-3.3-70b',
      tier: 'open-weight',
      sovereignFloor: true,
      stageFitness: {
        intent: 0.3, context: 0.3, capability: 0.3, risk: 0.3,
        value: 0.3, price: 0.3, consequence: 0.3, validation: 0.3,
      },
    },
    0.5,
  ),
  // ChainGPT — the fifth ROUTABLE provider (verified adapter in
  // callChatWithUsage). Low all-stage fitness: an eligible alternative in the
  // registry, but never displaces a fit frontier qube — behaviour-preserving.
  modelQube(
    'chaingpt-general-assistant',
    {
      provider: 'chaingpt',
      model: 'general_assistant',
      tier: 'frontier',
      sovereignFloor: false,
      stageFitness: {
        intent: 0.3, context: 0.3, capability: 0.3,
        price: 0.3, consequence: 0.3,
      },
    },
    0.55,
  ),
  // thirdweb Nebula — now ROUTABLE (adapter in callChatWithUsage; server-side
  // secret-key auth, operator-provided THIRDWEB_NEBULA_URL). Low all-stage
  // fitness: an eligible alternative, never displaces a frontier default.
  modelQube(
    'thirdweb-nebula',
    {
      provider: 'thirdweb',
      model: 'nebula',
      tier: 'frontier',
      sovereignFloor: false,
      stageFitness: {
        intent: 0.3, context: 0.3, capability: 0.3,
        price: 0.3, consequence: 0.3,
      },
    },
    0.55,
  ),
  // ─── Stubs — NAMED in the registry, never routed (filtered below) ──────────
  // gemini and grok are operator-requested future slots — inert until an adapter
  // + verified endpoint land (No-Guessing: the API shape must be provided).
  modelQube(
    'gemini',
    {
      provider: 'gemini',
      model: '',
      tier: 'frontier',
      sovereignFloor: false,
      stubbed: true,
      stubReason: 'adapter not implemented — Google Gemini API (not OpenAI-compatible); provide key + endpoint to make it routable',
      stageFitness: {},
    },
    0.2,
  ),
  modelQube(
    'grok',
    {
      provider: 'grok',
      model: '',
      tier: 'frontier',
      sovereignFloor: false,
      stubbed: true,
      stubReason: 'adapter not implemented — xAI Grok API; provide key + endpoint to make it routable',
      stageFitness: {},
    },
    0.2,
  ),
];

// ─── The invariant-aware routing policy (pure) ───────────────────────────────

export interface ModelQubeRoute {
  provider: ConstitutionalProviderId;
  model: string;
  /** The ModelQube object ref the route resolved to (provenance). */
  qubeRef: ObjectRef;
  governingInvariants: string[];
  /** True when the resolved route is the open-weight sovereign floor. */
  sovereignFloor: boolean;
}

/**
 * Resolve the constitutionally-preferred ModelQube for a reasoning stage. Ranks
 * fit qubes by (stage fitness desc, standing desc, id asc) — deterministic. The
 * sovereign floor is always included, so a stage ALWAYS resolves while any qube
 * exists (sovereignty survives). Returns null only if no qube is fit for the
 * stage at all (the router then falls back to its literal default — defensive).
 *
 * `opts.frontierUnavailable` models the sovereignty case: every frontier
 * provider is unreachable → the policy resolves to the open-weight floor,
 * proving reasoning continues under full sovereignty. Pure.
 */
export function resolveModelQubeRoute(
  stage: ReasoningStage,
  qubes: readonly ModelQube[] = CONSTITUTIONAL_MODEL_QUBES,
  opts: { frontierUnavailable?: boolean } = {},
): ModelQubeRoute | null {
  const eligible = qubes.filter((q) => {
    if (q.payload.stubbed) return false; // named-but-not-routable — never a route
    if (opts.frontierUnavailable && q.payload.tier === 'frontier') return false;
    const fit = q.payload.stageFitness[stage];
    return typeof fit === 'number' && fit > 0;
  });
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const fa = a.payload.stageFitness[stage] ?? 0;
    const fb = b.payload.stageFitness[stage] ?? 0;
    if (fa !== fb) return fb - fa;
    if (a.standing.standing !== b.standing.standing) return b.standing.standing - a.standing.standing;
    return a.identity.id < b.identity.id ? -1 : a.identity.id > b.identity.id ? 1 : 0;
  });

  const chosen = eligible[0];
  return {
    provider: chosen.payload.provider,
    model: chosen.payload.model,
    qubeRef: objectRef(chosen.identity.id, chosen.identity.kind),
    governingInvariants: [...MODEL_ROUTING_INVARIANTS],
    sovereignFloor: chosen.payload.sovereignFloor,
  };
}

/** Diagnostics: the resolved ModelQube route for every stage. */
export function describeModelQubeRoutes(
  stages: readonly ReasoningStage[],
): Array<{ stage: ReasoningStage; route: ModelQubeRoute | null }> {
  return stages.map((stage) => ({ stage, route: resolveModelQubeRoute(stage) }));
}
