/**
 * metaMe Companion — Observer extension popup
 * (PRD-MMC-IMPL-001 §7 Increment 6; SPEC-MMC-003 §3.3 + §3.7, 2026-07-25.)
 *
 * Deliberately minimal, per the plan's own scope: this popup does NOT
 * duplicate `components/companion/ObserverGrantPanel.tsx` (Increment 4).
 * Grant management stays a single UI, hosted in the existing
 * `/triad/embed/companion` shell — "Open Companion" below opens that shell
 * (Wallet/Companion/Search/Overlay/Workspace) in the docked side panel.
 * Named for what it does (opens the whole Companion experience), not just
 * the grants sub-surface it happens to also host — renamed from "Manage
 * permissions" (2026-07-25) after the operator flagged that label as
 * undersold.
 *
 * Two things this popup DOES own, both from SPEC-MMC-003's Phase 1 pass:
 *
 *  1. §3.3 — PERSONA CONFIRMATION BEFORE PAIRING. "Connect" stays disabled
 *     until the background worker's PROBE_ACTIVE_PERSONA reports which
 *     persona would actually be paired, and the id it reports is passed back
 *     as `confirmedPersonaId` on CONNECT_METAME. The background worker
 *     refuses to pair without a match. This replaces the old post-hoc
 *     `personaFound: false` warning, which fired only AFTER a session with
 *     no persona hint had already been stored — every later server call then
 *     resolving through `getActivePersona`'s "first owned persona" fallback
 *     (the real 2026-07-24 incident, SPEC-MMC-003 §0.4).
 *
 *  2. §3.7 — ONE TRI-STATE VERIFICATION, not three status strings. A single
 *     VERIFY_COMPANION round-trip runs the three signals that already
 *     existed but were reported separately (valid session / persona stored /
 *     grants fetch succeeds) and renders exactly one of: Connected & verified,
 *     Connected — needs attention (naming the specific failing check), or
 *     Not connected.
 */

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const personaValue = document.getElementById('personaValue');
const personaHint = document.getElementById('personaHint');
const connectBtn = document.getElementById('connectBtn');
const recheckBtn = document.getElementById('recheckBtn');
const verifyBtn = document.getElementById('verifyBtn');

/** The persona the operator has been SHOWN. Only this value is ever sent as
 *  `confirmedPersonaId` — never a value the popup didn't display. */
let confirmedPersonaId = null;

// Slate house style: emerald = verified, amber = needs attention, slate =
// not connected / unknown, rose = a hard failure. No white chrome anywhere.
const DOT_COLORS = {
  ok: '#10b981',
  warn: '#f59e0b',
  idle: '#64748b',
  error: '#f43f5e',
};

function setStatus(tone, text) {
  statusDot.style.background = DOT_COLORS[tone] || DOT_COLORS.idle;
  statusText.textContent = text;
}

/**
 * The persona UUID is the owner's own private root identifier (CLAUDE.md's
 * three-level reference model, level 1): masked by default, shown only to
 * the owner, and only enough of it to confirm "yes, that's the one I meant".
 */
function maskPersonaId(personaId) {
  return personaId.length > 12 ? `${personaId.slice(0, 8)}…${personaId.slice(-4)}` : personaId;
}

const PROBE_MESSAGES = {
  'no-active-tab': 'No active tab. Open metaMe in this window, then check again.',
  'active-tab-not-metame':
    'The active tab is not metaMe. Open dev-beta.aigentz.me in this tab, then check again.',
  'not-signed-in': 'Not signed in on this tab. Sign in to metaMe, then check again.',
  'no-active-persona':
    'No active persona selected. Open your wallet on metaMe and pick a persona, then check again — pairing without one would resolve to the wrong persona.',
  'probe-returned-nothing': 'Could not read the page. Reload the metaMe tab, then check again.',
};

