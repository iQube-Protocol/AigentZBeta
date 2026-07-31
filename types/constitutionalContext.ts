/**
 * Constitutional Identity Hierarchy + the Constitutional Context primitive
 * (CFS-024). Aletheon's discovery (2026-07-10), ratified by operator direction:
 * the surfaces disagreed not because of a bug but because a primitive was
 * missing — the distinction between the constitutional PERSON, their PERSONAS,
 * and AGENT AUTHORITY.
 *
 * Two constitutional relationships, never conflated:
 *   - BINDING    (Citizen ↔ Agent): PERMANENT. An agent belongs to the person,
 *                established through the Passport + Personhood. Alethean belongs
 *                to *you*, not to Mansa Meta or Metayé.
 *   - ASSIGNMENT (Persona ↔ Agent): TEMPORARY. Which bound agent acts as this
 *                persona's aigentMe / delegate right now, via bounded delegation.
 *                The same agent can be aigentMe for one persona and merely
 *                available to another.
 *
 * Authority originates from the CITIZEN, is established by the PASSPORT, accrues
 * through STANDING, and is exercised through PERSONAS. Every surface (Wallet,
 * Delegation Bureau, Founder Office, Studio, Registry, Aigent Z) MUST render
 * from ONE resolved ConstitutionalContext — the single source of truth — instead
 * of each independently resolving "active persona".
 *
 * Contract-first: order-pinned constitutional data + pure helpers, no runtime
 * organs. The resolver (services/identity/constitutionalContext.ts) COMPOSES the
 * existing identity spine (getActivePersona et al.) — it never forks it.
 */

// ---------------------------------------------------------------------------
// §1 The constitutional identity hierarchy (order pinned)
// ---------------------------------------------------------------------------

/**
 * The identity ladder. Delegation sits at the PERSONA level (assignment), not at
 * the citizen or passport (which establish personhood + authority). Order is
 * meaning — pinned by canary.
 */
export const CONSTITUTIONAL_IDENTITY_HIERARCHY = [
  'citizen', // the human — who HAS authority
  'passport', // the personhood credential — establishes the constitutional person
  'personhood', // the fact the passport establishes
  'person', // ONE — continuity, standing, sovereignty, authority
  'persona', // MANY — constitutional operating contexts (projections of the person)
  'delegated-agent', // ASSIGNED to a persona; BOUND to the person
  'session', // an operating session within a context
  'task', // the unit of work
] as const;

export type ConstitutionalIdentityLevel = (typeof CONSTITUTIONAL_IDENTITY_HIERARCHY)[number];

/** The level at which delegation is EXERCISED. Not citizen, not passport. */
export const DELEGATION_LEVEL: ConstitutionalIdentityLevel = 'persona';

/** Numeric depth of a level (0 = citizen), or -1 if unknown. Pure. */
export function hierarchyIndexOf(level: string): number {
  return (CONSTITUTIONAL_IDENTITY_HIERARCHY as readonly string[]).indexOf(level);
}

// ---------------------------------------------------------------------------
// §2 The two agent relationships — binding vs assignment
// ---------------------------------------------------------------------------

export const AGENT_RELATIONSHIPS = ['binding', 'assignment'] as const;
export type AgentRelationship = (typeof AGENT_RELATIONSHIPS)[number];

/** Binding is permanent (Citizen↔Agent); assignment is temporary (Persona↔Agent). */
export const RELATIONSHIP_PERMANENCE: Record<AgentRelationship, 'permanent' | 'temporary'> = {
  binding: 'permanent',
  assignment: 'temporary',
};

export function isBinding(rel: string): boolean {
  return rel === 'binding';
}

// ---------------------------------------------------------------------------
// §3 The three constitutional invariants (stated; proposed under Law XI)
// ---------------------------------------------------------------------------

/**
 * The invariants this discovery ratifies. They enter the substrate as PROPOSED
 * (Law XI — the operator ratifies); the canary pins their statements, not their
 * canonical status.
 */
export const CONSTITUTIONAL_IDENTITY_INVARIANTS = [
  {
    id: 'constitutional-agent-binding',
    statement:
      'Agents SHALL be permanently bound to constitutional persons through their Passport and Personhood.',
  },
  {
    id: 'constitutional-agent-assignment',
    statement: 'Agents SHALL be assigned to personas through bounded delegation.',
  },
  {
    id: 'constitutional-authority',
    statement:
      'Constitutional authority originates from the citizen, is established by the Passport, accrues through Standing, and is exercised through Personas.',
  },
] as const;

// ---------------------------------------------------------------------------
// §4 The relationship records
// ---------------------------------------------------------------------------

/** The PERMANENT Citizen↔Agent binding — an agent belongs to the person. */
export interface BoundAgent {
  agentId: string;
  agentDid: string;
  displayName: string;
  agentClass: string;
  /** True once the agent's Participant Passport is issued + bound. */
  passportBound: boolean;
  relationship: 'binding';
}

/** The TEMPORARY Persona↔Agent assignment — a bound agent acting in a capacity. */
export interface PersonaAssignment {
  personaId: string; // T0
  agentId: string;
  /** The capacity the agent acts in FOR this persona. */
  role: 'aigentMe' | 'delegate' | string;
  /** Allowed actions / trust-band scope the persona has delegated. */
  delegatedAuthority: string[];
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  relationship: 'assignment';
}

// ---------------------------------------------------------------------------
// §5 The Constitutional Context — the single source of truth
// ---------------------------------------------------------------------------

/**
 * The resolved constitutional state EVERY surface renders from. Replaces the
 * per-surface "active persona" scramble: resolve once, render everywhere.
 * `boundAgents` is the person's permanent roster; `assignedAgent` /
 * `currentAigentMe` are this persona's temporary assignment.
 */
export interface ConstitutionalContext {
  /** WHO has authority — the citizen/person (T0 person id). */
  citizen: { personId: string | null };
  /** WHO is the constitutional person — the personhood credential. */
  passport: { passportId: string | null; grade: string | null };
  /** WHAT authority they have earned. */
  standing: { overall: number | null; maxTrustBand: string | null };
  /** IN WHAT capacity they are acting — the active operating context. */
  persona: { personaId: string | null; displayLabel: string | null };
  /** WHICH delegates belong to the person (permanent binding). */
  boundAgents: BoundAgent[];
  /**
   * The bound agents ASSIGNED to act for THIS persona (temporary). A persona
   * may assign MANY agents; exactly one carries role 'aigentMe'. Empty when the
   * persona has assigned none.
   */
  assignedAgents: PersonaAssignment[];
  /** The agentId assigned as this persona's aigentMe (role='aigentMe'), if any. */
  currentAigentMe: string | null;
  workspace: string | null;
  session: { sessionId: string | null };
}

/** The single resolver contract every surface calls. Impl composes the spine. */
export type ConstitutionalContextResolver = (sessionId?: string) => Promise<ConstitutionalContext>;

/** An empty context (no storage / unauthenticated) — honest nulls, never faked. */
export function emptyConstitutionalContext(): ConstitutionalContext {
  return {
    citizen: { personId: null },
    passport: { passportId: null, grade: null },
    standing: { overall: null, maxTrustBand: null },
    persona: { personaId: null, displayLabel: null },
    boundAgents: [],
    assignedAgents: [],
    currentAigentMe: null,
    workspace: null,
    session: { sessionId: null },
  };
}
