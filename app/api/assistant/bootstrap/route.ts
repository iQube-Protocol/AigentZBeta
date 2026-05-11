/**
 * GET /api/assistant/bootstrap
 *
 * metaMe Personal Assistant Alpha — Aigent Me Phase 1.
 *
 * Returns the cold-start surface for Aigent Me when the user enters the
 * metaMe cartridge: who is here, what cartridges are available, what
 * specialists can be coordinated, what next-best-actions to surface, and
 * (when configured) a hint at the user's ExperienceModel state.
 *
 * Privacy contract:
 *   - T0 fields (personaId, authProfileId, rootDid, kybeAttestation,
 *     cross-persona fioHandle) are NEVER serialised here.
 *   - personaSessionToken (T1) is the only persona handle that touches the
 *     wire. Mirrors GET /api/wallet/active-persona.
 *   - ExperienceModel hint is read-only and discloses only `configured`,
 *     `name`, `currentStage`. Strategic notes / IP / partner data live in
 *     the BlakQube payload and remain server-side only.
 *
 * Reuses (do not duplicate):
 *   - services/identity/getActivePersona.ts
 *   - services/identity/personaSessionToken.ts
 *   - app/api/_lib/supabaseServer
 *
 * See:
 *   - PRD v0.2 §12 (Suggested API/service endpoints → Assistant bootstrap)
 *   - codexes/packs/agentiq/updates/2026-05-11_metame-personal-assistant-alpha-decisions.md
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { issuePersonaSessionToken } from '@/services/identity/personaSessionToken';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ActivePersonaSurface } from '@/types/access';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────
// Aigent Me bootstrap surface — T1 only.
// ─────────────────────────────────────────────────────────────────────────

interface ExperienceModelHint {
  configured: boolean;
  name?: string;
  currentStage?: string;
  /** Any of: setup | alpha_activation | launch | growth | scale (PRD §11). */
}

interface AssistantSpecialist {
  id: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c';
  label: string;
  description: string;
  /** Where this specialist primarily operates from. */
  homeCartridge: 'cross-cutting' | 'qriptopian' | 'knyt' | 'platform';
}

interface AssistantCta {
  id:
    | 'set-up-experience-model'
    | 'brief-me'
    | 'move-this-forward'
    | 'review-venture-progress'
    | 'create-something'
    | 'coordinate-follow-ups'
    | 'ask-marketa'
    | 'ask-quill'
    | 'ask-kn0w1';
  label: string;
  /** Phase at which the backend for this CTA lands. */
  enabled: boolean;
  /**
   * 'available' — fully wired now.
   * 'preview'   — surface only; backend not yet live (alpha placeholder).
   */
  status: 'available' | 'preview';
}

interface AssistantBootstrapSurface {
  /** Persona session token — T1 opaque handle. */
  personaSessionToken: string;
  sessionExpiresAt: string;

  /** Cosmetic display only. Never derived from personaId or fioHandle. */
  displayLabel?: string;

  /** Cartridge-role flags (server-resolved). */
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };

  /**
   * Active cartridge slug the assistant should treat as default.
   * Resolved from query string > journey state > 'metame'.
   */
  activeCartridge: string;

  /** Cartridges the user can pivot Aigent Me into for this session. */
  availableCartridges: Array<{
    slug: 'metame' | 'knyt' | 'qriptopian' | 'marketa' | 'avl';
    label: string;
  }>;

  /** Specialists available for coordination. Quill is alpha-preview. */
  availableSpecialists: AssistantSpecialist[];

  /** Welcome panel primary CTAs (PRD §9.1). */
  primaryCtas: AssistantCta[];

  /** ExperienceModel state hint — does the user have one? */
  experienceModel: ExperienceModelHint;

  /** Counters (deferred phases). 0 in alpha bootstrap. */
  pendingApprovals: number;

  /** Recent activity receipts (deferred to Phase 7). Empty array for now. */
  recentActivity: Array<{ id: string; summary: string; createdAt: string }>;

  /** Locked naming conventions surfaced for client display. */
  naming: {
    productLabel: 'metaMe Personal Assistant, powered by Aigent Me';
    knytSpecialist: 'Kn0w1';
    qriptopianSpecialist: 'Quill, editor of The Qriptopian, powered by Aigent Q';
    canonicalMediaBrand: 'Metayé Media';
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Static catalogues — single source of truth for the welcome surface.
// ─────────────────────────────────────────────────────────────────────────

const AVAILABLE_CARTRIDGES: AssistantBootstrapSurface['availableCartridges'] = [
  { slug: 'metame', label: 'metaMe' },
  { slug: 'knyt', label: 'KNYT' },
  { slug: 'qriptopian', label: 'The Qriptopian' },
  { slug: 'marketa', label: 'Marketa' },
  { slug: 'avl', label: 'AgentiQ Venture Lab' },
];

const AVAILABLE_SPECIALISTS: AssistantSpecialist[] = [
  {
    id: 'marketa',
    label: 'Marketa',
    description: 'Campaigns, partners, proposals',
    homeCartridge: 'cross-cutting',
  },
  {
    id: 'quill',
    label: 'Quill, editor of The Qriptopian, powered by Aigent Q',
    description: 'Editorial angle, article briefs, issue planning',
    homeCartridge: 'qriptopian',
  },
  {
    id: 'kn0w1',
    label: 'Kn0w1',
    description: 'KNYT world, PCS, missions',
    homeCartridge: 'knyt',
  },
  {
    id: 'aigent-z',
    label: 'Aigent Z',
    description: 'Platform / system guidance',
    homeCartridge: 'platform',
  },
  {
    id: 'aigent-c',
    label: 'Aigent C',
    description: 'Customer journey, AgentiQ OS builder context',
    homeCartridge: 'platform',
  },
];

/**
 * Phase 1 ships only the welcome surface. CTAs whose backend lands later
 * are surfaced as `preview` so the UI can render them in a disabled /
 * coming-soon state without claiming functionality that does not exist.
 */
const PRIMARY_CTAS: AssistantCta[] = [
  { id: 'set-up-experience-model', label: 'Set up my ExperienceModel', enabled: false, status: 'preview' },
  { id: 'brief-me',                label: 'Brief me',                  enabled: false, status: 'preview' },
  { id: 'move-this-forward',       label: 'Move this forward',         enabled: false, status: 'preview' },
  { id: 'review-venture-progress', label: 'Review venture progress',   enabled: false, status: 'preview' },
  { id: 'create-something',        label: 'Create something',          enabled: false, status: 'preview' },
  { id: 'coordinate-follow-ups',   label: 'Coordinate follow-ups',     enabled: false, status: 'preview' },
  { id: 'ask-marketa',             label: 'Ask Marketa',               enabled: false, status: 'preview' },
  { id: 'ask-quill',               label: 'Ask Quill',                 enabled: false, status: 'preview' },
  { id: 'ask-kn0w1',               label: 'Ask Kn0w1',                 enabled: false, status: 'preview' },
];

const ALLOWED_CARTRIDGE_SLUGS = new Set<string>(
  AVAILABLE_CARTRIDGES.map((c) => c.slug),
);

// ─────────────────────────────────────────────────────────────────────────
// Helpers — server-internal reads. Each is timeout-tolerant; the bootstrap
// must remain useful even if a peripheral table read fails.
// ─────────────────────────────────────────────────────────────────────────

async function readPersonaPresentation(
  personaId: string,
): Promise<{ displayLabel?: string }> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return {};
    const { data } = await admin
      .from('personas')
      .select('display_name')
      .eq('id', personaId)
      .maybeSingle();
    const row = data as { display_name?: string } | null;
    const displayLabel =
      typeof row?.display_name === 'string' && row.display_name.trim().length > 0
        ? row.display_name.trim()
        : undefined;
    return { displayLabel };
  } catch {
    return {};
  }
}

