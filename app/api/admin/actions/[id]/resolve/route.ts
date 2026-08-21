/**
 * Admin API — resolve one Admin Action Centre item.
 *
 * POST /api/admin/actions/:id/resolve
 *
 * Resolving is triage state on THIS row only — it never performs, and is
 * never a substitute for, the underlying domain action (operator brief
 * §14: "resolving the notification and executing the underlying action
 * remain separate authorities").
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { resolveAdminAction } from '@/services/adminActions/adminActionService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireCartridgeAdmin(req, 'polity-passport-bureau');
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const result = await resolveAdminAction(id, gate.personaId);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
