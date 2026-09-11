/**
 * GET/POST /api/journey/constitutional-internet-bridge/act/disposition
 *
 * The Constitutional Internet Bridge's ACT stage — "shape your agent
 * relationship." Reuses the SAME generalized ExperienceQube disposition
 * write path the Horizen/MoneyPenny journey uses
 * (services/journey/experienceQubeDispositionService.ts), scoped under this
 * journey's own runtime agent id (Aigent Z) and context tag so a disposition
 * recorded here is never read back by the Horizen route, or vice versa (see
 * constitutionalInternetBridgeJourney.ts's header for why Aigent Z, not one
 * of the Horizen-demo REGISTRABLE_AGENTS, is the correct scope here).
 *
 * The disposition vocabulary is genuinely different from Horizen's
 * central/secondary/temporary ladder — the principal chooses an agent ROLE
 * and an ACTION MODE (how much authority to grant), never a domain-focus
 * recognition. Both fields are REQUIRED; there is no default or inferred
 * value — the principal must explicitly choose both (Guided Sovereignty
 * Principle, same discipline as AigentMeFocusDispositionPrompt).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  recordExperienceQubeDisposition,
  readExperienceQubeDisposition,
} from '@/services/journey/experienceQubeDispositionService';
import {
  CI_BRIDGE_RUNTIME_AGENT_ID,
  CI_BRIDGE_DISPOSITION_CONTEXT,
} from '@/services/journey/constitutionalInternetBridgeJourney';

export const dynamic = 'force-dynamic';

export const AGENT_ROLES = [
  'guide',
  'researcher',
  'operator',
  'creative-collaborator',
  'financial-assistant',
  'advocate-safeguard',
  'other',
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const ACTION_MODES = [
  'advise',
  'prepare',
  'ask-before-acting',
  'act-autonomously-within-limits',
] as const;
export type ActionMode = (typeof ACTION_MODES)[number];

interface DispositionBody {
  role?: string;
  actionMode?: string;
}

/* EVERY EXIT IS A NAMED ANSWER — see the Horizen disposition route's own
   header for the incident this discipline closes; mirrored here verbatim. */
export async function GET(request: NextRequest) {
  try {
    return await getImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { aigentMeActive, dispositionReceipt } = await readExperienceQubeDisposition(
    persona.personaId,
    CI_BRIDGE_RUNTIME_AGENT_ID,
  );
  const actionInput = dispositionReceipt?.actionInput as
    | { role?: string; actionMode?: string; context?: string }
    | null;

  // Belt-and-suspenders: even though agentsInvoked scoping already
  // disambiguates, only ever answer for OUR context tag.
  const isOurs = actionInput?.context === CI_BRIDGE_DISPOSITION_CONTEXT;

  return NextResponse.json({
    ok: true,
    aigentMeActive,
    role: isOurs ? actionInput?.role ?? null : null,
    actionMode: isOurs ? actionInput?.actionMode ?? null : null,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await postImpl(request);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function postImpl(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: DispositionBody;
  try {
    body = (await request.json()) as DispositionBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body.role || !AGENT_ROLES.includes(body.role as AgentRole)) {
    return NextResponse.json({ error: 'invalid-role', validValues: AGENT_ROLES }, { status: 400 });
  }
  if (!body.actionMode || !ACTION_MODES.includes(body.actionMode as ActionMode)) {
    return NextResponse.json({ error: 'invalid-action-mode', validValues: ACTION_MODES }, { status: 400 });
  }

  const role = body.role as AgentRole;
  const actionMode = body.actionMode as ActionMode;

  const result = await recordExperienceQubeDisposition({
    personaId: persona.personaId,
    runtimeAgentId: CI_BRIDGE_RUNTIME_AGENT_ID,
    agentDisplayName: 'Aigent Z',
    dispositionSummary: `Principal recorded a constitutional agent disposition: role='${role}', actionMode='${actionMode}' (Constitutional Internet Bridge)`,
    actionInput: { role, actionMode, context: CI_BRIDGE_DISPOSITION_CONTEXT },
    activeCartridge: 'metame-codex',
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        refusalCode: result.refusalCode,
        step: result.step,
        detail: result.detail,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    aigentMeActive: true,
    role,
    actionMode,
    receiptId: result.receiptId,
  });
}
