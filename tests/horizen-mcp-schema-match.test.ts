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
import { matchSchemaFields, findCompatibleTool, schemaFieldOverlapScore, extractFirstJson, extractStringField, describeToolResultShape, extractPartnerMessage, extractStructuredMessageField, firstEmbeddedJsonObject, normalizeMcpSubmissionResult, classifyPulseEnrollmentState } from '@/services/horizen/mcpSchemaMatch';

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

/*
 * normalizeMcpSubmissionResult — Al's brief, 2026-08-06.
 *
 * `enable_pulse_monitoring` answered a genuinely successful call (no
 * `isError`) with 1109 characters of NON-JSON text, and the client discarded
 * the entire response because it found no `submissionRef`/`transactionHash`/
 * `hash`/`id` in a JSON object — then persisted REFUSED for what may have been
 * a completed enablement. Pulse enablement is a registry API call, not
 * necessarily a chain transaction, so there may be no hash to return at all.
 *
 * The invariant these tests pin: a partner mutation is confirmed by
 * AUTHORITATIVE PARTNER STATE, never by the shape of its transport
 * acknowledgement. A reference is useful metadata, never a prerequisite.
 */
describe('normalizeMcpSubmissionResult — a submission reference is metadata, not a prerequisite (2026-08-06)', () => {
  const textResult = (text: string, isError?: boolean) => ({ ...(isError ? { isError } : {}), content: [{ type: 'text', text }] });

  it('accepts a text-only confirmation with NO submission reference at all', () => {
    const n = normalizeMcpSubmissionResult(textResult('Pulse monitoring enabled for agent 8798 on base-sepolia.'));
    expect(n.semanticStatus).toBe('confirmed');
    expect(n.submissionRef).toBeUndefined();
  });

  it('treats "already enabled" idempotently as confirmed, never as an error', () => {
    const n = normalizeMcpSubmissionResult(textResult('Agent 8798 is already enabled for Pulse monitoring; no change made.'));
    expect(n.semanticStatus).toBe('confirmed');
  });

  it('classifies prose "processing" as pending', () => {
    const n = normalizeMcpSubmissionResult(textResult('Your request is being processed and will be applied shortly.'));
    expect(n.semanticStatus).toBe('pending');
  });

  it('classifies a text rejection as rejected', () => {
    const n = normalizeMcpSubmissionResult(textResult('Registry API returned 401 — Invalid signature.'));
    expect(n.semanticStatus).toBe('rejected');
  });

  it('`isError` outranks confirming prose — a tool that reports failure has failed', () => {
    const n = normalizeMcpSubmissionResult(textResult('pulse monitoring enabled', true));
    expect(n.semanticStatus).toBe('rejected');
  });

  it('does NOT read a negated confirmation as success', () => {
    const n = normalizeMcpSubmissionResult(textResult('Pulse monitoring is not enabled for this agent.'));
    expect(n.semanticStatus).not.toBe('confirmed');
  });

  it('leaves genuinely unrecognisable text as unknown — for the reread to settle, never as a failure', () => {
    const n = normalizeMcpSubmissionResult(textResult('Thank you. Reference material is available in the developer portal.'));
    expect(n.semanticStatus).toBe('unknown');
  });

  it('still finds a reference in a JSON response — the pre-existing shape keeps working unchanged', () => {
    const n = normalizeMcpSubmissionResult({ content: [{ type: 'text', text: JSON.stringify({ submissionRef: '0xdeadbeef' }) }] });
    expect(n.submissionRef).toBe('0xdeadbeef');
    expect(n.parsedJsonValues).toHaveLength(1);
  });

  it('finds a reference nested inside a JSON response, and in the newly-searched field names', () => {
    const n = normalizeMcpSubmissionResult({ content: [{ type: 'text', text: JSON.stringify({ result: { requestId: 'req-123' } }) }] });
    expect(n.submissionRef).toBe('req-123');
  });

  it('finds a reference spelled inside PROSE, without requiring the whole body to be JSON', () => {
    // Scoped to what this test is actually about: reference extraction from
    // prose. A bare "Enabled." is deliberately NOT treated as a confirmation —
    // the classifier requires a phrase that names what was enabled, and
    // loosening it to match any stray "enabled" would tune detection to a
    // fixture rather than to the partner's real language.
    const n = normalizeMcpSubmissionResult(textResult('Done. transactionHash: 0xabc123def456 — see the explorer.'));
    expect(n.submissionRef).toBe('0xabc123def456');
    expect(n.semanticStatus).not.toBe('rejected');
  });

  it('parses a `--- structured ---` block inside prose rather than writing the block off as "NOT JSON"', () => {
    const n = normalizeMcpSubmissionResult(
      textResult('Pulse monitoring enabled.\n\n--- structured ---\n' + JSON.stringify({ enabled: true, submissionRef: 'sub-77' })),
    );
    expect(n.parsedJsonValues).toHaveLength(1);
    expect(n.submissionRef).toBe('sub-77');
    expect(n.semanticStatus).toBe('confirmed');
  });

  it('PRESERVES the exact partner text, untruncated — the evidence the old summary threw away', () => {
    // The observed live length. `describeToolResultShape` reduced exactly this
    // to "[0] type=text, NOT JSON (1109 chars)".
    const long = 'Pulse monitoring enabled. ' + 'detail '.repeat(155);
    const n = normalizeMcpSubmissionResult(textResult(long));
    expect(n.partnerMessage).toBe(long);
    expect(n.textBlocks).toEqual([long]);
    expect(n.rawResult).toBeTruthy();
  });

  it('handles an empty/absent result without throwing — unknown, never a crash', () => {
    expect(normalizeMcpSubmissionResult(null).semanticStatus).toBe('unknown');
    expect(normalizeMcpSubmissionResult({}).textBlocks).toEqual([]);
  });
});

