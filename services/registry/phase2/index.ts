/**
 * Phase 2 stubs — index.
 *
 * PRD v1.0 §13 / v1.1 §16. Interface-only seam for the intent →
 * calibration → risk → value → pricing → exchange chain. Implementation
 * is gated on a dedicated Phase 2 PRD; these stubs throw when called
 * to surface accidental use during Stage 1–8 development.
 *
 * Authority compliance: none of these will become parallel access /
 * ownership / receipt authorities when implemented. They run on the
 * spine: pricing/exchange settle through evaluateAccess + userOwnsAsset
 * + orchestrationEvents, never around them.
 */

export type { IntentCaptureInput, IntentToIQubeProposal } from './intent';
export { intentToIQubeProposal } from './intent';

export type { CalibrationProfile } from './calibration';
export { calibrate } from './calibration';

export type { RiskAssessment } from './risk';
export { assessRisk } from './risk';

export type { ValueAssessment } from './value';
export { assessValue } from './value';

export type { PricingProposal } from './pricing';
export { proposePricing } from './pricing';

export type { ExchangeListing, ExchangeOptimisationOpts } from './exchange';
export { publishListing, optimiseListings } from './exchange';
