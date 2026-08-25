/**
 * ContactGraph — canonical domain types (QubeTalk Fast-Follow: ContactGraph +
 * aigentMe First Deployment, priority steps 2-3).
 *
 * ContactGraph is a distinct, platform-wide contact-resolution and
 * contact-management capability. It is NOT owned by QubeTalk — QubeTalk
 * REFERENCES ContactGraph resolution (types/qubetalk.ts's
 * QubeTalkParticipant.contactPersonId / QubeTalkParticipantEndpoint.contactPersonaId)
 * rather than maintaining a competing address book (C9/NC10).
 *
 * Canonical hierarchy (locked):
 *   ContactPerson -> ContactPersona -> CommunicationEndpoint
 * "Communication identifiers belong to personas; personas belong to
 * people." (C2)
 *
 * T0/T2 discipline: `ownerAuthProfileId` is deliberately T0 (never
 * serialised to a client) — the real owner across all of that owner's own
 * personas (see the migration header for why this is auth_profile_id, not
 * persona_id). `linkedPersonhoodRef`/`linkedPlatformPersonaRef` are Polity
 * Public References (personas.public_ref) — set only when independently
 * confirmed, never inferred (C3/NC6: ContactGraph is not a new identity
 * authority).
 */

import type {
  CapabilityProjectionRequestBase,
  CapabilityProjectionResultBase,
  CapabilityProjectionProfile,
} from '@/types/capabilityProjection';

// ─── ContactPerson ─────────────────────────────────────────────────────────

export const CONTACT_PERSON_STATES = ['active', 'archived'] as const;
export type ContactPersonState = (typeof CONTACT_PERSON_STATES)[number];

export interface ContactPerson {
  id: string;
  /** T0 — the real owner across all of the owner's own personas. Never leaves the server. */
  ownerAuthProfileId: string;
  displayName: string;
  /** Polity Public Reference once independently confirmed to be a real
   *  platform persona; null otherwise. NEVER inferred from a name/handle
   *  match (NC2/NC6) — set only by a deliberate confirmation action. */
  linkedPersonhoodRef: string | null;
  state: ContactPersonState;
  createdAt: string;
  updatedAt: string;
}

// ─── ContactPersona ────────────────────────────────────────────────────────

