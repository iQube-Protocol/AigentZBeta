"use client";

import type { BrowserArtifact, BrowserHistoryEvent, BrowserReceipt } from "@metame/browser-contracts";

type BrowserHistoryDrawerProps = {
  open: boolean;
  loading: boolean;
  refreshedAt?: string | null;
  history: BrowserHistoryEvent[];
  artifacts: BrowserArtifact[];
  receipts: BrowserReceipt[];
  onRefresh: () => void;
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function BrowserHistoryDrawer({
  open,
  loading,
  refreshedAt,
  history,
  artifacts,
  receipts,
  onRefresh,
}: BrowserHistoryDrawerProps) {
  if (!open) return null;

  return (
    <section className="browser-history-drawer" aria-label="Browser history and artifacts">
      <div className="browser-history-drawer-top">
        <div className="browser-history-drawer-heading">
          <strong>Runtime History</strong>
          <div className="browser-history-drawer-meta">
            {refreshedAt ? `Last synced ${formatTimestamp(refreshedAt)}` : "Waiting for first sync"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="browser-history-columns browser-history-columns-3">
        <div className="browser-history-column">
          <h3>History</h3>
          {history.length === 0 ? <div className="browser-history-empty">No runtime history yet.</div> : null}
          {history.map((item) => (
            <article key={item.id} className="browser-history-item">
              <div className="browser-history-item-top">
                <strong>{item.actionType}</strong>
                <span>{formatTimestamp(item.occurredAt)}</span>
              </div>
              <div className="browser-history-item-body">
                <div>{item.title || item.url || "Untitled page"}</div>
                {item.domain ? <div className="browser-history-muted">{item.domain}</div> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="browser-history-column">
          <h3>Artifacts</h3>
          {artifacts.length === 0 ? <div className="browser-history-empty">No artifacts yet.</div> : null}
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="browser-history-item">
              <div className="browser-history-item-top">
                <strong>{artifact.artifactType}</strong>
                <span>{formatTimestamp(artifact.createdAt)}</span>
              </div>
              <div className="browser-history-item-body">
                <div>{artifact.sourceTitle || artifact.sourceUrl || "Untitled artifact"}</div>
                {artifact.mimeType ? <div className="browser-history-muted">{artifact.mimeType}</div> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="browser-history-column">
          <h3>Receipts</h3>
          {receipts.length === 0 ? <div className="browser-history-empty">No receipts yet.</div> : null}
          {receipts.map((receipt) => (
            <article key={receipt.id} className="browser-history-item">
              <div className="browser-history-item-top">
                <strong>{receipt.receiptType}</strong>
                <span>{formatTimestamp(receipt.createdAt)}</span>
              </div>
              <div className="browser-history-item-body">
                <div>{receipt.receiptHash.slice(0, 12)}…</div>
                {receipt.receiptUri ? <div className="browser-history-muted">{receipt.receiptUri}</div> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
