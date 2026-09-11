/**
 * domainProfileRegistry — SPEC-CDR-001 P2 (D-15 RATIFIED 2026-07-25).
 *
 * The verified Domain Profile registry that REPLACES the hardcoded
 * `BANKING_DOMAINS` hostname `Set` in `services/companion/overlayMapping.ts`.
 *
 * THE CHANGE THIS FILE REPRESENTS, stated exactly (operator, 2026-07-25):
 *
 *   The old set said only:  "Render this card for these hosts."
 *   This registry says:     "A named authority has asserted and verified that
 *                            this host should resolve to this presentation
 *                            context."
 *
 * The same five hostnames carry over — but NOT by inheritance. They are
 * **re-entered explicitly as ratified seeds under D-15**, each with its
 * provenance, verification status, evidence, and rationale stated. That
 * distinction is the whole point of P2: the *reason* a host resolves is now
 * explicit, inspectable, and governed.
 *
 * MIGRATION-EQUIVALENT, NOT FEATURE-EXPANDING (operator, binding). After this
 * lands the same five hosts render materially the same experience as before.
 * New behaviour begins in later phases only.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO:
 *   - **No inferred classification.** Every profile is asserted by an
 *     authority; nothing here is derived from page content or a model.
 *   - **No provisional profiles.** Every seed is `verified`. The L3 provisional
 *     discovery path is P5, blocked on D-12.
 *   - **No `executionDomains`.** A hostname profile asserts a *presentation
 *     context*, not an execution domain. Claiming otherwise would let a
 *     presentation surface imply executability — precisely the §7.2
 *     presentation/execution firewall (D-11). `FinancialDomain` is untouched.
 *   - **No Horizen hostname** (operator, explicit). The registry classifies a
 *     subject by the context relevant *on that subject*, never by partnership
 *     affiliation. A Horizen property is added only when there is an actual
 *     pilot/agent-discovery surface, a first-party attestation or capability
 *     manifest, or a specifically curated route. The pilot's first subjects
 *     are likely **agents**, not hostnames — which is architecturally cleaner
 *     and is why nothing is stubbed here in anticipation.
 *   - **No `invariantFieldRef`** — D-8 is unresolved and the interim ruling is
 *     to treat `ire://` as documentary, so nothing may depend on its
 *     resolvability.
 *
 * P4 added `capabilityModules` (D-2/D-3/D-4/D-11): a profile now names the
 * modules it asserts are applicable. Still no `executionDomains` — naming a
 * module is a presentation assertion and must never become an execution claim.
 */

import type { CapabilityModuleId } from '@/services/resolution/capabilityModules';

/**
 * The overlay presentation context. Renamed from the legacy `'banking'`
 * identifier under D-14: it is a **rendering context informed by domain
 * profiles, not a financial domain**, and must never become a fourth ontology
 * competing with the runtime `FinancialDomain` taxonomy (§4.3).
 */
export type OverlayContext = 'financial-context';

/** D-5: provenance and verification are INDEPENDENT axes. A curated assertion
 *  can be verified; a first-party one can be unverified. Collapsing them into
 *  one field made resolver precedence ambiguous. */
export type AssertionProvenance = 'first-party' | 'curated' | 'discovered';
export type VerificationStatus = 'verified' | 'provisional';

export interface DomainProfileEvidence {
  readonly type:
    | 'page-content'
    | 'service-description'
    | 'capability-manifest'
    | 'operator-attestation';
  readonly ref: string;
}

/**
 * Who asserted the verification.
 *
 * §5.3's schema shows `verifiedBy` carrying a T2 Polity Public Reference. The
 * seeds below are verified by **operator ratification of D-15**, and no
 * `personaPublicRef` was issued for that act — so rather than mint or guess
 * one (CLAUDE.md's no-guessing rule is absolute), this union adds an explicit
 * `operator-ratification` variant that names the governing decision instead.
 *
 * Both variants are T2-safe by construction: neither can carry a `personaId`,
 * `authProfileId`, or `rootDid`. Domain Profiles are network-bound and
 * potentially chain-bound artifacts, so the Spine's tier rules apply in full.
 */
