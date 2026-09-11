/**
 * AigentQube governance tests.
 *
 * Stage 7 C29. Asserts:
 *   1. AigentQube cards carry an agent_governance block
 *   2. Non-AigentQube cards (ContentQube / ToolQube / DataQube / ClusterQube)
 *      omit agent_governance entirely
 *   3. Governance block round-trips through Zod validation
 *   4. T0 sentinels NEVER appear in the serialised card (extends the
 *      existing iqube-legibility-actionmap pattern to the new field)
 *   5. Default governance defaults match PRD v1.1 §B.6:
 *        - payment_authority is NULL
 *        - must_disclose_as_agent is true
 *        - trust_band is 0
 *        - revocable_by is ['platform_admin']
 */

import { describe, expect, it } from 'vitest';

import { buildIQubeCard, type LegibilitySource } from '@/services/iqube/legibility/cardBuilder';
import { IQubeCardSchema, IQubeAgentGovernanceSchema } from '@/services/iqube/legibility/schemas';
import type { IQubeAgentGovernance } from '@/types/iqube/legibility';

const T0_SENTINELS = {
  personaId: 'T0-SENTINEL-PERSONA-aigent-test',
  authProfileId: 'T0-SENTINEL-AUTH-PROFILE-aigent-test',
  rootDid: 'did:fio:T0-SENTINEL-ROOT-DID-aigent-test',
};

function aigentSource(overrides: Partial<LegibilitySource> = {}): LegibilitySource {
  return {
    iqube_id: 'aigent-test-marketa',
    name: 'Test Marketa',
    description: 'Stage 7 governance smoke test',
    primitive_type: 'AigentQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
    owner_identity_state: 'identifiable',
    title: 'Test Marketa',
    summary: 'governance smoke',
    tags: ['aigent', 'specialist'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function contentSource(): LegibilitySource {
  return {
    iqube_id: '00000000-0000-4000-8000-000000000007',
    name: 'Test ContentQube',
    primitive_type: 'ContentQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'pseudonymous',
    owner_identity_state: 'pseudonymous',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('aigent-governance: card population by primitive', () => {
  it('AigentQube cards carry agent_governance', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance).toBeDefined();
    expect(card.agent_governance?.root_agent_id).toBe('aigent-test-marketa');
  });

  it('ContentQube cards do NOT carry agent_governance', () => {
    const card = buildIQubeCard(contentSource());
    expect(card.agent_governance).toBeUndefined();
  });

  it('ToolQube cards do NOT carry agent_governance', () => {
    const card = buildIQubeCard(
      aigentSource({
        iqube_id: 'tool-test',
        primitive_type: 'ToolQube',
      }),
    );
    expect(card.agent_governance).toBeUndefined();
  });
});

describe('aigent-governance: default values per PRD v1.1 §B.6', () => {
  it('payment_authority defaults to undefined (NULL)', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.rights.payment_authority).toBeUndefined();
  });

  it('must_disclose_as_agent defaults to true', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.constraints.must_disclose_as_agent).toBe(true);
  });

  it('trust_band defaults to 0 (KNYT framework §14 entry tier)', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.obligations.trust_band).toBe(0);
  });

  it('charter_accepted defaults to false', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.obligations.charter_accepted).toBe(false);
  });

  it('revocable_by defaults to [platform_admin]', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.revocation.revocable_by).toEqual(['platform_admin']);
  });

  it('revocation_receipt_required defaults to true', () => {
    const card = buildIQubeCard(aigentSource());
    expect(card.agent_governance?.revocation.revocation_receipt_required).toBe(true);
  });

  it('mutating actions are in requires_human_approval until charter accepted', () => {
    const card = buildIQubeCard(aigentSource());
    const approval = card.agent_governance?.constraints.requires_human_approval ?? [];
    expect(approval).toContain('mint_derivative');
    expect(approval).toContain('fork');
    expect(approval).toContain('revoke_access');
  });
});

