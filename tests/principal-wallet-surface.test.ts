/**
 * PRINCIPAL_WALLET_PROVISIONING — the wallet surface, and the boundary it holds.
 *
 *   > "Journey detects and explains the prerequisite
 *   >  → SmartWallet provisions and proves the wallet
 *   >  → Journey resumes the consequential act"
 *   >
 *   > "Wallet creation and proof belong to the wallet. The Journey invokes
 *   >  them only when a consequential act requires them."
 *
 * Three things could break that, and each has a canary here: the ceremony
 * appearing as a modal or a Register-stage component (a second implementation
 * of what the wallet owns), the Journey provisioning anything itself, and the
 * operator being told a wallet is missing with no way to reach the remedy.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';

import {
  surfaceStateFor,
  type PrincipalProvisioningState,
} from '@/components/wallet/PrincipalWalletProvisioningPanel';
import {
  requestWalletSurface,
  subscribeWalletSurfaceRequest,
  subscribeWalletSurfaceCompletion,
  announceWalletSurfaceCompletion,
  __resetWalletSurfaceRequests,
} from '@/services/wallet/walletSurfaceRequest';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

function status(over: Partial<Parameters<typeof surfaceStateFor>[0] & object> = {}) {
  return {
    capability: 'ABSENT',
    address: null,
    detail: '',
    remediation: null,
    controlProven: false,
    supersededPlaceholder: null,
    linkedExternalWallets: [],
    ...over,
  } as Parameters<typeof surfaceStateFor>[0];
}

describe('capability maps to exactly the ten states', () => {
  const cases: [string, boolean, PrincipalProvisioningState][] = [
    ['ABSENT', false, 'NOT_CONFIGURED'],
    ['AMBIGUOUS', false, 'AMBIGUOUS_DATA_DETECTED'],
    ['ADDRESS_ONLY', false, 'READY_TO_PROVISION'],
    ['EXTERNAL_UNPROVEN', false, 'READY_TO_PROVISION'],
    ['EXTERNAL_PROVEN', false, 'READY_TO_PROVISION'],
    ['PRESENT_BUT_UNBOUND', false, 'READY_TO_PROVISION'],
    ['LEGACY_EVIDENCE_ONLY', false, 'QUARANTINED'],
    ['COMPROMISED', false, 'QUARANTINED'],
    ['SIGNER_CONFIGURED', false, 'AWAITING_CONTROL_PROOF'],
    ['SIGNER_CONFIGURED', true, 'CONTROL_PROVEN'],
    ['MALFORMED', false, 'REFUSED'],
  ];

  for (const [capability, controlProven, expected] of cases) {
    it(`${capability}${controlProven ? ' + proven' : ''} → ${expected}`, () => {
      expect(surfaceStateFor(status({ capability, controlProven }))).toBe(expected);
    });
  }

  it('a configured signer is NOT proven until a proof says so', () => {
    // The one distinction the whole repair turns on. Collapsing these would
    // report a wallet as ready on the strength of a row having been written.
    expect(surfaceStateFor(status({ capability: 'SIGNER_CONFIGURED', controlProven: false }))).not.toBe(
      'CONTROL_PROVEN',
    );
  });

  it('UNAVAILABLE is REFUSED, never NOT_CONFIGURED', () => {
    // "Could not check" is not "you have none". Offering provisioning on an
    // unknown answer invites a second wallet for a persona that has one.
    expect(surfaceStateFor(status({ capability: 'UNAVAILABLE' }))).toBe('REFUSED');
  });

  it('a missing status is REFUSED rather than an empty state', () => {
    expect(surfaceStateFor(null)).toBe('REFUSED');
  });
});

/*
 * A minimal `window` for the SAME-DOCUMENT channel.
 *
 * The suite runs on `environment: "node"` (vitest.config.mjs), so there is no
 * window at all and `subscribeWalletSurfaceRequest` correctly returns a no-op.
 * An `EventTarget` exercises the real code path: `dispatchEvent` is synchronous
 * in browsers too, so the fake is faithful for this channel.
 *
 * WHAT THIS CANNOT COVER, said plainly rather than implied: the `postMessage`
 * climb to ancestor windows — the half that carries a request out of an iframe
 * — needs real frames. That is exactly the gap the module bus fell through, so
 * it is named here rather than left to look tested. The browser acceptance run
 * is what closes it.
 */