/*
 * classifyPulseEnrollmentState — an explicit negative is not the same
 * question as "no answer yet" (operator's follow-up brief, 2026-08-06).
 *
 * A live `get_onboarding_status` reread answered:
 *   ✗ Not enrolled in Pulse monitoring.
 *   Next step: Enroll: build_pulse_auth_message → sign → enable_pulse_monitoring.
 * and the predecessor classifier (a bare `.includes('enabled')` check) filed
 * this as inconclusive-pending, trapping the operator behind a status-check
 * button that could never change the outcome. These tests pin the fix:
 * negation outranks positive keyword matching, and only an EXPLICIT
 * statement — never silence — may resolve to CONFIRMED or NOT_ENROLLED.
 */
describe('classifyPulseEnrollmentState — explicit negative outranks positive substring matching (2026-08-06)', () => {
  it('the exact live transcript resolves to NOT_ENROLLED', () => {
    const text =
      'onboarding status for agent 8798 on base:\n' +
      '✓ registered on-chain — owner 0xa6acb16f7baf5ffe984a67d96c62b686ed6c1709.\n' +
      '✓ indexed in the registry marketplace as "agent #0x225e".\n' +
      '✗ not enrolled in pulse monitoring.\n\n' +
      'next step: enroll: build_pulse_auth_message (action: enable) → sign with the owner wallet → enable_pulse_monitoring.';
    expect(classifyPulseEnrollmentState(text)).toBe('NOT_ENROLLED');
  });

  it('"Next step: Enroll" alone resolves to NOT_ENROLLED, even without the word "not"', () => {
    expect(classifyPulseEnrollmentState('Onboarding incomplete. Next step: Enroll in Pulse monitoring.')).toBe('NOT_ENROLLED');
  });

  it('"not enabled" is NEVER misclassified as CONFIRMED merely because it contains "enabled"', () => {
    expect(classifyPulseEnrollmentState('Pulse monitoring is not enabled for this agent.')).toBe('NOT_ENROLLED');
    expect(classifyPulseEnrollmentState('Pulse monitoring is not enabled for this agent.')).not.toBe('CONFIRMED');
  });

  it('a structured false value resolves to NOT_ENROLLED', () => {
    expect(classifyPulseEnrollmentState('{"agentId":"8798","pulseEnabled":false}')).toBe('NOT_ENROLLED');
    expect(classifyPulseEnrollmentState('{"enrolled": false}')).toBe('NOT_ENROLLED');
  });

  it('an unqualified positive resolves to CONFIRMED', () => {
    expect(classifyPulseEnrollmentState('Pulse monitoring is enabled and active for agent 8798.')).toBe('CONFIRMED');
    expect(classifyPulseEnrollmentState('Agent is already enrolled in Pulse monitoring.')).toBe('CONFIRMED');
  });

  it('genuine processing language remains PENDING_CONVERGENCE, never a conclusion', () => {
    expect(classifyPulseEnrollmentState('Your enrollment request is being processed.')).toBe('PENDING_CONVERGENCE');
    expect(classifyPulseEnrollmentState('Enrollment queued — propagating to the registry.')).toBe('PENDING_CONVERGENCE');
  });

  it('total silence — no conclusive statement at all — defaults to PENDING_CONVERGENCE, never CONFIRMED or NOT_ENROLLED', () => {
    expect(classifyPulseEnrollmentState('Thank you for your request. Reference material is in the developer portal.')).toBe(
      'PENDING_CONVERGENCE',
    );
  });
});

