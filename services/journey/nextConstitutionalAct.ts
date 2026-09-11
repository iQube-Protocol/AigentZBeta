/**
 * THE NEXT CONSTITUTIONAL ACT — platform navigation invariant (operator
 * ruling, 2026-08-02).
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 * "Once authentication succeeds, never route the user to a generic landing
 * page. Route them immediately to the next incomplete constitutional act."
 *
 * The router must not ask "where do authenticated users go?" — that question
 * has no correct answer, and answering it produced the defect this module
 * closes: every successful sign-in and every successful invitation claim
 * resolved to the IRL OS cartridge root, which lands on its generic Welcome
 * tab. A reviewer who had just claimed a scoped EXP-P1 invitation was
 * deposited on a general landing page and had to find the programme
 * themselves; a reviewer who had NOT yet claimed was deposited there too,
 * with no indication that an unclaimed invitation was the one thing standing
 * between them and the programme.
 *
 * The router must instead ask: "what is the next constitutional act required
 * of this principal?" That question always has an answer, it is always
 * derived from state rather than from which link the visitor happened to
 * open, and it generalises — the same ladder serves Horizen pilots, Founders
 * Office, Polity Passport, partner onboarding, and every future guided
 * journey. This module is that resolver. Extend the ladder here; never fork
 * it into a per-surface `if` chain (inv.engineering.036/037).
 *
 * ── WHY THIS IS NOT A ROUTE GUARD ──────────────────────────────────────────
 *
 * This module decides where a principal SHOULD go next. It never decides
 * what they MAY do — that stays with the access spine and the server-side
 * gates (`evaluateAccess`, `callerMayReadExperimentReview`, the admin-only
 * governed-resolution routes). A principal may always navigate directly past
 * their "next act": the journey tolerates direct navigation by design, and
 * the real gate refuses independently if they lack authority. Confusing the
 * two would turn a wayfinding hint into a second, parallel authorization
 * system — exactly the duplication the identity spine exists to abolish.
 *
 * ── FAIL FAITHFUL ──────────────────────────────────────────────────────────
 *
 * Every input is a KNOWN fact or `null` for "not yet known". A `null` never
 * collapses to `false`: an unknown passport state is not "no passport", and
 * an unknown claim state is not "unclaimed". When a required fact is
 * unknown, the resolver returns the `observe` act — "we cannot tell you your
 * next step yet" — rather than guessing a step that may already be done
 * (which would send a claimed reviewer back to claim again) or one that is
 * not yet reachable. Guessing here is worse than admitting ignorance,
 * because the guess LOOKS authoritative.
 */

/** The ladder, in order. Each act is something a PRINCIPAL performs. */
export type ConstitutionalActId =
  /** No session — sign in, or establish an account/persona/Passport. */
  | 'authenticate'
  /** Signed in, holds an unclaimed invitation — claim it. */
  | 'claim-invitation'
  /** Signed in and claimed — enter the programme the invitation scopes. */
  | 'enter-programme'
  /** A required fact is unknown. Never a guess; see FAIL FAITHFUL above. */
  | 'observe';

export interface ConstitutionalActFacts {
  /** Does a session exist? `null` = not yet resolved. */
  authenticated: boolean | null;
  /**
   * Is an invitation in play at all? A surface with no invitation context
   * (an ordinary sign-in) passes `false` and lands on `enter-programme`,
   * whose destination the caller supplies.
   */
  invitationPresent: boolean;
  /** Has THIS invitation already been claimed? `null` = not yet resolved. */
  invitationClaimed: boolean | null;
}

export interface NextConstitutionalAct {
  id: ConstitutionalActId;
  /** Imperative label for the primary action. */
  label: string;
  /**
   * Why this act is next, in the principal's own terms. Rendered as-is, so
   * it must always be TRUE of the facts that produced it — never aspirational
   * copy.
   */
  because: string;
}

/**
 * Resolve the single next act. Pure — no I/O, no globals, no `Date.now()` —
 * so it is trivially testable and cannot drift between surfaces.
 *
 * Order is load-bearing: authentication gates everything (an unauthenticated
 * visitor cannot claim, because claiming is a human constitutional act bound
 * to a signed-in persona — see /api/participation/claim's own header), and
 * the claim gates programme entry (an unclaimed invitation grants nothing).
 */
export function resolveNextConstitutionalAct(facts: ConstitutionalActFacts): NextConstitutionalAct {
  if (facts.authenticated === null) {
    return {
      id: 'observe',
      label: 'Checking your access',
      because: 'We are confirming whether you are already signed in.',
    };
  }

  if (!facts.authenticated) {
    return {
      id: 'authenticate',
      label: 'Sign in',
      because: facts.invitationPresent
        ? 'Claiming an invitation is something you do as yourself, so it needs a signed-in Passport.'
        : 'Sign in to continue.',
    };
  }

  if (!facts.invitationPresent) {
    return {
      id: 'enter-programme',
      label: 'Continue',
      because: 'You are signed in.',
    };
  }

  if (facts.invitationClaimed === null) {
    return {
      id: 'observe',
      label: 'Checking your invitation',
      because: 'We are confirming whether this invitation has already been claimed.',
    };
  }

  if (!facts.invitationClaimed) {
    return {
      id: 'claim-invitation',
      label: 'Accept invitation and enter Validation Programme',
      because: 'You are signed in. Accepting this invitation is the one step left before the programme opens.',
    };
  }

  return {
    id: 'enter-programme',
    label: 'Continue to Validation Programme',
    because: 'Your invitation is claimed and your access is active.',
  };
}

/**
 * A sibling to `resolveNextConstitutionalAct` for gates that need ONLY the
 * authentication rung — no invitation-claim semantics. The KNYTS Bridge
 * Remix gate (ORIENT: "claim your Passport to tell your own crossing") is
 * the first caller: crossing the Threshold to Remix a Crossing Story is not
 * an invitation claim, it is the same "you must be signed in as yourself"
 * act as `authenticate` above, generalized so a future non-invitation gate
 * does not fork a new ladder for the same question.
 *
 * Same FAIL FAITHFUL discipline as the ladder above: `null` means "not yet
 * known" and returns `observe`, never a guessed answer.
 */
export interface AuthGateFacts {
  authenticated: boolean | null;
}

export interface NextAuthGateAct {
  id: 'authenticate' | 'proceed' | 'observe';
  label: string;
  because: string;
}

export function resolveNextAuthGateAct(
  facts: AuthGateFacts,
  gatedAction: string,
): NextAuthGateAct {
  if (facts.authenticated === null) {
    return {
      id: 'observe',
      label: 'Checking your access',
      because: 'We are confirming whether you are already signed in.',
    };
  }

  if (!facts.authenticated) {
    return {
      id: 'authenticate',
      label: 'Claim your Passport',
      because: `${gatedAction} is something you do as yourself, so it needs a signed-in Passport.`,
    };
  }

  return {
    id: 'proceed',
    label: 'Continue',
    because: 'You are signed in.',
  };
}
