/**
 * sponsorPolityAgent — idempotent re-run for a migrated/platform agent
 * (existingIdentity), 2026-09-05 capacity remediation follow-on.
 *
 * Factor/Aegis-style platform-agent provisioning WILL be called more than
 * once (a fresh provision, then a re-run to verify idempotency, or an
 * accidental workflow re-trigger) — sponsorPolityAgent's ordinary slug-
 * uniqueness gate previously treated any repeat as a 409 "already taken"
 * error, which is correct for ordinary citizen genesis (two DIFFERENT
 * agents should never share a slug) but wrong for the SAME migrated agent
 * re-registering its own already-provisioned identity. This suite pins:
 *   1. a fresh existingIdentity call creates the row;
 *   2. an identical re-run returns the SAME row, ok:true, alreadyExisted:true
 *      — never a 409;
 *   3. a DIFFERENT agent_id colliding on the same slug is STILL refused —
 *      the idempotency check never silently adopts another agent's row;
 *   4. ordinary genesis (no existingIdentity) hitting a taken slug is
 *      UNCHANGED — still a 409, proving this fix never widens the ordinary
 *      citizen-genesis path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The resolver's ordinary-capacity computation (see
// services/agents/sponsorPolityAgent.ts's comment: it always computes
// "ordinary" capacity first, purely to know whether an override is being
// exercised — regardless of the real callerIsAdmin/isPlatformAuthority)
// reaches getPersonaPlan/persona_plans unconditionally. Mocked here so this
// suite doesn't need a full persona_plans fake — a free-tier default (base 3)
// is exactly what makes tests 2-4 meaningful (capacity IS exhausted at the
// ordinary tier; the override/refusal branching is what's under test).
vi.mock('@/services/billing/personaPlan', async () => {
  const actual = await vi.importActual<typeof import('@/services/billing/personaPlan')>('@/services/billing/personaPlan');
  return { ...actual, getPersonaPlan: async () => ({ boundedDelegateLimit: 3 }) };
});

interface FakeRootRow {
  id: string;
  agent_id: string;
  did_uri: string;
  agent_class: string;
  display_name: string;
  description: string;
  sponsor_passport_id: string;
  sponsor_persona_id: string;
  agent_card_url: string;
  agent_card_slug: string;
  is_aigent_me: boolean | null;
  created_at: string;
}

function makeAdmin(opts: { rootRows: FakeRootRow[]; sponsorPersonaId: string; sponsorPassportId: string }) {
  const rootRows = opts.rootRows;
  return {
    from: (table: string) => {
      if (table === 'polity_passport_records') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  passport_id: opts.sponsorPassportId,
                  persona_id: opts.sponsorPersonaId,
                  passport_class: 'citizen',
                  citizen_status: 'active',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'personas') {
        // The resolver's capacity-columns lookup — no admin-granted base/
        // earned credit configured for this fake sponsor (defaults to 0/0).
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      }
      if (table === 'agent_root_identity') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({ data: rootRows.find((r) => r.agent_card_slug === val) ?? null, error: null }),
              // used-count (capacity) query shape — the resolver awaits this directly (no .maybeSingle()).
              then: (resolve: (v: unknown) => void) => resolve({ count: rootRows.length, data: null, error: null }),
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const created: FakeRootRow = {
                  id: `root-${rootRows.length + 1}`,
                  agent_id: String(row.agent_id),
                  did_uri: String(row.did_uri),
                  agent_class: String(row.agent_class),
                  display_name: String(row.display_name),
                  description: String(row.description),
                  sponsor_passport_id: String(row.sponsor_passport_id),
                  sponsor_persona_id: String(row.sponsor_persona_id),
                  agent_card_url: String(row.agent_card_url),
                  agent_card_slug: String(row.agent_card_slug),
                  is_aigent_me: (row.is_aigent_me as boolean) ?? null,
                  created_at: new Date().toISOString(),
                };
                rootRows.push(created);
                return { data: created, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`sponsor-polity-agent-existing-identity-idempotency.test.ts: unexpected table "${table}"`);
    },
  } as any;
}

const SPONSOR_PERSONA_ID = 'sponsor-platform-1';
const SPONSOR_PASSPORT_ID = 'passport-platform-1';

describe('sponsorPolityAgent — existingIdentity idempotent re-run', () => {
  let rootRows: FakeRootRow[];

  beforeEach(() => {
    rootRows = [];
  });

  it('1. a fresh existingIdentity call creates the row', async () => {
    const { sponsorPolityAgent } = await import('@/services/agents/sponsorPolityAgent');
    const admin = makeAdmin({ rootRows, sponsorPersonaId: SPONSOR_PERSONA_ID, sponsorPassportId: SPONSOR_PASSPORT_ID });
    const result = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor',
      displayName: 'Factor',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      existingIdentity: { agentId: 'aigent-factor', didUri: 'did:agent:root:aigent-factor', agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json' },
      isPlatformAuthority: true,
    });
    expect(result.ok).toBe(true);
    expect(result.alreadyExisted).toBeFalsy();
    expect(result.agent?.agentId).toBe('aigent-factor');
  });

  it('2. an identical re-run returns the SAME row, ok:true, alreadyExisted:true — never a 409', async () => {
    const { sponsorPolityAgent } = await import('@/services/agents/sponsorPolityAgent');
    const admin = makeAdmin({ rootRows, sponsorPersonaId: SPONSOR_PERSONA_ID, sponsorPassportId: SPONSOR_PASSPORT_ID });
    const input = {
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor',
      displayName: 'Factor',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      existingIdentity: { agentId: 'aigent-factor', didUri: 'did:agent:root:aigent-factor', agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json' },
      isPlatformAuthority: true,
    };
    const first = await sponsorPolityAgent(input);
    const second = await sponsorPolityAgent(input);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.status).toBe(200);
    expect(second.alreadyExisted).toBe(true);
    expect(second.agent?.agentRootId).toBe(first.agent?.agentRootId);
    expect(rootRows).toHaveLength(1); // never a second insert
  });

  it("3. a DIFFERENT agent_id colliding on the same slug is STILL refused (409) — never silently adopted", async () => {
    const { sponsorPolityAgent } = await import('@/services/agents/sponsorPolityAgent');
    const admin = makeAdmin({ rootRows, sponsorPersonaId: SPONSOR_PERSONA_ID, sponsorPassportId: SPONSOR_PASSPORT_ID });
    await sponsorPolityAgent({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor',
      displayName: 'Factor',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      existingIdentity: { agentId: 'aigent-factor', didUri: 'did:agent:root:aigent-factor', agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json' },
      isPlatformAuthority: true,
    });
    const collision = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor', // same slug
      displayName: 'Someone Else',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      existingIdentity: { agentId: 'aigent-someone-else', didUri: 'did:agent:root:aigent-someone-else', agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/someone-else/agent-card.json' },
      isPlatformAuthority: true,
    });
    expect(collision.ok).toBe(false);
    expect(collision.status).toBe(409);
  });

  it('4. ordinary genesis (no existingIdentity) hitting a taken slug is UNCHANGED — still a 409', async () => {
    const { sponsorPolityAgent } = await import('@/services/agents/sponsorPolityAgent');
    const admin = makeAdmin({ rootRows, sponsorPersonaId: SPONSOR_PERSONA_ID, sponsorPassportId: SPONSOR_PASSPORT_ID });
    await sponsorPolityAgent({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor',
      displayName: 'Factor',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      existingIdentity: { agentId: 'aigent-factor', didUri: 'did:agent:root:aigent-factor', agentCardUrl: 'https://dev-beta.aigentz.me/api/agents/factor/agent-card.json' },
      isPlatformAuthority: true,
    });
    const ordinary = await sponsorPolityAgent({
      admin,
      sponsorPersonaId: SPONSOR_PERSONA_ID,
      sponsorPassportId: SPONSOR_PASSPORT_ID,
      slug: 'factor', // same slug, ordinary citizen genesis — no existingIdentity
      displayName: 'A Citizen Delegate',
      description: 'test',
      origin: 'https://dev-beta.aigentz.me',
      callerIsAdmin: true, // even an admin must not silently adopt another agent's slug
    });
    expect(ordinary.ok).toBe(false);
    expect(ordinary.status).toBe(409);
  });
});
