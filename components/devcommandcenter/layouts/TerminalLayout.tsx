"use client";

/**
 * TerminalLayout — the Constitutional Terminal viewport (CFS-020 CDE).
 *
 * A terminal-styled REPL (monospace, dark, scrollback, up/down command
 * history) over the STRICT read-only whitelist executed by
 * /api/dev-command-center/terminal. This is a command surface, NOT a shell:
 * arbitrary execution stays human under CFS-016 D1. Plain React + Tailwind —
 * no xterm.js, no new deps. All fetches ride personaFetch (spine rule).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { personaFetch } from "@/utils/personaSpine";

interface TerminalEntry {
  command: string;
  lines: string[];
}

const WELCOME: string[] = [
  "aigentZ Constitutional Terminal — read-only command surface (CFS-016 D1).",
  "This is NOT a shell; execution stays human. Type `help` for the command set.",
];

export function TerminalLayout({
  onBack,
  onToolUsed,
}: {
  onBack: () => void;
  /** Fires a DCIR observation for the executed command's first token only. */
  onToolUsed?: (op: string) => void;
}) {
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Command recall (up/down). recallIndex === commands.length ⇒ live input.
  const commandsRef = useRef<string[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, busy]);

  const run = useCallback(async (raw: string) => {
    const command = raw.trim();
    if (!command || busy) return;
    commandsRef.current = [...commandsRef.current, command];
    setRecallIndex(commandsRef.current.length);
    setInput("");
    setBusy(true);
    // T2-safe observation: the first token only, never the full command line.
    onToolUsed?.(command.split(/\s+/)[0] ?? "");
    try {
      const res = await personaFetch("/api/dev-command-center/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        cache: "no-store",
      });
      let lines: string[];
      if (res.status === 403) {
        lines = ["forbidden — the Terminal requires an admin persona"];
      } else if (res.status === 401) {
        lines = ["unauthenticated — sign in to use the Terminal"];
      } else {
        const json = await res.json().catch(() => null);
        lines = Array.isArray(json?.lines) ? json.lines : [`unexpected response (HTTP ${res.status})`];
      }
      setHistory((prev) => [...prev, { command, lines }]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { command, lines: [`request failed: ${err instanceof Error ? err.message : String(err)}`] },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy, onToolUsed]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void run(input);
      return;
    }
    const cmds = commandsRef.current;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmds.length === 0) return;
      const next = Math.max(0, recallIndex - 1);
      setRecallIndex(next);
      setInput(cmds[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cmds.length === 0) return;
      const next = Math.min(cmds.length, recallIndex + 1);
      setRecallIndex(next);
      setInput(next === cmds.length ? "" : cmds[next] ?? "");
    }
  };

  const body = (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-950/80 p-3 font-mono text-[12px] leading-relaxed text-slate-200"
      onClick={(e) => {
        // Focus the input when the terminal body is clicked.
        (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
      }}
    >
      {WELCOME.map((l, i) => (
        <div key={`w-${i}`} className="text-slate-500">{l}</div>
      ))}
      <div className="h-2" />
      {history.map((entry, i) => (
        <div key={i} className="mb-2">
          <div className="text-emerald-400">
            <span className="text-slate-600">aigentZ$</span> {entry.command}
          </div>
          {entry.lines.map((line, j) => (
            <div key={j} className="whitespace-pre-wrap break-words text-slate-300">
              {line === "" ? " " : line}
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="text-slate-600 shrink-0">aigentZ$</span>
        <input
          autoFocus
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          placeholder={busy ? "running…" : "type a command — `help`"}
          className="flex-1 bg-transparent text-emerald-300 placeholder-slate-600 outline-none"
          aria-label="Constitutional terminal command input"
        />
      </div>
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-terminal"
      disTemplateId="dev-terminal-layout-v1"
      headerIcon={<TerminalIcon className="w-4 h-4" />}
      headerEyebrow="CDE tool · read-only"
      headerTitle="Constitutional Terminal"
      onDismiss={onBack}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
