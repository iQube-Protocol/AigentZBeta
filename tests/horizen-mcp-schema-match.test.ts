/**
 * services/horizen/mcpSchemaMatch.ts — the shared tool-discovery mechanics
 * extracted from scripts/register-moneypenny-horizen.ts. Covers both the
 * legacy `matchSchemaFields` behaviour (regression-pinned, since
 * tests/register-moneypenny-horizen.test.ts imports it via the script's
 * re-export) and the new `findCompatibleTool` role-based discovery GJR-VFY-001
 * Phase 1 needs — exact-name match first, schema-shape fallback second,
 * honest "not found" refusal third, never a fabricated tool.
 */

import { describe, it, expect } from 'vitest';
import { matchSchemaFields, findCompatibleTool, schemaFieldOverlapScore, extractFirstJson, extractStringField, describeToolResultShape, extractPartnerMessage, extractStructuredMessageField, firstEmbeddedJsonObject } from '@/services/horizen/mcpSchemaMatch';

describe('matchSchemaFields (regression-pinned — the register-moneypenny-horizen.ts precedent)', () => {
  it('matches candidate values against the schema\'s own declared property names, never inventing new ones', () => {
    const schema = { properties: { agentURI: { type: 'string' }, network: { type: 'string' } } };
    const matched = matchSchemaFields(schema, { agentURI: 'https://example/card.json', network: 'base-sepolia' });
    expect(matched).toEqual({ agentURI: 'https://example/card.json', network: 'base-sepolia' });
  });

  it('matches case-insensitively and by substring', () => {
    const schema = { properties: { transactionHash: { type: 'string' } } };
    const matched = matchSchemaFields(schema, { HASH: '0xabc' });
    expect(matched).toEqual({ transactionHash: '0xabc' });
  });

  it('never invents a property absent from the schema', () => {
    const matched = matchSchemaFields({ properties: {} }, { agentURI: 'x' });
    expect(matched).toEqual({});
  });
});

describe('findCompatibleTool — exact-name match', () => {
  it('picks the tool whose name matches a provisional label, case-insensitively', () => {
    const tools = [
      { name: 'Build_Pulse_Auth_Message', inputSchema: { properties: { tokenId: {} } } },
      { name: 'unrelated_tool', inputSchema: { properties: {} } },
    ];
    const result = findCompatibleTool(tools, { role: 'build', nameCandidates: ['build_pulse_auth_message'], requiredFieldHints: ['tokenid'] }, new Set());
    expect(result).toMatchObject({ ok: true, tool: { name: 'Build_Pulse_Auth_Message' } });
  });
});

describe('findCompatibleTool — schema-shape fallback', () => {
  it('finds a compatible tool by property-name overlap when no name matches a provisional label', () => {
    const tools = [
      { name: 'issue_transparency_auth_payload', inputSchema: { properties: { agentId: {}, network: {}, walletAddress: {} } } },
      { name: 'unrelated', inputSchema: { properties: { foo: {} } } },
    ];
    const result = findCompatibleTool(
      tools,
      { role: 'build', nameCandidates: ['build_pulse_auth_message'], requiredFieldHints: ['tokenid', 'agentid', 'network', 'wallet'] },
      new Set(),
    );
    expect(result).toMatchObject({ ok: true, tool: { name: 'issue_transparency_auth_payload' } });
  });

  it('prefers the tool with the higher field-overlap score', () => {
    const weak = { name: 'weak', inputSchema: { properties: { network: {} } } };
    const strong = { name: 'strong', inputSchema: { properties: { agentId: {}, network: {}, walletAddress: {} } } };
    const result = findCompatibleTool([weak, strong], { role: 'build', nameCandidates: [], requiredFieldHints: ['tokenid', 'agentid', 'network', 'wallet'] }, new Set());
    expect(result).toMatchObject({ ok: true, tool: { name: 'strong' } });
  });

  it('never claims a tool already claimed by another role', () => {
    const tools = [{ name: 'only_tool', inputSchema: { properties: { agentId: {}, network: {} } } }];
    const result = findCompatibleTool(tools, { role: 'submit', nameCandidates: [], requiredFieldHints: ['agentid', 'network'] }, new Set(['only_tool']));
    expect(result.ok).toBe(false);
  });
});

