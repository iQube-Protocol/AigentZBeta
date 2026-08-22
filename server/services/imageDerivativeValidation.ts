import sharp from 'sharp';

const MIN_DIMENSION = 100;

/**
 * Detects a decoder fill artifact: a contiguous band at the bottom of the
 * image that is one near-uniform color across nearly its full width. This is
 * the observed signature of a raster decoded from a truncated/incomplete
 * source — the decoder renders whatever scan data arrived and pads the
 * remainder with a flat fill instead of throwing. A full decode of the
 * output can succeed (the file is not corrupt as a *container*) even though
 * the pixel content is, so dimension/decodability checks alone do not catch
 * this; this does.
 */
export async function hasSuspiciousUniformBand(bytes: Buffer): Promise<boolean> {
  const { data, info } = await sharp(bytes, { failOn: 'error' }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) return false;

  const bandRows = Math.max(1, Math.floor(height * 0.15));
  const xStep = Math.max(1, Math.floor(width / 40));
  const tolerance = 2;
  let uniformRows = 0;

  for (let r = 0; r < bandRows; r++) {
    const y = height - 1 - r;
    const rowStart = y * width * channels;
    const r0 = data[rowStart];
    const g0 = data[rowStart + 1];
    const b0 = data[rowStart + (channels > 2 ? 2 : 0)];
    let uniform = true;
    for (let x = 0; x < width; x += xStep) {
      const idx = rowStart + x * channels;
      if (
        Math.abs(data[idx] - r0) > tolerance ||
        Math.abs(data[idx + 1] - g0) > tolerance ||
        Math.abs(data[idx + (channels > 2 ? 2 : 0)] - b0) > tolerance
      ) {
        uniform = false;
        break;
      }
    }
    if (uniform) uniformRows++;
  }

  return uniformRows >= bandRows * 0.9;
}

/**
 * Full validation an existing OR freshly-materialized public image
 * derivative must pass before it is trusted/served/cached. Callers should
 * run this both on a pre-existing cache-hit (a filename match is not
 * validity — a prior implementation could have cached a truncated or
 * gray-filled render) and on a freshly-produced derivative before publishing
 * it (a truncated canonical download can produce a structurally valid file
 * with corrupt pixel content).
 */
export async function assertValidImageDerivative(bytes: Buffer): Promise<void> {
  const meta = await sharp(bytes, { failOn: 'error' }).metadata();
  if (!meta.width || !meta.height || meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
    throw new Error(`degenerate-dimensions:${meta.width ?? 0}x${meta.height ?? 0}`);
  }
  if (await hasSuspiciousUniformBand(bytes)) {
    throw new Error('suspicious-uniform-fill-band');
  }
}
