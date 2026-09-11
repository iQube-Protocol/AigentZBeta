/**
 * SmartWalletDrawer — P1 Item 4 (operator brief 2026-08-16, "bring the
 * Wallet onto the constitutional projection").
 *
 * Before this fix, the Wallet independently re-resolved currentAigentMe via
 * a second fetch to /api/identity/constitutional-context and used it to
 * OVERRIDE the isAigentMe flag returned by /api/persona/sponsored-agents —
 * a workaround dating from when the two endpoints disagreed (documented in
 * the removed code's own comment). Now that sponsored-agents itself sources
 * isAigentMe from resolveConstitutionalContext() (P1 Item 3), the second
 * resolution is redundant duplication of the same fact — "resolve once,
 * project everywhere" means the Wallet renders the server's projection
 * directly, never re-deriving it client-side.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const FILE = 'app/components/content/SmartWalletDrawer.tsx';

describe('SmartWalletDrawer — no second client-side currentAigentMe resolution', () => {
  it('no longer fetches /api/identity/constitutional-context to override isAigentMe', () => {
    const code = stripComments(readSource(FILE));
    expect(code, 'a second, redundant currentAigentMe resolution is back').not.toMatch(
      /\/api\/identity\/constitutional-context/,
    );
    expect(code).not.toMatch(/aigentMeAssignmentId/);
    expect(code).not.toMatch(/assignmentContextLoaded/);
  });

  it('renders sponsoredAgents (the server-projected list) directly, not a client-recomputed override', () => {
    const code = stripComments(readSource(FILE));
    expect(code).toContain('const displaySponsoredAgents = sponsoredAgents;');
  });
});