describe('findCompatibleTool — honest refusal', () => {
  it('refuses with the declared tool list rather than fabricating a match', () => {
    const tools = [{ name: 'totally_unrelated', inputSchema: { properties: { foo: {} } } }];
    const result = findCompatibleTool(tools, { role: 'build', nameCandidates: ['build_pulse_auth_message'], requiredFieldHints: ['tokenid', 'agentid'] }, new Set());
    expect(result).toEqual({ ok: false, role: 'build', declaredToolNames: ['totally_unrelated'] });
  });
});

describe('extractFirstJson / extractStringField', () => {
  it('extracts a JSON object from a text content block', () => {
    const result = extractFirstJson({ content: [{ type: 'text', text: '{"message":"sign this"}' }] });
    expect(result).toEqual({ message: 'sign this' });
  });

  it('extractStringField finds the first matching field name', () => {
    const result = extractStringField({ content: [{ type: 'text', text: '{"authMessage":"sign this exact text"}' }] }, ['message', 'authMessage']);
    expect(result).toBe('sign this exact text');
  });

  it('returns null rather than guessing when no field matches', () => {
    const result = extractStringField({ content: [{ type: 'text', text: '{"somethingElse":"x"}' }] }, ['message']);
    expect(result).toBeNull();
  });
});

describe('schemaFieldOverlapScore', () => {
  it('counts case-insensitive substring hits only', () => {
    expect(schemaFieldOverlapScore({ properties: { tokenId: {}, network: {}, unrelated: {} } }, ['tokenid', 'network'])).toBe(2);
    expect(schemaFieldOverlapScore({ properties: {} }, ['tokenid'])).toBe(0);
  });
});

describe('describeToolResultShape — a refusal that can be acted on (2026-08-03)', () => {
  /*
   * Verify refused with `"build_pulse_auth_message" did not return a
   * recognisable message field — refusing rather than inventing one`. The
   * refusal is correct (a guessed field could put an error string in front of
   * the operator's key) but it named only what we failed to find, never what
   * the partner actually sent — so there was no way to tell plain-text from
   * nested-JSON from a different field name without partner source.
   */
  it('names the top-level keys when the tool returned a JSON object', () => {
    const shape = describeToolResultShape({
      content: [{ type: 'text', text: JSON.stringify({ result: { msg: 'sign me' } }) }],
    });
    expect(shape).toContain('JSON object with keys: result');
  });

  it('says explicitly when the text is NOT JSON — the plain-string case', () => {
    const shape = describeToolResultShape({ content: [{ type: 'text', text: 'Please sign: 0xabc' }] });
    expect(shape).toContain('NOT JSON');
  });

  it('reports a missing content array rather than throwing', () => {
    expect(describeToolResultShape({} as never)).toContain('no content array');
    expect(describeToolResultShape(null)).toContain('no result object');
    expect(describeToolResultShape({ content: [] })).toContain('empty array');
  });

  it('never leaks partner VALUES — only shapes and key names', () => {
    const secret = 'SUPER-SECRET-PAYLOAD-VALUE';
    const shape = describeToolResultShape({
      content: [{ type: 'text', text: JSON.stringify({ token: secret }) }],
    });
    expect(shape).toContain('token');
    expect(shape, 'a diagnostic must not become an exfiltration channel').not.toContain(secret);
  });
});

