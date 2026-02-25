"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQubeTalk, useQubeTalkClient } from "@metame/qubetalk-client/react";
import {
  publishMetameRuntimeThinClientSeeds,
  type SeedPublishResult,
  type QubeTalkMessage,
  type QubeTalkThread,
} from "@metame/qubetalk-client";
import {
  clearDiagnosticsSnapshot,
  getDiagnosticsSnapshot,
  type DiagnosticsSnapshot,
} from "../diagnostics/diagnostics";

const THREADS: QubeTalkThread[] = ["spec", "api-wiring", "ui-shell", "dev-exec", "ops"];

type ThreadPanelProps = {
  thread: QubeTalkThread;
  messages: QubeTalkMessage[];
};

function ThreadPanel({ thread, messages }: ThreadPanelProps) {
  const recent = useMemo(() => [...messages].reverse().slice(0, 8), [messages]);

  return (
    <section className="dev-section">
      <h2>
        #{thread} ({messages.length})
      </h2>
      {recent.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-muted)" }}>No messages yet.</p>
      ) : (
        <table className="dev-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Severity</th>
              <th>Title</th>
              <th>Status</th>
              <th>Authority</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((message) => (
              <tr key={`${thread}-${message.control.id}`}>
                <td>{message.type}</td>
                <td>{message.severity}</td>
                <td>
                  <div>{message.title}</div>
                  <div style={{ color: "var(--ink-muted)", fontSize: "0.74rem" }}>{message.body}</div>
                </td>
                <td>{message.control.status}</td>
                <td>{message.attestations.authority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function RuntimeShellDiagnosticsPage() {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>(() => getDiagnosticsSnapshot());
  const [publishThread, setPublishThread] = useState<QubeTalkThread>("dev-exec");
  const [publishTitle, setPublishTitle] = useState("Runtime Shell Progress");
  const [publishBody, setPublishBody] = useState("Thin client shell diagnostics active and collecting telemetry.");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [seedPublishResult, setSeedPublishResult] = useState<SeedPublishResult | null>(null);
  const [seedPublishBusy, setSeedPublishBusy] = useState(false);

  const { client, authority } = useQubeTalkClient();

  const spec = useQubeTalk("spec");
  const api = useQubeTalk("api-wiring");
  const ui = useQubeTalk("ui-shell");
  const dev = useQubeTalk("dev-exec");
  const ops = useQubeTalk("ops");

  const refresh = () => {
    setSnapshot(getDiagnosticsSnapshot());
  };

  useEffect(() => {
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const connected = spec.connected || api.connected || ui.connected || dev.connected || ops.connected;
  const connectionError = spec.error ?? api.error ?? ui.error ?? dev.error ?? ops.error;

  const senderByThread: Record<QubeTalkThread, typeof spec.sendMessage> = {
    spec: spec.sendMessage,
    "api-wiring": api.sendMessage,
    "ui-shell": ui.sendMessage,
    "dev-exec": dev.sendMessage,
    ops: ops.sendMessage,
  };

  const messagesByThread: Record<QubeTalkThread, QubeTalkMessage[]> = {
    spec: spec.messages,
    "api-wiring": api.messages,
    "ui-shell": ui.messages,
    "dev-exec": dev.messages,
    ops: ops.messages,
  };

  const sendDraftMessage = useCallback(async () => {
    setPublishError(null);

    try {
      await senderByThread[publishThread]({
        type: "status",
        thread: publishThread,
        severity: "info",
        title: publishTitle,
        body: publishBody,
        acceptance: [
          "Message published to correct thread",
          "Message contains refs and control metadata",
        ],
        refs: {
          repo: "AigentZBeta",
          paths: ["apps/metame-runtime-shell/app/dev/page.tsx"],
          endpoints: [],
          env: ["NEXT_PUBLIC_QUBETALK_WS_URL"],
        },
      });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Unable to publish QubeTalk message");
    }
  }, [publishBody, publishThread, publishTitle, senderByThread]);

  const publishCanonicalSeeds = useCallback(async () => {
    setSeedPublishBusy(true);
    setPublishError(null);
    setSeedPublishResult(null);

    try {
      const result = await publishMetameRuntimeThinClientSeeds(client, authority, {
        continueOnError: true,
      });
      setSeedPublishResult(result);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Unable to publish canonical seeds");
    } finally {
      setSeedPublishBusy(false);
    }
  }, [authority, client]);

  return (
    <main className="dev-page">
      <div className="dev-actions">
        <Link href="/" className="shell-chip">
          Back to shell
        </Link>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
        <button
          type="button"
          onClick={() => {
            clearDiagnosticsSnapshot();
            refresh();
          }}
        >
          Clear logs
        </button>
      </div>

      <section className="dev-section">
        <h2>QubeTalk Coordination</h2>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
          Connection: <strong>{connected ? "Connected" : "Disconnected"}</strong>
        </p>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
          Authority: <strong>{authority}</strong>
        </p>
        {connectionError ? <div className="error-bar">{connectionError}</div> : null}
        <div className="thread-grid">
          {THREADS.map((thread) => (
            <span key={thread} className="shell-chip" style={{ justifyContent: "center" }}>
              #{thread}: {messagesByThread[thread].length}
            </span>
          ))}
        </div>
      </section>

      <section className="dev-section">
        <h2>Publish Messages</h2>
        {publishError ? <div className="error-bar">{publishError}</div> : null}
        <div className="publish-grid" style={{ marginBottom: "0.6rem" }}>
          <button type="button" disabled={seedPublishBusy} onClick={() => void publishCanonicalSeeds()}>
            {seedPublishBusy ? "Publishing canonical seeds…" : "Publish Canonical Seed Messages"}
          </button>
          {seedPublishResult ? (
            <div className="shell-chip" style={{ width: "fit-content" }}>
              Published: {seedPublishResult.published.length} · Skipped: {seedPublishResult.skipped.length} · Failed:{" "}
              {seedPublishResult.failed.length}
            </div>
          ) : null}
        </div>
        <div className="publish-grid" style={{ marginTop: publishError ? "0.5rem" : 0 }}>
          <label>
            Thread
            <select value={publishThread} onChange={(event) => setPublishThread(event.target.value as QubeTalkThread)}>
              {THREADS.map((thread) => (
                <option key={thread} value={thread}>
                  {thread}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={publishTitle} onChange={(event) => setPublishTitle(event.target.value)} />
          </label>
          <label>
            Body
            <textarea rows={3} value={publishBody} onChange={(event) => setPublishBody(event.target.value)} />
          </label>
          <button type="button" onClick={() => void sendDraftMessage()}>
            Send Message
          </button>
        </div>
      </section>

      <div className="thread-panels">
        <ThreadPanel thread="spec" messages={spec.messages} />
        <ThreadPanel thread="api-wiring" messages={api.messages} />
        <ThreadPanel thread="ui-shell" messages={ui.messages} />
        <ThreadPanel thread="dev-exec" messages={dev.messages} />
        <ThreadPanel thread="ops" messages={ops.messages} />
      </div>

      <section className="dev-section">
        <h2>Snapshot Meta</h2>
        <p style={{ margin: 0, fontSize: "0.82rem" }}>
          Last update: <code>{snapshot.updatedAt}</code>
        </p>
      </section>

      <section className="dev-section">
        <h2>Shell Config Snapshot</h2>
        <pre className="dev-code">{JSON.stringify(snapshot.shellConfig, null, 2)}</pre>
      </section>

      <section className="dev-section">
        <h2>AA Request Log (last {snapshot.aaLogs.length})</h2>
        <table className="dev-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.aaLogs.map((entry, index) => (
              <tr key={`${entry.timestamp}-${index}`}>
                <td>{entry.timestamp}</td>
                <td>{entry.method}</td>
                <td>{entry.path}</td>
                <td>{entry.status}</td>
                <td>{entry.duration_ms}ms</td>
                <td>{entry.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dev-section">
        <h2>postMessage Log (last {snapshot.bridgeLogs.length})</h2>
        <table className="dev-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Direction</th>
              <th>Type</th>
              <th>Origin</th>
              <th>Message ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.bridgeLogs.map((entry, index) => (
              <tr key={`${entry.timestamp}-${entry.type}-${index}`}>
                <td>{entry.timestamp}</td>
                <td>{entry.direction}</td>
                <td>{entry.type}</td>
                <td>{entry.origin ?? ""}</td>
                <td>{entry.msg_id ?? ""}</td>
                <td>
                  {entry.error ? entry.error : <pre className="dev-code">{JSON.stringify(entry.payload ?? {}, null, 2)}</pre>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
