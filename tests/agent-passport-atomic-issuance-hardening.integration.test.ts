/**
 * DiDQube Phase 3 closure review (2026-09-07): live-Postgres proof of the
 * three guarantees `issue_agent_participant_passport_atomic`
 * (`supabase/migrations/20260930290000_agent_participant_passport_issuance_hardening.sql`)
 * makes that no unit test can fake through a mocked Supabase client:
 *
 *   1. GRANTS — the ANON key cannot invoke the RPC over the real PostgREST
 *      endpoint at all (it would otherwise be exposed as a public RPC,
 *      bypassing every TypeScript-side authorization check applyReviewDecision
 *      performs before ever reaching it). The `authenticated` role's denial
 *      was verified directly against the live database during the closure
 *      review (see the execution-plan doc) and is not re-proven here via
 *      HTTP, since exercising it would require a real signed user session.
 *   2. CONCURRENCY — a second call against an already-claimed application is
 *      refused, never a second issued Passport.
 *   3. SCOPE — a citizen application is refused by this agent-only RPC.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL (+
 * NEXT_PUBLIC_SUPABASE_ANON_KEY for the grants check) for the project this
 * repo's deployments point at; skipped entirely (not failed) when absent,
 * matching this repo's other `.integration.test.ts` suites. Every fixture
 * row this test creates is explicitly deleted in `afterEach` — PostgREST
 * executes each call in its own transaction, so there is no ambient
 * transaction to roll back, unlike the ad hoc DO-block verification run
 * live against the database during the review itself.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const HAS_SERVICE_CREDS = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const AGENT_CARD_URL = 'https://agents.example.invalid/card/integration-hardening-test';

const createdAppIds: string[] = [];
const createdAgentCardUrls: string[] = [AGENT_CARD_URL];

describe.skipIf(!HAS_SERVICE_CREDS)('issue_agent_participant_passport_atomic — live Postgres hardening proof', () => {
  const admin = () => createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  afterEach(async () => {
    const a = admin();
    if (createdAppIds.length) {
      await a.from('polity_passport_records').delete().in('application_id', createdAppIds);
      await a.from('polity_passport_applications').delete().in('id', createdAppIds);
      createdAppIds.length = 0;
    }
    await a.from('agent_root_identity').delete().in('agent_card_url', createdAgentCardUrls);
  });

  it('the ANON key cannot invoke the RPC over the real PostgREST endpoint', async () => {
    const anonClient = createClient(SUPABASE_URL!, ANON_KEY || 'anon-key-not-set');
    const { error } = await anonClient.rpc('issue_agent_participant_passport_atomic', {
      p_application_id: '00000000-0000-0000-0000-000000000000',
      p_passport_id: 'ppp-perm-test-SHOULD-FAIL',
      p_issued_status: 'approved',
      p_actor_type: 'steward',
      p_steward_persona_id: 'x',
      p_notes: null,
      p_evidence_type: 'e',
      p_receipt_action: 'r',
    });
    expect(error).toBeTruthy();
    expect(error?.message ?? '').toMatch(/permission denied|not.*found|schema cache/i);
  });

  it('a second call against an already-claimed application is refused, never issuing a second Passport', async () => {
    const a = admin();
    const { data: appRow, error: appError } = await a
      .from('polity_passport_applications')
      .insert({
        passport_class: 'agent_participant',
        application_status: 'pending_approval',
        agent_card_url: AGENT_CARD_URL,
        agent_protocol: 'a2a',
        personhood_proof_type: 'agent_declaration',
        personhood_proof_ref: 'agent-card:test',
        personhood_proof_at: new Date().toISOString(),
        passport_grade: 'agent_participant',
        requested_domains: [],
        consents: {},
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(appError).toBeNull();
    const appId = appRow!.id as string;
    createdAppIds.push(appId);

    await a.from('agent_root_identity').insert({
      agent_id: 'integration-hardening-agent',
      did_uri: 'did:test:integration-hardening',
      agent_class: 'tool-agent',
      agent_card_url: AGENT_CARD_URL,
      agent_card_slug: 'integration-hardening-test',
    });

    const first = await a.rpc('issue_agent_participant_passport_atomic', {
      p_application_id: appId,
      p_passport_id: 'ppp-integration-1',
      p_issued_status: 'approved',
      p_actor_type: 'steward',
      p_steward_persona_id: 'steward-1',
      p_notes: null,
      p_evidence_type: 'e',
      p_receipt_action: 'r',
    });
    expect(first.error).toBeNull();
    expect(first.data?.[0]?.bound).toBe(true);

    const second = await a.rpc('issue_agent_participant_passport_atomic', {
      p_application_id: appId,
      p_passport_id: 'ppp-integration-2-SHOULD-FAIL',
      p_issued_status: 'approved',
      p_actor_type: 'steward',
      p_steward_persona_id: 'steward-1',
      p_notes: null,
      p_evidence_type: 'e',
      p_receipt_action: 'r',
    });
    expect(second.error).toBeTruthy();
    expect(second.error?.message ?? '').toMatch(/not an open agent_participant application/);

    const { data: records } = await a.from('polity_passport_records').select('id').eq('application_id', appId);
    expect(records?.length).toBe(1);
  });

  it('a citizen application is refused by this agent-only RPC', async () => {
    const a = admin();
    const { data: appRow, error: appError } = await a
      .from('polity_passport_applications')
      .insert({
        passport_class: 'citizen',
        application_status: 'pending_approval',
        passport_grade: 'citizen',
        requested_domains: [],
        consents: {},
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(appError).toBeNull();
    const appId = appRow!.id as string;
    createdAppIds.push(appId);

    const result = await a.rpc('issue_agent_participant_passport_atomic', {
      p_application_id: appId,
      p_passport_id: 'ppp-citizen-SHOULD-FAIL',
      p_issued_status: 'active',
      p_actor_type: 'steward',
      p_steward_persona_id: 'steward-1',
      p_notes: null,
      p_evidence_type: 'e',
      p_receipt_action: 'r',
    });
    expect(result.error).toBeTruthy();
    expect(result.error?.message ?? '').toMatch(/not an open agent_participant application/);
  });
});
