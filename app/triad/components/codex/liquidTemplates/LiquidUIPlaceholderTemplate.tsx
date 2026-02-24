"use client";

import { LayoutGrid } from "lucide-react";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  configuration?: Record<string, any>;
};

interface LiquidUIPlaceholderTemplateProps {
  experience?: ExperienceQube;
  packet?: Record<string, any> | null;
  theme?: "light" | "dark";
  personaId?: string;
}

export function LiquidUIPlaceholderTemplate({
  experience,
  packet,
  theme = "dark",
}: LiquidUIPlaceholderTemplateProps) {
  const templateId = packet?.ui?.primary_template || "liquidui:template_v1";
  const title = packet?.ui?.title || experience?.name || "Liquid UI Template";
  const subhead = packet?.ui?.subhead || experience?.description || "Placeholder scaffold";
  const selectionReason = packet?.ui?.template_selection?.reason || "TemplateRegistry selection";

  const isDark = theme === "dark";
  const frameClass = isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={`rounded-2xl border ${frameClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-300">
            <LayoutGrid className="h-4 w-4 text-indigo-400" />
            Liquid UI Template
          </div>
          <div className={`mt-2 text-lg font-semibold ${textClass}`}>{title}</div>
          <div className={`mt-1 text-sm ${mutedClass}`}>{subhead}</div>
        </div>
        <div className="text-right text-xs text-slate-300">
          <div className="rounded-full border border-slate-700 px-3 py-1">{templateId}</div>
          <div className={`mt-2 text-[11px] ${mutedClass}`}>{selectionReason}</div>
        </div>
      </div>

      <div className="h-[560px]">
        <div className="h-full overflow-auto px-5 py-4">
          <div className={`text-sm ${mutedClass}`}>
            This is a placeholder Liquid UI template. It keeps the drawer frame fixed and
            scrolls content inside the template body.
          </div>
          <div className={`mt-4 rounded-xl border ${frameClass} p-4`}>
            <div className={`text-xs uppercase tracking-widest ${mutedClass}`}>Planned elements</div>
            <ul className={`mt-3 space-y-2 text-sm ${textClass}`}>
              <li>Header: intent, filters, and primary actions</li>
              <li>Body: scrollable content region</li>
              <li>Side rail: SmartTriad overlays (wallet, copilot)</li>
              <li>Footer: status, receipts, and provenance links</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