describe('extractPartnerMessage — Horizen returns the message as plain text (2026-08-03)', () => {
  /*
   * The diagnostic refusal produced the evidence in one attempt:
   *   Actually returned: [0] type=text, NOT JSON (265 chars)
   * One text block, not JSON — the message itself, returned directly. MCP
   * defines a result's `content` AS its return value and carries `isError`
   * separately, so reading a non-error sole text block as the answer follows
   * the protocol rather than guessing a convention.
   */
  const FIELDS = ['message', 'payload', 'authMessage', 'messageToSign', 'authorizationMessage'];

  it('accepts a lone non-JSON text block — the real Horizen shape', () => {
    const msg = 'Authorize Pulse monitoring for agent 8798 on base-sepolia. Nonce: abc123.';
    const r = extractPartnerMessage({ content: [{ type: 'text', text: msg }] }, FIELDS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.message).toBe(msg);
      expect(r.via).toBe('sole-text-block');
    }
  });

  it('still PREFERS a named field when the tool returns structured JSON', () => {
    const r = extractPartnerMessage(
      { content: [{ type: 'text', text: JSON.stringify({ message: 'from-field' }) }] },
      FIELDS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBe('named-field');
  });

  it('REFUSES when the tool reported isError — an error body is never a message to sign', () => {
    const r = extractPartnerMessage(
      { isError: true, content: [{ type: 'text', text: 'tokenId 8798 not found' }] },
      FIELDS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('isError');
  });

  it('REFUSES two text blocks as ambiguous rather than choosing one', () => {
    const r = extractPartnerMessage(
      { content: [{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }] },
      FIELDS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('ambiguous');
  });

  it('REFUSES JSON that names none of the expected fields — never signs raw source', () => {
    const r = extractPartnerMessage(
      { content: [{ type: 'text', text: JSON.stringify({ unexpected: 'shape' }) }] },
      FIELDS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('raw source');
  });

  /*
   * THE DEFECT CLASS UNDER LIVE INVESTIGATION (Horizen engineer's live-probe
   * escalation, 2026-08-05): a response that is prose + an "ASR Pulse
   * enable" body + a `--- structured ---` marker + a trailing JSON object
   * naming `message`. This whole blob fails `JSON.parse` (it isn't bare
   * JSON), so the named-field path here finds nothing and the sole-text-block
   * fallback accepts the ENTIRE blob — preamble and all — as the message to
   * sign. `extractStructuredMessageField` (below) is what a caller uses to
   * catch this: it looks PAST the marker for the JSON's own `message` field.
   */
  it('sole-text-block accepts the FULL preamble+ASR+structured blob when the whole thing is not bare JSON — the exact shape extractStructuredMessageField exists to catch', () => {
    const blob =
      'Sign this message with wallet 0x24bb… then call enable_pulse_monitoring with the signature and issuedAt="2026-08-05T00:00:00.000Z".\n' +
      'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\nIssued At: 2026-08-05T00:00:00.000Z\n' +
      '--- structured ---\n' +
      JSON.stringify({ message: 'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\nIssued At: 2026-08-05T00:00:00.000Z' });
    const r = extractPartnerMessage({ content: [{ type: 'text', text: blob }] }, FIELDS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.via).toBe('sole-text-block');
      // The bug shape: the ENTIRE blob, not the JSON's own message field.
      expect(r.message).toBe(blob);
      expect(r.message).toContain('Sign this message with wallet');
      expect(r.message).toContain('--- structured ---');
    }
  });
});

describe('firstEmbeddedJsonObject — brace-balanced, marker-aware extraction', () => {
  it('finds the JSON object after a "--- structured ---" marker, ignoring braces in the prose above it', () => {
    const text = 'Some prose with a stray { brace.\n--- structured ---\n' + JSON.stringify({ message: 'the real message', foo: 'bar' });
    expect(firstEmbeddedJsonObject(text)).toEqual({ message: 'the real message', foo: 'bar' });
  });

  it('returns null when no JSON object is embedded at all', () => {
    expect(firstEmbeddedJsonObject('just plain prose, no braces here')).toBeNull();
  });
});

describe('extractStructuredMessageField — the message named INSIDE embedded JSON, distinct from the whole-blob fallback (2026-08-05)', () => {
  const FIELDS = ['message', 'payload', 'authMessage', 'messageToSign', 'authorizationMessage'];

  it('extracts the structured message field from a preamble+ASR+marker+JSON blob — the exact case extractPartnerMessage cannot distinguish', () => {
    const structuredMessage = 'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\nIssued At: 2026-08-05T00:00:00.000Z';
    const blob =
      'Sign this message with wallet 0x24bb… then call enable_pulse_monitoring with the signature.\n' +
      'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\nIssued At: 2026-08-05T00:00:00.000Z\n' +
      '--- structured ---\n' +
      JSON.stringify({ message: structuredMessage });

    const r = extractStructuredMessageField({ content: [{ type: 'text', text: blob }] }, FIELDS);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.message).toBe(structuredMessage);
      expect(r.markerPresent).toBe(true);
      // This is the divergence a drift check compares against — it must NOT
      // equal the whole rendered blob extractPartnerMessage would fall back to.
      expect(r.message).not.toContain('Sign this message with wallet');
    }
  });

  it('reports not-found, naming why, when no embedded JSON object exists at all', () => {
    const r = extractStructuredMessageField({ content: [{ type: 'text', text: 'plain text, no JSON anywhere' }] }, FIELDS);
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.markerPresent).toBe(false);
      expect(r.reason).toContain('no text block contained an embedded JSON object');
    }
  });

  it('reports not-found when a marker is present but the embedded JSON names none of the expected fields', () => {
    const blob = 'prose\n--- structured ---\n' + JSON.stringify({ unexpected: 'shape' });
    const r = extractStructuredMessageField({ content: [{ type: 'text', text: blob }] }, FIELDS);
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.markerPresent).toBe(true);
      expect(r.reason).toContain('none of');
    }
  });

  it('agrees with extractPartnerMessage when the response is bare JSON with a named field — no drift on the existing, already-working shape', () => {
    const bare = { content: [{ type: 'text', text: JSON.stringify({ message: 'ASR Pulse enable\nAgent: 8798' }) }] };
    const viaPartner = extractPartnerMessage(bare, FIELDS);
    const viaStructured = extractStructuredMessageField(bare, FIELDS);
    expect(viaPartner.ok).toBe(true);
    expect(viaStructured.found).toBe(true);
    if (viaPartner.ok && viaStructured.found) {
      expect(viaStructured.message).toBe(viaPartner.message);
    }
  });
});

