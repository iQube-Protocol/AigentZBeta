/**
 * Regression suite for the Qriptopian Threshold essay cover delivery repair
 * (P0 forensic repair, 2026-08-22).
 *
 * Root causes proven live against dev-beta before this suite was written:
 *
 * 1. `app/api/threshold/mcp/route.ts::callUploadContentAsset` decoded the
 *    JSON-RPC `fileBase64`/`file` argument with `Buffer.from(x, 'base64')`
 *    unconditionally — Node's base64 decoder silently skips characters
 *    outside the base64 alphabet rather than rejecting them, so a data-URL
 *    prefix or any malformed input decoded to a plausible-length but corrupt
 *    buffer with no error anywhere in the pipeline. Confirmed live: covers
 *    for essays 002 and 003 return `cover-derivative-failed` /
 *    "Input buffer contains unsupported image format" — GCM-authenticated
 *    decryption succeeds (so the ciphertext/key/iv/tag are self-consistent),
 *    meaning the bytes that were originally encrypted were never a valid
 *    image. `decodeBase64Strict` + `assertDecodableImage` close this at the
 *    upload boundary, where the real source is still in hand.
 *
 * 2. `app/api/qriptopian/essay-cover/[id]/route.ts` and
 *    `app/api/content/media/[id]/route.ts` trusted an existing object in
 *    public storage by filename match alone, with no re-validation. A stale
 *    derivative produced by an older, non-strict pipeline stayed cached
 *    forever. Confirmed live: essay 004's cached derivative is a
 *    structurally valid 1024x1536 WebP that Sharp decodes without error, but
 *    the bottom ~45% of the raster is a flat RGB(128,128,128) fill — the
 *    classic signature of a decoder given a truncated JPEG. `assertValidImageDerivative`
 *    (`hasSuspiciousUniformBand`) catches this class of corruption that a
 *    decode-success/dimension check alone cannot.
 */

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { decodeBase64Strict, assertDecodableImage, THRESHOLD_IMAGE_ROLES } from '@/services/threshold/uploadContentAsset';
import { assertValidImageDerivative, hasSuspiciousUniformBand } from '@/server/services/imageDerivativeValidation';

// Minimal valid PNG (1x1 red pixel) — same fixture used by
// tests/mcp-upload-content-asset.test.ts.
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x0f, 0x00, 0x00, 0x01, 0x01, 0x00, 0x05, 0x18, 0x0b, 0xb3, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

async function makeGradientJpeg(width: number, height: number): Promise<Buffer> {
  // A real photographic-ish raster: a left-to-right gradient, encoded as JPEG.
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const v = Math.floor((x / width) * 255);
      raw[idx] = v;
      raw[idx + 1] = 255 - v;
      raw[idx + 2] = (v + y) % 255;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

async function makeTruncatedFillDerivative(width: number, height: number): Promise<Buffer> {
  // Reproduces essay 004's exact defect shape: a real image for the top
  // portion, a flat RGB(128,128,128) fill for the bottom ~45%.
  const raw = Buffer.alloc(width * height * 3);
  const fillStart = Math.floor(height * 0.55);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      if (y >= fillStart) {
        raw[idx] = 128;
        raw[idx + 1] = 128;
        raw[idx + 2] = 128;
      } else {
        const v = Math.floor((x / width) * 255);
        raw[idx] = v;
        raw[idx + 1] = 255 - v;
        raw[idx + 2] = (v + y) % 255;
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality: 82 }).toBuffer();
}

