import { IdentityEnvelope } from "./types";

// Comma-separated persona IDs that may make authoritative pipeline state commits.
// Defaults to matching names containing "agent-z" or "aigent-z" if env var is absent.
const AUTHORITATIVE_PERSONAS: string[] = process.env.WORKFLOW_AUTHORITATIVE_PERSONAS
  ? process.env.WORKFLOW_AUTHORITATIVE_PERSONAS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

function isAuthoritative(personaId: string): boolean {
  if (AUTHORITATIVE_PERSONAS.length > 0) {
    return AUTHORITATIVE_PERSONAS.includes(personaId);
  }
  const lower = personaId.toLowerCase();
  return lower.includes("agent-z") || lower.includes("aigent-z");
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
