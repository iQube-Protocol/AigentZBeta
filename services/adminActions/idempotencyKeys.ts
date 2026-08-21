/**
 * Admin Action Centre — idempotency-key builders.
 *
 * One key per logical occurrence (operator brief §9). Centralized here so
 * every producer and every future consumer agree on the exact string —
 * hand-formatting the same key in two places is exactly the drift
 * inv.engineering.036/037 exists to prevent.
 */

export function passportNewApplicationKey(applicationId: string): string {
  return `passport-new-application:${applicationId}`;
}

export function passportAutoIssuedKey(applicationId: string): string {
  return `passport-auto-issued:${applicationId}`;
}

export function passportReviewRequiredKey(applicationId: string, reasonCode: string): string {
  return `passport-review-required:${applicationId}:${reasonCode}`;
}

export function passportIssuanceFailedKey(applicationId: string, reasonCode: string): string {
  return `passport-issuance-failed:${applicationId}:${reasonCode}`;
}