export type DomainProfileAuthority =
  | { readonly kind: 'polity-public-ref'; readonly ref: string }
  | { readonly kind: 'operator-ratification'; readonly decisionRef: string };

/**
 * WHERE the profile came from — operational metadata, deliberately DISTINCT
 * from `assertionProvenance` (operator, P5-1).
 *
 *   profileSource       = which store held it (a deployment fact)
 *   assertionProvenance = who asserted it and how (a constitutional fact)
 *
 * Collapsing them would make "ratified in code" look like a provenance class,
 * which it is not: a ratified seed and a promoted discovery can both be
 * `curated`, and a code seed is not automatically more trustworthy than a
 * verified promoted one — the resolver's precedence is about provenance, not
 * storage.
 */
export type ProfileSource = 'ratified-seed' | 'promoted-discovery';

interface DomainProfileBase {
  readonly schemaVersion: 'cdr-domain-profile/v1';
  readonly profileSource: ProfileSource;
  /** P2 seeds are all hostnames. The schema is subject-kind-general by design
   *  (§5.3) so one service can later resolve agents and capabilities too. */
  readonly subjectType: 'hostname';
  /** The canonical hostname, lowercase. */
  readonly subject: string;
  /**
   * Additional hostnames that resolve to THIS SAME profile (operator, D-15:
   * "treat `www` entries as explicit hostname aliases … avoid duplicating the
   * complete profile body"). Alias lookup returns the identical profile
   * object, so there is exactly one source of truth per subject.
   */
  readonly aliases?: readonly string[];
  readonly overlayContext: OverlayContext;
  /**
   * P4 (D-2/D-3/D-4/D-11, operator P4-1): the capability modules this profile
   * ASSERTS are applicable. A typed union rather than `string[]`, so an
   * unknown module is a compile error instead of a silently-dropped row.
   *
   * These are assertions governed by this profile's own provenance and
   * verification lifecycle. **They do not imply execution-domain membership or
   * executability** — a profile still asserts no `executionDomains`, and the
   * presentation/execution firewall stands (§7.2).
   *
   * Governance modules render ONLY when named here (operator, P4-2): never by
   * default, and never inferred from `overlayContext`.
   */
  readonly capabilityModules: readonly CapabilityModuleId[];
  readonly verificationStatus: VerificationStatus;
  readonly verifiedBy: DomainProfileAuthority;
  /** ISO-8601. The date the asserting authority verified this profile. */
  readonly verifiedAt: string;
  readonly evidence: readonly DomainProfileEvidence[];
  /** Human-readable justification, carried so the registry is inspectable
   *  rather than merely correct. An extension beyond §5.3's schema, adopted
   *  because "the reason they resolve is now explicit and inspectable" is the
   *  stated purpose of P2. */
  readonly rationale: string;
}

/**
 * D-6, enforced by the type system rather than by review: `confidence` exists
 * ONLY for `discovered` assertions. A curated or first-party profile carrying
 * a confidence score would imply an inference that never happened — so the
 * union makes that a compile error, and makes confidence mandatory when the
 * assertion IS inferred.
 */
export type DomainProfile =
  | (DomainProfileBase & {
      readonly assertionProvenance: 'first-party' | 'curated';
      readonly confidence?: never;
    })
  | (DomainProfileBase & {
      readonly assertionProvenance: 'discovered';
      /** 0..1 */
      readonly confidence: number;
    });

const D15 = 'SPEC-CDR-001 §10 D-15 — operator ratification, 2026-07-25';

const RATIFIED_BY: DomainProfileAuthority = {
  kind: 'operator-ratification',
  decisionRef: 'SPEC-CDR-001:D-15',
};

const RATIFIED_AT = '2026-07-25T00:00:00Z';

const ATTESTATION: readonly DomainProfileEvidence[] = [
  { type: 'operator-attestation', ref: D15 },
];

/**
 * THE SEED REGISTRY — five subjects, deliberately small (operator, D-15:
 * "describe only contexts we can presently assert without inference").
 *
 * Three first-party (metaMe's own properties), two curated (an external
 * digital-asset property). All `verified`. All `financial-context`.
 */
