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
import { serviceRegistrySnapshot, getService } from '../services/threshold/serviceRegistry';
import { journeyRegistrySnapshot, getJourney, FOUNDER_OFFICE_RUNG } from '../services/threshold/journeyRegistry';

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
    for (const t of ['begin_handshake', 'propose_delegation', 'submit_review', 'send_qubetalk_message']) {
      const res = await callTool(t, {}, ctx);
      expect(res.isError).toBe(true);
      expect((res.content[0].text as string)).toMatch(/Constitutional Handshake/);
    }
  });
});
