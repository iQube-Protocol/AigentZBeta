/**
 * registryAccess — the SINGLE, swappable gate for the Experiment /
 * Constitutional / Invariant Pipeline (CFS-051, Strand 1 built 2026-07-24;
 * WIDENED 2026-07-25 per the operator's "both" answer).
 *
 * Operator framing (CFS-051 §1, quoted verbatim in the seed backlog row
 * `backlog-widen-registry-access-gate`): *"admin gated but stubbed for opening
 * up to cohorts or token gated access to enable public users to **propose**
 * experiment or constitutional principles."* Asked whether to widen to a CAS
 * research-lab grant, a token gate, or both, the operator answered **both**.
 *
 * ── The three paths (OR'd; each INDEPENDENTLY sufficient) ────────────────────
 *
 *   1. `platform-admin`            — `persona.cartridgeFlags.isAdmin`. Today's
 *                                    behaviour, UNCHANGED and never weakened.
 *   2. `cas-research-lab-grant`    — an active `research-lab` grant in the
 *                                    Constitutional Access Service. The SAME
 *                                    mechanism CFS-044's Open Lab reviewer
 *                                    engagement already issues against.
 *   3. `token-holding`             — the caller holds the operator-configured
 *                                    gate token on-chain.
 *
 * ── Propose vs. curate — why this gate is TWO capabilities, not one ──────────
 *
 * The operator's words are specific: widen so public users can **propose**.
 * Proposing (creating a candidate row) and curating (editing OTHER people's
 * entries, transitioning status, appending reviewer dispositions to the
 * append-only audit trail) are different constitutional acts. Silently handing
 * full CRUD to every grant-holder would over-read the instruction and would
 * also collide with CFS-051 §2's promotion discipline — a candidate's status
 * transition is the step a human takes toward the FORMAL registry/canon
 * ceremony, and that judgement stays with the platform admin.
 *
 * So:
 *   • `canReadRegistry`     — any of the three paths. You cannot propose into a
 *                             pipeline you cannot see; still requires an
 *                             authenticated persona (the route's 401 stands).
 *   • `canProposeToRegistry` — any of the three paths. Create only.
 *   • `canManageRegistry`    — platform admin ONLY. Edit / transition-status /
 *                             add-review. Byte-identical to the pre-widening
 *                             behaviour, so this change is purely additive.
 *
 * Role-scoped curation (letting a grant whose role is `reviewer` /
 * `research-steward` / `ratifier` append review notes) is deliberately NOT
 * built here: `getGrantedExperiments` — the only persona-scoped grant reader
 * that exists — returns experiment scoping, not the grant's role, and inventing
 * a second grant query would be exactly the parallel-implementation defect
 * CLAUDE.md's "Extend, Don't Duplicate" forbids. Named as a follow-on in
 * CFS-051 §5 rather than guessed at.
 *
 * ── What this module COMPOSES (and therefore does NOT re-implement) ──────────
 *
 *   - CAS grants  → `getGrantedExperiments` (services/passport/participationAccess.ts)
 *                   — the persona-scoped `research-lab` grant reader CFS-051 §5
 *                   already named as the composition target. No second grant
 *                   system, no new table, no new query.
 *   - token gate  → `resolveExternalCredential` (services/access/policyResolvers.ts)
 *                   — the access spine's SHIPPED `token:<chain>:<contract>[:<tokenId>]`
 *                   credential resolver, which resolves the persona's chain
 *                   address (`resolvePersonaWalletAddress`) and reads
 *                   `balanceOf` via `ownsErc721`/`ownsErc1155`. That file is
 *                   spine-protected: imported, never modified.
 *
 * ── Pure core + thin I/O shell ───────────────────────────────────────────────
 *
 * `decideRegistryAccess` is PURE and synchronous — three booleans in, a
 * capability decision out — mirroring the pattern SPEC-COS-001's
 * `services/onboarding/substrateState.ts::activeSurfaces` uses. All I/O lives
 * in `resolveRegistryAccess`, which gathers the three signals and delegates the
 * decision. `tests/research-registry-access.test.ts` is the canary for both the
 * decision table and the store layer's continued ignorance of the gate.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getGrantedExperiments } from '@/services/passport/participationAccess';
import { resolveExternalCredential } from '@/services/access/policyResolvers';

export interface RegistryCallerPersona {
  /** T0 — server-internal only. Used ONLY to look up grants/holdings; never
   *  serialised into any response, receipt, or chain-bound payload. */
  personaId?: string;
  cartridgeFlags?: { isAdmin?: boolean } | null;
}

