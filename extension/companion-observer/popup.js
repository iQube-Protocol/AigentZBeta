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
