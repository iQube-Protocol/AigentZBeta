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
import {
  PRINCIPAL_MANDATE_TTL_SECONDS,
  MANDATE_TTL_POLICY,
  humanLegIsNotTighterThanMachineLeg,
} from '@/services/signing/mandatePolicy';
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

  /*
   * ── Why expired rows are demoted (operator, 2026-08-02) ──────────────────
   *
   * Five consecutive mandates expired unsigned. The store orders by
   * created_at ASC and expired rows are never reaped, so the OLDEST dead ones
   * led and the list grew with every retry — the one request the operator
   * could actually sign was the sixth card down, under five identical
   * expired ones. Each attempt made the live one harder to find, which is how
   * a short TTL presented itself as "signing failed".
   */
  it('actionable rows lead; expired rows follow, under a divider that counts them', () => {
    expect(panel).toMatch(/const rows = groupRows\.filter\(\(r\) => !r\.expired\)/);
    expect(panel).toMatch(/const expiredRows = groupRows\.filter\(\(r\) => r\.expired\)/);
    expect(panel).toMatch(/\[\.\.\.rows, \.\.\.expiredRows\]/);
    expect(panel).toMatch(/expired — no longer actionable/);
  });

  it('a list of nothing but expired rows reads as "nothing waiting", and says why', () => {
    // "Nothing is waiting on you" alone would leave the operator wondering
    // where five attempts went; the count of expired ones is the answer.
    expect(panel).toMatch(/requests\.filter\(\(r\) => !r\.expired\)\.length === 0/);
    expect(panel).toMatch(/expired before being/);
  });
});

describe('the mandate window is a stated policy, not a literal in a service call', () => {
  /*
   * Operator, 2026-08-02: "I would widen it, but explicitly as an
   * operator-approved governance change … Record the TTL as a mandate-policy
   * parameter rather than burying it in UI code."
   *
   * A validity window bounds how long an authorisation may be exercised. That
   * is a governance decision, and it was a bare `600` sitting beside a bare
   * `900` with nothing saying either was deliberate — which is how the leg a
   * HUMAN performs ended up with the tighter window.
   */
  const ceremony = stripComments(readSource('services/horizen/registerCeremony.ts'));

  it('the ceremony carries no hardcoded window', () => {
    expect(ceremony).not.toMatch(/expiresInSeconds:\s*\d+/);
    expect(ceremony).toMatch(/expiresInSeconds: PRINCIPAL_MANDATE_TTL_SECONDS/);
    expect(ceremony).toMatch(/expiresInSeconds: AGENT_INVOCATION_TTL_SECONDS/);
  });

  it('the human leg is never given less time than the machine leg it precedes', () => {
    expect(humanLegIsNotTighterThanMachineLeg()).toBe(true);
    expect(PRINCIPAL_MANDATE_TTL_SECONDS).toBe(1800);
  });

  it('the policy records who approved it and why', () => {
    // A window nobody is named for is a window nobody can revisit.
    expect(MANDATE_TTL_POLICY.ratifiedBy).toBe('operator');
    expect(MANDATE_TTL_POLICY.ratifiedAt).toBe('2026-08-02');
    expect(MANDATE_TTL_POLICY.rationale).toMatch(/governance parameter/i);
    expect(MANDATE_TTL_POLICY.principalSeconds).toBe(PRINCIPAL_MANDATE_TTL_SECONDS);
  });
});

