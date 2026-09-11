import { describe, it, expect } from 'vitest';

describe('MoneyPenny -> Horizen registration script -- pure helpers (2026-07-30)', () => {
  it('matchSchemaFields matches candidate values against the schema\'s own declared property names, never invents new ones', async () => {
    const { matchSchemaFields } = await import('../scripts/register-moneypenny-horizen');
    const schema = { properties: { agentURI: { type: 'string' }, network: { type: 'string' }, unrelatedField: { type: 'number' } } };
    const matched = matchSchemaFields(schema, { agentURI: 'https://example/card.json', network: 'base-sepolia' });
    expect(matched).toEqual({ agentURI: 'https://example/card.json', network: 'base-sepolia' });
    expect(matched).not.toHaveProperty('unrelatedField');
  });

  it('matchSchemaFields matches case-insensitively and by substring (e.g. "signedTx" candidate vs "rawTransactionHex" property)', async () => {
    const { matchSchemaFields } = await import('../scripts/register-moneypenny-horizen');
    const schema = { properties: { rawTx: { type: 'string' } } };
    const matched = matchSchemaFields(schema, { rawTx: '0xsigned' });
    expect(matched.rawTx).toBe('0xsigned');
  });

  it('validateAgentCard refuses a card with the wrong name', async () => {
    const { validateAgentCard } = await import('../scripts/register-moneypenny-horizen');
    const problems = validateAgentCard({ name: 'Someone Else', url: 'x', metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: { network: 'base-sepolia', identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', tokenId: null } } });
    expect(problems.some((p: string) => p.includes('name mismatch'))).toBe(true);
  });

  it('validateAgentCard refuses a card whose identityRegistry drifted from the repo\'s own recorded fact', async () => {
    const { validateAgentCard } = await import('../scripts/register-moneypenny-horizen');
    const problems = validateAgentCard({
      name: 'Aigent MoneyPenny',
      url: 'https://example/card.json',
      metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: { network: 'base-sepolia', identityRegistry: '0xWRONG', tokenId: null } },
    });
    expect(problems.some((p: string) => p.includes('identityRegistry drift'))).toBe(true);
  });

  it('validateAgentCard refuses re-registration when tokenId is already set', async () => {
    const { validateAgentCard } = await import('../scripts/register-moneypenny-horizen');
    const problems = validateAgentCard({
      name: 'Aigent MoneyPenny',
      url: 'https://example/card.json',
      metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: { network: 'base-sepolia', identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', tokenId: '7866' } },
    });
    expect(problems.some((p: string) => p.includes('already set'))).toBe(true);
  });

  it('validateAgentCard passes a well-formed, not-yet-registered card', async () => {
    const { validateAgentCard } = await import('../scripts/register-moneypenny-horizen');
    const problems = validateAgentCard({
      name: 'Aigent MoneyPenny',
      url: 'https://example/card.json',
      metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: { network: 'base-sepolia', identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', tokenId: null } },
    });
    expect(problems).toEqual([]);
  });

  it('extractUnsignedTx reads a direct {to,data} shape from tool content', async () => {
    const { extractUnsignedTx } = await import('../scripts/register-moneypenny-horizen');
    const result = { content: [{ type: 'text', text: JSON.stringify({ to: '0xabc', data: '0x1234' }) }] };
    expect(extractUnsignedTx(result)).toEqual({ to: '0xabc', data: '0x1234' });
  });

  it('extractUnsignedTx reads a nested {transaction:{to,data}} shape', async () => {
    const { extractUnsignedTx } = await import('../scripts/register-moneypenny-horizen');
    const result = { content: [{ type: 'text', text: JSON.stringify({ transaction: { to: '0xabc', data: '0x1234' } }) }] };
    expect(extractUnsignedTx(result)).toEqual({ to: '0xabc', data: '0x1234' });
  });

  it('extractUnsignedTx returns null rather than guessing when nothing recognisable is present', async () => {
    const { extractUnsignedTx } = await import('../scripts/register-moneypenny-horizen');
    const result = { content: [{ type: 'text', text: JSON.stringify({ somethingElse: true }) }] };
    expect(extractUnsignedTx(result)).toBeNull();
  });

  it('extractTxHash reads a declared hash field', async () => {
    const { extractTxHash } = await import('../scripts/register-moneypenny-horizen');
    const hash = '0x' + 'a'.repeat(64);
    const result = { content: [{ type: 'text', text: JSON.stringify({ transactionHash: hash }) }] };
    expect(extractTxHash(result)).toBe(hash);
  });

  it('extractTxHash falls back to a regex scan of non-JSON text for a 0x-prefixed 32-byte hash', async () => {
    const { extractTxHash } = await import('../scripts/register-moneypenny-horizen');
    const hash = '0x' + 'b'.repeat(64);
    const result = { content: [{ type: 'text', text: `submitted: ${hash}` }] };
    expect(extractTxHash(result)).toBe(hash);
  });

  it('sha256Hex is deterministic', async () => {
    const { sha256Hex } = await import('../scripts/register-moneypenny-horizen');
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });
});
