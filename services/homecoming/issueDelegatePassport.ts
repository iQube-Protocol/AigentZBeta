/**
 * Issue a delegate's Participant Passport — Agent Homecoming (CFS-023, W2 → L5).
 *
 * Automates the passport track a delegate otherwise clicks through by hand:
 *   1. SUBMIT  — a participant application for the delegate's agent_card_url
 *                (or reuse an open one). Payload validated by the Bureau's own
 *                validateParticipantApplication (never a bespoke shape).
 *   2. APPROVE — via the Bureau's own applyReviewDecision (decision 'approve').
 *                The caller (an admin sponsoring this delegate) IS the reviewing
 *                steward — the admin-as-Bureau decision, deliberate + receipted.
 *   3. BIND    — set agent_root_identity.bound_passport_id = the issued passport
 *                (idempotent, NULL-guarded). This is the exact L5 passport signal
 *                the presence scorer reads and the "Sponsored Agents" view shows.
 *
 * Idempotent: an already-bound delegate returns its existing passport untouched.
 * Reuses the canonical Bureau services (Extend-Don't-Duplicate) — it does not
 * fork issuance. The application-payload builder is pure + canary-tested.
 *
 * NOTE: this binds the passport (the L5 signal); the W3C-VC credential DOWNLOAD
 * (credential_claimed_at) remains the agent's own optional claim step.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { applyReviewDecision } from '@/services/passport/issuanceService';
import { validateParticipantApplication } from '@/services/passport/participantApplicationValidator';
import { getDelegateSpec, type DelegateStandUpSpec } from '@/services/homecoming/agentHomecoming';
import type { HomecomingDelegateId } from '@/types/homecoming';

const OPEN_STATUSES = ['submitted', 'pending_approval', 'needs_more_information'];

/** Build a minimal, VALID participant application for a delegate. Pure. */
export function buildParticipantApplication(spec: DelegateStandUpSpec, agentCardUrl: string): Record<string, unknown> {
  return {
    schema_version: '0.1.0',
    application_type: 'agent_participant_passport',
    participant: {
      participant_kind: 'agent',
      agent_type: 'constitutional-delegate',
      display_name: spec.displayName,
    },
    agent_identity: {
      agent_card: { agent_card_url: agentCardUrl },
      supported_protocols: ['a2a'],
    },
    capabilities: {},
    policy_profile: {},
    risk_profile: {},
    passport_request: {
      requested_passport_type: 'agent_participant',
      requested_scope: [],
      requested_status: 'provisionally_issued',
    },
    consents: {
      participant_terms_accepted: true,
      registry_pending_record_consent: true,
      constraints_and_obligations_accepted: true,
      review_process_accepted: true,
    },
  };
}

export interface IssueDelegatePassportInput {
  admin: SupabaseClient;
  delegate: HomecomingDelegateId;
  /** The reviewing steward (the caller, an admin sponsoring the delegate). */
  stewardPersonaId: string;
}

export interface IssueDelegatePassportResult {
  ok: boolean;
  status: number;
  passportId?: string;
  applicationId?: string;
  alreadyBound?: boolean;
  submitted?: boolean;
  error?: string;
}

export async function issueDelegatePassport(
  input: IssueDelegatePassportInput,
): Promise<IssueDelegatePassportResult> {
  const { admin, delegate, stewardPersonaId } = input;
  const spec = getDelegateSpec(delegate);
  if (!spec) return { ok: false, status: 400, error: `No stand-up spec for '${delegate}' — author its card first.` };

  // Resolve the seeded RootDID (must exist — stand the delegate up first).
  const { data: root, error: rootErr } = await admin
    .from('agent_root_identity')
    .select('id, agent_card_url, bound_passport_id')
    .eq('agent_card_slug', spec.slug)
    .maybeSingle();
  if (rootErr) return { ok: false, status: 500, error: rootErr.message };
  if (!root) return { ok: false, status: 409, error: `${spec.displayName} is not seeded yet — stand it up first.` };
  if (root.bound_passport_id) {
    return { ok: true, status: 200, alreadyBound: true, passportId: String(root.bound_passport_id) };
  }
  const agentCardUrl = String(root.agent_card_url);

  // 1. Find an open application for this card, or submit a new one.
  const { data: apps } = await admin
    .from('polity_passport_applications')
    .select('id, application_status')
    .eq('agent_card_url', agentCardUrl)
    .order('submitted_at', { ascending: false })
    .limit(1);
  const openApp = (apps ?? []).find((a) => OPEN_STATUSES.includes(String(a.application_status)));

  let applicationId: string;
  let submitted = false;
  if (openApp) {
    applicationId = String(openApp.id);
  } else {
    const payload = buildParticipantApplication(spec, agentCardUrl);
    const validation = validateParticipantApplication(payload);
    if (!validation.valid) {
      return { ok: false, status: 500, error: `application payload invalid: ${validation.issues.map((i) => i.path).join(', ')}` };
    }
    const { data: appRow, error: insertErr } = await admin
      .from('polity_passport_applications')
      .insert({
        passport_class: 'agent_participant',
        application_status: 'submitted',
        agent_card_url: agentCardUrl,
        agent_protocol: 'a2a',
        personhood_proof_type: 'agent_declaration',
        personhood_proof_ref: `agent-card:${agentCardUrl}`,
        personhood_proof_at: new Date().toISOString(),
        passport_grade: 'agent_participant',
        requested_domains: [],
        consents: payload.consents,
        application_payload: payload,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertErr) return { ok: false, status: 500, error: insertErr.message };
    applicationId = String(appRow.id);
    submitted = true;
  }

  // 2. Approve → issue (the admin-as-Bureau decision, receipted by the service).
  const decision = await applyReviewDecision({
    applicationId,
    decision: 'approve',
    stewardPersonaId,
    participantIssueStatus: 'approved',
  });
  if (!decision.ok || !decision.passportId) {
    return { ok: false, status: 500, applicationId, submitted, error: decision.error ?? 'issuance failed' };
  }

  // 3. Bind the passport to the RootDID — the L5 passport signal. NULL-guarded
  //    so a concurrent claim can't be clobbered; best-effort (non-fatal).
  try {
    await admin
      .from('agent_root_identity')
      .update({ bound_passport_id: decision.passportId })
      .eq('agent_card_url', agentCardUrl)
      .is('bound_passport_id', null);
  } catch {
    /* binding is best-effort — the record is issued regardless */
  }

  return { ok: true, status: 200, passportId: decision.passportId, applicationId, submitted };
}
