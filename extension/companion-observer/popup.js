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

document.getElementById('manageBtn').addEventListener('click', async () => {
  // Opens Chrome's native side panel (docked beside the current tab) instead
  // of navigating to a new tab, so the operator keeps their place on
  // whatever page they were on. Falls back to a new tab if sidePanel isn't
  // available (older Chrome, or a non-Chromium browser loading this
  // extension) rather than silently doing nothing.
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (chrome.sidePanel && activeTab?.windowId != null) {
      await chrome.sidePanel.open({ windowId: activeTab.windowId });
      return;
    }
  } catch (err) {
    console.warn('[metaMe Observer] sidePanel.open failed, falling back to a new tab:', err);
  }
  chrome.tabs.create({ url: COMPANION_EMBED_URL });
});
