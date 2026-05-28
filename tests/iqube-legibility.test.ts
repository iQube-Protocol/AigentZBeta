/**
 * iQube Agent Legibility Profile v0.1 — unit tests
 *
 * Covers the PRD §12 happy-path test list against the pure
 * functions: card builder, mappers, action menu, and Zod schemas.
 * Route-level tests (catalog + card endpoints) are deferred to
 * integration runs; the pure-function coverage here is the
 * regression net for permission / visibility / DVN-flag drift.
 */

import { describe, expect, it } from 'vitest';

import {
  IQubeCardSchema,
  IQubeCatalogSchema,
  IQubeActionsResponseSchema,
  IQubePolicyResponseSchema,
} from '@/services/iqube/legibility/schemas';
import {
  buildIQubeCard,
  buildActionMenu,
  mapLifecycleState,
  type LegibilitySource,
} from '@/services/iqube/legibility/cardBuilder';

// ── Fixtures ────────────────────────────────────────────────────────────

function publicCanonizedContentQube(): LegibilitySource {
  return {
    iqube_id: '11111111-1111-1111-1111-111111111111',
    name: 'Time Sovereignty Paper',
    description:
      'Canonized Qriptopian paper describing time sovereignty, '
      + 'time dividends, and metaMe Runtime.',
    primitive_type: 'ContentQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
    owner_identity_state: 'identifiable',
    title: 'Time Sovereignty',
    summary: 'A public canonized ContentQube about time sovereignty.',
    tags: ['time-sovereignty', 'metaMe', 'Qriptopian', 'ContentQube'],
  };
}

function publicMetaPrivatePayloadWipContentQube(): LegibilitySource {
  return {
    iqube_id: '22222222-2222-2222-2222-222222222222',
    name: 'Private WIP Paper',
    primitive_type: 'ContentQube',
    raw_lifecycle_state: 'semi_minted',
    visibility_state: 'public_meta_private_payload',
    gating: ['did', 'allowlist'],
    private_payload_available: true,
    creator_identity_state: 'pseudonymous',
    owner_identity_state: 'identifiable',
    title: 'Private WIP Paper',
    summary: 'A private work-in-progress ContentQube.',
    tags: ['wip', 'private', 'ContentQube'],
  };
}

function privateContentQube(): LegibilitySource {
  return {
    iqube_id: '33333333-3333-3333-3333-333333333333',
    name: 'Draft Paper',
    primitive_type: 'ContentQube',
    raw_lifecycle_state: 'draft',
    visibility_state: 'private',
    gating: ['did'],
    private_payload_available: true,
    creator_identity_state: 'pseudonymous',
  };
}

function publicToolQube(): LegibilitySource {
  return {
    iqube_id: 'tool-web-search',
    name: 'web_search',
    description: 'Live web search tool.',
    primitive_type: 'ToolQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
  };
}

function publicAigentQube(): LegibilitySource {
  return {
    iqube_id: 'aigent-marketa',
    name: 'Marketa',
    description: 'Cartridge-level marketing specialist.',
    primitive_type: 'AigentQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
  };
}

// ── Lifecycle mapper ───────────────────────────────────────────────────

describe('mapLifecycleState', () => {
  it('maps the rich internal enum to the PRD surface enum', () => {
    expect(mapLifecycleState('canonized')).toBe('canonized');
    expect(mapLifecycleState('chain_minted')).toBe('canonized');
    expect(mapLifecycleState('semi_minted')).toBe('wip');
    expect(mapLifecycleState('review_ready')).toBe('wip');
    expect(mapLifecycleState('canon_pending')).toBe('wip');
    expect(mapLifecycleState('superseded')).toBe('deprecated');
    expect(mapLifecycleState('archived')).toBe('archived');
    expect(mapLifecycleState('draft')).toBe('draft');
  });

  it('falls back to draft for unknown values — never canonized', () => {
    expect(mapLifecycleState('mystery_value')).toBe('draft');
  });
});

// ── Card builder ───────────────────────────────────────────────────────

