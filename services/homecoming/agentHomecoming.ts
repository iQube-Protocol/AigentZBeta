/**
 * Agent Homecoming — stand a constitutional delegate up (CFS-023, Workstream 2).
 *
 * "Establish <delegate> as a sovereign constitutional delegate operating natively
 * within the Human Agency System" — NOT a migration. This wraps the EXISTING
 * genesis core (services/agents/sponsorPolityAgent) for a NAMED Homecoming
 * delegate: it does not build new machinery, it runs the platform's own
 * genesis→passport→persona pipeline. This slice performs the first step — seed
 * the delegate's RootDID (agent_root_identity) — which moves the delegate from
 * "card-only archetype" (L0) to a persisted registry identity (L1). Passport
 * issuance (→L5) and persona provisioning (→L2) are the delegate's own follow-on
 * steps through the existing routes; the route surfaces them as nextSteps.
 *
 * Server-only (writes via the admin client). The delegate SPECS are pure data,
 * grounded in each delegate's canonical Agent Card — canary-tested.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sponsorPolityAgent, SLUG_RE } from '@/services/agents/sponsorPolityAgent';
import type { HomecomingDelegateId } from '@/types/homecoming';

export interface DelegateStandUpSpec {
  /** agent_card_slug — MUST match SLUG_RE and the delegate's existing card route. */
  slug: string;
  displayName: string;
  description: string;
  /**
   * Option A (polity_autonomous) stamps constitutional binding + requires admin.
   * Aletheon is a BOUNDED companion by its own charter ("assists through bounded
   * delegation… does not exercise authority or act independently"), so it is
   * polity_bound, not autonomous.
   */
  autonomous: boolean;
}

/**
 * Stand-up specs, grounded in the canonical Agent Cards. Only delegates whose
 * identity is authored (a real card + description) appear here; standing up
 * MoneyPenny/Nakamoto requires their cards first (No-Guessing — their
 * descriptions are not invented here). Aletheon is the archetype/first-mover.
 */
export const HOMECOMING_DELEGATE_SPECS: Partial<Record<HomecomingDelegateId, DelegateStandUpSpec>> = {
  aletheon: {
    slug: 'aletheon',
    displayName: 'Aletheon',
    description:
      "The First Citizen's Constitutional Companion Intelligence — reveals context, synthesizes " +
      'knowledge, preserves institutional memory, and supports governance design through bounded ' +
      'delegation. Illuminates possibilities and surfaces consequences; never commands, claims ' +
      'sovereignty, or acts outside constitutional constraints. Motto: "Not to command the path, but to illuminate it."',
    autonomous: false,
  },
};

/** The stand-up spec for a delegate, or null if none is authored yet. Pure. */
export function getDelegateSpec(delegate: HomecomingDelegateId): DelegateStandUpSpec | null {
  return HOMECOMING_DELEGATE_SPECS[delegate] ?? null;
}

export interface StandUpDelegateInput {
  admin: SupabaseClient;
  /** Sponsor persona (T0) — the citizen sponsoring the delegate's genesis. */
  sponsorPersonaId: string;
  /** The sponsoring citizen passport. */
  sponsorPassportId: string;
  delegate: HomecomingDelegateId;
  /** Public origin for the agent card URL. */
  origin: string;
  callerIsAdmin: boolean;
}

/** The resolved delegate RootDID — from a fresh genesis OR a pre-existing row. */
export interface ResolvedAgent {
  agentRootId: string;
  agentId: string;
  didUri: string;
  agentClass: string;
  displayName: string;
  description: string;
  agentCardUrl: string;
  agentCardSlug: string;
}

export interface StandUpResult {
  spec: DelegateStandUpSpec;
  agent: ResolvedAgent;
  /** True when the RootDID already existed (a prior stand-up) — idempotent. */
  alreadySeeded: boolean;
}

/**
 * Seed a Homecoming delegate's RootDID via the genesis core — IDEMPOTENT. On a
 * fresh seed it returns the new agent; if the RootDID already exists (a prior
 * run), it resolves the existing row and returns `alreadySeeded: true` so the
 * caller can proceed uniformly to persona provisioning. Ground truth is the
 * row, not the genesis error string. Genuine failures (capacity, sponsor
 * ownership) still surface as an error.
 */
export async function standUpDelegate(input: StandUpDelegateInput): Promise<StandUpResult | { error: string; status: number }> {
  const spec = getDelegateSpec(input.delegate);
  if (!spec) {
    return {
      status: 400,
      error: `No stand-up spec for '${input.delegate}'. Author its Agent Card + spec first (only delegates with a canonical card can be stood up).`,
    };
  }
  if (!SLUG_RE.test(spec.slug)) {
    return { status: 500, error: `spec slug '${spec.slug}' is invalid` };
  }

  const outcome = await sponsorPolityAgent({
    admin: input.admin,
    sponsorPersonaId: input.sponsorPersonaId,
    sponsorPassportId: input.sponsorPassportId,
    slug: spec.slug,
    displayName: spec.displayName,
    description: spec.description,
    origin: input.origin,
    agentClass: spec.autonomous ? 'polity_autonomous' : 'polity_bound',
    isAutonomous: spec.autonomous,
    callerIsAdmin: input.callerIsAdmin,
  });

  if (outcome.ok && outcome.agent) {
    const a = outcome.agent;
    return {
      spec,
      alreadySeeded: false,
      agent: {
        agentRootId: a.agentRootId,
        agentId: a.agentId,
        didUri: a.didUri,
        agentClass: a.agentClass,
        displayName: a.displayName,
        description: a.description,
        agentCardUrl: a.agentCardUrl,
        agentCardSlug: a.agentCardSlug,
      },
    };
  }

  // Idempotency — a prior run may already have seeded the RootDID. If a row
  // exists for this slug, proceed as already-seeded (persona provisioning runs
  // uniformly). This is the reason a re-click of "Stand up" advances L1 → L2.
  try {
    const { data: existing } = await input.admin
      .from('agent_root_identity')
      .select('id, agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug')
      .eq('agent_card_slug', spec.slug)
      .maybeSingle();
    if (existing) {
      return {
        spec,
        alreadySeeded: true,
        agent: {
          agentRootId: String(existing.id),
          agentId: String(existing.agent_id),
          didUri: String(existing.did_uri),
          agentClass: String(existing.agent_class),
          displayName: String(existing.display_name),
          description: String(existing.description ?? ''),
          agentCardUrl: String(existing.agent_card_url),
          agentCardSlug: String(existing.agent_card_slug),
        },
      };
    }
  } catch {
    /* fall through to the genesis error */
  }

  // Genuine failure (capacity, sponsor ownership, migration, etc.).
  return { error: outcome.error ?? 'genesis failed', status: outcome.status };
}
