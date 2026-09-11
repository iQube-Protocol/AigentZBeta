/**
 * Admin API — mark one Admin Action Centre item read.
 *
 * POST /api/admin/actions/:id/read
 *
 * Marking read is triage state on THIS row only — it never touches the
 * underlying domain record (operator brief §10/§14: resolving/reading a
 * notification is independent of the domain action it observes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { markAdminActionRead } from '@/services/adminActions/adminActionService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireCartridgeAdmin(req, 'polity-passport-bureau');
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const result = await markAdminActionRead(id, gate.personaId);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
