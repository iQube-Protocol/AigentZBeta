import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('OCSGA reciprocal exchange iQube projection', () => {
  it('registers exchange and artifact identities without copying payloads', () => {
    const sql = read('supabase/migrations/20260930330000_exchange_iqubes_and_private_payloads.sql');
    expect(sql).toContain("'reciprocal_exchange'");
    expect(sql).toContain("'exchange_artifact'");
    expect(sql).toContain('reciprocal_exchanges_register_iqube');
    expect(sql).toContain('exchange_artifacts_register_iqube');
    expect(sql).not.toMatch(/insert\s+into\s+public\.exchange_artifacts/i);
    expect(sql).toContain("'exchange-artifacts', 'exchange-artifacts', false");
    expect(sql).not.toMatch(/create\s+policy[\s\S]+exchange-artifacts/i);
  });

  it('delegates artifact authorization to the exchange view and Access Steward', () => {
    const resolver = read('services/registry/resolver.ts');
    expect(resolver).toContain("record.source_system === 'reciprocal_exchange'");
    expect(resolver).toContain("record.source_system === 'exchange_artifact'");
    expect(resolver).toContain('getExchangeView');
    expect(resolver).toContain('explainReciprocalExchangeArtifactAccess');
    expect(resolver).toContain("decision.decision === 'ALLOW'");
  });

  it('keeps ClusterQube member access independent and private', () => {
    const adapter = read('services/registry/adapters/exchangeClusterQubeAdapter.ts');
    expect(adapter).toContain("visibility_state: 'private'");
    expect(adapter).toContain("access_propagation: 'independent'");
    expect(adapter).toContain("sources: ['reciprocal_exchange']");
  });

  it('guards repository paths and verifies every recovered payload hash', () => {
    const projection = read('services/threshold/personaIQubeProjection.ts');
    expect(projection).toContain("startsWith('codexes/packs/irl/')");
    expect(projection).toContain("rel.includes('..')");
    expect(projection).toContain('exchange artifact failed its content-integrity check');
    expect(projection).toContain('autodrive:([^:]+):(.+)');
  });

  it('preserves the immutable Party A baseline fingerprint', () => {
    const file = path.join(root, 'codexes/packs/irl/foundation/experiments/ci-irl-native-architecture-baseline-v1.0.md');
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex'))
      .toBe('41fb47c6cd7c3022a0fc17046166f6b9a988d6d07a569c1fb2106ef6f5a60f35');
  });

  it('supports Markdown and DOCX through both Threshold upload paths', () => {
    const route = read('app/api/threshold/mcp/route.ts');
    const fallback = read('services/threshold/gateway.ts');
    const storage = read('server/services/autonomysContentService.ts');
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    for (const source of [route, fallback, storage]) {
      expect(source).toContain('text/markdown');
      expect(source).toContain(docx);
    }
    expect(fallback).toContain('decodeBase64Strict');
    expect(fallback).not.toContain("Buffer.from(fileBase64, 'base64').buffer");
  });
});