describe('an isError body is shown, not summarised away (2026-08-03)', () => {
  /*
   * Third instance of the same defect in one day: an honest refusal that
   * discards the one field explaining itself. The isError guard correctly
   * stopped an error string reaching the operator's key — and then the
   * shape-only description hid WHY, leaving "[0] type=text, NOT JSON (265
   * chars)" as the entire diagnosis.
   *
   * The no-values rule protects a SUCCESS payload. An error body is
   * diagnostic output — it exists to be read.
   */
  it('includes the error text verbatim when isError is set', () => {
    const shape = describeToolResultShape({
      isError: true,
      content: [{ type: 'text', text: 'Agent 8798 is not owned by the calling wallet' }],
    });
    expect(shape).toContain('tool-reported error');
    expect(shape).toContain('Agent 8798 is not owned by the calling wallet');
  });

  it('still withholds VALUES from a successful payload — the rule is unchanged there', () => {
    const secret = 'SUPER-SECRET-PAYLOAD-VALUE';
    const shape = describeToolResultShape({ content: [{ type: 'text', text: JSON.stringify({ token: secret }) }] });
    expect(shape).toContain('token');
    expect(shape).not.toContain(secret);
  });

  it('bounds a very long error rather than dumping it whole', () => {
    const shape = describeToolResultShape({ isError: true, content: [{ type: 'text', text: 'x'.repeat(5000) }] });
    expect(shape).toContain('chars total');
    expect(shape.length).toBeLessThan(2200);
  });

  it('falls back to shape when isError is set but carries no text', () => {
    const shape = describeToolResultShape({ isError: true, content: [{ type: 'image' } as never] });
    expect(shape).toContain('type=image');
  });
});