/** Which of the three widening paths admitted the caller. Diagnostic only —
 *  T1-safe path labels, never an identifier. */
export type RegistryAccessPath = 'platform-admin' | 'cas-research-lab-grant' | 'token-holding';

/** The three independent signals the decision is a pure function of. */
export interface RegistryAccessSignals {
  /** `persona.cartridgeFlags.isAdmin` — the original, never-weakened path. */
  isPlatformAdmin: boolean;
  /** An active CAS `research-lab` access grant exists for this persona. */
  hasResearchLabGrant: boolean;
  /** The caller holds the operator-configured gate token on-chain. */
  holdsGateToken: boolean;
}

export interface RegistryAccessDecision {
  /** May list the four registers. */
  canRead: boolean;
  /** May CREATE a candidate experiment / principle / invariant / backlog item. */
  canPropose: boolean;
  /** May EDIT, TRANSITION STATUS, or ADD REVIEW NOTES. Platform admin only. */
  canCurate: boolean;
  /** Paths that admitted this caller, in precedence order. */
  via: RegistryAccessPath[];
}

/**
 * THE PURE CORE. Given the three signals, what may the caller do?
 *
 * Read + propose: any path. Curate: platform admin only (see the header's
 * propose-vs-curate reasoning). This function performs no I/O, has no
 * dependencies, and is the single place the OR-ing and the propose/curate
 * split are expressed — so widening again later means adding a signal here,
 * never a new branch at a call site.
 */
export function decideRegistryAccess(signals: RegistryAccessSignals): RegistryAccessDecision {
  const via: RegistryAccessPath[] = [];
  if (signals.isPlatformAdmin) via.push('platform-admin');
  if (signals.hasResearchLabGrant) via.push('cas-research-lab-grant');
  if (signals.holdsGateToken) via.push('token-holding');

  const admitted = via.length > 0;
  return {
    canRead: admitted,
    canPropose: admitted,
    // NEVER widened. A grant or a token buys proposal rights, not curation of
    // someone else's candidate nor the status transitions that feed the formal
    // promotion ceremony.
    canCurate: signals.isPlatformAdmin,
    via,
  };
}

/**
 * The operator-configured token credential, in the access spine's OWN grammar:
 * `token:<chain>:<contract>` (ERC-721) or `token:<chain>:<contract>:<tokenId>`
 * (ERC-1155). Chains supported by `services/access/tokenOwnership.ts`:
 * ethereum | base | optimism | polygon | arbitrum (+ aliases).
 *
 * UNSET IS THE DEFAULT AND MEANS THE TOKEN PATH IS INERT — not open. No
 * contract address is hardcoded, guessed, or defaulted here (CLAUDE.md "No
 * Guessing or Hallucinating"): the operator names the real token by setting
 * `RESEARCH_REGISTRY_TOKEN_CREDENTIAL`. A malformed value is treated as unset
 * and logged, so a typo fails CLOSED rather than silently gating on nothing.
 */
export const REGISTRY_TOKEN_CREDENTIAL_ENV = 'RESEARCH_REGISTRY_TOKEN_CREDENTIAL';

/** Exported for the canary: is this a well-formed spine token credential? */
export function isTokenCredential(value: string | undefined | null): value is string {
  if (!value) return false;
  if (!value.startsWith('token:')) return false;
  const parts = value.slice('token:'.length).split(':').filter(Boolean);
  // <chain>:<contract> (2) or <chain>:<contract>:<tokenId> (3)
  return parts.length === 2 || parts.length === 3;
}

