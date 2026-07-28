/**
 * GET /api/companion/extension — the Companion distribution artifact
 * (SPEC-MMC-003 §3.2, install orchestration; the pre-store path).
 *
 *   ?format=zip  → the extension source as a stored zip, ready to unzip and
 *                  "Load unpacked" in a Chromium-family browser.
 *   (no format)  → the integrity manifest: per-file sha256, bundle sha256, the
 *                  derived extension ID, and the install/verify/pairing steps.
 *
 * ── Why this route is UNAUTHENTICATED, and where the gate actually is ───────
 *
 * A browser extension is a public artifact by construction: the moment the
 * Chrome Web Store listing exists, these exact bytes are world-downloadable,
 * and the CSP-allowlisted extension ID is already public in
 * `configs/embed/policy.v1.json`. The bundle carries **no credential** — the
 * canary in `tests/companion-extension-artifact.test.ts` fails the build if a
 * secret-shaped literal ever appears in it — and per PRD-MMC-001 §4.1 the
 * install itself "grants nothing beyond identity-only": the Companion holds no
 * session until the human pairs it with their OWN signed-in session.
 *
 * So gating the bytes would be theatre, and worse: it would need a
 * capability-token mint that does not exist, on a URL the human clicks in a
 * browser that carries no MCP bearer. The gate that carries real meaning is on
 * **discovery**, and it already exists — `get_companion_install` is a
 * Threshold handshake tool, so an agent only learns of this artifact after its
 * principal has crossed the Threshold in the browser. Do not add a bespoke
 * check here; if this artifact ever needs to be partner-scoped, that is a
 * capability-token design, not an `if` statement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import {
  readExtensionFiles,
  buildExtensionArtifactManifest,
  buildCompanionInstallBrief,
  writeStoreZip,
} from '@/services/companion/extensionArtifact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const files = readExtensionFiles();

    if (request.nextUrl.searchParams.get('format') === 'zip') {
      const manifest = buildExtensionArtifactManifest(files);
      const zip = writeStoreZip(files);
      return new NextResponse(new Uint8Array(zip), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="metame-companion-${manifest.version}.zip"`,
          'Content-Length': String(zip.length),
          // The bundle digest travels with the bytes so a download can be
          // verified without a second request to the manifest.
          'X-Companion-Bundle-Sha256': manifest.bundleSha256,
          'X-Companion-Extension-Id': manifest.extensionId,
          'Cache-Control': 'no-store',
        },
      });
    }

    const brief = buildCompanionInstallBrief(publicOrigin(request), buildExtensionArtifactManifest(files));
    return NextResponse.json(brief, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'companion extension artifact unavailable' },
      { status: 500 },
    );
  }
}
