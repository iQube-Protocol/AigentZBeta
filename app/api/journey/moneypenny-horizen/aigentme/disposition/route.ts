/**
 * POST /api/journey/moneypenny-horizen/aigentme/disposition
 *
 * PRD-GJR-001 §5.10 (aigentMe Onboarding Oversight Principle) made real: the
 * ONE sovereign act the aigentMe stage requires from the principal — not
 * MoneyPenny, not aigentMe itself. aigentMe surfaces MoneyPenny's declared
 * domain focus; the PRINCIPAL decides whether it becomes part of their
 * ExperienceQube population, and whether MoneyPenny is recorded as one of
 * their delegated agents. This route is that decision's write path.
 *
 * Spine-gated: resolves the caller's OWN active persona (never MoneyPenny's,
 * never another persona's) via getActivePersona. First call also writes the
 * (idempotent) aigentme_activated receipt — activation and the disposition
 * are two distinct facts, but the disposition can't be recorded without
 * aigentMe having activated first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  createActivityReceipt,
  listActivityReceiptsForPersona,
} from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

const VALID_DISPOSITIONS = ['central', 'secondary', 'temporary', 'not-carried-forward'] as const;
type Disposition = (typeof VALID_DISPOSITIONS)[number];

interface DispositionBody {
  disposition?: string;
  domainFocus?: string;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const receipts = await listActivityReceiptsForPersona(persona.personaId, {
    actionTypes: ['aigentme_activated', 'experienceqube_focus_disposition_recorded'],
    limit: 10,
  });

  const activated = receipts.some((r) => r.actionType === 'aigentme_activated');
  const dispositionReceipt = receipts.find((r) => r.actionType === 'experienceqube_focus_disposition_recorded');

  return NextResponse.json({
    ok: true,
    aigentMeActive: activated,
    disposition: (dispositionReceipt?.actionInput as { disposition?: string } | null)?.disposition ?? null,
  });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: DispositionBody;
  try {
    body = (await request.json()) as DispositionBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body.disposition || !VALID_DISPOSITIONS.includes(body.disposition as Disposition)) {
    return NextResponse.json(
      { error: 'invalid-disposition', validValues: VALID_DISPOSITIONS },
      { status: 400 },
    );
  }
  const disposition = body.disposition as Disposition;

  // aigentMe activation is idempotent — only write it once per persona.
  const existing = await listActivityReceiptsForPersona(persona.personaId, {
    actionTypes: ['aigentme_activated'],
    limit: 1,
  });
  if (existing.length === 0) {
    await createActivityReceipt({
      personaId: persona.personaId,
      activeCartridge: 'metame-codex',
      actionType: 'aigentme_activated',
      summary: 'aigentMe activated as the principal\'s constitutional companion',
    });
  }

  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'metame-codex',
    actionType: 'experienceqube_focus_disposition_recorded',
    summary: `Principal recorded disposition '${disposition}' on MoneyPenny's Financial Services domain focus`,
    agentsInvoked: ['aigent-moneypenny'],
    actionInput: { disposition, domainFocus: body.domainFocus ?? 'financial-services' },
  });

  return NextResponse.json({ ok: true, aigentMeActive: true, disposition, receiptId: receipt?.id ?? null });
}
