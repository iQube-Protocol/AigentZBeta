/**
 * File-backed nonce/attempt ledger for the pilot treasury authority gate
 * (`services/treasury/pilotTreasuryAuthority.js`).
 *
 * Plain CommonJS, matching `scripts/deploy-qct-bitcoin.js`'s own style (a
 * plain `node`-invoked script) so it can be required with no toolchain
 * change. This is real filesystem IO — deliberately NOT subject to the
 * `services/research/review/*` "no clock, no randomness" discipline, since
 * this module is not part of that capability and genuinely needs to read
 * the clock to enforce a lockout WINDOW.
 *
 * The ledger file itself (`scripts/.treasury-mandate-ledger.json`) is
 * gitignored — it is local operational state (used nonces + failed-attempt
 * timestamps), never committed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '.treasury-mandate-ledger.json');
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function loadLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return { usedNonces: {}, failedAttempts: [] };
  let raw;
  try {
    raw = fs.readFileSync(ledgerPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `treasury mandate ledger at ${ledgerPath} is present but unreadable/corrupt -- refusing rather ` +
        `than treating it as empty (a corrupt ledger could otherwise silently forget used nonces or a ` +
        `lockout in progress): ${err.message}`,
    );
  }
}

function saveLedger(ledgerPath, ledger) {
  const tmpPath = `${ledgerPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2));
  fs.renameSync(tmpPath, ledgerPath);
}

function createFileBackedNonceStore(ledgerPath = DEFAULT_LEDGER_PATH) {
  return {
    hasBeenUsed(nonce) {
      const ledger = loadLedger(ledgerPath);
      return Boolean(ledger.usedNonces[nonce]);
    },
    markUsed(nonce, mandateCommitment) {
      const ledger = loadLedger(ledgerPath);
      ledger.usedNonces[nonce] = { mandateCommitment, usedAt: new Date().toISOString() };
      saveLedger(ledgerPath, ledger);
    },
  };
}

function recordFailedPasscodeAttempt(ledgerPath = DEFAULT_LEDGER_PATH) {
  const ledger = loadLedger(ledgerPath);
  ledger.failedAttempts = ledger.failedAttempts || [];
  ledger.failedAttempts.push({ at: new Date().toISOString() });
  saveLedger(ledgerPath, ledger);
}

/**
 * Throws if too many failed passcode attempts have landed within the
 * lockout window -- a hard control, checked BEFORE the passcode prompt even
 * runs, so a brute-force loop cannot burn through guesses at will.
 */
function assertNotLockedOut(ledgerPath = DEFAULT_LEDGER_PATH, nowMs = Date.now()) {
  const ledger = loadLedger(ledgerPath);
  const recent = (ledger.failedAttempts || []).filter((a) => nowMs - new Date(a.at).getTime() < LOCKOUT_WINDOW_MS);
  if (recent.length >= MAX_FAILED_ATTEMPTS) {
    const oldestRecent = recent.reduce((min, a) => Math.min(min, new Date(a.at).getTime()), Infinity);
    const retryAtMs = oldestRecent + LOCKOUT_WINDOW_MS;
    const waitMinutes = Math.max(1, Math.ceil((retryAtMs - nowMs) / 60000));
    throw new Error(
      `treasury passcode locked out: ${recent.length} failed attempts within the last ` +
        `${LOCKOUT_WINDOW_MS / 60000} minutes. Wait ~${waitMinutes} more minute(s) before retrying.`,
    );
  }
}

module.exports = {
  DEFAULT_LEDGER_PATH,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_WINDOW_MS,
  createFileBackedNonceStore,
  recordFailedPasscodeAttempt,
  assertNotLockedOut,
};
