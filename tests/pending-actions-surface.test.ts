/**
 * PENDING_ACTIONS — one shell, several sovereign wallets.
 *
 *   > "One SmartWallet shell, multiple sovereign wallets. Not: one merged
 *   >  wallet with shared custody."
 *   >
 *   > "principal wallet = authority and mandate; agent wallet = control,
 *   >  acceptance and execution; external wallet = linked execution instrument
 *   >  only."
 *
 * The canaries here guard the collapse that would undo that: presenting a
 * principal mandate and an agent-key invocation as the same act, signing an
 * agent request with the principal key, or offering a control for an action
 * whose completion route does not exist.
 */

import { describe, it, expect } from 'vitest';

import {
  PENDING_ACTION_ROUTES,
  routeForAction,
  mayProducePrincipalSignature,
  NO_COMPLETION_ROUTE_YET,
} from '@/services/signing/pendingActionRouting';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('the two completions are different acts', () => {
  it('a principal mandate is completed by a signature', () => {
    const r = routeForAction('authorize_registration', 'principal');
    expect(r?.completion).toBe('principal-signature');
    expect(r?.label).toMatch(/sign/i);
  });

  it('an agent invocation is completed by an approval, and does not say "sign"', () => {
    // Calling it "sign" would tell the operator they are doing something they
    // are not — the agent key is under bounded custody and never reaches them.
    const r = routeForAction('sign_registry_transaction', 'agent');
    expect(r?.completion).toBe('agent-approval');
    expect(r?.label).toMatch(/approve/i);
    expect(r?.label).not.toMatch(/^sign/i);
  });

  it('the principal key may never be produced for an agent-role request', () => {
    const agent = routeForAction('sign_registry_transaction', 'agent')!;
    const principal = routeForAction('authorize_registration', 'principal')!;
    expect(mayProducePrincipalSignature(agent)).toBe(false);
    expect(mayProducePrincipalSignature(principal)).toBe(true);
  });

  it('an action with no route resolves to null rather than a guess', () => {
    expect(routeForAction('sign_activation', 'principal')).toBeNull();
    expect(routeForAction('authorize_registration', 'agent')).toBeNull();
  });

  it('says the surface is missing, not that the request is', () => {
    expect(NO_COMPLETION_ROUTE_YET).toMatch(/recorded and waiting/i);
    expect(NO_COMPLETION_ROUTE_YET).toMatch(/has not been built yet/i);
  });

  it('every route names a real endpoint and a summary', () => {
    for (const r of PENDING_ACTION_ROUTES) {
      expect(r.endpoint, r.actionKind).toMatch(/^\/api\//);
      expect(r.summary.length, r.actionKind).toBeGreaterThan(40);
    }
  });
});

describe('the list route answers "what is waiting on ME"', () => {
  const route = stripComments(readSource('app/api/wallet/signing-requests/route.ts'));

  it('reads across every wallet the operator controls, not just principal', () => {
    // Two acts in two wallets are one queue for one operator; a principal-only
    // list would hide the agent invocation the ceremony depends on.
    expect(route).toMatch(/listPendingSigningRequestsForOperator/);
    expect(route).not.toMatch(/listPendingSigningRequestsForPrincipal/);
  });

  it('returns walletRef so the surface can group by signing domain', () => {
    expect(route).toMatch(/walletRef: r\.walletRef/);
  });

  it('never returns the T0 persona id', () => {
    expect(route).not.toMatch(/principalPersonaId: r\./);
  });

  it('returns the exact payload — a summary alone would be blind signing', () => {
    expect(route).toMatch(/payload: r\.payload/);
    expect(route).toMatch(/payloadHash: r\.payloadHash/);
  });

  it('derives completion from the routing table, never inline in the route', () => {
    expect(route).toMatch(/routeForAction\(/);
  });

  it('an unreadable list is not an empty one', () => {
    expect(route).toMatch(/not the same as/i);
  });
});

describe('the panel keeps the domains separate', () => {
  const panel = stripComments(readSource('components/wallet/PendingActionsPanel.tsx'));

  it('groups by walletRef', () => {
    expect(panel).toMatch(/reduce<Record<string, PendingRequestView\[\]>>/);
    expect(panel).toMatch(/walletGroupLabel\(/);
  });

  it('labels the principal domain as authority and the agent domain as execution', () => {
    expect(panel).toMatch(/Authority and mandate/);
    expect(panel).toMatch(/Agent control and execution/);
  });

  it('the collapsed row shows the deciding summary; expansion shows the full detail', () => {
    // Collapsed: action, signer, consequence, expiry, status — enough to
    // decide whether to look closer, never enough to sign on.
    expect(panel).toMatch(/relativeExpiry\(r\.expiresAt\)/);
    for (const label of [
      'Signer',
      'Signer role',
      'Authority source',
      'Subject',
      'AigentQube',
      'Wallet ref',
      'Wallet address',
      'Network',
      'Receipt destination',
      'Request hash',
    ]) {
      expect(panel, label).toContain(`label="${label}"`);
    }
    expect(panel).toMatch(/Exact text your key would cover/);
  });

  it('offers Review, Sign/Approve and Refuse', () => {
    expect(panel).toMatch(/'Review'/);
    expect(panel).toMatch(/r\.actionLabel/);
    expect(panel).toMatch(/>\s*Refuse\s*</);
  });

  it('Review expands in place — no modal, no navigation', () => {
    expect(panel).toMatch(/setExpandedId\(isExpanded \? null : r\.id\)/);
    expect(panel).not.toMatch(/createPortal|role="dialog"|fixed inset-0/);
  });

  it('refusal confirms INLINE inside the card, with an optional reason', () => {
    expect(panel).toMatch(/Refuse this request\?/);
    expect(panel).toMatch(/Reason \(optional\)/);
    expect(panel).toMatch(/Confirm refusal/);
    expect(panel).toMatch(/Cancel/);
  });

  it("an agent act's wallet address is bounded custody, never presented as the operator's", () => {
    expect(panel).toMatch(/held in bounded custody/);
  });

  it('asks for the wallet password ONLY on the principal branch', () => {
    const at = panel.indexOf("r.completion === 'principal-signature' && isOpen");
    expect(at).toBeGreaterThan(-1);
    // The agent branch has no password input of its own.
    expect(panel.match(/type="password"/g)?.length ?? 0).toBe(1);
  });

  it('signs the request payload verbatim — never a message assembled here', () => {
    expect(panel).toMatch(/signMessage\(request\.payload\)/);
  });

  it('never sends the password or a plaintext key', () => {
    const bodies = panel.match(/JSON\.stringify\([\s\S]{0,200}?\)/g) ?? [];
    for (const b of bodies) {
      expect(b).not.toMatch(/password/i);
      expect(b).not.toMatch(/plaintextKey/);
    }
  });

  it('drops the plaintext key and password when the act ends', () => {
    expect(panel).toMatch(/plaintextKey = ''/);
    expect(panel).toMatch(/setPassword\(''\)/);
  });

  it('offers no control for an action with no completion route', () => {
    // A button that 404s is the defect that produced the "Unexpected token
    // '<'" report on the Register button.
    expect(panel).toMatch(/!r\.completion \?/);
    expect(panel).toMatch(/NO_COMPLETION_ROUTE_YET/);
  });

  it('an expired request is never revived', () => {
    expect(panel).toMatch(/expired request is never revived/i);
  });
});

describe('refusal is a real outcome', () => {
  const route = stripComments(readSource('app/api/wallet/signing-requests/[requestId]/refuse/route.ts'));

  it('writes the refused status the state machine already carries', () => {
    expect(route).toMatch(/status: 'refused'/);
    expect(route).toMatch(/OPERATOR_DECLINED/);
  });

  it('may only be exercised by the persona the request was prepared for', () => {
    expect(route).toMatch(/record\.principalPersonaId !== persona\.personaId/);
  });

  it('refuses to re-resolve an already-resolved request', () => {
    expect(route).toMatch(/ALREADY_RESOLVED/);
  });

  it('says plainly that it undoes nothing already done', () => {
    expect(route).toMatch(/has been undone|Nothing already completed/i);
  });
});

describe('the surface is mounted in the wallet shell', () => {
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));

  it('PENDING_ACTIONS is a wallet surface, not a separate app', () => {
    expect(drawer).toMatch(/"PENDING_ACTIONS"/);
    expect(drawer).toMatch(/walletSurface === 'PENDING_ACTIONS'/);
    expect(drawer).toMatch(/<PendingActionsPanel/);
  });

  it('the entry row appears only when something is actually waiting', () => {
    // A permanent "0 pending" row trains the operator to ignore it.
    expect(drawer).toMatch(/\(pendingActionCount \?\? 0\) > 0/);
  });

  it('an unknown count is not rendered as zero', () => {
    expect(drawer).toMatch(/setPendingActionCount\(null\)/);
  });
});
