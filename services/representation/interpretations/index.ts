/**
 * Interpretation registry — the readings the Constitutional Representation
 * System carries (CFS-021). CCF is the default (interpretation v1). Adding an
 * interpretation = one entry here + a file that satisfies the contract; the
 * validation gate rejects any that does not. N interpretations, one contract.
 */

import type { Interpretation } from '@/types/representation';
import { constitutionalCivicFuturism } from './constitutionalCivicFuturism';
import { highContrastAccessible } from './highContrastAccessible';

/** The default interpretation — CCF is interpretation v1, never the definition. */
export const DEFAULT_INTERPRETATION_ID = constitutionalCivicFuturism.id;

/** Every registered interpretation, in display order. */
export const INTERPRETATIONS: Interpretation[] = [
  constitutionalCivicFuturism,
  highContrastAccessible,
];

/** Lookup by id; falls back to the default when unknown. */
export function getInterpretation(id: string): Interpretation {
  return INTERPRETATIONS.find((i) => i.id === id) ?? constitutionalCivicFuturism;
}

export { constitutionalCivicFuturism, highContrastAccessible };