function configuredTokenCredential(): string | null {
  const raw = process.env[REGISTRY_TOKEN_CREDENTIAL_ENV]?.trim();
  if (!raw) return null;
  if (!isTokenCredential(raw)) {
    console.warn(
      `[research registry] ${REGISTRY_TOKEN_CREDENTIAL_ENV} is set but malformed ` +
        `(expected "token:<chain>:<contract>[:<tokenId>]") — token path disabled (fail closed)`,
    );
    return null;
  }
  return raw;
}

/**
 * THE I/O SHELL. Gathers the three signals, then delegates to the pure core.
 *
 * Both widened lookups fail CLOSED and never throw: a Supabase outage or an RPC
 * failure denies the widened path, it does not deny the admin path and does not
 * 500 the route. The admin signal is read straight off the already-resolved
 * spine context, so an admin is never blocked by a downstream dependency.
 */
export async function resolveRegistryAccess(
  persona: RegistryCallerPersona | null | undefined,
): Promise<RegistryAccessDecision> {
  const isPlatformAdmin = Boolean(persona?.cartridgeFlags?.isAdmin);
  const personaId = persona?.personaId;

  // An admin is already admitted on every capability — skip both network
  // lookups entirely rather than paying for signals that cannot change the
  // decision.
  if (isPlatformAdmin || !personaId) {
    return decideRegistryAccess({
      isPlatformAdmin,
      hasResearchLabGrant: false,
      holdsGateToken: false,
    });
  }

  const [hasResearchLabGrant, holdsGateToken] = await Promise.all([
    hasActiveResearchLabGrant(personaId),
    holdsConfiguredGateToken(personaId),
  ]);

  return decideRegistryAccess({ isPlatformAdmin, hasResearchLabGrant, holdsGateToken });
}

/** COMPOSES `getGrantedExperiments` — the CAS reader CFS-051 §5 named. The
 *  grant's experiment scoping is irrelevant here (this pipeline is not an
 *  experiment run); only the existence of an active `research-lab` grant is. */
async function hasActiveResearchLabGrant(personaId: string): Promise<boolean> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return false;
    const { hasGrant } = await getGrantedExperiments(admin, personaId);
    return hasGrant;
  } catch (e) {
    console.warn(
      '[research registry] CAS research-lab grant lookup failed; widened path denied:',
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

/** COMPOSES the access spine's `token:*` credential resolver. No chain call,
 *  address resolution, or ABI encoding is re-implemented here. */
async function holdsConfiguredGateToken(personaId: string): Promise<boolean> {
  const credential = configuredTokenCredential();
  if (!credential) return false;
  try {
    const resolution = await resolveExternalCredential(credential, personaId);
    return resolution.matches;
  } catch (e) {
    console.warn(
      '[research registry] token gate lookup failed; widened path denied:',
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

// ── The gate functions the API route calls ──────────────────────────────────
// Three thin named wrappers over ONE resolver, so the route reads as its own
// capability vocabulary and no call site ever re-derives a decision.

/** May the caller LIST the four registers? Admin, CAS grant, or token. */
export async function canReadRegistry(persona: RegistryCallerPersona | null | undefined): Promise<boolean> {
  return (await resolveRegistryAccess(persona)).canRead;
}

/** May the caller CREATE a candidate entry? Admin, CAS grant, or token —
 *  this is the "enable public users to propose" capability. */
export async function canProposeToRegistry(persona: RegistryCallerPersona | null | undefined): Promise<boolean> {
  return (await resolveRegistryAccess(persona)).canPropose;
}

/** May the caller EDIT / TRANSITION STATUS / ADD REVIEW NOTES?
 *  PLATFORM ADMIN ONLY — identical to this gate's pre-widening behaviour. */
export async function canManageRegistry(persona: RegistryCallerPersona | null | undefined): Promise<boolean> {
  return (await resolveRegistryAccess(persona)).canCurate;
}
