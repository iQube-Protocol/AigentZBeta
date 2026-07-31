import { IdentityEnvelope } from "./types";

// Comma-separated persona IDs that may make authoritative pipeline state
// commits. WORKFLOW_AUTHORITATIVE_PERSONAS is the single source of truth for
// this registry (inv.engineering.036) — do not fork a second allowlist.
//
// 2026-07-30: when the env var is unset, this used to fall back to a
// substring heuristic (personaId containing "agent-z"/"aigent-z"). That
// heuristic silently failed to match the real Aigent Z handle
// "aigentz@aigent" (no hyphen), and was wide enough to match any unrelated
// persona that happened to contain the same substring. Replaced with an
// explicit default allowlist — the four personas the operator identified as
// the current authoritative set — which is both correct (actually includes
// aigentz@aigent) and narrower (an enumerated list, not a substring match).
// The env var, when set, still fully overrides this default. See
// codexes/packs/agentiq/updates/2026-07-30_platform-state-reporter-role-resolver.md.
const DEFAULT_AUTHORITATIVE_PERSONAS: string[] = [
  "aigentz@aigent",
  "marketa@aigent",
  "qriptiq@qripto",
  "aigent-marketa@aigent",
];

function getAuthoritativePersonaRegistry(): string[] {
  const raw = process.env.WORKFLOW_AUTHORITATIVE_PERSONAS;
  if (raw) {
    const configured = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (configured.length > 0) return configured;
  }
  return DEFAULT_AUTHORITATIVE_PERSONAS;
}

function isAuthoritative(personaId: string): boolean {
  return getAuthoritativePersonaRegistry().includes(personaId);
}

export function parseEnvelope(body: unknown): IdentityEnvelope | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const tenantId = typeof b.tenantId === "string" ? b.tenantId : undefined;
  const personaId = typeof b.personaId === "string" ? b.personaId : undefined;
  if (!tenantId || !personaId) return null;
  const authority =
    b.authority === "authoritative" || b.authority === "proposal"
      ? b.authority
      : undefined;
  return { tenantId, personaId, authority };
}

export function assertEnvelope(body: unknown): IdentityEnvelope {
  const envelope = parseEnvelope(body);
  if (!envelope) {
    throw { status: 400, message: "Missing required identity envelope fields: tenantId, personaId" };
  }
  return envelope;
}

export function assertAuthority(envelope: IdentityEnvelope): void {
  if (envelope.authority === "authoritative" && !isAuthoritative(envelope.personaId)) {
    throw {
      status: 403,
      message: `Persona '${envelope.personaId}' is not authorised to make authoritative workflow state commits`,
    };
  }
}

// --- Role-based authoritative persona resolution ----------------------------
//
// The flat registry above only answers "may this persona act with
// authoritative status?" — it carries no notion of *which* authoritative
// persona owns a given declared role. `resolveAuthoritativePersonaForRole`
// adds that mapping for callers that need to resolve a role to exactly one
// actor deterministically (e.g. "who is the platform-state reporter?"),
// from this SAME registry — never an independent, standalone deployment
// variable of its own.
//
// This replaces WORKSPACE_REPORT_PERSONA_ID as the PRIMARY source of
// authority for the daily/weekly Horizen workspace report (operator ruling,
// 2026-07-30): Aigent Z composes and issues the report from authoritative
// platform state; MoneyPenny may supply financial-services evidence into it
// but does not become the report producer. See
// codexes/packs/agentiq/updates/2026-07-30_platform-state-reporter-role-resolver.md.
//
// Fails closed: throws if the role has no mapped candidate, if none of its
// candidates are present in the authoritative registry, or if more than one
// candidate is present (ambiguous). Never guesses or silently substitutes a
// different persona.

export type AuthoritativeRole = "platform-state-reporter";

// Declared role -> the persona(s) eligible to hold it in code. Extend this
// map — never add a parallel structure — when a new role needs an
// authoritative-persona owner. Exactly one candidate must also be present in
// the live registry for resolution to succeed.
const ROLE_CANDIDATES: Record<AuthoritativeRole, string[]> = {
  "platform-state-reporter": ["aigentz@aigent"],
};

/**
 * The fail-closed core, independent of role/env wiring — exported so tests
 * can exercise the zero-match and ambiguous-match paths directly without
 * needing a second declared role.
 */
export function resolveExactlyOneAuthoritativePersona(
  candidates: string[],
  registry: string[],
): string {
  const eligible = candidates.filter((c) => registry.includes(c));
  if (eligible.length === 0) {
    throw new Error(
      `No persona in the authoritative registry satisfies this role (checked: ${
        candidates.join(", ") || "(none declared)"
      }) — refusing to guess an actor`,
    );
  }
  if (eligible.length > 1) {
    throw new Error(
      `${eligible.length} personas in the authoritative registry satisfy this role (${eligible.join(
        ", ",
      )}) — ambiguous, refusing to pick one`,
    );
  }
  return eligible[0];
}

/**
 * Resolve exactly one persona authorised to act for a declared role, from the
 * WORKFLOW_AUTHORITATIVE_PERSONAS registry (or its default fallback — see
 * getAuthoritativePersonaRegistry above). `registry` is overridable for
 * tests; production callers should never pass it.
 */
export function resolveAuthoritativePersonaForRole(
  role: AuthoritativeRole,
  registry: string[] = getAuthoritativePersonaRegistry(),
): string {
  const candidates = ROLE_CANDIDATES[role];
  if (!candidates || candidates.length === 0) {
    throw new Error(`No persona is mapped to authoritative role '${role}'`);
  }
  return resolveExactlyOneAuthoritativePersona(candidates, registry);
}
