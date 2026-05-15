"use client";

/**
 * ComposeQuickActionsStrip — six compose actions rendered inside the
 * SmartTriadCopilotLayer footerContent slot on the aigentMe split tab.
 *
 * Each button flips a boolean on the parent split tab, opening the
 * corresponding compose modal. The modals themselves stay mounted at
 * the split tab root — this strip never owns modal state.
 */

import React from "react";
import { Mail, Calendar, FileText, Sheet, Layout, Megaphone, Wallet } from "lucide-react";

export type ComposeKind = "gmail" | "event" | "doc" | "sheet" | "slides" | "marketa";

interface Props {
  onOpen: (kind: ComposeKind) => void;
  onWalletOpen?: () => void;
  theme?: "light" | "dark";
}

const ACTIONS: Array<{ kind: ComposeKind; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "gmail",   label: "Email",   Icon: Mail },
  { kind: "event",   label: "Event",   Icon: Calendar },
  { kind: "doc",     label: "Doc",     Icon: FileText },
  { kind: "sheet",   label: "Sheet",   Icon: Sheet },
  { kind: "slides",  label: "Slides",  Icon: Layout },
  { kind: "marketa", label: "Marketa", Icon: Megaphone },
];

export function ComposeQuickActionsStrip({ onOpen, onWalletOpen, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const baseBtn = isDark
    ? "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-emerald-500/60 hover:bg-slate-800"
    : "bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-slate-50";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl ${isDark ? "bg-slate-950/60 ring-1 ring-white/10" : "bg-white/70 ring-1 ring-slate-200"} backdrop-blur-md shadow-lg`}>
      <span className="text-[10px] uppercase tracking-wider mr-1 text-slate-500">
        Compose
      </span>
      {ACTIONS.map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onOpen(kind)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition ${baseBtn}`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
        </button>
      ))}
      {onWalletOpen && (
        <>
          <span className="mx-1 text-slate-600 select-none">|</span>
          <button
            type="button"
            onClick={onWalletOpen}
            title="Open wallet"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition ${baseBtn}`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Wallet</span>
          </button>
        </>
      )}
    </div>
  );
}