describe('aigent-governance: source override beats default', () => {
  const customGovernance: IQubeAgentGovernance = {
    root_agent_id: 'aigent-test-marketa',
    deployment_id: 'depl-test-1',
    persona_alias_commitment: 'T2-alias-commitment-abc',
    rights: {
      allowed_actions: ['discover', 'read_meta', 'transform', 'request_access'],
      cartridge_scopes: ['marketa', 'knyt-codex'],
      tool_scopes: ['tool-web-search'],
      data_scopes: [],
      payment_authority: {
        currency: 'qc',
        max_amount_per_tx: 100,
      },
    },
    constraints: {
      prohibited_actions: ['revoke_access'],
      prohibited_cartridges: [],
      must_disclose_as_agent: true,
      requires_human_approval: ['mint_derivative'],
    },
    obligations: {
      receipt_required_for: ['transform', 'mint_derivative'],
      charter_accepted: true,
      charter_version: '1.0',
      trust_band: 2,
    },
    revocation: {
      revocable_by: ['platform_admin', 'cartridge_admin'],
      revocation_receipt_required: true,
    },
  };

  it('source-provided governance is preserved verbatim', () => {
    const card = buildIQubeCard(aigentSource({ agent_governance: customGovernance }));
    expect(card.agent_governance).toEqual(customGovernance);
  });

  it('source-provided trust_band overrides the default 0', () => {
    const card = buildIQubeCard(aigentSource({ agent_governance: customGovernance }));
    expect(card.agent_governance?.obligations.trust_band).toBe(2);
  });

  it('source-provided payment_authority is preserved', () => {
    const card = buildIQubeCard(aigentSource({ agent_governance: customGovernance }));
    expect(card.agent_governance?.rights.payment_authority?.currency).toBe('qc');
    expect(card.agent_governance?.rights.payment_authority?.max_amount_per_tx).toBe(100);
  });
});

describe('aigent-governance: T0 leak guard', () => {
  it('default governance never serialises a T0 sentinel', () => {
    const card = buildIQubeCard(aigentSource());
    const json = JSON.stringify(card);
    for (const [name, sentinel] of Object.entries(T0_SENTINELS)) {
      expect(
        json.includes(sentinel),
        `Default AigentQube card leaked T0 sentinel ${name}: ${sentinel}`,
      ).toBe(false);
    }
  });

  it('source carrying T0 sentinels in unrelated fields still produces a clean governance block', () => {
    // Hostile source: T0 markers placed where they shouldn't matter.
    // The governance block is built from public fields only — sentinels
    // in description / summary should not propagate into agent_governance.
    const card = buildIQubeCard(
      aigentSource({
        description: T0_SENTINELS.personaId, // Hostile content in description
      }),
    );
    const governanceJson = JSON.stringify(card.agent_governance);
    for (const [name, sentinel] of Object.entries(T0_SENTINELS)) {
      expect(
        governanceJson.includes(sentinel),
        `Governance block leaked T0 sentinel ${name} from description`,
      ).toBe(false);
    }
  });
});

describe('aigent-governance: Zod schema round-trip', () => {
  it('default governance passes IQubeAgentGovernanceSchema', () => {
    const card = buildIQubeCard(aigentSource());
    const parsed = IQubeAgentGovernanceSchema.safeParse(card.agent_governance);
    expect(parsed.success).toBe(true);
  });

  it('full card with agent_governance passes IQubeCardSchema', () => {
    const card = buildIQubeCard(aigentSource());
    const parsed = IQubeCardSchema.safeParse(card);
    expect(parsed.success).toBe(true);
  });

  it('non-AigentQube card passes IQubeCardSchema without agent_governance', () => {
    const card = buildIQubeCard(contentSource());
    const parsed = IQubeCardSchema.safeParse(card);
    expect(parsed.success).toBe(true);
    expect((parsed.success ? parsed.data : null)?.agent_governance).toBeUndefined();
  });

  it('Zod rejects an invalid trust_band value (e.g. 5)', () => {
    const card = buildIQubeCard(aigentSource());
    const tampered = {
      ...card.agent_governance,
      obligations: { ...card.agent_governance!.obligations, trust_band: 5 as any },
    };
    expect(IQubeAgentGovernanceSchema.safeParse(tampered).success).toBe(false);
  });

  it('Zod rejects an invalid payment_authority currency (e.g. "btc")', () => {
    const card = buildIQubeCard(aigentSource());
    const tampered = {
      ...card.agent_governance,
      rights: {
        ...card.agent_governance!.rights,
        payment_authority: { currency: 'btc' as any, max_amount_per_tx: 10 },
      },
    };
    expect(IQubeAgentGovernanceSchema.safeParse(tampered).success).toBe(false);
  });
});
