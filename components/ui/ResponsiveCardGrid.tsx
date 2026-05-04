/**
 * ResponsiveCardGrid — canonical card-grid surface plan for cartridge tabs.
 *
 * Codex/store/cartridge surfaces standardise on the same responsive
 * breakpoints so the layout follows the active device without per-tab
 * Tailwind class strings:
 *   mobile  (<768px) → 2 columns
 *   tablet  (≥768px) → 3 columns
 *   desktop (≥1024px) → 4 columns
 *
 * Use this for any list of cards in a cartridge tab. Don't write
 * `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` inline — wrap with this.
 *
 * Inner decorative grids (tier swatches, edition-count rows inside a
 * single card) should NOT use this — they have their own intentional
 * fixed column counts.
 */

import { ReactNode } from 'react';

interface ResponsiveCardGridProps {
  children: ReactNode;
  /** Tailwind gap utility — defaults to gap-1.5. Pass strings like 'gap-2' or 'gap-3' to override. */
  gap?: string;
  /** Extra classes appended after the grid + gap classes (padding, margin, etc.). */
  className?: string;
}

export function ResponsiveCardGrid({
  children,
  gap = 'gap-1.5',
  className = '',
}: ResponsiveCardGridProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${gap} ${className}`.trim()}>
      {children}
    </div>
  );
}