/**
 * Best-effort ExperienceModel hint. Reads journey_states for the persona
 * and joins to experience_models if the existing schema is in place. The
 * full ExperienceQube service lands in Phase 2; this stays minimal.
 */
async function readExperienceModelHint(
  personaId: string,
): Promise<ExperienceModelHint> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return { configured: false };

    const { data } = await admin
      .from('journey_states')
      .select('stage')
      .eq('persona_id', personaId)
      .order('active_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = data as { stage?: string } | null;
    if (!row?.stage) return { configured: false };

    return {
      configured: true,
      currentStage: row.stage,
    };
  } catch {
    return { configured: false };
  }
}

function pickActiveCartridge(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get('cartridge');
  if (fromQuery && ALLOWED_CARTRIDGE_SLUGS.has(fromQuery)) return fromQuery;
  return 'metame';
}

// ─────────────────────────────────────────────────────────────────────────
// GET handler.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let issued: ReturnType<typeof issuePersonaSessionToken>;
  try {
    issued = issuePersonaSessionToken({
      personaId: context.personaId,
      authProfileId: context.authProfileId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[assistant/bootstrap] token issuance failed: ${msg}. ` +
      `Set PERSONA_SESSION_TOKEN_HMAC_KEY (>=32 chars) in Amplify env, ` +
      `or ensure NEXTAUTH_SECRET (>=32 chars) is set as fallback.`,
    );
    return NextResponse.json(
      {
        error: 'token-issuance-failed',
        detail: msg,
        hint:
          'Set PERSONA_SESSION_TOKEN_HMAC_KEY (>=32 chars) in Amplify env, ' +
          'or ensure NEXTAUTH_SECRET (>=32 chars) is set as fallback.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [{ displayLabel }, experienceModel] = await Promise.all([
    readPersonaPresentation(context.personaId),
    readExperienceModelHint(context.personaId),
  ]);

  const surface: AssistantBootstrapSurface = {
    personaSessionToken: issued.token,
    sessionExpiresAt: issued.expiresAt,
    cartridgeFlags: { ...context.cartridgeFlags },
    activeCartridge: pickActiveCartridge(request),
    availableCartridges: AVAILABLE_CARTRIDGES,
    availableSpecialists: AVAILABLE_SPECIALISTS,
    primaryCtas: PRIMARY_CTAS,
    experienceModel,
    pendingApprovals: 0,
    recentActivity: [],
    naming: {
      productLabel: 'metaMe Personal Assistant, powered by Aigent Me',
      knytSpecialist: 'Kn0w1',
      qriptopianSpecialist: 'Quill, editor of The Qriptopian, powered by Aigent Q',
      canonicalMediaBrand: 'Metayé Media',
    },
    ...(displayLabel ? { displayLabel } : {}),
  };

  // Type-narrowing assist for ActivePersonaSurface compatibility — the
  // bootstrap surface is a strict superset of the T1 contract.
  const _typecheck: ActivePersonaSurface = {
    personaSessionToken: surface.personaSessionToken,
    identifiability: context.identifiability,
    cartridgeFlags: surface.cartridgeFlags,
    cohortMemberships: [...context.cohortMemberships],
    sessionExpiresAt: surface.sessionExpiresAt,
    ...(surface.displayLabel ? { displayLabel: surface.displayLabel } : {}),
  };
  void _typecheck;

  return NextResponse.json(surface, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