export interface ContactPersona {
  id: string;
  contactPersonId: string;
  /** T0 — denormalized from the parent ContactPerson at creation time (see
   *  the migration header). Never leaves the server. */
  ownerAuthProfileId: string;
  /** e.g. "Professional", "Personal", "Horizon" — a contextual label, NOT
   *  itself a constitutionally established identity. */
  label: string;
  /** Opt-in only: set when this context genuinely IS an established
   *  platform/Polity persona. Absent for an ordinary off-platform contact
   *  context (C4: external correspondents can exist without Passport
   *  membership). */
  linkedPlatformPersonaRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── CommunicationEndpoint ──────────────────────────────────────────────────

export const CONTACT_ENDPOINT_PLATFORMS = [
  'metame', 'email', 'whatsapp', 'telegram', 'signal', 'linkedin', 'discord', 'x', 'sms',
] as const;
export type ContactEndpointPlatform = (typeof CONTACT_ENDPOINT_PLATFORMS)[number];

/** Reuses QubeTalk's own confidence vocabulary verbatim — never a second scale. */
export const CONTACT_ENDPOINT_CONFIDENCE = [
  'verified', 'user_confirmed', 'high_confidence', 'tentative', 'unresolved',
] as const;
export type ContactEndpointConfidence = (typeof CONTACT_ENDPOINT_CONFIDENCE)[number];

export const CONTACT_ENDPOINT_SOURCES = [
  'manual', 'google_contacts', 'vcard', 'icloud', 'linkedin', 'outlook', 'csv',
  'gmail_correspondence', 'qubetalk_observed',
] as const;
export type ContactEndpointSource = (typeof CONTACT_ENDPOINT_SOURCES)[number];

export const CONTACT_ENDPOINT_STATES = ['active', 'reassigned', 'rejected'] as const;
export type ContactEndpointState = (typeof CONTACT_ENDPOINT_STATES)[number];

export type ContactEndpointLinkAction = 'proposed' | 'confirmed' | 'rejected' | 'reassigned';

/** One append-only audit entry. Never deleted or rewritten — a full history
 *  of why an endpoint is linked where it is (C7: reassignment re-indexes,
 *  never rewrites source history). */
export interface ContactEndpointLinkEvent {
  action: ContactEndpointLinkAction;
  fromContactPersonaId: string | null;
  toContactPersonaId: string | null;
  actorPersonaId: string | null;
  at: string;
  reason: string | null;
}

export interface ContactEndpoint {
  id: string;
  contactPersonaId: string;
  platform: ContactEndpointPlatform;
  identifier: string;
  normalizedIdentifier: string;
  externalAccountRef: string | null;
  confidence: ContactEndpointConfidence;
  source: ContactEndpointSource;
  inboundCapable: boolean;
  outboundCapable: boolean;
  isPreferred: boolean;
  state: ContactEndpointState;
  firstObservedAt: string;
  lastObservedAt: string;
  confirmedByPersonaId: string | null;
  confirmedAt: string | null;
  linkHistory: ContactEndpointLinkEvent[];
  createdAt: string;
  updatedAt: string;
}

// ─── Reconciliation provenance (persona_contacts -> ContactGraph) ──────────

/** promotion_state on persona_contacts (additive column) — distinguishes an
 *  OBSERVED correspondent from a SAVED contact (C8/NC3/NC4). Only
 *  'confirmed' rows are eligible for ContactGraph projection. */
export const PERSONA_CONTACT_PROMOTION_STATES = ['candidate', 'confirmed'] as const;
export type PersonaContactPromotionState = (typeof PERSONA_CONTACT_PROMOTION_STATES)[number];

// ─── Surface-independent capability projection ──────────────────────────────
//
// ContactGraph is a contained capability just as QubeTalk is (C13) — it must
// not belong exclusively to aigentMe. This reuses the SAME shared seam
// QubeTalk's own projection contract uses (types/capabilityProjection.ts),
// per the operator's explicit instruction to prefer one shared projection
// contract over two unrelated frameworks.

/** What the requesting surface is asking to see. `'all'` is only ever
 *  GRANTED for `profile: 'full'` requested by the owning principal itself —
 *  never for 'contextual' (a cartridge scope must always be an explicit,
 *  bounded list of ContactPerson ids; mirrors
 *  QubeTalkProjectionScope/evaluateProjectionScope's own discipline). */
export interface ContactGraphProjectionScope {
  contactPersonIds?: string[] | 'all';
}

export interface ContactGraphProjectionRequest extends CapabilityProjectionRequestBase {
  capability: 'contacts';
  projection: CapabilityProjectionProfile;
  scope: ContactGraphProjectionScope;
}

/** A bounded per-person summary — never raw endpoint identifiers for a
 *  'contextual' profile beyond what the requesting surface's context
 *  actually needs (disclosure boundary mirrors QubeTalk's own
 *  summaries-only discipline). */
export interface ContactGraphProjectionPersonSummary {
  contactPersonId: string;
  displayName: string;
  personaLabels: string[];
  endpointCount: number;
  preferredEndpointPlatform: ContactEndpointPlatform | null;
}

export interface ContactGraphProjectionDenial {
  contactPersonIds: string[];
  reason: 'not_owned' | 'not_permitted_for_contextual_profile' | 'agent_not_authorized_for_scope';
}

export interface ContactGraphProjectionResult extends CapabilityProjectionResultBase {
  people: ContactGraphProjectionPersonSummary[];
  denied: ContactGraphProjectionDenial[];
}