class FakeWindow extends EventTarget {
  parent: FakeWindow = this;
  postMessage(): void {
    /* the cross-realm half; unexercised in node, see above */
  }
}
const hadWindow = typeof (globalThis as { window?: unknown }).window !== 'undefined';
if (!hadWindow) {
  (globalThis as unknown as { window: FakeWindow }).window = new FakeWindow();
}
afterAll(() => {
  if (!hadWindow) delete (globalThis as { window?: unknown }).window;
});

describe('the request is serializable and crosses realms', () => {
  beforeEach(() => __resetWalletSurfaceRequests());

  it('survives structured cloning — the iframe test the module bus failed', () => {
    // The first version was a module-level Set. It passed every canary and was
    // dead in the browser, because the Multi-Cartridge Viewer puts an iframe
    // between the Journey and the wallet and they never shared a module.
    let captured: unknown = null;
    const off = subscribeWalletSurfaceRequest((r) => { captured = r; });
    requestWalletSurface({
      surface: 'PRINCIPAL_WALLET_PROVISIONING',
      origin: 'HORIZEN_REGISTER',
      subjectAgentId: 'aigent-nakamoto',
      returnTarget: 'journey:horizen:register:aigent-nakamoto',
      returnLabel: 'Continue to Aigent Nakamoto registration',
    });
    off();
    expect(captured).toBeTruthy();
    // structuredClone throws on a function; passing proves nothing unclonable
    // rode along.
    expect(() => structuredClone(captured)).not.toThrow();
    expect(JSON.parse(JSON.stringify(captured))).toMatchObject({
      surface: 'PRINCIPAL_WALLET_PROVISIONING',
      origin: 'HORIZEN_REGISTER',
      subjectAgentId: 'aigent-nakamoto',
      returnTarget: 'journey:horizen:register:aigent-nakamoto',
    });
  });

  it('carries no function anywhere in the payload', () => {
    let captured: Record<string, unknown> | null = null;
    const off = subscribeWalletSurfaceRequest((r) => { captured = r as unknown as Record<string, unknown>; });
    requestWalletSurface({ surface: 'PRINCIPAL_WALLET_PROVISIONING', origin: 'HORIZEN_REGISTER' });
    off();
    for (const v of Object.values(captured ?? {})) expect(typeof v).not.toBe('function');
  });

  it('delivers to a listener registered on window, not a module Set', () => {
    const seen: string[] = [];
    const off = subscribeWalletSurfaceRequest((r) => seen.push(r.surface));
    requestWalletSurface({ surface: 'PRINCIPAL_WALLET_PROVISIONING', origin: 'WALLET_ENTRY' });
    off();
    expect(seen).toEqual(['PRINCIPAL_WALLET_PROVISIONING']);
  });

  it('gives each request a new token, so a repeat re-opens the surface', () => {
    const tokens: number[] = [];
    const off = subscribeWalletSurfaceRequest((r) => tokens.push(r.token));
    requestWalletSurface({ surface: 'PRINCIPAL_WALLET_PROVISIONING', origin: 'a' });
    requestWalletSurface({ surface: 'PRINCIPAL_WALLET_PROVISIONING', origin: 'b' });
    off();
    expect(tokens[1]).toBeGreaterThan(tokens[0]);
  });

  it('is silent with no subscriber rather than throwing', () => {
    expect(() => requestWalletSurface({ surface: 'PRINCIPAL_WALLET_PROVISIONING', origin: 'x' })).not.toThrow();
  });

  it('unsubscribes cleanly', () => {
    const seen: number[] = [];
    const off = subscribeWalletSurfaceCompletion((c) => seen.push(1));
    off();
    announceWalletSurfaceCompletion({ surface: 'PRINCIPAL_WALLET_PROVISIONING', outcome: 'CONTROL_PROVEN' });
    expect(seen).toEqual([]);
  });

  it('the completion event is serializable too, and names the outcome', () => {
    let captured: unknown = null;
    const off = subscribeWalletSurfaceCompletion((c) => { captured = c; });
    announceWalletSurfaceCompletion({
      surface: 'PRINCIPAL_WALLET_PROVISIONING',
      outcome: 'SIGNER_CONFIGURED_AWAITING_PROOF',
      returnTarget: 'journey:horizen:register:aigent-nakamoto',
    });
    off();
    expect(() => structuredClone(captured)).not.toThrow();
    expect(captured).toMatchObject({ outcome: 'SIGNER_CONFIGURED_AWAITING_PROOF' });
  });

  it('distinguishes a proven completion from a partial one', () => {
    // "A provisioning write is not completion; authoritative control proof is
    // completion." A single 'done' outcome would erase that distinction at the
    // exact boundary it has to survive.
    const outcomes: string[] = [];
    const off = subscribeWalletSurfaceCompletion((c) => outcomes.push(c.outcome));
    announceWalletSurfaceCompletion({ surface: 'PRINCIPAL_WALLET_PROVISIONING', outcome: 'CONTROL_PROVEN' });
    announceWalletSurfaceCompletion({ surface: 'PRINCIPAL_WALLET_PROVISIONING', outcome: 'SIGNER_CONFIGURED_AWAITING_PROOF' });
    off();
    expect(outcomes).toEqual(['CONTROL_PROVEN', 'SIGNER_CONFIGURED_AWAITING_PROOF']);
  });
});

