/**
 * researchLadder — the seven-rung Research Progression Ladder (CFS-034).
 *
 * A pure, deterministic mapping from a researcher's TWO axes to their rung:
 *   - Standing (earned)   — the composite Standing score (0..100). Rungs 1..5.
 *   - Governance (role)   — steward / admin. Required additionally for rungs 6..7.
 * Tooling (the paid `research_copilot` tier) gates the CAPABILITY SURFACE, not the
 * rung — a free participant can hold a high rung through contribution (CFS-034 §2).
 *
 * T2-safe: consumes only a numeric score + boolean flags — never a personaId.
 * Side-effect-free: no I/O, no persistence. IRL surfaces read it to render a
 * researcher's current rung and their next-rung requirement.
 */

/** The seven rungs, ordered ascending (index === rung number − 1). */
export type ResearchLevel =
  | 'citizen_researcher'   // 1
  | 'research_analyst'     // 2
  | 'research_associate'   // 3
  | 'research_fellow'      // 4
  | 'principal_investigator' // 5
  | 'institute_steward'    // 6
  | 'founder_operator';    // 7

export interface ResearchLevelInput {
  /** Composite Standing score, 0..100 (from the Standing Charter). */
  standingScore: number;
  /** Whether the persona owns the research_copilot tooling tier. Gates capability, NOT rung. */
  hasResearchCopilot: boolean;
  /** Steward-tier / IRL-admin governance role — required for Institute Steward (rung 6). */
  isSteward: boolean;
  /** Platform admin / Founder Office — required for Founder Operator (rung 7). */
  isAdmin: boolean;
}

export interface ResearchLevelResult {
  /** The rung the researcher currently occupies. */
  level: ResearchLevel;
  /** 1..7. */
  rung: number;
  /** Human-legible label. */
  label: string;
  /** Primary capability of the rung (CFS-034 §3). */
  capability: string;
  /** The next rung up, or null at the top. */
  nextLevel: ResearchLevel | null;
  /** One-line requirement to reach the next rung, or null at the top. */
  nextRequirement: string | null;
}

interface RungDef {
  level: ResearchLevel;
  rung: number;
  label: string;
  capability: string;
  /** Minimum Standing score for this rung (0 = no standing gate). */
  minStanding: number;
  /** Governance role required beyond standing, if any. */
  requiresSteward?: boolean;
  requiresAdmin?: boolean;
}

// Standing thresholds reuse the existing Standing composite (QUALIFY_THRESHOLD = 25).
// Rungs 1..5 are pure standing rungs; 6..7 additionally require a governance role.
const RUNGS: readonly RungDef[] = [
  { level: 'citizen_researcher',     rung: 1, label: 'Citizen Researcher',     capability: 'Consume, annotate, reproduce published research', minStanding: 0 },
  { level: 'research_analyst',       rung: 2, label: 'Research Analyst',       capability: 'Run experiments, analyse evidence',              minStanding: 25 },
  { level: 'research_associate',     rung: 3, label: 'Research Associate',     capability: 'Contribute protocols + invariant proposals',     minStanding: 50 },
  { level: 'research_fellow',        rung: 4, label: 'Research Fellow',        capability: 'Lead investigations, mentor others',             minStanding: 75 },
  { level: 'principal_investigator', rung: 5, label: 'Principal Investigator', capability: 'Own research programmes',                         minStanding: 90 },
  { level: 'institute_steward',      rung: 6, label: 'Institute Steward',      capability: 'Ratify findings, govern the corpus',             minStanding: 90, requiresSteward: true },
  { level: 'founder_operator',       rung: 7, label: 'Founder Operator',       capability: 'Shape the Institute itself',                     minStanding: 0,  requiresAdmin: true },
] as const;

function meetsRung(def: RungDef, input: ResearchLevelInput): boolean {
  if (input.standingScore < def.minStanding) return false;
  if (def.requiresAdmin) return input.isAdmin;
  if (def.requiresSteward) return input.isSteward || input.isAdmin;
  return true;
}

/**
 * Resolve the highest rung a researcher qualifies for. Founder Operator (admin)
 * and Institute Steward (steward/admin) are governance rungs evaluated on top of
 * the standing rungs; a governance role does not skip the standing requirement
 * for the standing rungs it would also satisfy — the researcher occupies the
 * highest rung for which meetsRung holds.
 */
export function researchLevelFor(input: ResearchLevelInput): ResearchLevelResult {
  // Scan high→low; the first rung whose gate is satisfied is the occupied rung.
  let occupied: RungDef = RUNGS[0];
  for (let i = RUNGS.length - 1; i >= 0; i--) {
    if (meetsRung(RUNGS[i], input)) { occupied = RUNGS[i]; break; }
  }

  // Next rung up = the lowest rung strictly above the occupied one the researcher
  // has NOT yet reached (by number), for the "what's next" hint.
  const next = RUNGS.find((r) => r.rung === occupied.rung + 1) ?? null;
  const nextRequirement = next ? requirementFor(next, input) : null;

  return {
    level: occupied.level,
    rung: occupied.rung,
    label: occupied.label,
    capability: occupied.capability,
    nextLevel: next?.level ?? null,
    nextRequirement,
  };
}

function requirementFor(def: RungDef, input: ResearchLevelInput): string {
  if (def.requiresAdmin) return 'Platform admin / Founder Office role';
  if (def.requiresSteward) {
    const needStanding = input.standingScore < def.minStanding ? `Standing ≥ ${def.minStanding} and ` : '';
    return `${needStanding}Steward tier / IRL admin role`;
  }
  return `Standing ≥ ${def.minStanding} (earned through contribution)`;
}

/** Label lookup for a rung (UI convenience). */
export function researchLevelLabel(level: ResearchLevel): string {
  return RUNGS.find((r) => r.level === level)?.label ?? level;
}
