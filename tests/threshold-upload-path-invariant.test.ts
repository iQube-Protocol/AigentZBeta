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
    expect(source).toContain("Buffer.from(fileBase64 || file || '', 'base64')");
    expect(source).toContain('Do NOT pass Buffer.buffer');
  });
});
