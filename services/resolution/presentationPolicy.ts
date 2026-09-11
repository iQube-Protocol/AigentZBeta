/**
 * presentationPolicy — SPEC-CDR-001 P5 (operator decision P5-2, 2026-07-25).
 *
 * THE TWO NUMBERS THAT MUST NEVER COLLAPSE:
 *
 *   confidence            — how strongly does the evidence support this
 *                           candidate? Inferred by the IDE. Evidence.
 *   presentation threshold — how much support do we require before
 *                           INTERRUPTING the citizen? Operational policy.
 *
 * L3 never asserts, so a threshold is not an assertion gate. But showing a
 * hedged contextual offer is still an intervention: it shapes how the citizen
 * reads the page. Without a threshold, weakly-grounded discoveries would
 * interrupt repeatedly with plausible-but-thin suggestions — which is why the
 * operator overrode the "no threshold" recommendation.
 *
 * RESOLUTION ORDER (operator, P5-1/P5-2 — two layers for P5):
 *
 *     profile.presentationThreshold
 *             ↓ if null
 *     CDR_PRESENTATION_THRESHOLD
 *
 * A third layer (subject-type / domain policy default) slots between them
 * later with no schema change — it is a lookup, not a column.
 *
 * FAIL SAFE, ALWAYS (operator, binding): where neither a valid row override
 * nor a valid environment value exists, the runtime **silently abstains**. It
 * does NOT fall back to zero, and it does not show every candidate. A
 * misconfigured deployment must under-serve, never over-assert.
 *
 * The threshold is an operational starting value subject to evidence-based
 * calibration. It is NOT a constitutional constant, which is why it lives in
 * configuration rather than in this file as a literal.
 */

/** Diagnosable reason a presentation decision came out the way it did. */
export type PresentationDecisionReason =
  /** Confidence met the applied threshold — the hedged offer may be shown. */
  | 'eligible'
  /** Confidence below the applied threshold — abstain, and record it. */
  | 'below-threshold'
  /** No usable threshold anywhere. Abstain (fail safe), and surface in diagnostics. */
  | 'threshold-unconfigured'
  /** The profile carries no confidence, so eligibility cannot be evaluated.
   *  Only reachable for a non-discovered profile, which never needs this. */
  | 'no-confidence';

export interface PresentationDecision {
  readonly eligible: boolean;
  readonly reason: PresentationDecisionReason;
  /**
   * The threshold ACTUALLY applied, recorded on the event so calibration
   * survives a later change to either the row value or the env default.
   * Null only when none could be resolved.
   */
  readonly appliedThreshold: number | null;
  /** Where the applied threshold came from — for diagnostics, not policy. */
  readonly thresholdSource: 'profile' | 'environment' | 'none';
}

const ENV_KEY = 'CDR_PRESENTATION_THRESHOLD';

/** A threshold is a probability. Anything else is a configuration error, not
 *  a value to coerce into range — coercion would silently change policy. */
function isValidThreshold(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * PURE-ish (reads `process.env`) — the configured system default, or null when
 * absent or invalid. Never throws: an invalid value must be observable in
 * diagnostics while remaining non-disruptive to the citizen.
 */
export function configuredPresentationThreshold(): number | null {
  const raw = process.env[ENV_KEY];
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw);
  if (!isValidThreshold(parsed)) {
    console.warn(
      `[CDR] ${ENV_KEY}="${raw}" is not a number in [0,1]; abstaining from all provisional offers until it is corrected.`,
    );
    return null;
  }
  return parsed;
}

/**
 * PURE — may a provisional profile's hedged offer be shown?
 *
 * `profileThreshold` is the row-level override (null = use the system
 * default). `confidence` is the profile's inferred confidence.
 */
export function decidePresentation(
  confidence: number | null | undefined,
  profileThreshold: number | null | undefined,
): PresentationDecision {
  const threshold = isValidThreshold(profileThreshold)
    ? { value: profileThreshold, source: 'profile' as const }
    : (() => {
        const configured = configuredPresentationThreshold();
        return configured === null
          ? null
          : { value: configured, source: 'environment' as const };
      })();

  if (threshold === null) {
    // Fail safe. Silence is the correct behaviour for a misconfiguration —
    // the alternative is interrupting citizens on the strength of nothing.
    return {
      eligible: false,
      reason: 'threshold-unconfigured',
      appliedThreshold: null,
      thresholdSource: 'none',
    };
  }

  if (!isValidThreshold(confidence)) {
    return {
      eligible: false,
      reason: 'no-confidence',
      appliedThreshold: threshold.value,
      thresholdSource: threshold.source,
    };
  }

  return {
    eligible: confidence >= threshold.value,
    reason: confidence >= threshold.value ? 'eligible' : 'below-threshold',
    appliedThreshold: threshold.value,
    thresholdSource: threshold.source,
  };
}
