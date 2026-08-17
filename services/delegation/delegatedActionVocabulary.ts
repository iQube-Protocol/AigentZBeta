/**
 * delegatedActionVocabulary — the canonical delegated-action names for the
 * Founder Command Center's low-risk operational connectors (Homecoming
 * Closeout WP-C1, operator brief 2026-08-17).
 *
 * Audit finding (2026-08-17): the platform already has TWO separate action
 * vocabularies that had never been connected:
 *   1. `TRUST_BAND_ACTIONS` (app/api/codex/chat/agentiq-os/delegation/route.ts)
 *      — abstract governance-level actions (knowledge_retrieval,
 *      draft_document, registry_submission_proposal, registry_publish,
 *      full_delegation) that populate `delegation_grants.allowed_actions`.
 *   2. `GoogleConnectorId` / Marketa connector ids (services/google/connectors.ts,
 *      services/marketa/marketaConnector.ts) — the actual executable
 *      connectors, each already carrying its own `requiresApproval` flag.
 *
 * This module is the bridge, not a third vocabulary: it names ONE canonical
 * action id per connector (reusing the SAME string domain `allowed_actions`
 * already stores) and maps every real, already-implemented connector id to
 * it. No new connector, no new execution layer — this is normalization only.
 *
 * Draft/create vs externalize/send is preserved exactly as the connectors
 * already split it (create-doc vs share-doc, create-event vs
 * invite-external, gmail.draft vs gmail.send) — this module does not
 * re-decide that boundary, it names it.
 */

import type { GoogleConnectorId } from '@/services/google/connectors';

export type DelegatedActionId =
  | 'draft_email'
  | 'send_email'
  | 'create_calendar_event'
  | 'invite_calendar_event'
  | 'create_google_doc'
  | 'share_google_doc'
  | 'create_google_sheet'
  | 'create_google_slides'
  | 'marketa_send';

/** Every canonical delegated action this module names. Additive to
 *  TRUST_BAND_ACTIONS' existing abstract entries — never replaces them. */
export const DELEGATED_ACTION_IDS: readonly DelegatedActionId[] = [
  'draft_email',
  'send_email',
  'create_calendar_event',
  'invite_calendar_event',
  'create_google_doc',
  'share_google_doc',
  'create_google_sheet',
  'create_google_slides',
  'marketa_send',
];

/** Actions that create/prepare content with no external exposure — the
 *  connectors backing these already carry requiresApproval: false. */
export const DRAFT_ACTION_IDS: ReadonlySet<DelegatedActionId> = new Set([
  'draft_email',
  'create_calendar_event',
  'create_google_doc',
  'create_google_sheet',
  'create_google_slides',
]);

/** Actions that externalize/send/share/invite — the connectors backing
 *  these already carry requiresApproval: true. The delegation gate never
 *  weakens this; it is an ADDITIONAL check, not a replacement. */
export const EXTERNALIZING_ACTION_IDS: ReadonlySet<DelegatedActionId> = new Set([
  'send_email',
  'invite_calendar_event',
  'share_google_doc',
  'marketa_send',
]);

const CONNECTOR_TO_DELEGATED_ACTION: Record<string, DelegatedActionId> = {
  'google.gmail.draft': 'draft_email',
  'google.gmail.send': 'send_email',
  'google.calendar.create-event': 'create_calendar_event',
  'google.calendar.invite-external': 'invite_calendar_event',
  'google.drive.create-doc': 'create_google_doc',
  'google.drive.share-doc': 'share_google_doc',
  'google.sheets.create': 'create_google_sheet',
  'google.slides.create': 'create_google_slides',
  'marketa.send-transactional': 'marketa_send',
  'marketa.send-cohort': 'marketa_send',
};

/** Resolve the canonical delegated-action name for a connector id, or null
 *  for a connector this vocabulary hasn't named yet (e.g. read-only
 *  connectors like google.drive.search / google.calendar.list-events /
 *  google.tasks.list, which are not consequential actions and are
 *  deliberately left ungated). */
export function delegatedActionForConnector(
  connectorId: GoogleConnectorId | string,
): DelegatedActionId | null {
  return CONNECTOR_TO_DELEGATED_ACTION[connectorId] ?? null;
}

/** The Founder Command Center's full action set — every canonical action a
 *  Founder Command Center delegation grant preset (WP-C4) should offer. */
export const FOUNDER_COMMAND_CENTER_ACTIONS: readonly DelegatedActionId[] = DELEGATED_ACTION_IDS;
