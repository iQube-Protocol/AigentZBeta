/**
 * VL-CT-001 experiment cells — the ratified 2×2×2 factorial (charter §8.6, R-7).
 *
 * The eight cell identifiers are DERIVED from configuration, never hand-written:
 *
 *   USDC-BUNDLED-EXEC       USDC-BUNDLED-COMPLETE
 *   USDC-SERVICE-EXEC       USDC-SERVICE-COMPLETE
 *   BASEQC-BUNDLED-EXEC     BASEQC-BUNDLED-COMPLETE
 *   BASEQC-SERVICE-EXEC     BASEQC-SERVICE-COMPLETE
 *
 * Bare arm letters `A`/`B`/`C`/`D` are PROHIBITED in records, reports,
 * filenames and test names. A letter cannot say which of the three axes it
 * varies, so a reader of a result table cannot tell a pricing finding from a
 * neutrality finding — which is exactly the confusion §8.6 warns the three-axis
 * design exists to prevent.
 *
 * H2 and H3 are named analytical VIEWS over this one dataset (H2 reads the
 * denomination × pricing plane, H3 the denomination × contingency plane).
 * There is one experiment and one set of runs; there are not two experiments.
 */

import type {
  VentureCompensationContingency,
  VentureDenomination,
  VentureExperimentCell,
  VenturePricingStructure,
} from './types';

export const VENTURE_DENOMINATIONS: readonly VentureDenomination[] = ['USDC', 'BASE_QC'] as const;

export const VENTURE_PRICING_STRUCTURES: readonly VenturePricingStructure[] = [
  'bundled',
  'per-service',
] as const;

export const VENTURE_COMPENSATION_CONTINGENCIES: readonly VentureCompensationContingency[] = [
  'execution-contingent',
  'constitutional-completion-contingent',
] as const;

/** Axis → identifier token. The ONLY place a cell-id fragment is spelled. */
const DENOMINATION_TOKEN: Record<VentureDenomination, string> = {
  USDC: 'USDC',
  BASE_QC: 'BASEQC',
};
const PRICING_TOKEN: Record<VenturePricingStructure, string> = {
  bundled: 'BUNDLED',
  'per-service': 'SERVICE',
};
const CONTINGENCY_TOKEN: Record<VentureCompensationContingency, string> = {
  'execution-contingent': 'EXEC',
  'constitutional-completion-contingent': 'COMPLETE',
};

/** Derive the canonical cell identifier from a cell configuration. */
export function ventureExperimentCellId(cell: VentureExperimentCell): string {
  return [
    DENOMINATION_TOKEN[cell.denomination],
    PRICING_TOKEN[cell.pricingStructure],
    CONTINGENCY_TOKEN[cell.compensationContingency],
  ].join('-');
}

/** The full factorial, in a stable order so replay output is comparable. */
export const VENTURE_EXPERIMENT_CELLS: readonly VentureExperimentCell[] =
  VENTURE_DENOMINATIONS.flatMap((denomination) =>
    VENTURE_PRICING_STRUCTURES.flatMap((pricingStructure) =>
      VENTURE_COMPENSATION_CONTINGENCIES.map((compensationContingency) => ({
        denomination,
        pricingStructure,
        compensationContingency,
      })),
    ),
  );

/** The eight derived identifiers, same order as VENTURE_EXPERIMENT_CELLS. */
export const VENTURE_EXPERIMENT_CELL_IDS: readonly string[] =
  VENTURE_EXPERIMENT_CELLS.map(ventureExperimentCellId);

const CELL_BY_ID = new Map<string, VentureExperimentCell>(
  VENTURE_EXPERIMENT_CELLS.map((c) => [ventureExperimentCellId(c), c]),
);

/** Resolve a cell identifier back to its configuration; null when unknown. */
export function parseVentureExperimentCellId(id: string): VentureExperimentCell | null {
  return CELL_BY_ID.get(id) ?? null;
}

/**
 * H3's contingency plane for one denomination — the `*-SERVICE-EXEC` against
 * `*-SERVICE-COMPLETE` comparison §8.6 names as the key interaction to test.
 */
export function cellsForContingency(
  contingency: VentureCompensationContingency,
): readonly VentureExperimentCell[] {
  return VENTURE_EXPERIMENT_CELLS.filter((c) => c.compensationContingency === contingency);
}