/*
 * ── AUTHORITATIVE pulseEnrolled=true MUST DOMINATE AN UNRELATED CAPABILITY'S
 * OWN "next step" (Aigent Nakamoto, 2026-08-08) ─────────────────────────────
 *
 * A live get_onboarding_status response reports on MULTIPLE independent
 * capabilities in ONE blob — Pulse and Verifiable PnL. The exact operator
 * regression fixture: pulseEnrolled:true, pulseCommitmentRecorded:true,
 * nextStep:"Onboarding complete. Verified receipts appear as Pulse proves
 * uptime windows." — genuinely Pulse-positive. But the SAME response also
 * names Verifiable PnL's OWN, independent, genuinely-still-pending next step
 * ("Next step: Enroll ... Verifiable PnL" — see services/horizen/
 * evidenceChain.ts's verifiablePnlLink, unaffected by this fix). Before this
 * fix, that unrelated sentence's bare "next step: enroll" vetoed Pulse's own
 * positive evidence a few lines away — reproduced below, FAILING before the
 * fix (classified NOT_ENROLLED), passing after (CONFIRMED).
 */
describe('classifyPulseEnrollmentState — an unrelated capability\'s own "next step" must not veto Pulse\'s (2026-08-08)', () => {
  it('the exact operator regression fixture: Pulse positive + PnL\'s own unrelated "next step: enroll" in the same response', () => {
    const text =
      'pulseEnrolled: true\n' +
      'pulseCommitmentRecorded: true\n' +
      'Next step: Onboarding complete. Verified receipts appear as Pulse proves uptime windows.\n' +
      'Next step: Enroll to unlock Verifiable PnL reporting.';
    expect(classifyPulseEnrollmentState(text)).toBe('CONFIRMED');
  });

  it('the same fixture, with the two capabilities in the opposite order', () => {
    const text =
      'Verifiable PnL: not registered. Next step: Enroll in Verifiable PnL through the Horizen dashboard.\n' +
      '✓ Enrolled in Pulse monitoring\n' +
      '✓ On-chain identity commitment recorded\n' +
      'Next step: Onboarding complete.';
    expect(classifyPulseEnrollmentState(text)).toBe('CONFIRMED');
  });

  it('preserved exactly: a bare structured false with NO capability label at all is still NOT_ENROLLED (no PnL label anywhere to misattribute it to)', () => {
    expect(classifyPulseEnrollmentState('{"enrolled": false}')).toBe('NOT_ENROLLED');
  });

  it('preserved exactly: a GENUINE Pulse-specific negative right next to a PnL mention still resolves NOT_ENROLLED — this narrows false positives, it never widens what counts as a Pulse negative', () => {
    const text = 'Pulse monitoring: not enrolled. Next step: Enroll in Pulse monitoring. Verifiable PnL: also not registered.';
    expect(classifyPulseEnrollmentState(text)).toBe('NOT_ENROLLED');
  });

  it('preserved exactly: the existing live-transcript and "Next step: Enroll in Pulse monitoring" canaries above are unaffected (no PnL mention in either)', () => {
    expect(classifyPulseEnrollmentState('Onboarding incomplete. Next step: Enroll in Pulse monitoring.')).toBe('NOT_ENROLLED');
  });
});
