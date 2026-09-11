/**
 * Test-environment bootstrap: guarantee `globalThis.crypto` (WebCrypto).
 *
 * WHY — `services/passport/selfCustodyVault.ts` is a CLIENT-side module: it
 * deliberately uses only `globalThis.crypto` and imports nothing from Node, so
 * the holder-derived key never touches a server code path. In a browser that
 * global is always present. Under Node it is present as a DEFAULT global only
 * from Node 19 onward — on Node 18 it needs `--experimental-global-webcrypto`.
 * (The module's own header said "Node 18+", which is why this went unnoticed;
 * that claim is now corrected in the file.)
 *
 * The result was environment-dependent test failures: four vault tests passed
 * on Node 20/22 and failed on Node 18 with
 * `Cannot read properties of undefined (reading 'getRandomValues')` —
 * a red suite caused by the runner's Node version, not by the code under test.
 *
 * This installs the SAME WebCrypto implementation Node exposes as the global
 * (`node:crypto`.webcrypto) only when it is absent. It is a runner shim, not a
 * fallback in the security module: the vault's client-only contract is
 * unchanged, nothing is weakened, and no alternative crypto is substituted.
 * When the global already exists it is left strictly alone.
 */

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
