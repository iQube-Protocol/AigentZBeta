/**
 * Admin API — Admin Action Centre list.
 *
 * GET /api/admin/actions?category=&disposition=&status=&limit=
 *
 * Hub-and-spoke (operator ruling, 2026-08-21): this is an INDEX into
 * existing domain queues, not a replacement inbox. Passport is the only
 * wired category today (see services/passport/citizenAutoIssuance.ts);
 * gating on the Passport Bureau cartridge here is deliberate and narrow —
 * a future second category (metaMe Pulse, KNYT/Qripto admin) must extend
 * this gate to check the CALLER'S OWN adminCartridges against the
 * requested category, never just widen this single check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { listAdminActions } from '@/services/adminActions/adminActionService';
import type { AdminActionStatus } from '@/types/adminActionItem';

const VALID_STATUSES: ReadonlyArray<AdminActionStatus> = ['unread', 'read', 'resolved', 'dismissed'];

export async function GET(req: NextRequest) {
  const gate = await requireCartridgeAdmin(req, 'polity-passport-bureau');
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? undefined;
  const dispositionParam = url.searchParams.get('disposition');
  const disposition =
    dispositionParam === 'informational' || dispositionParam === 'action_required'
      ? dispositionParam
      : undefined;
  const statusParam = url.searchParams.get('status');
  const status = statusParam
    ? (statusParam
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is AdminActionStatus =>
          (VALID_STATUSES as readonly string[]).includes(s),
        ) as AdminActionStatus[])
    : undefined;
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : undefined;

  const items = await listAdminActions({ category, disposition, status, limit });
  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}
