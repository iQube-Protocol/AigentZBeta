"use client";

/**
 * GitHubLayout — repo viewport (CFS-020 CDE).
 *
 * Branches, recent commits, open PRs, and a file browser, served by
 * /api/dev-command-center/github (GITHUB_TOKEN server-side). When the token is
 * absent the API returns `{ configured: false, missingEnv: 'GITHUB_TOKEN' }`
 * and this layout renders the honest setup notice — never a fabricated state.
 * personaFetch only.
 *
 * One write affordance (2026-07-14): PRs targeting dev carry a confirm-then-
 * merge button (`/api/dev-command-center/github/merge`) — the CFS-016 D1 human
 * execution gate exercised in-app. Merging dev deploys via Amplify; the act is
 * receipted as `deployment_authorized`. Everything else stays read-only.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GitBranch, RefreshCw, Loader2, Folder, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { personaFetchDeadline } from "@/utils/personaSpine";

interface Overview {
  configured: true;
  repo: string;
  branches: { name: string; commitSha: string }[];
  commits: { sha: string; message: string; author: string; date: string }[];
  pulls: { number: number; title: string; author: string; updatedAt: string; headRef: string; baseRef: string }[];
}
interface TreeEntry { name: string; type: "file" | "dir"; path: string }
interface FileView { path: string; text: string; note: string | null }

const CAT_MAX_LINES = 200;

export function GitHubLayout({
  onBack,
  onToolUsed,
}: {
  onBack: () => void;
  onToolUsed?: (op: string) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // File browser state.
  const [treePath, setTreePath] = useState("");
  const [entries, setEntries] = useState<TreeEntry[] | null>(null);
  const [file, setFile] = useState<FileView | null>(null);

  // In-app merge state (the D1 human gate). armedPr: first click arms, second
  // executes — a deploy-triggering act never fires on a single click.
  const [armedPr, setArmedPr] = useState<number | null>(null);
  const [mergingPr, setMergingPr] = useState<number | null>(null);
  const [mergeNotes, setMergeNotes] = useState<Record<number, string>>({});
  // Validation-gate override (admin, receipted, never silent): when the merge
  // route blocks a pack PR for lack of a passing validation record, this arms
  // a reason-required override form on that PR row.
  const [overridePr, setOverridePr] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Hold the latest onToolUsed in a ref so the fetch callbacks (and the mount
  // effect that depends on loadOverview) don't get a new identity every time the
  // parent re-renders with a fresh inline callback — which otherwise re-fires the
  // mount effect in an infinite loop (the flicker + API stampede this fixes).
  const onToolUsedRef = useRef(onToolUsed);
  useEffect(() => { onToolUsedRef.current = onToolUsed; }, [onToolUsed]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    onToolUsedRef.current?.("overview");
    try {
      const res = await personaFetchDeadline("/api/dev-command-center/github", { cache: "no-store" });
      if (res.status === 403) { setError("forbidden — GitHub viewport requires an admin persona"); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setError(json?.error ?? `unexpected response (HTTP ${res.status})`); return; }
      if (json.configured === false) { setConfigured(false); setMissingEnv(json.missingEnv ?? "GITHUB_TOKEN"); return; }
      setConfigured(true);
      setOverview(json as Overview);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setError(aborted ? "GitHub viewport timed out after 12s — server route or auth token step unavailable" : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const mergePr = useCallback(async (pullNumber: number, override?: { reason: string }) => {
    setMergingPr(pullNumber);
    setArmedPr(null);
    onToolUsedRef.current?.("merge");
    try {
      const res = await personaFetchDeadline("/api/dev-command-center/github/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullNumber,
          ...(override ? { overrideValidation: true, overrideReason: override.reason } : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || json?.ok !== true) {
        // Validation gate blocked — arm the receipted override form on this row.
        if (json?.validationGate === "blocked") setOverridePr(pullNumber);
        setMergeNotes((m) => ({
          ...m,
          [pullNumber]: (typeof json?.error === "string" && json.error) || `merge failed (HTTP ${res.status})`,
        }));
        return;
      }
      setOverridePr(null);
      setOverrideReason("");
      // Linear mirror status folds into the same note — never silent
      // (operator report 2026-07-15: a failed mirror was invisible everywhere).
      const linear = json.linear as { mirrored?: boolean; issueIdentifier?: string; reason?: string } | undefined;
      const linearSuffix = linear
        ? linear.mirrored
          ? ` · Linear ${linear.issueIdentifier ?? "issue"} updated`
          : ` · Linear not updated: ${linear.reason ?? "mirror skipped"}`
        : "";
      setMergeNotes((m) => ({
        ...m,
        [pullNumber]: `${json.validationGate === "overridden" ? "⚠ OVERRIDE — " : ""}Merged ${String(json.sha ?? "").slice(0, 10)} — Amplify is deploying dev.${
          typeof json.receiptId === "string" && json.receiptId ? ` receipt ${String(json.receiptId).slice(0, 8)}…` : ""
        }${typeof json.overrideReceiptId === "string" && json.overrideReceiptId ? ` override-receipt ${String(json.overrideReceiptId).slice(0, 8)}…` : ""}${linearSuffix}`,
      }));
      void loadOverview();
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setMergeNotes((m) => ({
        ...m,
        [pullNumber]: aborted ? "merge timed out — check GitHub before retrying (it may have landed)" : err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setMergingPr(null);
    }
  }, [loadOverview]);

  const browseTree = useCallback(async (path: string) => {
    setFile(null);
    setLoading(true);
    onToolUsedRef.current?.("tree");
    try {
      const res = await personaFetchDeadline(`/api/dev-command-center/github?op=tree&path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setError(json?.error ?? `tree failed (HTTP ${res.status})`); return; }
      setTreePath(path);
      setEntries(json.entries ?? []);
      setError(null);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setError(aborted ? "tree browse timed out after 12s — unavailable" : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    setLoading(true);
    onToolUsedRef.current?.("file");
    try {
      const res = await personaFetchDeadline(`/api/dev-command-center/github?op=file&path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setError(json?.error ?? `file failed (HTTP ${res.status})`); return; }
      setFile(json.file as FileView);
      setError(null);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      setError(aborted ? "file open timed out after 12s — unavailable" : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const parentPath = treePath.includes("/") ? treePath.slice(0, treePath.lastIndexOf("/")) : "";

  const body = (
    <div className="space-y-3">
      {configured === false && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-[12px] text-amber-100">
          <div className="font-semibold mb-1">GitHub not configured</div>
          <div>
            <code>{missingEnv}</code> is missing on this server. Add it to the Amplify environment to activate the
            read-only repo viewport.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{error}</div>
      )}

      {configured && overview && (
        <>
          {/* File browser */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
              <span>Files</span>
              <span className="normal-case tracking-normal text-slate-500 font-mono">{overview.repo}@dev</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
              <button className="hover:text-white" onClick={() => { setFile(null); void browseTree(""); }}>/</button>
              {treePath && <span className="text-slate-600">{treePath}</span>}
            </div>
            {file ? (
              <div className="space-y-1">
                <button onClick={() => setFile(null)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3 h-3" /> back to files
                </button>
                <div className="text-[11px] text-slate-300 font-mono">{file.path}</div>
                {file.note ? (
                  <div className="text-[11px] text-amber-300">{file.note}</div>
                ) : (
                  <>
                    <pre className="whitespace-pre-wrap break-words rounded border border-slate-800/60 bg-slate-950/70 p-2 text-[10.5px] leading-relaxed text-slate-300 font-mono max-h-72 overflow-y-auto">
                      {file.text.split("\n").slice(0, CAT_MAX_LINES).join("\n")}
                    </pre>
                    {file.text.split("\n").length > CAT_MAX_LINES && (
                      <div className="text-[10px] text-slate-500">
                        …truncated — showing first {CAT_MAX_LINES} of {file.text.split("\n").length} lines
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {entries === null ? (
                  <button onClick={() => void browseTree("")} className="text-[11px] text-emerald-300 hover:underline">
                    browse repository files →
                  </button>
                ) : (
                  <>
                    {treePath && (
                      <button onClick={() => void browseTree(parentPath)} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white">
                        <ArrowLeft className="w-3 h-3" /> ..
                      </button>
                    )}
                    {entries.map((e) => (
                      <button
                        key={e.path}
                        onClick={() => (e.type === "dir" ? void browseTree(e.path) : void openFile(e.path))}
                        className="flex items-center gap-1.5 w-full text-left text-[11px] text-slate-300 hover:text-white"
                      >
                        {e.type === "dir" ? <Folder className="w-3 h-3 text-sky-400" /> : <FileText className="w-3 h-3 text-slate-500" />}
                        {e.name}
                        {e.type === "dir" && <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Branches */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Branches ({overview.branches.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {overview.branches.map((b) => (
                <span key={b.name} className="rounded px-1.5 py-0.5 text-[10.5px] bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {b.name} <span className="text-slate-500">{b.commitSha}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Open PRs */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Open PRs ({overview.pulls.length})</div>
            {overview.pulls.length === 0 ? (
              <div className="text-[11px] text-slate-500">no open pull requests</div>
            ) : (
              overview.pulls.map((pr) => (
                <div key={pr.number} className="text-[11px] text-slate-300">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-500 font-mono">#{pr.number}</span> {pr.title}
                      <span className="text-slate-600"> · {pr.author} · {pr.updatedAt} · {pr.headRef} → {pr.baseRef}</span>
                    </div>
                    {/* In-app merge — the D1 human gate. Only dev-base PRs (the
                        deploy lane); confirm-then-merge, never one click. */}
                    {pr.baseRef === "dev" && !mergeNotes[pr.number]?.startsWith("Merged") && (
                      armedPr === pr.number ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => void mergePr(pr.number)}
                            disabled={mergingPr !== null}
                            className="rounded bg-emerald-700 hover:bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                          >
                            Confirm merge → deploys dev
                          </button>
                          <button
                            onClick={() => setArmedPr(null)}
                            className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setArmedPr(pr.number)}
                          disabled={mergingPr !== null}
                          className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 disabled:opacity-50"
                        >
                          {mergingPr === pr.number ? <Loader2 className="w-3 h-3 animate-spin" /> : "Merge"}
                        </button>
                      )
                    )}
                  </div>
                  {mergeNotes[pr.number] && (
                    <div className={`mt-0.5 text-[10px] ${mergeNotes[pr.number].includes("Merged") ? "text-emerald-300" : "text-rose-300"}`}>
                      {mergeNotes[pr.number]}
                    </div>
                  )}
                  {/* Receipted validation-gate override — admin states a reason,
                      the merge proceeds, and a validation_override_granted
                      receipt (DVN-anchorable) records the act. Never silent. */}
                  {overridePr === pr.number && (
                    <div className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 p-1.5 space-y-1">
                      <div className="text-[10px] font-semibold text-amber-300">
                        Override validation gate — deploys UNVALIDATED code; the override is receipted (DVN-anchorable).
                      </div>
                      <input
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-100 text-[10px]"
                        placeholder="Reason for overriding (required, ≥ 10 chars) — e.g. minor/mistaken infringement, validating post-hoc"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void mergePr(pr.number, { reason: overrideReason })}
                          disabled={mergingPr !== null || overrideReason.trim().length < 10}
                          className="rounded bg-amber-700 hover:bg-amber-600 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                        >
                          Override & merge
                        </button>
                        <button
                          onClick={() => { setOverridePr(null); setOverrideReason(""); }}
                          className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Recent commits */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Recent commits (dev)</div>
            <div className="space-y-0.5 font-mono text-[10.5px]">
              {overview.commits.map((c) => (
                <div key={c.sha} className="text-slate-300 truncate">
                  <span className="text-amber-300">{c.sha}</span> <span className="text-slate-600">{c.date}</span> {c.message}
                  <span className="text-slate-600"> ({c.author})</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {configured === null && !error && (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> loading repo…
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-github"
      disTemplateId="dev-github-layout-v1"
      headerIcon={<GitBranch className="w-4 h-4" />}
      headerEyebrow="CDE tool · read + merge gate"
      headerTitle="GitHub"
      headerActions={
        <button
          onClick={() => void loadOverview()}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      }
      onDismiss={onBack}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
