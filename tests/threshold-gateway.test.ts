/**
 * metaMe Threshold Gateway canary (Increment 1) — PRD-THR-001.
 *
 * Locks the read-only, unauthenticated surface + the constitutional guardrails:
 *  - the signed Threshold Link manifest round-trips + carries no T0 ids;
 *  - tools/list advertises ONLY the read-only tools (no agent-authorize path);
 *  - handshake tools are gated with an honest "handshake required" result;
 *  - list_services returns the registry without leaking identifiers.
 */

import { describe, it, expect } from 'vitest';
import { buildThresholdLink, verifyThresholdLink, THRESHOLD_LINK_SCHEMA } from '../services/threshold/thresholdLink';
import { listTools, listPrompts, callTool, type GatewayContext } from '../services/threshold/gateway';
import { serviceRegistrySnapshot, getService, grantableCapabilities, CONSTITUTIONAL_ROOT_CAPABILITIES } from '../services/threshold/serviceRegistry';
import { journeyRegistrySnapshot, getJourney, FOUNDER_OFFICE_RUNG } from '../services/threshold/journeyRegistry';
import { crossingReceipt } from '../services/threshold/welcome';

const ctx: GatewayContext = {
  origin: 'https://example.test',
  gatewayUrl: 'https://example.test/api/threshold/mcp',
  resolveInvitation: async (code) =>
    code === 'pinv-known'
      ? {
          invitationId: 'pinv:abcd1234abcd1234',
          initiatingService: 'irl',
          institution: 'Invariant Research Lab',
          requestedRole: 'external_reviewer',
          requestedCapabilities: ['research.read', 'research.submit', 'qubetalk.send'],
          status: 'active',
          onboarded: false,
          expiresAt: null,
        }
      : null,
};

describe('Threshold Link manifest', () => {
  it('builds a v1 manifest with the gateway url and no persona/T0 ids', () => {
    const m = buildThresholdLink({
      invitationId: 'pinv:abcd1234abcd1234',
      initiatingService: 'irl',
      requestedRole: 'external_reviewer',
      requestedCapabilities: ['research.read'],
      gatewayUrl: 'https://example.test/api/threshold/mcp',
    });
    expect(m.schema).toBe(THRESHOLD_LINK_SCHEMA);
    expect(m.gateway.url).toContain('/api/threshold/mcp');
    const json = JSON.stringify(m);
    // no raw persona identifiers of any tier
    expect(json).not.toMatch(/personaId|authProfileId|rootDid|kybe/i);
  });

  it('HMAC stub signature round-trips when a secret is set', () => {
    process.env.THRESHOLD_LINK_SIGNING_SECRET = 'test-secret';
    const m = buildThresholdLink({
      invitationId: 'x',
      initiatingService: 'polity-passport',
      requestedRole: 'participant',
      requestedCapabilities: [],
      gatewayUrl: 'https://example.test/api/threshold/mcp',
    });
    expect(m.signature.type).toBe('ThresholdHmacStub/v0');
    expect(verifyThresholdLink(m)).toBe(true);
    // tamper → invalid
    const tampered = { ...m, requestedRole: 'admin' };
    expect(verifyThresholdLink(tampered as typeof m)).toBe(false);
    delete process.env.THRESHOLD_LINK_SIGNING_SECRET;
  });
});

describe('Gateway catalogue', () => {
  it('advertises only the read-only tools in Increment 1 (no authorize path)', () => {
    const names = listTools().map((t) => t.name);
    expect(names).toContain('list_services');
    expect(names).toContain('inspect_threshold_link');
    // constitutionally, no tool that lets the agent authorize/claim on the human's behalf
    expect(names).not.toContain('authorize_delegation');
    expect(names).not.toContain('activate_agent_passport');
  });

  it('offers the conversational crossing prompts incl. journey selection', () => {
    const names = listPrompts().map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['cross_the_threshold', 'get_polity_passport', 'explain_delegation_request', 'choose_your_journey']),
    );
  });

  it('advertises list_journeys ahead of the platform-facing list_services', () => {
    const names = listTools().map((t) => t.name);
    expect(names).toContain('list_journeys');
    expect(names.indexOf('list_journeys')).toBeLessThan(names.indexOf('list_services'));
  });
});

describe('Journey registry', () => {
  it('exposes the five constitutional journeys, each converging on the Founder Office', () => {
    const snap = journeyRegistrySnapshot();
    expect(snap.journeys.map((j) => j.id)).toEqual(['citizen', 'entrepreneur', 'researcher', 'creative', 'technical']);
    expect(snap.apex).toBe(FOUNDER_OFFICE_RUNG);
    for (const j of snap.journeys) {
      expect(j.ladder[j.ladder.length - 1]).toBe(FOUNDER_OFFICE_RUNG);
      expect(j.unlocks).toContain('founder-office');
      expect(j.experienceGuide).toMatch(/experience-guide$/);
    }
  });

  it('maps journeys onto the existing participation access domains (no parallel model)', () => {
    expect(getJourney('researcher')?.accessDomain).toBe('research-lab');
    expect(getJourney('entrepreneur')?.accessDomain).toBe('venture-lab');
    expect(getJourney('technical')?.unlocks).toEqual(expect.arrayContaining(['devon', 'agentiq-builder']));
    expect(getJourney('nope')).toBeNull();
  });

  it('list_journeys returns the registry and carries no persona/T0 ids', async () => {
    const res = await callTool('list_journeys', {}, ctx);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.journeys.length).toBe(5);
    expect(JSON.stringify(body)).not.toMatch(/personaId|authProfileId|rootDid|kybe/i);
  });
});

