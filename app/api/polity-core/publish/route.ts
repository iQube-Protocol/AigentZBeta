/**
 * POST /api/polity-core/publish — publish constitutional documents to Autodrive
 * (Autonomys) for content-addressed immutability.
 *
 * Admin-only. Runs server-side on the deployed app where AUTONOMYS_API_KEY and
 * network egress exist (the sandbox blocks both). Returns the resulting CIDs to
 * record in the Amendment Records + services/polity/frameworks/autodrive-cids.json.
 *
 * OPERATOR RULING, 2026-07-27: *"The Development Constitution and Horizen
 * governance packet need to be added to a general constitutional framework
 * registry before the publication route can reach them. Do not special-case
 * CFS-009 or Horizen directly inside the route. … Then the publisher should
 * consume the registry rather than six imports hardwired into the route. This
 * resolves the present blocker and prevents the same failure for the next
 * constitutional document."*
 *
 * This route USED to hold six `getX()` imports and an inline `assets` array. The
 * set of publishable documents was a literal in a route body, which is why
 * CFS-009 appeared zero times here and was unreachable. The set now comes from
 * `services/polity/constitutionalFrameworkRegistry.ts`; adding the next
 * constitutional document is one registry entry and zero changes here.
 *
 * Publication carries the document's CONTENT HASH alongside its CID, so the
 * ratification record's `contentHash` and the published bytes are provably the
 * same bytes rather than two code paths that happen to agree.
 *
 * GET returns the currently-recorded CIDs (the in-repo immutability record) plus
 * the registry's own view of what is publishable and what is deliberately not.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import { getAutodriveImmutability } from '@/services/polity/constitution';
import {
  CONSTITUTIONAL_FRAMEWORKS,
  publishableFrameworks,
} from '@/services/polity/constitutionalFrameworkRegistry';
import { attachPublication } from '@/services/governance/governanceRatification';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...getAutodriveImmutability(),
    // Derived from the registry, never a second list.
    registry: CONSTITUTIONAL_FRAMEWORKS.map((f) => ({
      id: f.id,
      title: f.title,
      ratificationRequired: f.ratificationRequired,
      publish: f.publicationPolicy.publish,
      ...(f.publicationPolicy.publish ? {} : { withheldReason: f.publicationPolicy.reason }),
    })),
  });
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

    let body: Record<string, unknown> = {};
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      /* no body — publish everything the registry says is publishable */
    }
    const only = Array.isArray(body.frameworkIds)
      ? body.frameworkIds.filter((v): v is string => typeof v === 'string')
      : null;
    /** Optional: attach the resulting CID to an already-recorded ratification. */
    const decisionIdByFramework = (body.decisionIds ?? {}) as Record<string, string>;

    const definitions = publishableFrameworks().filter((f) => !only || only.includes(f.id));
    if (!definitions.length) {
      return NextResponse.json(
        { ok: false, error: 'no publishable frameworks matched', requested: only },
        { status: 400 },
      );
    }

    const { createAutoDriveApi } = await import('@autonomys/auto-drive');
    const api = createAutoDriveApi({ apiKey, network: 'mainnet' });

    const records: Array<Record<string, unknown>> = [];
    const skipped: Array<{ asset: string; reason: string }> = [];

    for (const def of definitions) {
      const doc = await def.sourceResolver();
      if (!doc) {
        // Unresolvable content is never published — an empty or missing body
        // uploaded as canon would produce a CID that attests to nothing.
        skipped.push({ asset: def.id, reason: 'source could not be resolved' });
        continue;
      }
      const filename = def.publicationPolicy.filename(doc.version);
      const cid = await api.uploadFileFromBuffer(Buffer.from(doc.body, 'utf8'), filename, {
        compression: false,
      });
      const publishedAt = new Date().toISOString();
      const record: Record<string, unknown> = {
        asset: def.id,
        title: def.title,
        version: doc.version,
        cid: String(cid),
        // The published bytes and the ratified bytes are the SAME bytes.
        contentHash: doc.contentHash,
        byteLength: doc.byteLength,
        sourcePath: doc.sourcePath,
        publishedAt,
      };
      records.push(record);

      // Ruling step 10 — attach the CID to the ratification, if one exists.
      // Best-effort by design: publication is downstream of ratification and
      // must never be able to invalidate it.
      const decisionId = decisionIdByFramework[def.id];
      if (decisionId) {
        const attached = await attachPublication(decisionId, { contentCid: String(cid), publishedAt });
        record.attachedTo = attached.ok ? decisionId : null;
        if (!attached.ok) record.attachError = attached.reason;
      }
    }

    return NextResponse.json({
      ok: true,
      network: 'mainnet',
      records,
      skipped,
      note:
        'Record these CIDs in services/polity/frameworks/autodrive-cids.json and ' +
        'codexes/packs/polity-core/items/AMENDMENT_RECORDS.md. Pass ' +
        '{"decisionIds":{"<frameworkId>":"<decisionId>"}} to attach a CID to a ratification record.',
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Publish failed' },
      { status: 500 },
    );
  }
}
