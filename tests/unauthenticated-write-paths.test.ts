/**
 * Routes that MINT AUTHORITY or GRANT ENTITLEMENTS must resolve the caller
 * through the identity spine.
 *
 * ── The two defects this closes (found by audit, 2026-08-02) ───────────────
 *
 * `POST /api/codex/chat/agentiq-os/delegation` and `POST /api/cart/complete`
 * both took the subject persona FROM THE REQUEST BODY and never asked who was
 * calling. Anyone holding a persona UUID could:
 *
 *   · grant or revoke that persona's delegation at any band below
 *     L5_CORE_SOVEREIGN — a grant of authority to act on their behalf; or
 *   · complete a cart against them, claiming entitlements and numbered
 *     editions.
 *
 * Both are `inv.engineering.037` in its most costly form: a parallel path that
 * diverged from the spine, on the money and authority rails.
 *
 * A third defect sat inside the delegation route: the trust-band gate read
 *
 *     if (typeof reputation_score === 'number' && reputation_score < minScore)
 *
 * so omitting the field skipped the check entirely — the party being gated
 * chose whether the gate applied. The DELEGATE side of the very same file
 * resolves its ceiling server-side and says "never client-asserted"; the
 * grantor side did the opposite, on the higher-privilege direction.
 *
 * These assertions exist because an auth gate is the thing most likely to be
 * "simplified" by someone who does not know why it is there.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const AUTHORITY_ROUTES = [
  'app/api/codex/chat/agentiq-os/delegation/route.ts',
  'app/api/cart/complete/route.ts',
];

describe('authority- and entitlement-granting routes resolve the caller', () => {
  it('each route resolves the caller through the spine', () => {
    for (const file of AUTHORITY_ROUTES) {
      const src = stripComments(readSource(file));
      expect(src, `${file} does not import the spine resolver`).toMatch(
        /import \{ getActivePersona \} from '@\/services\/identity\/getActivePersona'/,
      );
      expect(src, `${file} never calls getActivePersona`).toMatch(/await getActivePersona\(/);
    }
  });

  it('an unresolved caller is refused, not defaulted', () => {
    for (const file of AUTHORITY_ROUTES) {
      const src = stripComments(readSource(file));
      expect(src, `${file} does not 401 an unauthenticated caller`).toMatch(
        /if \(!caller\?\.personaId\)[\s\S]{0,400}status: 401/,
      );
    }
  });

  it('a body-supplied persona is a claim, and a mismatch is refused', () => {
    /*
     * Not silently rewritten to the caller: quietly retargeting a grant of
     * authority — or a purchase — hides the very act that needs to be visible.
     */
    const deleg = stripComments(readSource(AUTHORITY_ROUTES[0]));
    expect(deleg).toMatch(/if \(persona_id !== caller\.personaId\)/);
    expect(deleg).toMatch(/status: 403/);

    const cart = stripComments(readSource(AUTHORITY_ROUTES[1]));
    expect(cart).toMatch(/if \(body\.personaId !== caller\.personaId\)/);
  });

  it('the trust-band gate cannot be skipped by omitting the score', () => {
    const src = stripComments(readSource(AUTHORITY_ROUTES[0]));
    // Fail-closed: a band with a minimum needs a score to evaluate, and an
    // absent score refuses rather than passes.
    expect(src).toMatch(/if \(minScore > 0 && typeof reputation_score !== 'number'\)/);
    // The refusal must not imply the caller fell short — it says the check
    // could not be made.
    expect(src).toMatch(/not a statement that you fall short/);
  });
});