describe('Read-only dispatch', () => {
  it('list_services returns the registry (polity-passport is the constitutional root)', async () => {
    const res = await callTool('list_services', {}, ctx);
    const body = JSON.parse(res.content[0].text as string);
    const passport = body.services.find((s: { id: string }) => s.id === 'polity-passport');
    expect(passport.role).toBe('constitutional-root');
    expect(getService('irl')?.requiredCapabilities).toContain('research.read');
    expect(serviceRegistrySnapshot().services.length).toBeGreaterThan(1);
  });

  it('inspect_threshold_link explains the crossing and states the constitutional boundary', async () => {
    const res = await callTool('inspect_threshold_link', { code: 'pinv-known' }, ctx);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.crossing.initiatingService).toBe('irl');
    expect(body.constitutionalBoundary).toMatch(/HUMAN constitutional acts/);
    expect(body.manifest.schema).toBe(THRESHOLD_LINK_SCHEMA);
  });

  it('unknown link → isError', async () => {
    const res = await callTool('inspect_threshold_link', { code: 'pinv-nope' }, ctx);
    expect(res.isError).toBe(true);
  });

  it('handshake tools are gated with an honest "handshake required" (no silent action)', async () => {
    for (const t of ['begin_handshake', 'submit_review', 'send_qubetalk_message']) {
      const res = await callTool(t, {}, ctx);
      expect(res.isError).toBe(true);
      expect((res.content[0].text as string)).toMatch(/Constitutional Handshake/);
    }
  });
});

describe('Authenticated dispatch (Increment 3)', () => {
  const session = {
    id: 'sess',
    principalPublicRef: 'ppr_t2commitment',
    agentAlias: 'companion_t2alias',
    agreementId: 'agr-1',
    scope: ['research.read', 'research.submit', 'qubetalk.send'],
    initiatingService: 'irl',
    expiresAt: null,
    serviceAgreements: {},
  };
  const authedCtx: GatewayContext = { ...ctx, session };

  it('the implemented authenticated tools still gate to handshake-required WITHOUT a session', async () => {
    for (const t of ['get_crossing_status', 'request_service_capabilities', 'propose_delegation']) {
      const res = await callTool(t, {}, ctx); // no session
      expect(res.isError).toBe(true);
      expect(res.content[0].text as string).toMatch(/Constitutional Handshake/);
    }
  });

  it('get_crossing_status reports the current authority + receipt + reachability, with no T0 ids', async () => {
    const res = await callTool('get_crossing_status', {}, authedCtx);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.crossed).toBe(true);
    expect(body.currentAuthority).toEqual(session.scope);
    expect(body.crossingReceipt.citizenship).toBe('active');
    expect(body.reachableServices).toContain('irl'); // irl caps ⊆ granted scope
    expect(JSON.stringify(body)).not.toMatch(/personaId|authProfileId|rootDid|kybe/i);
  });

  it('request_service_capabilities distinguishes reachable vs an incremental crossing', async () => {
    const irl = await callTool('request_service_capabilities', { service: 'irl' }, authedCtx);
    expect(JSON.parse(irl.content[0].text as string).reachable).toBe(true);
    const devon = await callTool('request_service_capabilities', { service: 'devon' }, authedCtx);
    const body = JSON.parse(devon.content[0].text as string);
    expect(body.reachable).toBe(false);
    expect(body.missingCapabilities.length).toBeGreaterThan(0);
  });

  it('propose_delegation prepares only (never grants) and drops unknown capabilities', async () => {
    const res = await callTool('propose_delegation', { capabilities: ['research.read', 'not.a.capability'] }, authedCtx);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.proposal.alreadyHeld).toContain('research.read');
    expect(body.proposal.unrecognized).toContain('not.a.capability');
    expect(body.humanStep).toMatch(/cannot authorize on their behalf/i);
  });
});

