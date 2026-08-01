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

import { describe, it, expect, beforeEach } from 'vitest';

import {
  surfaceStateFor,
  type PrincipalProvisioningState,
} from '@/components/wallet/PrincipalWalletProvisioningPanel';
import {
  requestWalletSurface,
  subscribeWalletSurfaceRequest,
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

describe('the surface request bus routes, it does not navigate', () => {
  beforeEach(() => __resetWalletSurfaceRequests());

  it('delivers the request to the owner', () => {
    const seen: string[] = [];
    subscribeWalletSurfaceRequest((r) => seen.push(r.surface));
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING');
    expect(seen).toEqual(['PRINCIPAL_WALLET_PROVISIONING']);
  });

  it('gives each request a new token, so a repeat re-opens the surface', () => {
    const tokens: number[] = [];
    subscribeWalletSurfaceRequest((r) => tokens.push(r.token));
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING');
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING');
    expect(tokens[1]).toBeGreaterThan(tokens[0]);
  });

  it('carries the return destination when one was given, and none when not', () => {
    let withReturn: unknown;
    let without: unknown;
    subscribeWalletSurfaceRequest((r) => {
      if (r.returnTo) withReturn = r.returnTo;
      else without = r;
    });
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING', { label: 'Continue', onReturn: () => {} });
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING');
    expect(withReturn).toBeTruthy();
    expect(without).toBeTruthy();
  });

  it('is silent with no subscriber rather than throwing', () => {
    // A Journey rendered outside a wallet host is legitimate; the stage's own
    // explanation still renders and must not be taken down by the request.
    expect(() => requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING')).not.toThrow();
  });

  it('unsubscribes cleanly', () => {
    const seen: number[] = [];
    const off = subscribeWalletSurfaceRequest((r) => seen.push(r.token));
    off();
    requestWalletSurface('PRINCIPAL_WALLET_PROVISIONING');
    expect(seen).toEqual([]);
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
    expect(register).toMatch(/Set up your principal wallet/);
    expect(register).toMatch(/requestWalletSurface\('PRINCIPAL_WALLET_PROVISIONING'/);
  });

  it('passes a return destination so the Journey resumes', () => {
    expect(register).toMatch(/label: `Continue to \$\{selectedAgent\.displayName\} registration`/);
    expect(register).toMatch(/onReturn/);
  });

  it('re-reads the gate on return rather than trusting its stale state', () => {
    const returnBlock = register.slice(register.indexOf('onReturn'), register.indexOf('onReturn') + 300);
    expect(returnBlock).toMatch(/readWalletGate\(\)/);
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