describe('a signer mismatch names its sources, not just two hex strings', () => {
  const ceremony = stripComments(readSource('services/horizen/registerCeremony.ts'));

  it('says which record the expected address came from, and where to reconcile', () => {
    // The signature is produced from evm_key.encryptedPrivateKey and validated
    // against personas.evm_address. Two records of one fact: while they agree
    // nothing is wrong, and when they diverge every correct signature is
    // refused. Naming only the values made a split record read as a broken
    // signer.
    // Anchored on the ADDRESS mismatch specifically — there is an earlier
    // SIGNER_MISMATCH for "this request is not yours", which is a different
    // refusal with a different remedy.
    const at = ceremony.indexOf('signature recovers to');
    expect(at).toBeGreaterThan(-1);
    const block = ceremony.slice(at - 200, at + 1200);
    expect(block).toMatch(/personas\.evm_address/);
    expect(block).toMatch(/address-reconciliation/);
    // And that nothing happened downstream — a refusal is not a partial act.
    expect(block).toMatch(/nothing was changed/i);
  });

  it('the reconciliation route reports sources, and admits the check it cannot make', () => {
    const route = stripComments(readSource('app/api/wallet/principal/address-reconciliation/route.ts'));
    for (const field of ['resolverAnswer', 'personasEvmAddress', 'evmKeyAddress']) {
      expect(route, field).toMatch(new RegExp(field));
    }
    expect(route).toMatch(/notCheckedHere/);
    // It must say WHOSE records it reconciled. Its first caller sent no
    // persona selection, the spine resolved a fallback, and a truthful answer
    // about the wrong persona read as an answer about the right one — the
    // same ambiguity this route exists to expose.
    expect(route).toMatch(/answeredForPersona/);
    // The persona's own display_name — T1, owner self-view. NOT `displayLabel`,
    // which lives on the T1 surface type and not on the server-side context the
    // spine hands a route; the scoped typecheck caught that guess.
    expect(route).toMatch(/display_name/);
    // T1 only: the label names the persona; the raw id never crosses.
    expect(route).not.toMatch(/personaId: persona\.personaId/);
    // It must never decrypt, and never accept a password. It DOES name the
    // password when explaining the comparison it cannot make — omitting that
    // would let a three-of-four reconciliation read as complete.
    // Forbid the ACT, not the word: the route names both the password and the
    // encrypted key when describing where a signature comes from and which
    // comparison it cannot make. Naming them is the honesty; calling them
    // would be the breach.
    expect(route).not.toMatch(/decryptPrivateKey\s*\(/);
    expect(route).not.toMatch(/crypto\.subtle|deriveKey\s*\(/);
    expect(route).not.toMatch(/body\.password|password\s*[:=]\s*[a-z]/i);
    expect(route).toMatch(/notCheckedHere/);
    // Owner self-view — never a personaId from the query string.
    expect(route).toMatch(/getActivePersona/);
    expect(route).not.toMatch(/searchParams\.get\('personaId'\)/);
  });
});

describe('the wallet badge counts acts that are actually waiting', () => {
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));

  it('pending and expired are counted separately, never merged', () => {
    // Operator: "A useful split would be: 2 pending / 5 expired — rather than
    // presenting seven equivalent requests."
    expect(drawer).toMatch(/setExpiredActionCount/);
    expect(drawer).toMatch(/expiredActionCount/);
    expect(drawer).toMatch(/expired before completion|expired`/);
  });

  it('expired rows are excluded from the count', () => {
    // They stay `pending` in the store until something acts on them, so an
    // unfiltered length reported five dead mandates as five waiting acts.
    // Overstating is the same defect as understating.
    expect(drawer).toMatch(/filter\(\(r\) => !r\?\.expired\)\.length/);
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

  /*
   * ── Why the "only when waiting" rule was reversed (operator, 2026-08-02) ──
   *
   *   > "even if it doesn't open I dont see anywhere to sign it manually if I
   *   >  open the wallet my self manually."
   *
   * The row rendered only for `count > 0`, so an unreadable count (null) was
   * pixel-identical to none — the unknown/absent collapse this codebase
   * forbids — and, worse, the signing surface was reachable only through a
   * successful count query. The manual route exists precisely for when the
   * deep link fails; a manual route that can itself vanish is not a route.
   */
  it('the entry row is present for a signed-in persona in every count state', () => {
    // Anchored on CODE, not on the comment — stripComments removes the
    // comment, which is how the first version of this canary passed on ''.
    const at = drawer.indexOf("setWalletSurface('PENDING_ACTIONS')");
    expect(at).toBeGreaterThan(-1);
    const block = drawer.slice(at - 400, at + 2600);
    // Gated on identity only — never on the count.
    expect(block).toMatch(/sessionEmail && effectivePersonaId && \(\s*<button/);
    expect(block, 'the count must not gate the row').not.toMatch(
      /effectivePersonaId && \(pendingActionCount \?\? 0\) > 0 &&/,
    );
  });

  it('the three count states say three different things', () => {
    const at = drawer.indexOf("setWalletSurface('PENDING_ACTIONS')");
    const block = drawer.slice(at - 400, at + 2600);
    // unknown: explicitly not the same claim as none
    expect(block).toMatch(/pendingActionCount === null/);
    expect(block).toMatch(/not the same as having none/i);
    // none, and waiting — distinct copy, so the operator reads a state
    expect(block).toMatch(/Nothing waiting on your signature/);
    expect(block).toMatch(/Waiting on your signature or approval/);
  });

  it('the count badge renders only for a KNOWN non-zero count', () => {
    // A badge over an unreadable count would assert a number nobody read.
    const at = drawer.indexOf("setWalletSurface('PENDING_ACTIONS')");
    const block = drawer.slice(at - 400, at + 2600);
    expect(block).toMatch(/pendingActionCount !== null && pendingActionCount > 0 &&/);
  });

  it('an unknown count is not rendered as zero', () => {
    expect(drawer).toMatch(/setPendingActionCount\(null\)/);
  });
});

describe('a wallet hand-over that reaches nobody is reported, not silent', () => {
  /*
   * Three rounds were spent guessing which component hears a wallet-surface
   * request, and every round ended with the same operator report: the button
   * does nothing, the console says nothing. Delivery was unobservable by
   * construction, so "no listener" and "listener that rendered nothing" were
   * the same observation. The ACK makes them different.
   */
  const bus = stripComments(readSource('services/wallet/walletSurfaceRequest.ts'));
  const register = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));

  it('the channel carries an acknowledgement', () => {
    expect(bus).toMatch(/WALLET_SURFACE_ACK_TYPE/);
    expect(bus).toMatch(/export function acknowledgeWalletSurfaceRequest/);
    expect(bus).toMatch(/export function subscribeWalletSurfaceAck/);
  });

  it('every host that can open a wallet acknowledges when it acts', () => {
    for (const host of [
      'app/triad/components/CodexPanelDynamic.tsx',
      'app/components/codex/CodexCopilotLayer.tsx',
      'app/components/content/SmartWalletDrawer.tsx',
    ]) {
      const src = stripComments(readSource(host));
      expect(src, `${host} subscribes`).toMatch(/subscribeWalletSurfaceRequest/);
      expect(src, `${host} acknowledges`).toMatch(/acknowledgeWalletSurfaceRequest\(/);
    }
  });

  it('publish and acknowledge are both traced, with the token', () => {
    // "Nothing in console" must become evidence: publish-without-ack localises
    // the fault to the receiver, neither localises it to the click.
    expect(bus).toMatch(/trace\('published'/);
    expect(bus).toMatch(/trace\('acknowledged'/);
    expect(bus).toMatch(/\[wallet-surface\]/);
  });

  it('the Register stage states an unanswered hand-over and names the manual route', () => {
    expect(register).toMatch(/subscribeWalletSurfaceAck/);
    expect(register).toMatch(/handoffUnanswered/);
    expect(register).toMatch(/No wallet surface in this page answered/);
    // The mandate survives the failed hand-over; saying so is why the manual
    // route is worth following rather than starting over.
    expect(register).toMatch(/stored and still waiting/);
    expect(register).toMatch(/Pending actions/);
  });
});

describe('the wallet never says "nothing waiting" from a cached read', () => {
  /*
   * ── The defect this exists to prevent, which already happened ────────────
   *
   * Operator, 2026-08-02 01:29. Two screenshots, the SAME minute:
   *
   *   Journey:  live mandate sr_fd35e233…, 29:25 remaining
   *   Wallet:   "Nothing is waiting on you · 5 earlier requests expired"
   *
   * The wallet was not showing the mandate that existed — so it could not be
   * signed, and six consecutive mandates died unsigned. Every other fix that
   * night was upstream of a surface that would not re-read.
   *
   * The cause: this panel loaded ONCE on mount, and `load` only changes with
   * `personaId`. It mounts when the wallet switches TO this surface — but on
   * the normal path (check the wallet, go back to the Journey, prepare a
   * mandate, click "Sign in your wallet") the operator was ALREADY here, so
   * the drawer never unmounted it. The deep link delivered them to a stale
   * list, and the most consequential sentence this surface can say — "nothing
   * is waiting on you" — was said from cache.
   */
  const panel = stripComments(readSource('components/wallet/PendingActionsPanel.tsx'));

  it('re-reads when a wallet-surface request arrives — the path that failed', () => {
    // A deep link ARRIVING is the strongest possible signal that something new
    // exists. It must never land on a cached list.
    expect(panel).toMatch(/subscribeWalletSurfaceRequest\(\(request\) => \{/);
    expect(panel).toMatch(/request\.surface !== 'PENDING_ACTIONS'/);
  });

  it('re-reads on window focus and on an interval', () => {
    // Focus: returning from the Journey tab. Interval: mandates expire on a
    // clock, so the list goes stale with no event at all.
    expect(panel).toMatch(/addEventListener\('focus', onFocus\)/);
    expect(panel).toMatch(/setInterval\(refreshIfIdle, 20_000\)/);
  });

  it('offers a manual refresh, so nothing depends on a timer', () => {
    expect(panel).toMatch(/onClick=\{\(\) => void load\(\)\}/);
    expect(panel).toMatch(/'Checking…' : 'Refresh'/);
  });

  it('a background refresh never replaces the surface with a spinner', () => {
    /*
     * MY OWN REGRESSION, one turn after adding the refresh (operator: "there
     * is no approval that is appearing").
     *
     * `load()` sets loading=true and the early return replaced the ENTIRE
     * panel with a spinner. Harmless when the only load was on mount; the
     * moment an interval/focus/deep-link refresh existed, each one tore the
     * password field and the Sign button off the screen mid-act. The operator
     * reaches for the control and it is not there.
     *
     * The spinner belongs to the FIRST read only. After that, `requests` holds
     * the last good list — replacing it with a spinner discards known truth to
     * display the absence of a fetch.
     */
    expect(panel).toMatch(/if \(loading && requests === null && !loadRefusal\)/);
    expect(panel).not.toMatch(/^\s*if \(loading\) \{$/m);
  });

  it('never refreshes while the operator is mid-act', () => {
    // Password open, signature in flight, or a refusal being confirmed — a
    // re-render under their hands can discard a half-typed password.
    expect(panel).toMatch(/midActRef\.current = openId !== null \|\| busyId !== null \|\| refusingId !== null/);
    expect(panel).toMatch(/if \(midActRef\.current\) return;/);
    expect(panel).toMatch(/setInterval\(refreshIfIdle, 20_000\)/);
  });

  it('every listener is torn down — a leaked interval outlives the wallet', () => {
    expect(panel).toMatch(/unsubscribe\(\);/);
    expect(panel).toMatch(/removeEventListener\('focus', onFocus\)/);
    expect(panel).toMatch(/clearInterval\(interval\)/);
  });
});
