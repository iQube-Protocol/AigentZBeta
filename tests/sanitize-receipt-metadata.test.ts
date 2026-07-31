/**
 * Canary tests for sanitizeReceiptMetadata.
 *
 * The orchestrator-emitted receipts MUST NOT carry T0 fields. This test
 * asserts the stripping contract end-to-end — every forbidden key gets
 * removed at any depth, T1 transforms run, T2 fields pass through, and
 * the recursive walk handles nested objects + arrays.
 *
 * Mirrors the pattern of tests/persona-broadcast-handshake.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeReceiptMetadata,
  buildChainReceiptMetadata,
} from '@/services/orchestration/sanitizeReceiptMetadata';

describe('sanitizeReceiptMetadata — T0 strip', () => {
  it('strips every CLAUDE.md forbidden field at the top level', () => {
    const input = {
      personaId: 'p1',
      persona_id: 'p2',
      initiated_by_persona_id: 'p3',
      rated_by_persona_id: 'p4',
      payee_persona_id: 'p5',
      creator_persona_id: 'p6',
      authProfileId: 'a1',
      auth_profile_id: 'a2',
      rootDid: 'did:fio:bob@knight',
      root_did: 'did:fio:alice',
      kybeAttestation: 'KYC_PASSED',
      kybe_attestation: 'KYC_PASSED',
      fioHandle: 'someone@else',
      fio_handle: 'cross_persona',
      recipient: 'partner@example.com',
      recipient_email: 'partner@example.com',
      // T2 — should survive
      chain_id: 'c1',
      template_id: 't1',
      actor_alias_commitment: 'sha256_hash',
    };
    const out = sanitizeReceiptMetadata(input);
    // T0 stripped
    for (const k of [
      'personaId',
      'persona_id',
      'initiated_by_persona_id',
      'rated_by_persona_id',
      'payee_persona_id',
      'creator_persona_id',
      'authProfileId',
      'auth_profile_id',
      'rootDid',
      'root_did',
      'kybeAttestation',
      'kybe_attestation',
      'fioHandle',
      'fio_handle',
      'recipient',
      'recipient_email',
    ]) {
      expect(out).not.toHaveProperty(k);
    }
    // T2 preserved
    expect(out.chain_id).toBe('c1');
    expect(out.template_id).toBe('t1');
    expect(out.actor_alias_commitment).toBe('sha256_hash');
  });

  it('strips T0 fields nested inside an object', () => {
    const input = {
      chain_id: 'c1',
      actor: {
        actor_alias_commitment: 'safe',
        persona_id: 'leak',
      },
    };
    const out = sanitizeReceiptMetadata(input);
    expect((out.actor as Record<string, unknown>).actor_alias_commitment).toBe('safe');
    expect((out.actor as Record<string, unknown>).persona_id).toBeUndefined();
  });

  it('strips T0 fields inside an array of objects', () => {
    const input = {
      chain_id: 'c1',
      participants: [
        { alias_commitment: 'a1', persona_id: 'leak1' },
        { alias_commitment: 'a2', persona_id: 'leak2' },
      ],
    };
    const out = sanitizeReceiptMetadata(input);
    const parts = out.participants as Array<Record<string, unknown>>;
    expect(parts[0].alias_commitment).toBe('a1');
    expect(parts[0].persona_id).toBeUndefined();
    expect(parts[1].alias_commitment).toBe('a2');
    expect(parts[1].persona_id).toBeUndefined();
  });
});

describe('sanitizeReceiptMetadata — T1 transforms', () => {
  it('replaces feedback comment with comment_present bool', () => {
    const out = sanitizeReceiptMetadata({
      chain_id: 'c1',
      rating: 'dislike',
      comment: 'The proposal had factual errors.',
    });
    expect(out).not.toHaveProperty('comment');
    expect(out.comment_present).toBe(true);
    expect(out.rating).toBe('dislike');
  });

  it('comment_present is false for empty / whitespace comment', () => {
    expect(sanitizeReceiptMetadata({ comment: '' }).comment_present).toBe(false);
    expect(sanitizeReceiptMetadata({ comment: '   ' }).comment_present).toBe(false);
    expect(sanitizeReceiptMetadata({ comment: null }).comment_present).toBe(false);
  });

  it('truncates error_message to 200 chars', () => {
    const long = 'X'.repeat(500);
    const out = sanitizeReceiptMetadata({ error_message: long });
    expect((out.error_message as string).length).toBeLessThanOrEqual(201); // 200 + ellipsis
    expect((out.error_message as string).endsWith('…')).toBe(true);
  });

  it('truncates description to 500 chars', () => {
    const long = 'D'.repeat(800);
    const out = sanitizeReceiptMetadata({ description: long });
    expect((out.description as string).length).toBeLessThanOrEqual(501);
  });
});

describe('sanitizeReceiptMetadata — string truncation', () => {
  it('truncates strings beyond the configured limit', () => {
    const out = sanitizeReceiptMetadata(
      { chain_id: 'c1', note: 'A'.repeat(50) },
      { stringTruncate: 10 },
    );
    expect((out.note as string).length).toBeLessThanOrEqual(11); // 10 + ellipsis
  });

  it('hard-caps stringTruncate at 2000 regardless of caller input', () => {
    const out = sanitizeReceiptMetadata(
      { note: 'A'.repeat(3000) },
      { stringTruncate: 9999 }, // caller asks 9999 but cap is 2000
    );
    expect((out.note as string).length).toBeLessThanOrEqual(2001);
  });
});

describe('sanitizeReceiptMetadata — extraStripKeys', () => {
  it('strips domain-specific T0 keys passed via extraStripKeys', () => {
    const out = sanitizeReceiptMetadata(
      { chain_id: 'c1', internal_secret: 'SHHH', public: 'ok' },
      { extraStripKeys: ['internal_secret'] },
    );
    expect(out).not.toHaveProperty('internal_secret');
    expect(out.public).toBe('ok');
  });
});

describe('sanitizeReceiptMetadata — edge cases', () => {
  it('returns empty object for null / undefined input', () => {
    expect(sanitizeReceiptMetadata(null)).toEqual({});
    expect(sanitizeReceiptMetadata(undefined)).toEqual({});
  });

  it('preserves null/undefined values without crashing', () => {
    const out = sanitizeReceiptMetadata({ chain_id: 'c1', x: null, y: undefined });
    expect(out.chain_id).toBe('c1');
    expect(out.x).toBeNull();
    expect(out.y).toBeUndefined();
  });

  it('preserves numbers + booleans untouched', () => {
    const out = sanitizeReceiptMetadata({
      chain_id: 'c1',
      step_index: 3,
      done: true,
      cost_qc: 900,
    });
    expect(out.step_index).toBe(3);
    expect(out.done).toBe(true);
    expect(out.cost_qc).toBe(900);
  });
});

describe('buildChainReceiptMetadata', () => {
  it('builds the canonical chain receipt skeleton', () => {
    const out = buildChainReceiptMetadata({
      chain_id: 'c1',
      template_id: 'marketa.ask-partner-proposal',
      template_version: 'v1',
      step_id: 'submit-to-marketa',
      step_index: 1,
      step_kind: 'rpc',
      actor: 'marketa',
      actor_alias_commitment: 'sha256_actor_alias',
      extra: {
        brief_artifact_id: 'art-123',
        proposal_artifact_id: 'art-456',
        persona_id: 'should-be-stripped',  // T0 — must not survive
      },
    });
    expect(out.chain_id).toBe('c1');
    expect(out.template_id).toBe('marketa.ask-partner-proposal');
    expect(out.template_version).toBe('v1');
    expect(out.step_id).toBe('submit-to-marketa');
    expect(out.step_index).toBe(1);
    expect(out.step_kind).toBe('rpc');
    expect(out.actor).toBe('marketa');
    expect(out.actor_alias_commitment).toBe('sha256_actor_alias');
    expect(out.brief_artifact_id).toBe('art-123');
    expect(out.proposal_artifact_id).toBe('art-456');
    expect(out.persona_id).toBeUndefined();
  });

  it('enforces receipt_metadata_keys allowlist on extras', () => {
    const out = buildChainReceiptMetadata({
      chain_id: 'c1',
      template_id: 't1',
      step_id: 's1',
      extra: {
        brief_artifact_id: 'art-123',
        proposal_artifact_id: 'art-456',
        unrelated_secret: 'should-be-stripped',
      },
      receipt_metadata_keys: ['brief_artifact_id', 'proposal_artifact_id'],
    });
    expect(out.brief_artifact_id).toBe('art-123');
    expect(out.proposal_artifact_id).toBe('art-456');
    expect(out.unrelated_secret).toBeUndefined();
  });

  it('omits skeleton fields that were not provided', () => {
    const out = buildChainReceiptMetadata({
      chain_id: 'c1',
      template_id: 't1',
    });
    expect(out.chain_id).toBe('c1');
    expect(out.template_id).toBe('t1');
    expect(out).not.toHaveProperty('step_id');
    expect(out).not.toHaveProperty('step_kind');
    expect(out).not.toHaveProperty('actor');
  });
});
