"use client";

/**
 * StandingBadge — the first adoption proof of the Constitutional Representation
 * System (CFS-021). It renders the bearing's standing function (Experimental →
 * Validated → Canonical → Foundational) entirely from ROLES resolved through
 * the active interpretation — it hardcodes NO colour. Flip the interpretation
 * (CCF ↔ High-Contrast Accessible) and the SAME object reskins coherently.
 *
 * This is deliberately surgical: one low-risk primitive proving the pattern
 * end-to-end. Retrofitting existing chips/pills/buttons is the named
 * progressive-adoption follow-on, NOT this.
 */

import React from "react";
import { useRepresentation } from "./RepresentationProvider";
import {
  STANDING_LEVELS,
  type StandingLevel,
  type RepresentationRole,
} from "@/types/representation";

export interface StandingBadgeProps {
  standing: StandingLevel;
  /** Optional label override; defaults to the capitalised standing name. */
  label?: string;
  className?: string;
}

const standingRole = (level: StandingLevel): RepresentationRole =>
  `standing.${level}` as RepresentationRole;

/**
 * Renders a standing pill + the ordered 4-segment standing scale, all coloured
 * from the interpretation's roles. The lit segments = this standing's rung and
 * every rung below it (monotonic scale); the label uses the annotation type role.
 */
export function StandingBadge({ standing, label, className }: StandingBadgeProps) {
  const { role, interpretation } = useRepresentation();

  const activeIndex = STANDING_LEVELS.indexOf(standing);
  const tint = role(standingRole(standing));
  const surfaceRaised = role("surface.raised");
  const borderSubtle = role("border.subtle");
  const inkMuted = role("ink.muted");
  const annotationFont = role("type.annotation");
  const tempo = role("motion.tempo");
  const reveal = role("motion.reveal");

  const text = label ?? standing.charAt(0).toUpperCase() + standing.slice(1);

  return (
    <span
      className={className}
      data-interpretation={interpretation.id}
      data-standing={standing}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 10px",
        borderRadius: 9999,
        background: surfaceRaised,
        border: `1px solid ${borderSubtle}`,
        fontFamily: annotationFont,
        fontSize: 11,
        lineHeight: 1.4,
        letterSpacing: 0.2,
        transition: `background ${tempo} ${reveal}, border-color ${tempo} ${reveal}`,
      }}
    >
      <span aria-hidden style={{ display: "inline-flex", gap: 2 }}>
        {STANDING_LEVELS.map((level, i) => {
          const lit = i <= activeIndex;
          return (
            <span
              key={level}
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                // Each lit segment carries its OWN standing tint (the ramp);
                // unlit segments recede to the muted ink.
                background: lit ? role(standingRole(level)) : inkMuted,
                opacity: lit ? 1 : 0.28,
                transition: `background ${tempo} ${reveal}, opacity ${tempo} ${reveal}`,
              }}
            />
          );
        })}
      </span>
      <span style={{ color: tint, fontWeight: 600 }}>{text}</span>
    </span>
  );
}