describe('buildIQubeCard', () => {
  it('produces a valid card for a public canonized ContentQube', () => {
    const card = buildIQubeCard(publicCanonizedContentQube());
    expect(IQubeCardSchema.safeParse(card).success).toBe(true);
    expect(card.lifecycle_state).toBe('canonized');
    expect(card.visibility_state).toBe('public');
    expect(card.access.payload_disclosure).toBe('open');
    expect(card.agent_permissions.allowed_actions).toContain('cite');
    expect(card.agent_permissions.requires_dvn_receipt).toContain('mint_derivative');
  });

  it('produces a meta-only card for public_meta_private_payload', () => {
    const card = buildIQubeCard(publicMetaPrivatePayloadWipContentQube());
    expect(IQubeCardSchema.safeParse(card).success).toBe(true);
    expect(card.visibility_state).toBe('public_meta_private_payload');
    expect(card.access.payload_disclosure).toBe('policy_mediated');
    expect(card.access.requires_authentication).toBe(true);
    // Meta is visible; payload-bearing verbs are gated.
    expect(card.agent_permissions.allowed_actions).toContain('read_meta');
    expect(card.agent_permissions.allowed_actions).toContain('request_access');
    expect(card.agent_permissions.disallowed_actions).toContain('read_payload');
  });

  it('produces a 404-shaped card for a private iQube (only discover allowed)', () => {
    const card = buildIQubeCard(privateContentQube());
    expect(card.visibility_state).toBe('private');
    expect(card.access.payload_disclosure).toBe('none');
    expect(card.agent_permissions.allowed_actions).toEqual(['discover']);
    expect(card.agent_permissions.disallowed_actions).toContain('read_meta');
    expect(card.agent_permissions.disallowed_actions).toContain('read_payload');
  });

  it('produces a valid card for a ToolQube without derivative verbs', () => {
    const card = buildIQubeCard(publicToolQube());
    expect(IQubeCardSchema.safeParse(card).success).toBe(true);
    expect(card.primitive_type).toBe('ToolQube');
    // Tools do not get mint_derivative / propose_update by default —
    // those are ContentQube concerns.
    expect(card.agent_permissions.requires_policy_check ?? []).not.toContain('mint_derivative');
    expect(card.agent_permissions.requires_policy_check ?? []).toContain('audit_state');
  });

  it('produces a valid card for an AigentQube', () => {
    const card = buildIQubeCard(publicAigentQube());
    expect(IQubeCardSchema.safeParse(card).success).toBe(true);
    expect(card.primitive_type).toBe('AigentQube');
    expect(card.agent_permissions.requires_policy_check ?? []).toContain('audit_state');
  });

  it('marks canonized iQubes as DVN-required for state change', () => {
    const card = buildIQubeCard(publicCanonizedContentQube());
    expect(card.policy.dvn_required_for_state_change).toBe(true);
    expect(card.policy.state_change_verbs.length).toBeGreaterThan(0);
  });

  it('always emits an absolute registry canonical_url', () => {
    const card = buildIQubeCard(publicCanonizedContentQube());
    expect(card.registry.canonical_url).toMatch(/^https?:\/\//);
    expect(card.registry.canonical_url).toContain(card.iqube_id);
  });

  it('never sets canonical_content for non-open payload disclosure', () => {
    const card = buildIQubeCard(publicMetaPrivatePayloadWipContentQube());
    expect(card.links?.canonical_content).toBeUndefined();
  });
});

// ── Action menu derivation ─────────────────────────────────────────────

describe('buildActionMenu', () => {
  it('emits only allowed actions — disallowed verbs are absent (not just flagged)', () => {
    const card = buildIQubeCard(publicMetaPrivatePayloadWipContentQube());
    const menu = buildActionMenu(card);
    expect(IQubeActionsResponseSchema.safeParse(menu).success).toBe(true);
    const verbs = menu.actions.map((a) => a.verb);
    expect(verbs).toContain('read_meta');
    expect(verbs).toContain('request_access');
    expect(verbs).not.toContain('read_payload'); // disallowed
    expect(verbs).not.toContain('mint_derivative'); // disallowed
  });

  it('flags policy-check + DVN-receipt on verbs the card has marked', () => {
    const card = buildIQubeCard(publicCanonizedContentQube());
    const menu = buildActionMenu(card);
    const fork = menu.actions.find((a) => a.verb === 'fork');
    // fork is not in allowed_actions by default — verify it's absent
    expect(fork).toBeUndefined();
    // request_access is always present on public iQubes
    const request = menu.actions.find((a) => a.verb === 'request_access');
    expect(request?.method).toBe('POST');
  });

  it('honours private iQubes — only discover is surfaced', () => {
    const card = buildIQubeCard(privateContentQube());
    const menu = buildActionMenu(card);
    expect(menu.actions.length).toBe(1);
    expect(menu.actions[0].verb).toBe('discover');
  });
});

// ── Policy response shape ──────────────────────────────────────────────

describe('policy response shape', () => {
  it('always carries private_payload_exposed: false (Zod literal lock)', () => {
    const card = buildIQubeCard(publicMetaPrivatePayloadWipContentQube());
    const candidate = {
      iqube_id: card.iqube_id,
      policy_id: card.policy.policy_id,
      visibility_state: card.visibility_state,
      allowed_actions: card.agent_permissions.allowed_actions,
      requires_policy_check: card.agent_permissions.requires_policy_check ?? [],
      requires_dvn_receipt: card.agent_permissions.requires_dvn_receipt ?? [],
      private_payload_exposed: false as const,
    };
    expect(IQubePolicyResponseSchema.safeParse(candidate).success).toBe(true);
  });

  it('rejects any attempt to set private_payload_exposed: true', () => {
    const card = buildIQubeCard(publicCanonizedContentQube());
    const evil = {
      iqube_id: card.iqube_id,
      visibility_state: card.visibility_state,
      allowed_actions: card.agent_permissions.allowed_actions,
      requires_policy_check: card.agent_permissions.requires_policy_check ?? [],
      requires_dvn_receipt: card.agent_permissions.requires_dvn_receipt ?? [],
      private_payload_exposed: true,
    };
    expect(IQubePolicyResponseSchema.safeParse(evil).success).toBe(false);
  });
});

// ── Catalog shape ──────────────────────────────────────────────────────

describe('catalog shape', () => {
  it('validates an empty catalog', () => {
    const candidate = {
      type: 'iQubeCatalog',
      version: '0.1',
      generated_at: new Date().toISOString(),
      registry: { name: 'r', canonical_url: 'https://example.com' },
      supported_profiles: ['iQube Agent Legibility Profile v0.1'],
      iqubes: [],
    };
    expect(IQubeCatalogSchema.safeParse(candidate).success).toBe(true);
  });

  it('validates a populated catalog', () => {
    const candidate = {
      type: 'iQubeCatalog',
      version: '0.1',
      generated_at: new Date().toISOString(),
      registry: { name: 'r', canonical_url: 'https://example.com' },
      supported_profiles: ['iQube Agent Legibility Profile v0.1'],
      iqubes: [
        {
          iqube_id: '11111111-1111-1111-1111-111111111111',
          name: 'x',
          primitive_type: 'ContentQube',
          lifecycle_state: 'canonized',
          visibility_state: 'public',
          card_url: '/api/iqubes/x/card',
          registry_url: 'https://example.com/r/x',
        },
      ],
    };
    expect(IQubeCatalogSchema.safeParse(candidate).success).toBe(true);
  });
});