describe('decodeBase64Strict — upload-time base64 sanitation', () => {
  it('decodes well-formed base64 to the exact original bytes', () => {
    const encoded = VALID_PNG.toString('base64');
    const decoded = decodeBase64Strict(encoded);
    expect(decoded.equals(VALID_PNG)).toBe(true);
  });

  it('strips a data-URL prefix before decoding, rather than feeding it to the decoder', () => {
    const dataUrl = `data:image/png;base64,${VALID_PNG.toString('base64')}`;
    const decoded = decodeBase64Strict(dataUrl);
    expect(decoded.equals(VALID_PNG)).toBe(true);
  });

  it('strips embedded whitespace/newlines', () => {
    const withNewlines = VALID_PNG.toString('base64').replace(/(.{20})/g, '$1\n');
    const decoded = decodeBase64Strict(withNewlines);
    expect(decoded.equals(VALID_PNG)).toBe(true);
  });

  it('rejects input containing characters outside the base64 alphabet, loudly', () => {
    // A raw (non-base64) JSON fragment mistakenly passed as the file payload.
    expect(() => decodeBase64Strict('{"not":"base64"}')).toThrow(/invalid-base64-encoding/);
  });

  it('rejects a length that is not a multiple of 4, loudly', () => {
    expect(() => decodeBase64Strict('QQ')).toThrow(/invalid-base64-encoding/);
  });

  it('rejects empty input', () => {
    expect(() => decodeBase64Strict('')).toThrow(/empty-base64-input/);
  });

  it('the historical defect: Buffer.from(x, "base64") silently mangles a data URL instead of throwing', () => {
    // This is what the pre-fix code path did — documented here so the
    // contrast with decodeBase64Strict above is explicit, not just implied.
    const dataUrl = `data:image/png;base64,${VALID_PNG.toString('base64')}`;
    const lenientlyDecoded = Buffer.from(dataUrl, 'base64');
    expect(lenientlyDecoded.equals(VALID_PNG)).toBe(false);
  });
});

describe('assertDecodableImage — upload-time image validation', () => {
  it('accepts a genuine, fully-decodable image for an image-bearing role', async () => {
    await expect(assertDecodableImage(VALID_PNG, 'cover')).resolves.toBeUndefined();
  });

  it('is a no-op for non-image roles (pdf/video/audio/attachment)', async () => {
    const notAnImage = Buffer.from('not an image at all');
    await expect(assertDecodableImage(notAnImage, 'pdf')).resolves.toBeUndefined();
    await expect(assertDecodableImage(notAnImage, 'attachment')).resolves.toBeUndefined();
  });

  it('rejects non-image bytes for every image-bearing role — reproduces the 002/003 defect class', async () => {
    // Bytes with no recognizable image signature at all — exactly what a
    // mis-decoded base64 payload produces.
    const garbage = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 37) % 256));
    for (const role of THRESHOLD_IMAGE_ROLES) {
      await expect(assertDecodableImage(garbage, role)).rejects.toThrow(/upload-not-a-decodable-image/);
    }
  });

  it('THRESHOLD_IMAGE_ROLES matches the four asset roles that render as pictures', () => {
    expect(new Set(THRESHOLD_IMAGE_ROLES)).toEqual(new Set(['cover', 'thumbnail', 'hero', 'social']));
  });
});

describe('assertValidImageDerivative / hasSuspiciousUniformBand — display-time cache validation', () => {
  it('accepts a genuine photographic derivative with no uniform fill', async () => {
    const good = await makeGradientJpeg(400, 600);
    await expect(assertValidImageDerivative(good)).resolves.toBeUndefined();
    expect(await hasSuspiciousUniformBand(good)).toBe(false);
  });

  it('rejects a derivative with a large uniform bottom band — reproduces essay 004\'s exact defect', async () => {
    const corrupt = await makeTruncatedFillDerivative(400, 600);
    expect(await hasSuspiciousUniformBand(corrupt)).toBe(true);
    await expect(assertValidImageDerivative(corrupt)).rejects.toThrow(/suspicious-uniform-fill-band/);
  });

  it('rejects degenerate (near-zero) dimensions', async () => {
    const tiny = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .webp()
      .toBuffer();
    await expect(assertValidImageDerivative(tiny)).rejects.toThrow(/degenerate-dimensions/);
  });

  it('rejects bytes that are not a decodable image at all', async () => {
    const garbage = Buffer.from(Array.from({ length: 256 }, (_, i) => (i * 53) % 256));
    await expect(assertValidImageDerivative(garbage)).rejects.toThrow();
  });

  it('does not false-positive on a small legitimate uniform margin (below the 15%-of-height band threshold)', async () => {
    // A thin, genuinely flat border (5% of height) should not be confused
    // with a decoder fill artifact (>=15% of height, near-total uniformity).
    const width = 400;
    const height = 600;
    const raw = Buffer.alloc(width * height * 3);
    const marginRows = Math.floor(height * 0.05);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        if (y >= height - marginRows) {
          raw[idx] = 240; raw[idx + 1] = 240; raw[idx + 2] = 240;
        } else {
          const v = Math.floor((x / width) * 255);
          raw[idx] = v; raw[idx + 1] = 255 - v; raw[idx + 2] = (v + y) % 255;
        }
      }
    }
    const withThinMargin = await sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality: 82 }).toBuffer();
    expect(await hasSuspiciousUniformBand(withThinMargin)).toBe(false);
  });
});
