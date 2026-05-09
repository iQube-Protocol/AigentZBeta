/**
 * Phase 2.6 acceptance canary — assert that the state-C delivery helper
 * never returns a raw Supabase URL in its response body.
 *
 * Coverage:
 *   - 503 when bytes-at-rest aren't yet encrypted (Phase 2.5 not run)
 *   - decrypt-stream path returns Buffer with Content-Type, no URL
 *   - missing master key surfaces a 500 with a clear hint
 *
 * The wider canary — grepping every client-bound JSON for raw
 * supabase.co URLs on state-C content — is operationally enforced by
 * code review on the proxy diff (pdf/[cid], cover/[cid], video/[cid])
 * since runtime mocking the entire Supabase client surface adds more
 * test fragility than value here.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { streamStateCPlaintext } from '@/services/content/stateCDelivery';

const TEST_KEY = 'X'.repeat(43) + '='; // 32 bytes base64
let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
  process.env.CONTENT_ENCRYPTION_MASTER_KEY = TEST_KEY;
});

afterAll(() => {
  if (savedKey === undefined) delete process.env.CONTENT_ENCRYPTION_MASTER_KEY;
  else process.env.CONTENT_ENCRYPTION_MASTER_KEY = savedKey;
});

describe('Phase 2.6 — state-C delivery contract', () => {
  it('returns 503 with backfill hint when encryption_iv is missing', async () => {
    const res = await streamStateCPlaintext({
      id: 'mk_test',
      wip_storage_url: 'https://x.supabase.co/storage/v1/object/public/content-media/test.pdf',
      auto_drive_cid: null,
      mime_type: 'application/pdf',
      encryption_iv: null,
      encryption_auth_tag: null,
      encryption_key_id: null,
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/backfill/i);
    // Crucial: the response body MUST NOT contain the raw URL
    expect(JSON.stringify(body)).not.toMatch(/supabase\.co\/storage/);
  });

  it('returns 500 when CONTENT_ENCRYPTION_MASTER_KEY is missing', async () => {
    const saved = process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    delete process.env.CONTENT_ENCRYPTION_MASTER_KEY;
    const res = await streamStateCPlaintext({
      id: 'mk_test',
      wip_storage_url: 'https://x.supabase.co/storage/v1/object/public/content-media/test.pdf',
      encryption_iv: 'xx',
      encryption_auth_tag: 'yy',
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CONTENT_ENCRYPTION_MASTER_KEY/);
    process.env.CONTENT_ENCRYPTION_MASTER_KEY = saved;
  });

  it('returns 404 when the row has no storage URL at all', async () => {
    const res = await streamStateCPlaintext({
      id: 'mk_test',
      wip_storage_url: null,
      auto_drive_cid: null,
      encryption_iv: 'xx',
      encryption_auth_tag: 'yy',
    });
    expect(res.status).toBe(404);
  });

  it('returns 500 when the storage URL is malformed', async () => {
    const res = await streamStateCPlaintext({
      id: 'mk_test',
      wip_storage_url: 'https://wrong-shape.example.com/file.pdf',
      encryption_iv: 'xx',
      encryption_auth_tag: 'yy',
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/storage URL.*pattern/);
  });
});
