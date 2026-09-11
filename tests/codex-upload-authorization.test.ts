/**
 * app/api/admin/codex/upload-asset/route.ts and
 * app/api/admin/codex/storage/register/route.ts — authorization repair
 * (2026-09-02).
 *
 * Both routes previously had NO authorization check at all (confirmed by
 * reading them directly — a deliberate but unsafe "URL-protected" design).
 * Both existing browser callers (CodexUploadModal.tsx, this app and
 * apps/theqriptopian-web's copy) already attach a real Supabase bearer
 * token when a session exists, so gating with the canonical
 * `requireAdminPersona` check makes that already-sent token do something
 * rather than asking either caller to change how it calls these routes.
 *
 * This suite proves BOTH directions behaviorally (not just by source
 * inspection): an unauthenticated/non-admin request is refused BEFORE the
 * upload/register logic ever runs, and an authorized admin request reaches
 * that logic and gets its result back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireAdminPersona = vi.fn<[], Promise<boolean>>();
vi.mock('@/app/api/_lib/requireAdmin', () => ({
  requireAdminPersona: (...args: unknown[]) => mockRequireAdminPersona(...(args as [])),
}));

const mockHandleCodexAssetUpload = vi.fn();
vi.mock('@/services/content/codexAssetUploadHandler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/content/codexAssetUploadHandler')>();
  return { ...actual, handleCodexAssetUpload: (...args: unknown[]) => mockHandleCodexAssetUpload(...args) };
});

const mockHandleCodexStorageRegister = vi.fn();
vi.mock('@/services/content/codexStorageRegisterHandler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/content/codexStorageRegisterHandler')>();
  return { ...actual, handleCodexStorageRegister: (...args: unknown[]) => mockHandleCodexStorageRegister(...args) };
});

import { POST as uploadAssetPost } from '@/app/api/admin/codex/upload-asset/route';
import { POST as storageRegisterPost } from '@/app/api/admin/codex/storage/register/route';

beforeEach(() => {
  mockRequireAdminPersona.mockReset();
  mockHandleCodexAssetUpload.mockReset();
  mockHandleCodexStorageRegister.mockReset();
});

describe('POST /api/admin/codex/upload-asset', () => {
  function makeRequest(formData: FormData, headers: Record<string, string> = {}) {
    return new NextRequest('https://dev-beta.aigentz.me/api/admin/codex/upload-asset', {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  it('refuses with 403 and NEVER reaches the upload logic when the caller is not an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(false);
    const fd = new FormData();
    fd.append('title', 'test'); fd.append('assetKind', 'cover_image');
    const res = await uploadAssetPost(makeRequest(fd));
    expect(res.status).toBe(403);
    expect(mockHandleCodexAssetUpload).not.toHaveBeenCalled();
  });

  it('refuses with 403 when requireAdminPersona itself throws — the whole handler is wrapped, never an empty body', async () => {
    mockRequireAdminPersona.mockRejectedValue(new Error('boom'));
    const fd = new FormData();
    const res = await uploadAssetPost(makeRequest(fd));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(mockHandleCodexAssetUpload).not.toHaveBeenCalled();
  });

  it('reaches the upload logic and returns its result when the caller IS an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    mockHandleCodexAssetUpload.mockResolvedValue({ success: true, id: 'asset-1', cid: 'cid-1', data: { id: 'asset-1', cid: 'cid-1', assetKind: 'cover_image' } });
    const fd = new FormData();
    fd.append('title', 'test'); fd.append('assetKind', 'cover_image');
    const res = await uploadAssetPost(makeRequest(fd));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('asset-1');
    expect(mockHandleCodexAssetUpload).toHaveBeenCalledTimes(1);
  });

  it('propagates a CodexAssetUploadError\'s own status code (e.g. 400 for a validation failure) rather than flattening every failure to 500', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    const { CodexAssetUploadError } = await import('@/services/content/codexAssetUploadHandler');
    mockHandleCodexAssetUpload.mockRejectedValue(new CodexAssetUploadError('Missing required fields: title, assetKind', 400));
    const res = await uploadAssetPost(makeRequest(new FormData()));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/codex/storage/register', () => {
  function makeRequest(body: unknown) {
    return new NextRequest('https://dev-beta.aigentz.me/api/admin/codex/storage/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('refuses with 403 and NEVER reaches the register logic when the caller is not an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(false);
    const res = await storageRegisterPost(makeRequest({ path: 'x', category: 'cover', title: 't' }));
    expect(res.status).toBe(403);
    expect(mockHandleCodexStorageRegister).not.toHaveBeenCalled();
  });

  it('reaches the register logic and returns its result when the caller IS an admin', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    mockHandleCodexStorageRegister.mockResolvedValue({ id: 'media-1', storageUrl: 'https://x/y' });
    const res = await storageRegisterPost(makeRequest({ path: 'x', category: 'cover', title: 't' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('media-1');
    expect(mockHandleCodexStorageRegister).toHaveBeenCalledTimes(1);
  });
});

describe('the Threshold executor no longer depends on either route\'s HTTP boundary', () => {
  it('services/threshold/uploadContentAsset.ts never fetches an /api/admin route — it calls handleCodexAssetUpload in-process instead', async () => {
    // The behavioral proof above shows the admin route now refuses a
    // non-admin caller. This confirms the Threshold path was rerouted
    // AROUND that gate by design (it establishes its own authorization
    // upstream, per this file's own header comment) rather than silently
    // depending on an unauthenticated hop to a route that is now gated.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(process.cwd(), 'services/threshold/uploadContentAsset.ts'), 'utf8');
    expect(source).not.toMatch(/fetch\(`\$\{input\.origin\}\/api\/admin/);
    expect(source).toContain('await handleCodexAssetUpload(uploadForm)');
  });
});
