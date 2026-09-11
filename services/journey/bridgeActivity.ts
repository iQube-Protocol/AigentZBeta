/**
 * bridgeActivity — the reusable activity/capsule composition model for
 * Bridge learning stages (CFS production learning pattern, 2026-09-03,
 * operator's "lesson composition system" architectural refinement).
 *
 * No prior equivalent generic activity schema exists in this codebase —
 * `BridgeCapsuleRailCard` (BridgeContentCapsule.tsx) is the closest relative
 * but is scoped to MEDIA rail thumbnails (id/label/aspect/renderThumb), not
 * general learning activities with title/description/completion. This is a
 * new, purpose-built, minimal type — not a duplicate of an existing one.
 *
 * Deliberately NOT a fully serialized/interpreted schema (no JSON-driven
 * renderer): `content` is a real React element supplied by the STAGE that
 * composes the activity, so an activity's own domain logic and state stay
 * inside its own component (e.g. `FinancialSovereigntyCostExample`,
 * `FinancialSovereigntyCheckGroup`) — never re-implemented or interpreted by
 * the generic carousel/capsule shell. The stage still declares WHICH
 * activities appear and in what groups as plain data (`BridgeActivityGroup[]`),
 * which is what makes composition data-driven without requiring a second,
 * parallel rendering engine on top of React itself.
 */

import type { ReactNode } from 'react';

export type BridgeActivityType =
  | 'goal-selection'
  | 'comparison'
  | 'simulation'
  | 'knowledge-check'
  | 'reflection'
  | 'capability'
  | 'action'
  | 'example';

export interface BridgeActivityDescriptor {
  id: string;
  type: BridgeActivityType;
  title: string;
  description?: string;
  /** The activity's own component instance — owns its own state via normal
   *  React lifecycle. The carousel that hosts this activity keeps it
   *  mounted at all times (see BridgeActivityCarousel's header comment), so
   *  that state survives horizontal scroll without any lifting required. */
  content: ReactNode;
  /** Optional, purely presentational — a capsule that has been engaged
   *  (answered / selected / interacted) can render a subtle completion
   *  affordance. Never gates navigation on its own; a stage's real
   *  completion evidence lives in its own evidence/handler code exactly as
   *  before. */
  completion?: 'complete' | 'incomplete';
}

export interface BridgeActivityGroup {
  id: string;
  title?: string;
  activities: BridgeActivityDescriptor[];
}
