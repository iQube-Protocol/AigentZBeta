/**
 * app/api/admin/codex/storage/sign/route.ts and
 * app/api/admin/codex/assets-by-category/route.ts — authorization repair
 * (2026-09-02, third/fourth routes in the same defect class as
 * upload-asset/storage/register fixed earlier this session).
 *
 * storage/sign was the most severe of the four: it handed out a signed
 * Supabase Storage UPLOAD URL — a write capability, including an
 * `existingPath` overwrite of an arbitrary object — to any caller,
 * unauthenticated or not. assets-by-category leaked internal asset
 * metadata (titles, CIDs, status) to any caller. Both are now gated the
 * same way as the earlier pair: requireAdminPersona wraps the whole
 * handler, and existing callers already send (or are now switched to
 * send) a real Bearer token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireAdminPersona = vi.fn<[], Promise<boolean>>();
vi.mock('@/app/api/_lib/requireAdmin', () => ({
  requireAdminPersona: (...args: unknown[]) => mockRequireAdminPersona(...(args as [])),
}));

const mockHandleCodexStorageSign = vi.fn();
vi.mock('@/services/content/codexStorageSignHandler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/content/codexStorageSignHandler')>();
  return { ...actual, handleCodexStorageSign: (...args: unknown[]) => mockHandleCodexStorageSign(...args) };
});

import { POST as storageSignPost } from '@/app/api/admin/codex/storage/sign/route';
import { GET as assetsByCategoryGet } from '@/app/api/admin/codex/assets-by-category/route';

beforeEach(() => {
  mockRequireAdminPersona.mockReset();
  mockHandleCodexStorageSign.mockReset();
});

describe('POST /api/admin/codex/storage/sign', () => {
  function makeRequest(body: unknown) {
    return new NextRequest('https://dev-beta.aigentz.me/api/admin/codex/storage/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('refuses with 403 and NEVER reaches the sign logic when the caller is not an admin — this is a WRITE-capability grant', async () => {
    mockRequireAdminPersona.mockResolvedValue(false);
    const res = await storageSignPost(makeRequest({ category: 'social', fileName: 'x.mp4' }));
    expect(res.status).toBe(403);
    expect(mockHandleCodexStorageSign).not.toHaveBeenCalled();
  });

  it('refuses with 500 (whole handler wrapped) rather than an empty body when requireAdminPersona itself throws', async () => {
    mockRequireAdminPersona.mockRejectedValue(new Error('boom'));
    const res = await storageSignPost(makeRequest({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockHandleCodexStorageSign).not.toHaveBeenCalled();
  });

  it('reaches the sign logic and returns its result when the caller IS an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    mockHandleCodexStorageSign.mockResolvedValue({ signedUrl: 'https://x/signed', token: 't1', path: 'codex/assets/bridge/social_campaign_video/foo.mp4', bucket: 'content-media' });
    const res = await storageSignPost(makeRequest({ category: 'social', fileName: 'x.mp4' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe('https://x/signed');
    expect(mockHandleCodexStorageSign).toHaveBeenCalledTimes(1);
  });

  it('propagates a CodexStorageSignError\'s own status code rather than flattening every failure to 500', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    const { CodexStorageSignError } = await import('@/services/content/codexStorageSignHandler');
    mockHandleCodexStorageSign.mockRejectedValue(new CodexStorageSignError('Missing fileName', 400));
    const res = await storageSignPost(makeRequest({ category: 'social' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/codex/assets-by-category', () => {
  function makeRequest(qs: string) {
    return new NextRequest(`https://dev-beta.aigentz.me/api/admin/codex/assets-by-category${qs}`);
  }

  it('refuses with 403 and never touches Supabase when the caller is not an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(false);
    const res = await assetsByCategoryGet(makeRequest('?series=bridge&category=social'));
    expect(res.status).toBe(403);
  });

  it('refuses with 500 (whole handler wrapped) when requireAdminPersona throws', async () => {
    mockRequireAdminPersona.mockRejectedValue(new Error('boom'));
    const res = await assetsByCategoryGet(makeRequest('?series=bridge&category=social'));
    expect(res.status).toBe(500);
  });

  it('still 400s on a missing category for an authorized admin caller (existing validation unchanged)', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    const res = await assetsByCategoryGet(makeRequest('?series=bridge'));
    expect(res.status).toBe(400);
  });
});

describe('QriptopianAdminTab.tsx no longer calls assets-by-category with a bare, unauthenticated fetch', () => {
  it('the source uses personaFetch for this call, not a raw fetch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/triad/components/codex/tabs/QriptopianAdminTab.tsx'),
      'utf8',
    );
    expect(source).toMatch(/personaFetch\(`\/api\/admin\/codex\/assets-by-category/);
  });
});
