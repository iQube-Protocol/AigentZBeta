/**
 * Interpretation registry — the readings the Constitutional Representation
 * System carries (CFS-021). Adding an interpretation = one entry here + a file
 * that satisfies the contract; the validation gate rejects any that does not. N
 * interpretations, one contract.
 *
 * DEFAULT vs CANONICAL-FIRST (CFS-021 §3/§5): AgentiQ Liquid Glass — the
 * platform HOUSE STYLE — is the DEFAULT interpretation, so every adopted surface
 * defaults to the platform's own look and stays visually cohesive with the rest
 * of the platform out of the box. That is a cohesion decision, NOT a canonicity
 * claim: Constitutional Civic Futurism remains interpretation v1 / the reference
 * atlas grammar (the museum lens), and High-Contrast Accessible the accessibility
 * lens — both a switch away. Default ≠ canonical-first.
 */

import type { Interpretation } from '@/types/representation';
import { constitutionalCivicFuturism } from './constitutionalCivicFuturism';
import { highContrastAccessible } from './highContrastAccessible';
import { agentiqLiquidGlass } from './agentiqLiquidGlass';

/** The default interpretation — the platform house style, for cohesion with the
 * rest of the platform. CCF (v1/atlas) and High-Contrast are a switch away. */
export const DEFAULT_INTERPRETATION_ID = agentiqLiquidGlass.id;

/** Every registered interpretation, in display order. The house style leads as
 * the default; CCF (the reference atlas grammar) and High-Contrast follow. */
export const INTERPRETATIONS: Interpretation[] = [
  agentiqLiquidGlass,
  constitutionalCivicFuturism,
  highContrastAccessible,
];

/** Lookup by id; falls back to the default (house style) when unknown. */
export function getInterpretation(id: string): Interpretation {
  return INTERPRETATIONS.find((i) => i.id === id) ?? agentiqLiquidGlass;
}

export { agentiqLiquidGlass, constitutionalCivicFuturism, highContrastAccessible };
