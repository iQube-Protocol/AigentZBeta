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
import { getExperienceQubeBootstrapHint } from '@/services/iqube/experienceQube';
import { getPersonalGuide } from '@/services/iqube/experienceQube';
import type { AlignmentState, PrecedenceMode } from '@/types/experienceGuide';
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
  id: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto' | 'moneypenny' | 'metaye' | 'researcher';
  label: string;
  description: string;
  /** Where this specialist primarily operates from. */
  homeCartridge: 'cross-cutting' | 'qriptopian' | 'knyt' | 'platform' | 'protocol';
  /**
   * Whether this specialist can be invoked via the "Ask" affordance on the
   * welcome surface. 'available' lights up the button; 'preview' renders a
   * "soon" badge with the button disabled. Server-side enforcement still
   * checks the specialist router itself.
   */
  canAsk: { enabled: boolean; status: 'available' | 'preview' };
}

interface AssistantCta {
  id:
    | 'set-up-experience-model'
    | 'brief-me'
    | 'move-this-forward'
    | 'review-venture-progress'
    | 'ask-specialists'
    | 'create-something'
    | 'coordinate-follow-ups';
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
  cartridgeFlags: {
    isAdmin: boolean;
    isPartner: boolean;
    /** Cartridge slugs the persona admins (per-cartridge grants). */
    adminCartridges: string[];
  };

  /**
   * Active cartridge slug the assistant should treat as default.
   * Resolved from query string > journey state > 'metame'.
   */
  activeCartridge: string;

  /** Cartridges the user can pivot Aigent Me into for this session. */
  availableCartridges: Array<{
    slug: 'metame' | 'knyt' | 'qriptopian' | 'marketa' | 'mvl';
    label: string;
  }>;

  /** Specialists available for coordination. Quill is alpha-preview. */
  availableSpecialists: AssistantSpecialist[];

  /** Welcome panel primary CTAs (PRD §9.1). */
  primaryCtas: AssistantCta[];

  /** ExperienceModel state hint — does the user have one? */
  experienceModel: ExperienceModelHint;

  /**
   * Personal ExperienceGuide summary — T1 safe. Sphere positions and repair
   * risk details stay server-side; only alignment state, precedence mode, and
   * focus intent are surfaced here for the welcome chip and brief framing.
   */
  personalGuide: {
    configured: boolean;
    alignmentState?: AlignmentState;
    precedenceMode?: PrecedenceMode;
    focusIntent?: string;
  };

  /** Counters (deferred phases). 0 in alpha bootstrap. */
  pendingApprovals: number;

  /** Recent activity receipts (deferred to Phase 7). Empty array for now. */
  recentActivity: Array<{ id: string; summary: string; createdAt: string }>;

  /** Locked naming conventions surfaced for client display. */
  naming: {
    productLabel: 'metaMe Personal Assistant, powered by Aigent Me';
    knytSpecialist: 'Kn0w1';
    qriptopianSpecialist: 'Quill';
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
  { slug: 'mvl', label: 'metaMe Venture Lab' },
];

const AVAILABLE_SPECIALISTS: AssistantSpecialist[] = [
  {
    id: 'marketa',
    label: 'Marketa',
    description: 'Campaigns, partners, proposals',
    homeCartridge: 'cross-cutting',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'quill',
    label: 'Quill',
    description: 'Editorial, storytelling, article briefs, issue planning',
    homeCartridge: 'qriptopian',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'kn0w1',
    label: 'Kn0w1',
    description: 'KNYT world, PCS, knowledge economics, missions',
    homeCartridge: 'knyt',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'aigent-z',
    label: 'Aigent Z',
    description: 'Platform / system guidance',
    homeCartridge: 'platform',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'aigent-c',
    label: 'Aigent C',
    description: 'Customer journey, AgentiQ OS builder context',
    homeCartridge: 'platform',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'aigent-nakamoto',
    label: 'Nakamoto',
    description: 'Decentralisation, Qripto protocols, ecosystem policy',
    homeCartridge: 'protocol',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'moneypenny',
    label: 'MoneyPenny',
    description: 'Q¢ economics, micro-transactions, payment ops',
    homeCartridge: 'cross-cutting',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'metaye',
    label: 'Metayé',
    description: 'Sovereign Cybernetic Polity, governance, civic primitives',
    homeCartridge: 'protocol',
    canAsk: { enabled: true, status: 'available' },
  },
  {
    id: 'researcher',
    label: 'Research Copilot',
    description: 'Invariant substrate, experiments, protocols, structured discovery',
    homeCartridge: 'cross-cutting',
    canAsk: { enabled: true, status: 'available' },
  },
];

/**
 * Phase 1 ships only the welcome surface. CTAs whose backend lands later
 * are surfaced as `preview` so the UI can render them in a disabled /
 * coming-soon state without claiming functionality that does not exist.
 */
const PRIMARY_CTAS: AssistantCta[] = [
  { id: 'set-up-experience-model', label: 'Set up my ExperienceModel', enabled: true,  status: 'available' },
  { id: 'brief-me',                label: 'Brief me',                  enabled: true,  status: 'available' },
  { id: 'move-this-forward',       label: 'Move goals forward',        enabled: true,  status: 'available' },
  { id: 'review-venture-progress', label: 'Review venture progress',   enabled: true,  status: 'available' },
  { id: 'ask-specialists',         label: 'Ask specialists',           enabled: true,  status: 'available' },
  { id: 'create-something',        label: 'Create something',          enabled: false, status: 'preview' },
  { id: 'coordinate-follow-ups',   label: 'Coordinate follow-ups',     enabled: false, status: 'preview' },
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
 * ExperienceModel hint — delegates to the canonical ExperienceQube service.
 * Phase 2 wired the persona-scoped ExperienceQube; the bootstrap surface
 * never reads the BlakQube payload directly.
 */
async function readExperienceModelHint(
  personaId: string,
): Promise<ExperienceModelHint> {
  try {
    const hint = await getExperienceQubeBootstrapHint(personaId);
    if (!hint.configured) return { configured: false };
    return {
      configured: true,
      name: hint.experienceName,
      currentStage: hint.currentStage,
    };
  } catch {
    return { configured: false };
  }
}

async function readPersonalGuideHint(
  personaId: string,
): Promise<AssistantBootstrapSurface['personalGuide']> {
  try {
    const guide = await getPersonalGuide(personaId);
    if (!guide) return { configured: false };
    return {
      configured: true,
      alignmentState: guide.alignmentState,
      precedenceMode: guide.precedenceMode,
      ...(guide.focusIntent ? { focusIntent: guide.focusIntent } : {}),
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

  const [{ displayLabel }, experienceModel, personalGuide] = await Promise.all([
    readPersonaPresentation(context.personaId),
    readExperienceModelHint(context.personaId),
    readPersonalGuideHint(context.personaId),
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
    personalGuide,
    pendingApprovals: 0,
    recentActivity: [],
    naming: {
      productLabel: 'metaMe Personal Assistant, powered by Aigent Me',
      knytSpecialist: 'Kn0w1',
      qriptopianSpecialist: 'Quill',
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