describe('the ceremony lives in the wallet and nowhere else', () => {
  const panel = readSource('components/wallet/PrincipalWalletProvisioningPanel.tsx');
  const register = readSource('components/journey/RegisterAgentPanel.tsx');
  const drawer = readSource('app/components/content/SmartWalletDrawer.tsx');

  it('the Journey never runs the ceremony itself', () => {
    expect(
      forbiddenImportFindings(
        register,
        ['provisionPrincipalWallet', 'generateEvmKeyPair', 'encryptPrivateKey', 'decryptPrivateKey'],
        ['wallet/provisionPrincipalWalletClient', 'wallet/keyService'],
      ),
    ).toEqual([]);
  });

  it('the Journey never mounts the wallet panel — it requests', () => {
    expect(
      forbiddenImportFindings(register, ['PrincipalWalletProvisioningPanel', 'SmartWalletDrawer'], [
        'wallet/PrincipalWalletProvisioningPanel',
        'content/SmartWalletDrawer',
      ]),
    ).toEqual([]);
    expect(stripComments(register)).toMatch(/requestWalletSurface\(/);
  });

  it('the panel is not a modal', () => {
    const code = stripComments(panel);
    expect(code).not.toMatch(/createPortal|role="dialog"|<Dialog|fixed inset-0/);
  });

  it('the drawer mounts the panel as a wallet surface', () => {
    const code = stripComments(drawer);
    expect(code).toMatch(/walletSurface === 'PRINCIPAL_WALLET_PROVISIONING'/);
    expect(code).toMatch(/<PrincipalWalletProvisioningPanel/);
  });

  it('the surface is reachable from the wallet itself, not only via a deep link', () => {
    // The legacy-evidence block renders only when the principal is
    // UNRESOLVED, and the operator's own row is not that case — a remedy
    // reachable only from a diagnosis that does not fire is not reachable.
    const code = stripComments(drawer);
    const entries = code.match(/setWalletSurface\('PRINCIPAL_WALLET_PROVISIONING'\)/g) ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('the drawer re-opens on a NEW token, not on every render', () => {
    const code = stripComments(drawer);
    expect(code).toMatch(/lastWalletSurfaceTokenRef/);
    expect(code).toMatch(/walletSurfaceRequestToken === lastWalletSurfaceTokenRef\.current/);
  });
});

describe('Register detects and explains before it offers', () => {
  const register = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));

  it('reads the wallet gate before the mandate button is offered', () => {
    expect(register).toMatch(/\/api\/wallet\/principal\/status/);
    expect(register).toMatch(/walletGate\?\.ready &&/);
  });

  it('requires BOTH configured and proven', () => {
    expect(register).toMatch(/capability === 'SIGNER_CONFIGURED' && Boolean\(json\.controlProven\)/);
  });

  it('treats an unreadable gate as not-ready and not as absent', () => {
    expect(register).toMatch(/capability: 'UNKNOWN'/);
    expect(register).toMatch(/could not be read/);
  });

  it('offers the wallet ceremony rather than describing it', () => {
    expect(register).toMatch(/requestWalletSurface\(\{/);
    expect(register).toMatch(/shown\.action/);
  });

  it('passes a serializable return label, not a callback', () => {
    // Both call sites now go through `handOverToWallet`, which builds the
    // request once — so the fields are asserted where they are constructed.
    expect(register).toMatch(/returnLabel: `Continue to \$\{agentName\} registration`/);
    // The old `onReturn` closure could not cross the iframe boundary at all.
    expect(register).not.toMatch(/onReturn:/);
  });

  it('shows a checking state rather than an unlocked button before the gate resolves', () => {
    expect(register).toMatch(/!walletGate &&/);
    expect(register).toMatch(/Checking your principal wallet/);
  });
});

describe('the panel keeps the password local', () => {
  const code = stripComments(readSource('components/wallet/PrincipalWalletProvisioningPanel.tsx'));

  it('never puts the password into a request body', () => {
    const bodies = code.match(/JSON\.stringify\([\s\S]{0,300}?\)/g) ?? [];
    for (const b of bodies) expect(b).not.toMatch(/password/i);
  });

  it('clears the password from component state when the ceremony ends', () => {
    expect(code).toMatch(/setPassword\(''\)/);
    expect(code).toMatch(/setConfirm\(''\)/);
  });

  it('requires the two password fields to agree', () => {
    expect(code).toMatch(/password === confirm/);
  });

  it('requires an explicit acknowledgement before an ambiguous repair', () => {
    // Two addresses with opposite remedies: superseding the wrong one severs
    // a real binding, so the operator sees what happens to each first.
    expect(code).toMatch(/needsAcknowledgement/);
    expect(code).toMatch(/!needsAcknowledgement \|\| acknowledged/);
  });

  it('names all three parts of the repair explicitly', () => {
    expect(code).toMatch(/EXTERNAL_UNPROVEN/);
    expect(code).toMatch(/ADDRESS_ONLY \/ superseded \/ non-signing/);
    expect(code).toMatch(/first-party principal wallet/);
  });

  it('uses personaFetch, never raw fetch, for the spine endpoint', () => {
    expect(code).toMatch(/personaFetch\(/);
    expect(code).not.toMatch(/[^a-zA-Z]fetch\(['"`]\/api/);
  });

  it('does not classify the wallet itself — the server does', () => {
    // A second classifier here would disagree with the first one the moment
    // either changed (inv.engineering.037).
    expect(code).not.toMatch(/from\(['"]personas['"]\)/);
    expect(code).not.toMatch(/encryptedPrivateKey/);
  });
});

describe('the deep link works in every host, not only where the copilot mounts', () => {
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));
  const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));

  it('the wallet itself listens, so an open drawer honours a request in any host', () => {
    // Four mounts exist (copilot layer, SmartTriad surfaces, KnytTab,
    // DevPersonaTab) and only one was wired to forward. A request reaching a
    // host with no forwarder opened nothing — the browser-run failure, one
    // layer up.
    expect(drawer).toMatch(/subscribeWalletSurfaceRequest\(/);
    expect(drawer).toMatch(/setWalletSurface\('PRINCIPAL_WALLET_PROVISIONING'\)/);
  });

  it('the host still subscribes — only a host can open a CLOSED wallet', () => {
    expect(copilot).toMatch(/subscribeWalletSurfaceRequest\(/);
    expect(copilot).toMatch(/launchWalletRef\.current/);
  });

  it('no callback crosses the boundary — returnTarget is an identifier', () => {
    expect(drawer).toMatch(/walletSurfaceReturnTarget/);
    expect(drawer).not.toMatch(/walletSurfaceReturn\?:\s*\{\s*label[^}]*onReturn/);
  });
});

describe('the acceptance conditions the operator specified', () => {
  const register = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
  const panel = stripComments(readSource('components/wallet/PrincipalWalletProvisioningPanel.tsx'));

  it('Register opens the wallet on PRINCIPAL_WALLET_PROVISIONING with a serializable request', () => {
    expect(register).toMatch(/requestWalletSurface\(\{/);
    // The surface is chosen by the caller and passed through the one helper
    // that builds the request; the identity fields live in the helper.
    expect(register).toMatch(/handOverToWallet\('PRINCIPAL_WALLET_PROVISIONING'/);
    expect(register).toMatch(/origin: 'HORIZEN_REGISTER'/);
    expect(register).toMatch(/subjectAgentId: `aigent-\$\{agentSlugForReturn\}`/);
    expect(register).toMatch(/returnTarget: `journey:horizen:register:aigent-\$\{agentSlugForReturn\}`/);
  });

  it('successful provisioning does not announce completion before CONTROL_PROVEN', () => {
    // The announcement is gated on a FRESH status read, not on the ceremony's
    // own report of itself.
    expect(panel).toMatch(/confirmed\?\.capability === 'SIGNER_CONFIGURED' && confirmed\.controlProven/);
    expect(panel).toMatch(/announce\('CONTROL_PROVEN'\)/);
    expect(panel).toMatch(/PROOF_NOT_CONFIRMED_BY_STATUS/);
  });

  it('a configured-but-unproven wallet offers Retry proof, never Create', () => {
    const at = panel.indexOf("state === 'AWAITING_CONTROL_PROOF'");
    expect(at).toBeGreaterThan(-1);
    const block = panel.slice(at, panel.indexOf('</Section>', at));
    expect(block).toMatch(/Retry control proof/);
    expect(block).toMatch(/retryProof\(\)/);
    expect(block).not.toMatch(/Create and prove principal wallet/);
  });

  it('the create form is not reachable from a configured state', () => {
    // baseState drives the form; AWAITING_CONTROL_PROOF is not in its list.
    const at = panel.indexOf("['NOT_CONFIGURED', 'AMBIGUOUS_DATA_DETECTED', 'READY_TO_PROVISION'].includes(baseState)");
    expect(at).toBeGreaterThan(-1);
    expect(panel.slice(at, at + 200)).not.toMatch(/AWAITING_CONTROL_PROOF/);
  });

  it('returning to Register triggers a fresh authoritative status read', () => {
    expect(register).toMatch(/subscribeWalletSurfaceCompletion\(/);
    const at = register.indexOf('subscribeWalletSurfaceCompletion(');
    expect(register.slice(at, at + 400)).toMatch(/readWalletGate\(\)/);
    expect(register).toMatch(/cache: 'no-store'/);
  });

  it('CONTROL_PROVEN removes the prerequisite card', () => {
    // ready === SIGNER_CONFIGURED && controlProven; the prerequisite renders
    // only when !ready.
    expect(register).toMatch(/capability === 'SIGNER_CONFIGURED' && Boolean\(json\.controlProven\)/);
    expect(register).toMatch(/walletGate && !walletGate\.ready &&/);
    expect(register).toMatch(/walletGate\?\.ready &&/);
  });

  it('renders each non-ready capability separately, not one collapsed message', () => {
    for (const c of ['ABSENT', 'AMBIGUOUS', 'ADDRESS_ONLY', 'EXTERNAL_UNPROVEN', 'SIGNER_CONFIGURED', 'LEGACY_EVIDENCE_ONLY']) {
      expect(register, c).toContain(`case '${c}'`);
    }
    // The collapsed sentence survives for exactly one state.
    const occurrences = register.split('You do not yet have a principal wallet').length - 1;
    expect(occurrences).toBe(1);
  });

  it('a configured wallet is offered a retry in Register too, never a create', () => {
    const at = register.indexOf("case 'SIGNER_CONFIGURED':");
    const block = register.slice(at, at + 700);
    expect(block).toMatch(/Retry control proof/);
    expect(block).toMatch(/Nothing needs to be created/);
  });

  it('an unreadable status is not reported as an absent wallet', () => {
    expect(register).toMatch(/could not be read/);
    expect(register).toMatch(/does not mean you have no wallet/);
  });
});

describe('the surface explains why it will not act', () => {
  const panel = stripComments(readSource('components/wallet/PrincipalWalletProvisioningPanel.tsx'));

  it('names the reason the button is disabled', () => {
    // A grey button with no explanation is indistinguishable from a broken
    // one. The operator hit exactly that: the form looked complete and the
    // control did nothing.
    expect(panel).toMatch(/blockedBecause/);
    expect(panel).toMatch(/Enter a wallet password to continue/);
    expect(panel).toMatch(/do not match/);
  });

  it('validates password strength while typing, not only inside the ceremony', () => {
    expect(panel).toMatch(/validatePassword\(password\)/);
    expect(panel).toMatch(/strength\.valid/);
  });

  it('states the password rules before the fields', () => {
    const rules = panel.indexOf('At least 8 characters');
    const field = panel.indexOf("placeholder=\"Wallet password\"");
    expect(rules).toBeGreaterThan(-1);
    expect(rules).toBeLessThan(field);
  });

  it('renders a refusal ABOVE the form, not below the fold', () => {
    // In a narrow wallet column a refusal at the bottom is off-screen, so a
    // refused ceremony reads as a button that did nothing.
    const refusal = panel.indexOf('outcomeRefusal && (');
    const form = panel.indexOf('Create and prove principal wallet');
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(form);
  });
});

describe('a created wallet is visible, usable and exportable', () => {
  const panel = stripComments(readSource('components/wallet/PrincipalWalletProvisioningPanel.tsx'));
  const drawer = stripComments(readSource('app/components/content/SmartWalletDrawer.tsx'));

  it('the wallet entry row carries a state chip, not just a link', () => {
    // A successful ceremony left no trace anywhere the wallet is normally
    // looked at, so "did that work?" could only be answered by opening the
    // surface again.
    expect(drawer).toMatch(/principalChip/);
    expect(drawer).toMatch(/'proven' \| 'configured' \| 'none' \| null/);
  });

  it('an unknown state shows NO chip rather than "not set up"', () => {
    // Absent must read as "not checked", never as "you have no wallet".
    expect(drawer).toMatch(/setPrincipalChip\(null\)/);
    expect(drawer).toMatch(/principalChip === 'none'/);
  });

  it('the chip reads the same authoritative route, not a second classifier', () => {
    expect(drawer).toMatch(/\/api\/wallet\/principal\/status/);
    expect(drawer).not.toMatch(/encryptedPrivateKey/);
  });

  it('the proven state offers a copyable public receiving address', () => {
    const at = panel.indexOf('Receiving address');
    expect(at).toBeGreaterThan(-1);
    expect(panel).toMatch(/copyAddress\(/);
    expect(panel.slice(at)).toMatch(/Sharing this address is safe/);
  });

  it('the private key is decrypted in the browser, never fetched as plaintext', () => {
    // The operator's standing rule forbids "persona + password → plaintext
    // private key returned by server". This asks for CIPHERTEXT and decrypts
    // locally, which is a different mechanism.
    expect(panel).toMatch(/decryptPrivateKey\(/);
    expect(panel).toMatch(/\/api\/wallet\/principal\/envelope/);
    const bodies = panel.match(/JSON\.stringify\([\s\S]{0,300}?\)/g) ?? [];
    for (const b of bodies) expect(b).not.toMatch(/revealPassword/);
  });

  it('states the consequence before showing the key, and can hide it again', () => {
    expect(panel).toMatch(/controls this wallet completely and irreversibly/);
    expect(panel).toMatch(/hideKey/);
  });

  it('drops the reveal password from state after use', () => {
    expect(panel).toMatch(/setRevealPassword\(''\)/);
  });

  it('the envelope route returns ciphertext and nothing else', () => {
    const route = stripComments(readSource('app/api/wallet/principal/envelope/route.ts'));
    expect(route).toMatch(/encryptedEnvelope/);
    // No decryption server-side, and no password ever read from the request.
    expect(route).not.toMatch(/decryptPrivateKey|password/i);
  });
});

describe('every host that owns a wallet subscribes for it', () => {
  it('CodexPanelDynamic opens its standalone drawer on a request', () => {
    // The browser run that found this: the floating copilot is SUPPRESSED on
    // the Journey tab (the one place Register fires requests from), and the
    // drawer only listens while open — so the click delivered to a room with
    // nobody in it, silently.
    const host = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    expect(host).toMatch(/subscribeWalletSurfaceRequest\(/);
    expect(host).toMatch(/setWalletDrawerOpen\(true\)/);
    expect(host).toMatch(/initialWalletSurface=\{walletSurfaceDeepLink\?\.surface\}/);
  });

  it('the cartridge shell honours ALWAYS — it owns the drawer that renders', () => {
    /*
     * The guard this replaces deferred to the floating copilot unless the
     * copilot was suppressed. On the Journey tab the copilot is not
     * suppressed, only CLOSED — so it claimed every request, flipped its own
     * hidden `walletPanelOpen`, and rendered nothing. A listener that cannot
     * show a wallet must not be the one that wins.
     */
    const host = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    expect(host).not.toMatch(/copilotHandlesWalletRequests/);
    const at = host.indexOf('subscribeWalletSurfaceRequest(');
    const block = host.slice(Math.max(0, at - 400), at);
    // No early return guarding the subscription.
    expect(block).not.toMatch(/return undefined;/);
  });

  it('the claim is declared by mounting, and the copilot defers to it', () => {
    const host = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    expect(host).toMatch(/<WalletSurfaceHostProvider>/);
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/useIsWalletSurfaceHostClaimed\(\)/);
    expect(copilot).toMatch(/if \(walletSurfaceHostClaimed\) return undefined;/);
  });

  it('the copilot still subscribes where it IS the only wallet', () => {
    // The standalone Companion embed mounts the copilot with no cartridge
    // shell around it; removing its subscription outright would break that.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/subscribeWalletSurfaceRequest\(/);
  });

  it('a dismissed deep link is consumed, not remembered', () => {
    const host = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    expect(host).toMatch(/setWalletSurfaceDeepLink\(null\)/);
  });
});