describe('IRL read adapter (Increment 4a)', () => {
  const rootSession = {
    id: 's', principalPublicRef: 'p', agentAlias: 'a', agreementId: 'g',
    scope: [...CONSTITUTIONAL_ROOT_CAPABILITIES], initiatingService: 'polity-passport', expiresAt: null, serviceAgreements: {},
  };
  const irlSession = { ...rootSession, scope: [...CONSTITUTIONAL_ROOT_CAPABILITIES, 'research.read'], initiatingService: 'irl' };
  const fakeIrl = {
    listDocuments: async () => ({ ok: true, overview: { artifacts: ['a', 'b'] } }),
    readDocument: async (path: string) => ({ ok: true, path, content: '# doc' }),
    resolveCanon: async (term: string) => ({ ok: true, term, resolved: { invariants: ['inv.constitutional.061'] } }),
    submitResult: async (input: { agreementId: string }) => ({ ok: true, id: 'res-1', agreementId: input.agreementId }),
  };

  it('explain_primitive resolves a term against the canon WITHOUT a session (public, read-only)', async () => {
    const c: GatewayContext = { ...ctx, irl: fakeIrl }; // no session
    const res = await callTool('explain_primitive', { term: 'standing' }, c);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.ok).toBe(true);
    expect(body.term).toBe('standing');
    // it is a read-only tool — never gated behind the handshake
    expect(res.isError).toBeUndefined();
  });

  it('gates the read tools behind research.read — a base (root-only) crossing cannot read IRL', async () => {
    const c: GatewayContext = { ...ctx, session: rootSession, irl: fakeIrl };
    for (const t of ['list_shared_documents', 'read_shared_document']) {
      const res = await callTool(t, { path: 'foundation/x.md' }, c);
      expect(res.isError).toBe(true);
      expect(res.content[0].text as string).toMatch(/research\.read/);
    }
  });

  it('serves the read tools once the session holds research.read', async () => {
    const c: GatewayContext = { ...ctx, session: irlSession, irl: fakeIrl };
    const list = await callTool('list_shared_documents', {}, c);
    expect(JSON.parse(list.content[0].text as string).ok).toBe(true);
    const read = await callTool('read_shared_document', { path: 'foundation/PARTICIPATION_overview.md' }, c);
    expect(JSON.parse(read.content[0].text as string).path).toBe('foundation/PARTICIPATION_overview.md');
  });

  it('submit_review needs research.submit AND an IRL agreement, then submits under it (4b)', async () => {
    const submitScope = [...CONSTITUTIONAL_ROOT_CAPABILITIES, 'research.read', 'research.submit'];
    // holds the scope but NO irl agreement yet → refused with guidance
    const noAgr: GatewayContext = { ...ctx, session: { ...rootSession, scope: submitScope, serviceAgreements: {} }, irl: fakeIrl };
    const blocked = await callTool('submit_review', { experiment: 'EXP-P1', provider: 'x', model: 'y', results: {} }, noAgr);
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0].text as string).toMatch(/IRL submission agreement/i);
    // with the incremental IRL delegation recorded → submits under that agreement
    const withAgr: GatewayContext = { ...ctx, session: { ...rootSession, scope: submitScope, serviceAgreements: { irl: 'irlsub-abc' } }, irl: fakeIrl };
    const ok = await callTool('submit_review', { experiment: 'EXP-P1', provider: 'x', model: 'y', results: {} }, withAgr);
    const body = JSON.parse(ok.content[0].text as string);
    expect(body.ok).toBe(true);
    expect(body.agreementId).toBe('irlsub-abc');
  });
});

describe('Passport-first crossing (constitutional-root authority only)', () => {
  it('a base (polity-passport) crossing grants root navigation authority — NO service capability', () => {
    const grantable = grantableCapabilities('polity-passport');
    for (const c of CONSTITUTIONAL_ROOT_CAPABILITIES) expect(grantable.has(c)).toBe(true);
    // none of the service-operating capabilities may be grantable at a base crossing
    expect(grantable.has('research.read')).toBe(false);
    expect(grantable.has('code.read')).toBe(false);
    expect(grantable.has('workspace.act')).toBe(false);
  });

  it('a service-initiated (irl) crossing adds ONLY that service’s capabilities on top of root', () => {
    const grantable = grantableCapabilities('irl');
    for (const c of CONSTITUTIONAL_ROOT_CAPABILITIES) expect(grantable.has(c)).toBe(true);
    for (const c of getService('irl')!.requiredCapabilities) expect(grantable.has(c)).toBe(true);
    expect(grantable.has('code.read')).toBe(false); // not devon's crossing
  });

  it('the crossing receipt reads "none yet" for a root-only session, and lists service authority once granted', () => {
    const root = CONSTITUTIONAL_ROOT_CAPABILITIES.slice();
    const base = crossingReceipt({ id: 's', principalPublicRef: 'p', agentAlias: 'a', agreementId: 'g', scope: root, initiatingService: 'polity-passport', expiresAt: null, serviceAgreements: {} });
    expect(base.serviceAuthority).toBe('none yet');
    expect(base.citizenship).toBe('active');
    expect(base.nextStep).toBe('choose a journey');
    const withIrl = crossingReceipt({ id: 's', principalPublicRef: 'p', agentAlias: 'a', agreementId: 'g', scope: [...root, 'research.read'], initiatingService: 'irl', expiresAt: null, serviceAgreements: {} });
    expect(withIrl.serviceAuthority).toEqual(['research.read']);
  });
});
