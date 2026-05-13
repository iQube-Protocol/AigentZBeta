/**
 * Personal Experience Matrix — 7×7 lookup table.
 *
 * Sphere of Agency (Y) × Experience Maturity (X). Each cell carries:
 *   - label: short title for the cell
 *   - prescription: one-sentence guidance the helper surfaces when the
 *     user's position lands in that cell
 *
 * Prescriptions are intentionally short and structural — the metaMe
 * runtime composes them into longer nudges at the alignment-helper layer.
 *
 * This file is content (not code logic). Operators may refine individual
 * cells without touching the matrix tab UI.
 */

import {
  MATURITY_LEVELS,
  SPHERE_AXES,
  type MaturityLevel,
  type SphereAxis,
} from "@/types/experienceGuide";

export interface MatrixCell {
  label: string;
  prescription: string;
}

const SPHERE_NOUN: Record<SphereAxis, string> = {
  energy: "energy",
  body: "body",
  mind: "mind",
  emotion: "emotional life",
  relationship: "key relationships",
  community: "community ties",
  legacy: "legacy work",
};

const MATURITY_VERB: Record<MaturityLevel, string> = {
  noticing: "Notice",
  exploring: "Explore",
  experimenting: "Experiment with",
  practicing: "Practice with",
  integrating: "Integrate",
  sustaining: "Sustain",
  stewarding: "Steward",
};

const MATURITY_GUIDANCE: Record<MaturityLevel, string> = {
  noticing: "Just watch the pattern without trying to change it yet.",
  exploring: "Try one small, low-cost variation this week.",
  experimenting: "Run a deliberate trial and capture what changed.",
  practicing: "Make it a weekly habit and watch how it holds.",
  integrating: "Connect it to the rest of your routine so it stops requiring attention.",
  sustaining: "Hold the practice steady through change and pressure.",
  stewarding: "Make it generative for others — model it, mentor it, leave it better.",
};

function build(): Record<SphereAxis, Record<MaturityLevel, MatrixCell>> {
  const out = {} as Record<SphereAxis, Record<MaturityLevel, MatrixCell>>;
  for (const sphere of SPHERE_AXES) {
    out[sphere] = {} as Record<MaturityLevel, MatrixCell>;
    for (const level of MATURITY_LEVELS) {
      const label = `${MATURITY_VERB[level]} your ${SPHERE_NOUN[sphere]}`;
      const prescription = `${label}. ${MATURITY_GUIDANCE[level]}`;
      out[sphere][level] = { label, prescription };
    }
  }
  return out;
}

export const EXPERIENCE_MATRIX: Record<SphereAxis, Record<MaturityLevel, MatrixCell>> = build();
