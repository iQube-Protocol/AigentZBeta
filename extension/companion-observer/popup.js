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

document.getElementById('manageBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: COMPANION_EMBED_URL });
});