/** §3.3 — run the probe and gate the Connect button on its result. */
function probePersona() {
  confirmedPersonaId = null;
  connectBtn.disabled = true;
  personaValue.textContent = 'Checking…';
  personaHint.textContent = '';

  chrome.runtime.sendMessage({ type: 'PROBE_ACTIVE_PERSONA' }, (response) => {
    if (response && response.ok && response.personaId) {
      confirmedPersonaId = response.personaId;
      personaValue.textContent = maskPersonaId(response.personaId);
      personaHint.textContent = 'Confirm this is the persona you want paired, then Connect.';
      connectBtn.disabled = false;
      return;
    }
    const reason = response ? response.reason : 'no-response';
    personaValue.textContent = 'None confirmed';
    personaHint.textContent = PROBE_MESSAGES[reason] || `Could not confirm a persona: ${reason}`;
    connectBtn.disabled = true;
  });
}

const VERIFY_FAILING_MESSAGES = {
  persona:
    'no active persona is stored — reconnect from a metaMe tab with a persona selected.',
  grants: 'the server did not answer this session — reconnect, or check you are still signed in.',
};

/** §3.7 — one check, one of exactly three states. */
function runVerification({ announceStart = false } = {}) {
  if (announceStart) setStatus('idle', 'Verifying…');
  chrome.runtime.sendMessage({ type: 'VERIFY_COMPANION' }, (response) => {
    if (!response) {
      setStatus('error', 'Verification failed: no response from the extension worker.');
      return;
    }
    if (response.state === 'connected') {
      setStatus('ok', 'Connected & verified — session valid, persona confirmed, grants in sync.');
      return;
    }
    if (response.state === 'attention') {
      const detail =
        VERIFY_FAILING_MESSAGES[response.failing] ||
        `${response.failing} check failed${response.reason ? ` (${response.reason})` : ''}`;
      setStatus('warn', `Connected, needs attention — ${detail}`);
      return;
    }
    setStatus(
      'idle',
      response.reason === 'no-auth-session'
        ? 'Not connected.'
        : `Not connected: ${response.reason || 'unknown'}`,
    );
  });
}

// On open: confirm the persona first, then report the current tri-state.
probePersona();
runVerification();

recheckBtn.addEventListener('click', () => probePersona());
verifyBtn.addEventListener('click', () => runVerification({ announceStart: true }));

connectBtn.addEventListener('click', () => {
  if (!confirmedPersonaId) return; // belt-and-braces; the button is disabled
  setStatus('idle', 'Connecting…');
  chrome.runtime.sendMessage(
    { type: 'CONNECT_METAME', confirmedPersonaId },
    (response) => {
      if (response && response.ok) {
        // Nothing is paired without a confirmed persona any more, so there is
        // no "connected but maybe the wrong persona" state left to warn
        // about — go straight to the §3.7 verification for the honest answer.
        runVerification();
        return;
      }
      const reason = response ? response.reason : 'no response';
      if (reason === 'persona-changed-since-confirmation') {
        setStatus('warn', 'The active persona changed since you confirmed it. Nothing was paired — check again.');
        probePersona();
        return;
      }
      setStatus('error', `Not connected: ${reason}`);
    },
  );
});

/**
 * Opens Chrome's native docked side panel (sidepanel.html, the same document
 * the earlier floating-popup-window approach used) for the current browser
 * window. This re-embeds the Companion inside the browser chrome itself
 * instead of a separate OS-level window — 2026-07-23: the floating popup
 * read as "a popup" rather than an integrated panel, which the operator
 * called out as a regression from the originally-embedded side panel.
 * Accepted trade-off (unchanged from the original side-panel discussion):
 * opening the side panel reflows/pushes the host page's viewport to make
 * room for it — that's inherent to chrome.sidePanel, not a bug.
 */
document.getElementById('manageBtn').addEventListener('click', async () => {
  try {
    const current = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: current.id });
  } catch (err) {
    console.warn('[metaMe Observer] side panel open failed, falling back to a new tab:', err);
    chrome.tabs.create({ url: COMPANION_EMBED_URL });
  }
});
