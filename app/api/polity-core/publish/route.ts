/**
 * POST /api/polity-core/publish — publish the constitutional frameworks to
 * Autodrive (Autonomys) for content-addressed immutability.
 *
 * Admin-only. Runs server-side on the deployed app where AUTONOMYS_API_KEY and
 * network egress exist (the sandbox blocks both). Uploads the machine-readable
 * frameworks (imported, so it doesn't depend on the Lambda filesystem) and
 * returns the resulting CIDs to record in the Amendment Records +
 * services/polity/frameworks/autodrive-cids.json.
 *
 * GET returns the currently-recorded CIDs (the in-repo immutability record).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import {
  getConstitution,
  getAgentCharter,
  getDelegationFramework,
  getStandingCharter,
  getMetacommonsCharter,
  getFounderOfficeCharter,
  getAutodriveImmutability,
  CURRENT_CONSTITUTIONAL_VERSIONS,
} from '@/services/polity/constitution';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, ...getAutodriveImmutability() });
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      persona.cartridgeFlags.isAdmin ||
      persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'AUTONOMYS_API_KEY not configured in this environment' },
        { status: 503 },
      );
    }

    // Imported (bundled) so this doesn't depend on the Lambda filesystem.
    const assets = [
      { label: 'constitution', version: CURRENT_CONSTITUTIONAL_VERSIONS.constitutionVersion, body: getConstitution() },
      { label: 'agent-charter', version: CURRENT_CONSTITUTIONAL_VERSIONS.agentCharterVersion, body: getAgentCharter() },
      { label: 'delegation-framework', version: CURRENT_CONSTITUTIONAL_VERSIONS.delegationFrameworkVersion, body: getDelegationFramework() },
      { label: 'standing-charter', version: getStandingCharter().version, body: getStandingCharter() },
      { label: 'metacommons-charter', version: getMetacommonsCharter().version, body: getMetacommonsCharter() },
      { label: 'founder-office-charter', version: getFounderOfficeCharter().version, body: getFounderOfficeCharter() },
    ];

    const { createAutoDriveApi } = await import('@autonomys/auto-drive');
    const api = createAutoDriveApi({ apiKey, network: 'mainnet' });

    const records: Array<{ asset: string; version: string; cid: string; publishedAt: string }> = [];
    for (const asset of assets) {
      const buf = Buffer.from(JSON.stringify(asset.body, null, 2));
      const filename = `${asset.label}.v${asset.version}.json`;
      const cid = await api.uploadFileFromBuffer(buf, filename, { compression: false });
      records.push({ asset: asset.label, version: asset.version, cid: String(cid), publishedAt: new Date().toISOString() });
    }

    return NextResponse.json({
      ok: true,
      network: 'mainnet',
      records,
      note:
        'Record these CIDs in services/polity/frameworks/autodrive-cids.json and codexes/packs/polity-core/items/AMENDMENT_RECORDS.md.',
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Publish failed' },
      { status: 500 },
    );
  }
}
