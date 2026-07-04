/**
 * Participant passport application — structural validator (Stage 4).
 *
 * Validates agent/robot/organization participant applications against the
 * required shape of participant-passport.application.schema.json. This is a
 * hand-rolled structural check, not full JSON Schema validation — the
 * installed ajv predates draft 2020-12 support. When ajv is upgraded, this
 * module becomes a thin wrapper over compiled-schema validation; the
 * exported surface (validateParticipantApplication) stays stable.
 *
 * Shared by /api/polity-passport/validate (dry-run) and
 * /api/polity-passport/submit (persisting) so the two can never drift.
 */

export const PARTICIPANT_KINDS = [
  'agent',
  'robot',
  'model_backed_service',
  'organization_agent',
  'cartridge_copilot',
  'workflow_agent',
] as const;

export const REQUESTED_PASSPORT_TYPES = [
  'agent_participant',
  'robot_participant',
  'organization_participant',
  'restricted_participant',
  'provisional_participant',
] as const;

const MANDATORY_CONSENTS = [
  'participant_terms_accepted',
  'registry_pending_record_consent',
  'constraints_and_obligations_accepted',
  'review_process_accepted',
] as const;

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ParticipantValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Derived DB passport_class when valid. */
  passportClass?: 'agent_participant' | 'robot_participant' | 'organization_participant';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** participant_kind → polity_passport_applications.passport_class */
export function passportClassForKind(
  kind: string,
): 'agent_participant' | 'robot_participant' | 'organization_participant' {
  if (kind === 'robot') return 'robot_participant';
  if (kind === 'organization_agent') return 'organization_participant';
  return 'agent_participant';
}

export function validateParticipantApplication(body: unknown): ParticipantValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(body)) {
    return { valid: false, issues: [{ path: '$', message: 'Body must be a JSON object' }] };
  }

  if (body.schema_version !== '0.1.0') {
    issues.push({ path: 'schema_version', message: "Must be '0.1.0'" });
  }
  if (body.application_type !== 'agent_participant_passport') {
    issues.push({ path: 'application_type', message: "Must be 'agent_participant_passport'" });
  }

  // participant
  const participant = body.participant;
  if (!isRecord(participant)) {
    issues.push({ path: 'participant', message: 'Required object' });
  } else {
    const kind = participant.participant_kind;
    if (typeof kind !== 'string' || !(PARTICIPANT_KINDS as ReadonlyArray<string>).includes(kind)) {
      issues.push({
        path: 'participant.participant_kind',
        message: `Must be one of: ${PARTICIPANT_KINDS.join(', ')}`,
      });
    }
    if (typeof participant.agent_type !== 'string' || !participant.agent_type) {
      issues.push({ path: 'participant.agent_type', message: 'Required string' });
    }
    if (typeof participant.display_name !== 'string' || !participant.display_name.trim()) {
      issues.push({ path: 'participant.display_name', message: 'Required string' });
    }
  }

  // agent_identity.agent_card.agent_card_url
  const agentIdentity = body.agent_identity;
  if (!isRecord(agentIdentity)) {
    issues.push({ path: 'agent_identity', message: 'Required object' });
  } else {
    const card = agentIdentity.agent_card;
    if (!isRecord(card) || typeof card.agent_card_url !== 'string' || !card.agent_card_url) {
      issues.push({
        path: 'agent_identity.agent_card.agent_card_url',
        message: 'Required — the agent card URL is the participant identity anchor',
      });
    } else {
      try {
        const u = new URL(String(card.agent_card_url));
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
      } catch {
        issues.push({
          path: 'agent_identity.agent_card.agent_card_url',
          message: 'Must be a valid http(s) URL',
        });
      }
    }
  }

  // capabilities / policy_profile / risk_profile — required objects
  for (const section of ['capabilities', 'policy_profile', 'risk_profile'] as const) {
    if (!isRecord(body[section]) && !Array.isArray(body[section])) {
      issues.push({ path: section, message: 'Required section' });
    }
  }

  // passport_request
  const request = body.passport_request;
  if (!isRecord(request)) {
    issues.push({ path: 'passport_request', message: 'Required object' });
  } else {
    const type = request.requested_passport_type;
    if (
      typeof type !== 'string' ||
      !(REQUESTED_PASSPORT_TYPES as ReadonlyArray<string>).includes(type)
    ) {
      issues.push({
        path: 'passport_request.requested_passport_type',
        message: `Must be one of: ${REQUESTED_PASSPORT_TYPES.join(', ')}`,
      });
    }
    if (request.requested_scope === undefined) {
      issues.push({ path: 'passport_request.requested_scope', message: 'Required' });
    }
    if (request.requested_status === undefined) {
      issues.push({ path: 'passport_request.requested_status', message: 'Required' });
    }
  }

  // consents — all four mandatory booleans true
  const consents = body.consents;
  if (!isRecord(consents)) {
    issues.push({ path: 'consents', message: 'Required object' });
  } else {
    for (const consent of MANDATORY_CONSENTS) {
      if (consents[consent] !== true) {
        issues.push({ path: `consents.${consent}`, message: 'Must be true' });
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues };

  const kind = String((participant as Record<string, unknown>).participant_kind);
  return { valid: true, issues: [], passportClass: passportClassForKind(kind) };
}
