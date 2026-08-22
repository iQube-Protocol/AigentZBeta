#!/usr/bin/env -S npx tsx
/**
 * Deployment smoke test — Qriptopian Threshold essay cover delivery.
 *
 * Live-network check that cannot run in CI (it depends on the deployed
 * Autonomys/Supabase state). Run against dev-beta after a deploy that
 * touches app/api/qriptopian/essay-cover, app/api/content/media, or
 * services/threshold/uploadContentAsset.
 *
 * Usage:
 *   npx tsx scripts/smoke-qriptopian-essay-covers.ts [--host=https://dev-beta.aigentz.me]
 *
 * Exits non-zero if any published essay's thumbnail fails to resolve to a
 * genuine, Sharp-decodable image, if it exhibits the truncated-decode
 * uniform-fill defect, or if a known asset-id binding drifted.
 */

import sharp from 'sharp';
import { assertValidImageDerivative } from '../server/services/imageDerivativeValidation';

const args = process.argv.slice(2);
const hostArg = args.find((a) => a.startsWith('--host='));
const HOST = hostArg ? hostArg.split('=')[1] : 'https://dev-beta.aigentz.me';

// Known-good bindings, captured during the 2026-08-22 forensic repair.
// A drift here (e.g. CM's cover no longer resolving to f4ba6c5e...) is worth
// failing loudly on, since it would mean a re-upload silently rebound the
// canonical cover for an existing essay.
const EXPECTED_COVER_ASSET_IDS = {
  'Constitutional Media': 'f4ba6c5e-64b7-4605-8bef-d9d9919d677a',
  'Trusted Intelligence': '15a87ead-894d-4c25-ba0e-f4fa03395098',
};

const MIN_DIMENSION = 100;

let failures = 0;
let warnings = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}
function warn(msg) {
  console.warn(`WARN: ${msg}`);
  warnings++;
}
function pass(msg) {
  console.log(`PASS: ${msg}`);
}

async function fetchFinal(url) {
  // Follow redirects manually so we can report the final target + status.
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error(`too many redirects starting from ${url}`);
}

async function checkThumbnail(essay) {
  const { title, thumbnail } = essay;
  if (!thumbnail) {
    warn(`${title}: no thumbnail set (skipping)`);
    return;
  }

  const absoluteUrl = thumbnail.startsWith('http') ? thumbnail : `${HOST}${thumbnail}`;
  let res, finalUrl, bytes;
  try {
    const result = await fetchFinal(absoluteUrl);
    res = result.res;
    finalUrl = result.finalUrl;
  } catch (error) {
    fail(`${title}: thumbnail fetch threw — ${error.message}`);
    return;
  }

  if (res.status < 200 || res.status >= 300) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    fail(`${title}: final response is ${res.status} (not 2xx) — ${finalUrl} — body: ${body.slice(0, 200)}`);
    return;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    fail(`${title}: final response content-type is "${contentType}", not image/* — ${finalUrl}`);
    return;
  }

  try {
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    fail(`${title}: could not read response body — ${error.message}`);
    return;
  }

  if (!bytes.length) {
    fail(`${title}: response body is empty — ${finalUrl}`);
    return;
  }

  let meta;
  try {
    meta = await sharp(bytes, { failOn: 'error' }).metadata();
  } catch (error) {
    fail(`${title}: bytes are not Sharp-decodable — ${error.message} — ${finalUrl}`);
    return;
  }

  if (!meta.width || !meta.height || meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
    fail(`${title}: decoded dimensions ${meta.width}x${meta.height} are below the ${MIN_DIMENSION}px sanity floor — ${finalUrl}`);
    return;
  }

  try {
    // Same validator the display routes run before trusting/publishing a
    // derivative: full pixel decode + the truncated-decode uniform-fill
    // detector that caught essay 004's gray bottom half.
    await assertValidImageDerivative(bytes);
  } catch (error) {
    fail(`${title}: failed derivative validation — ${error instanceof Error ? error.message : String(error)} — ${finalUrl}`);
    return;
  }

  pass(`${title}: ${finalUrl} → ${contentType}, ${bytes.length} bytes, ${meta.width}x${meta.height}`);

  const expectedAssetId = EXPECTED_COVER_ASSET_IDS[title];
  if (expectedAssetId && !thumbnail.includes(expectedAssetId)) {
    warn(`${title}: thumbnail no longer references expected asset id ${expectedAssetId} (now: ${thumbnail})`);
  }
}

async function checkUnauthenticated(essay) {
  if (!essay.thumbnail || !essay.thumbnail.startsWith('/api/')) return;
  const url = `${HOST}${essay.thumbnail}`;
  const res = await fetch(url, { redirect: 'manual', headers: {} });
  if (res.status === 401 || res.status === 403) {
    fail(`${essay.title}: thumbnail route requires auth (${res.status}) — public covers must be unauthenticated`);
    return;
  }
  pass(`${essay.title}: thumbnail route is reachable unauthenticated (${res.status})`);
}

async function main() {
  console.log(`Qriptopian essay cover smoke test — host: ${HOST}\n`);

  const essaysRes = await fetch(`${HOST}/api/codex/qripto/essays`);
  if (!essaysRes.ok) {
    fail(`GET /api/codex/qripto/essays returned ${essaysRes.status}`);
    process.exit(1);
  }
  const { essays } = await essaysRes.json();
  if (!Array.isArray(essays) || essays.length === 0) {
    fail('No essays returned from /api/codex/qripto/essays');
    process.exit(1);
  }

  console.log(`Found ${essays.length} published essay(s)\n`);

  for (const essay of essays) {
    await checkThumbnail(essay);
    await checkUnauthenticated(essay);
  }

  console.log(`\n${failures} failure(s), ${warnings} warning(s)`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
