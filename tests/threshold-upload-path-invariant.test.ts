import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Threshold upload path invariant', () => {
  it('MCP upload is intercepted at the transport boundary and uses shared executor', () => {
    const source = read('app/api/threshold/mcp/route.ts');
    expect(source).toContain("name === 'upload_content_asset'");
    expect(source).toContain('executeThresholdContentUpload');
    expect(source).not.toContain("const uploadUrl = `${ctx.origin}/api/content/assets/upload`");
  });

  it('native connector upload uses the same shared executor', () => {
    const source = read('app/api/threshold/upload-action/route.ts');
    expect(source).toContain("requireThresholdSession(req, 'content.asset.upload')");
    expect(source).toContain('executeThresholdContentUpload');
    expect(source).not.toContain('getActivePersona');
  });

  it('legacy browser upload endpoint redirects ths_ bearers instead of mis-authenticating them', () => {
    const source = read('app/api/content/assets/upload/route.ts');
    expect(source).toContain("startsWith('bearer ths_')");
    expect(source).toContain("'/api/threshold/upload-action'");
    expect(source).toContain('307');
  });

  it('shared executor targets canonical Autonomys/Codex upload', () => {
    const source = read('services/threshold/uploadContentAsset.ts');
    expect(source).toContain('/api/admin/codex/upload-asset');
    expect(source).not.toContain('/api/content/assets/upload');
  });

  it('MCP base64 decoding keeps exact Buffer bytes instead of pooled ArrayBuffer backing storage', () => {
    const source = read('app/api/threshold/mcp/route.ts');
    // 2026-08-22: superseded the raw Buffer.from(x, 'base64') call with
    // decodeBase64Strict — it never touches `.buffer` (so the pooled-backing
    // risk this canary originally guarded stays closed) and additionally
    // rejects a data-URL prefix or malformed input loudly instead of the
    // previous lenient decode, which is what let corrupt Qriptopian essay
    // covers (002/003) reach Autonomys with no error anywhere in the
    // pipeline. See tests/qriptopian-essay-cover-validation.test.ts.
    expect(source).toContain('decodeBase64Strict(fileBase64 || file || ');
    expect(source).not.toMatch(/Buffer\.from\([^)]*\)\.buffer/);
  });

  it('MCP upload validates image-bearing roles are genuinely decodable before persisting', () => {
    const source = read('app/api/threshold/mcp/route.ts');
    expect(source).toContain('assertDecodableImage(bytes, role)');
  });

  it('upload-asset route honors isShareable from the individual-form-fields path', () => {
    // 2026-08-22: services/threshold/uploadContentAsset.ts appends
    // isShareable='true' as a form field for cover/thumbnail/hero/social
    // roles, but the individual-form-fields branch of
    // app/api/admin/codex/upload-asset/route.ts never read it — every asset
    // uploaded through the shared Threshold executor silently landed as
    // is_shareable=false, which the essay-cover / content-media display
    // routes reject with 403 asset-not-shareable regardless of image
    // validity. Discovered while re-uploading corrected Qriptopian essay
    // covers: the fixed base64/image-validation path let a genuinely valid
    // image through, and THIS gap is what surfaced next.
    const source = read('app/api/admin/codex/upload-asset/route.ts');
    expect(source).toContain("formData.get('isShareable')");
    expect(source).toMatch(/isShareable:\s*isShareable === 'true'/);
  });
});
