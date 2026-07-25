/**
 * domainResolver — SPEC-CDR-001 P3 (D-9, D-10, D-11 — RATIFIED).
 *
 * The four-level resolver, with **strict ordering**: a lower level never
 * overrides a higher one (§6.1). This is the component that decides whether a
 * subject's presentation context may be *asserted*, and it is the only place
 * that decision is made.
 *
 * | Level | Condition | Behaviour |
 * |---|---|---|
 * | **L1** | Exact match; provenance `first-party`/`curated`, `verified` | Assert. Full context. |
 * | **L2** | `discovered` profile a human/trusted process has `verified` | Assert. Full context. |
 * | **L3** | `discovered` + `provisional` | **MUST NOT assert.** |
 * | **L4** | No profile | No context. |
 *
 * L1 and L2 differ by **provenance, not verification** — both are verified.
 * That is precisely why §5.1 splits the two axes into independent fields: with
 * one collapsed field this distinction could not be expressed, and resolver
 * precedence would be ambiguous.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * P3 SHIPS L1, L2 AND L4. IT DOES NOT SHIP THE L3 PATH.
 *
 * A design choice worth stating, because "no provisional path" admits two
 * readings. The resolver could either (a) ignore provisional profiles
 * entirely, or (b) classify them and refuse to assert. **This implements (b).**
 *
 * Reason: (a) silently discards a profile the registry deliberately recorded,
 * which is a worse failure than refusing to act on it — and it would make P5
 * a rewrite instead of an addition. Under (b) a provisional profile resolves
 * to L3 with `assert: false` and `presentAs: 'L4'`, which §6.2 names as an
 * always-permitted implementation of L3 ("Nothing at all — falling back to L4
 * presentation"). The hedged-offer and context-selector forms are P5.
 *
 * So: no provisional profile can produce a rendered context today, and the
 * refusal is explicit rather than incidental. Nothing here fabricates,
 * infers, or best-guesses (§6.2, §13.5).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **This resolver grants no authority.** A resolved context says which
 * presentation is appropriate; it says nothing about whether a caller may act
 * (§13a, D-22). Authorization is the Identity & Access Spine's, evaluated at
 * the point of action, and is never carried in a resolution.
 *
 * Pure, no I/O. Subject-general by construction — it reads a Domain Profile,
 * so the same precedence will govern agents and capabilities (P6) without a
 * second resolver.
 */

import {
  resolveDomainProfile,
  type DomainProfile,
  type OverlayContext,
} from '@/services/resolution/domainProfileRegistry';

export type ResolutionLevel = 'L1' | 'L2' | 'L3' | 'L4';

/** Why the resolver landed where it did — carried so a caller (and an
 *  operator reading a log) never has to infer it from a null. */
export type ResolutionReason =
  /** L1 — an explicitly asserted, verified profile. */
  | 'asserted-verified'
  /** L2 — a discovered profile that has since been verified. */
  | 'discovered-verified'
  /** L3 — a discovered profile still awaiting verification. */
  | 'unverified'
  /** L4 — the registry has nothing for this subject. */
  | 'no-profile';

export interface DomainResolution {
  readonly level: ResolutionLevel;
  /**
   * The level whose PRESENTATION applies. Equals `level` except at L3, which
   * presents as L4 until P5 ships the hedged forms (§6.2).
   */
  readonly presentAs: Extract<ResolutionLevel, 'L1' | 'L2' | 'L4'>;
  /**
   * TRUE only when the context may be stated as fact. The single flag a
   * caller needs: `if (!resolution.assert) render nothing`.
   */
  readonly assert: boolean;
  /** The context to render — non-null ONLY when `assert` is true. */
  readonly overlayContext: OverlayContext | null;
  /** The profile behind the decision, for inspection/logging. Present at
   *  L3 too, so an operator can see what was refused and why. */
  readonly profile: DomainProfile | null;
  readonly reason: ResolutionReason;
}

const L4: DomainResolution = {
  level: 'L4',
  presentAs: 'L4',
  assert: false,
  overlayContext: null,
  profile: null,
  reason: 'no-profile',
};

/**
 * PURE — the precedence rules themselves, over a profile that has already
 * been looked up.
 *
 * Split out from `resolveDomain` deliberately: the registry contains no
 * provisional profile (and must not, before P5), so with lookup and
 * classification fused there was **no way to exercise the L3 refusal without
 * seeding an unverified profile into production data**. A canary that cannot
 * reach the branch it guards is not a canary — a mutation making L3 assertable
 * went undetected until this split. Now the refusal is directly testable
 * against a fixture, with nothing shipped to make it reachable.
 *
 * The ordering is a single top-to-bottom sequence rather than a score, so "a
 * lower level never overrides a higher one" is a property of the control flow
 * rather than a rule someone has to remember.
 */
export function classifyProfile(profile: DomainProfile | null): DomainResolution {
  if (!profile) return L4;

  // L1 — explicitly asserted by an authority, and verified.
  if (
    profile.verificationStatus === 'verified' &&
    (profile.assertionProvenance === 'first-party' || profile.assertionProvenance === 'curated')
  ) {
    return {
      level: 'L1',
      presentAs: 'L1',
      assert: true,
      overlayContext: profile.overlayContext,
      profile,
      reason: 'asserted-verified',
    };
  }

  // L2 — inferred, then verified. Same standing as L1 once verified; the
  // levels differ by provenance so the distinction stays visible in logs and
  // in any future policy that wants to treat the two differently.
  if (profile.verificationStatus === 'verified' && profile.assertionProvenance === 'discovered') {
    return {
      level: 'L2',
      presentAs: 'L2',
      assert: true,
      overlayContext: profile.overlayContext,
      profile,
      reason: 'discovered-verified',
    };
  }

  // L3 — provisional. Classified, but NOT asserted, and presented as L4 until
  // P5 ships the hedged forms. `overlayContext` is null by construction here:
  // a caller that ignores `assert` still cannot render an unverified context.
  return {
    level: 'L3',
    presentAs: 'L4',
    assert: false,
    overlayContext: null,
    profile,
    reason: 'unverified',
  };
}

/** PURE — look a subject up in the registry, then apply the precedence rules. */
export function resolveDomain(subject: string | null | undefined): DomainResolution {
  return classifyProfile(resolveDomainProfile(subject));
}

/**
 * PURE — the context a caller may actually render, or `null`.
 *
 * The narrow surface most consumers want: it collapses the four levels to the
 * one question a presentation layer is entitled to ask. Callers that need to
 * distinguish "unknown" from "known but unverified" — the abstention UI in P5,
 * and the abstention-rate metric in §6.3/§9 — use `resolveDomain` instead.
 */
export function assertedContextFor(subject: string | null | undefined): OverlayContext | null {
  const resolution = resolveDomain(subject);
  return resolution.assert ? resolution.overlayContext : null;
}
