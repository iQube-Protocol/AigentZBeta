/**
 * metaMe Companion — Observer extension popup
 * (PRD-MMC-IMPL-001 §7 Increment 6).
 *
 * Deliberately minimal, per the plan's own scope: this popup does NOT
 * duplicate `components/companion/ObserverGrantPanel.tsx` (Increment 4).
 * Grant management stays a single UI, hosted in the existing
 * `/triad/embed/companion` shell — "Manage permissions" below just opens
 * that page in a new tab.
 */

const statusEl = document.getElementById('status');

document.getElementById('connectBtn').addEventListener('click', async () => {
  statusEl.textContent = 'Connecting…';
  chrome.runtime.sendMessage({ type: 'CONNECT_METAME' }, (response) => {
    if (response && response.ok) {
      statusEl.textContent = 'Connected. Grants refreshed from server.';
    } else {
      statusEl.textContent = `Not connected: ${response ? response.reason : 'no response'}`;
    }
  });
});

const COMPANION_WINDOW_ID_KEY = 'companionWindowId';
// The Companion page (app/(embed)/triad/embed/companion/page.tsx) fills
// whatever width this window actually provides (w-full, embeddedWidth="fill")
// rather than clamping to a fixed rem value -- so this number is just a
// reasonable starting width, not a value that needs to exactly match the
// page's own content width. No gap results regardless of the exact platform
// window-chrome inset, since the content adapts to the real window size
// instead of the other way around.
const COMPANION_POPUP_WIDTH = 400;

/**
 * Opens (or refocuses) a small floating popup window hosting the SAME
 * sidepanel.html document Chrome's native side panel used — reusing that
 * document keeps the CSP frame-ancestors allowlist scoped to exactly the one
 * chrome-extension:// origin already permitted (configs/embed/policy.v1.json);
 * nothing new is exposed.
 *
 * Deliberately NOT chrome.sidePanel: that API docks into the browser window
 * and reflows/pushes the current page's viewport to make room for it — by
 * design, not a bug, but not what "overlay on top of the page" means. A
 * separate OS-level popup window positioned at the screen edge leaves the
 * operator's current page untouched. Trade-off, stated plainly: it's a real
 * window, not part of the page's own DOM, so it can be moved/closed
 * independently and won't auto-resize if the main browser window resizes.
 */
async function openOrFocusCompanionWindow() {
  const { [COMPANION_WINDOW_ID_KEY]: existingId } = await chrome.storage.local.get([
    COMPANION_WINDOW_ID_KEY,
  ]);
  if (typeof existingId === 'number') {
    try {
      await chrome.windows.update(existingId, { focused: true });
      return; // already open — just brought to front
    } catch {
      // Window no longer exists (operator closed it) — fall through and
      // create a fresh one.
    }
  }

  let left = 0;
  let top = 0;
  let height = 900;
  try {
    const current = await chrome.windows.getCurrent();
    top = current.top ?? 0;
    height = current.height ?? 900;
    left = (current.left ?? 0) + (current.width ?? COMPANION_POPUP_WIDTH) - COMPANION_POPUP_WIDTH;
  } catch (err) {
    console.warn('[metaMe Observer] could not read current window bounds, using defaults:', err);
  }

  const created = await chrome.windows.create({
    url: 'sidepanel.html',
    type: 'popup',
    width: COMPANION_POPUP_WIDTH,
    height,
    top,
    left: Math.max(0, left),
  });
  if (created?.id != null) {
    await chrome.storage.local.set({ [COMPANION_WINDOW_ID_KEY]: created.id });
  }
}

document.getElementById('manageBtn').addEventListener('click', async () => {
  try {
    await openOrFocusCompanionWindow();
  } catch (err) {
    console.warn('[metaMe Observer] floating window failed, falling back to a new tab:', err);
    chrome.tabs.create({ url: COMPANION_EMBED_URL });
  }
});