export const DOMAIN_PROFILES: readonly DomainProfile[] = [
  {
    schemaVersion: 'cdr-domain-profile/v1',
    profileSource: 'ratified-seed',
    subjectType: 'hostname',
    subject: 'metame.com',
    aliases: ['www.metame.com'],
    overlayContext: 'financial-context',
    // Migration-equivalent: `financial-intelligence` carries exactly the two
    // capability rows this card has rendered since 2026-07-24, so P4 reframes
    // them rather than changing what any seed presents. Naming a shadow-only
    // or governance module on a seed would be NEW behaviour, which P4 is not
    // authorised to add -- a profile amendment is the way to do that.
    capabilityModules: ['financial-intelligence'],
    assertionProvenance: 'first-party',
    verificationStatus: 'verified',
    verifiedBy: RATIFIED_BY,
    verifiedAt: RATIFIED_AT,
    evidence: ATTESTATION,
    rationale: 'Canonical metaMe production property.',
  },
  {
    schemaVersion: 'cdr-domain-profile/v1',
    profileSource: 'ratified-seed',
    subjectType: 'hostname',
    subject: 'dev-beta.aigentz.me',
    overlayContext: 'financial-context',
    capabilityModules: ['financial-intelligence'],
    assertionProvenance: 'first-party',
    verificationStatus: 'verified',
    verifiedBy: RATIFIED_BY,
    verifiedAt: RATIFIED_AT,
    evidence: ATTESTATION,
    rationale:
      'Existing platform runtime where Passport, Standing, delegation and wallet context are directly relevant.',
  },
  {
    schemaVersion: 'cdr-domain-profile/v1',
    profileSource: 'ratified-seed',
    subjectType: 'hostname',
    subject: 'coinbase.com',
    aliases: ['www.coinbase.com'],
    overlayContext: 'financial-context',
    capabilityModules: ['financial-intelligence'],
    assertionProvenance: 'curated',
    verificationStatus: 'verified',
    verifiedBy: RATIFIED_BY,
    verifiedAt: RATIFIED_AT,
    evidence: ATTESTATION,
    rationale: 'Explicit external digital-asset financial context.',
  },
];

/**
 * hostname → profile index, built once. Aliases map to the SAME object as
 * their canonical subject, so `resolveDomainProfile('www.metame.com') ===
 * resolveDomainProfile('metame.com')` — one source of truth per subject, which
 * is the alias mechanism D-15 asked for.
 *
 * A duplicate key across profiles would silently shadow one of them, so it
 * throws at module load rather than resolving the wrong context at runtime.
 */
const PROFILE_BY_HOSTNAME: ReadonlyMap<string, DomainProfile> = (() => {
  const index = new Map<string, DomainProfile>();
  for (const profile of DOMAIN_PROFILES) {
    for (const host of [profile.subject, ...(profile.aliases ?? [])]) {
      const key = host.trim().toLowerCase();
      if (index.has(key)) {
        throw new Error(`[CDR] duplicate domain-profile hostname: ${key}`);
      }
      index.set(key, profile);
    }
  }
  return index;
})();

/** Every hostname the registry resolves, canonical subjects and aliases
 *  alike. Exposed for canaries and inspection surfaces. */
export function registeredHostnames(): readonly string[] {
  return [...PROFILE_BY_HOSTNAME.keys()];
}

/**
 * PURE — the verified profile for a hostname, or `null` when the registry has
 * nothing to say. `null` is the honest answer and must stay one: abstention is
 * preferable to fabricated context (§6.2). Case- and whitespace-insensitive,
 * matching the normalisation `shapeForDomain` has always applied.
 */
export function resolveDomainProfile(
  hostname: string | null | undefined,
): DomainProfile | null {
  if (!hostname) return null;
  const key = hostname.trim().toLowerCase();
  if (key.length === 0) return null;
  return PROFILE_BY_HOSTNAME.get(key) ?? null;
}

/** PURE — the presentation context for a hostname, or `null` when unmapped. */
export function overlayContextForDomain(
  hostname: string | null | undefined,
): OverlayContext | null {
  return resolveDomainProfile(hostname)?.overlayContext ?? null;
}
