"use client";

/**
 * BriefLayout — Phase 2 Slice 1.
 *
 * Dedicated reading workspace for the Brief intent. Today / Project /
 * Cartridge scope switcher in the header (desktop) and as a sticky
 * bottom strip (mobile, per DIS `mobileShapes.brief-layout-v1`).
 *
 * DIS template id: `brief-layout-v1`.
 */

import React, { useCallback, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { BriefCard } from "@/components/metame/cards/BriefCard";
import { LayoutShell } from "./LayoutShell";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

type BriefVariant = "daily" | "project" | "cartridge";
const VARIANTS: { id: BriefVariant; label: string }[] = [
  { id: "daily",     label: "Today" },
  { id: "project",   label: "Project" },
  { id: "cartridge", label: "Cartridge" },
];

function BriefLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    brief,
    briefLoading,
    briefError,
    onNbeAct,
    onDismissBrief,
    onBriefVariantChange,
    onRequestLayout,
  } = props;

  const [activeVariant, setActiveVariant] = useState<BriefVariant>(
    brief?.briefType ?? "daily",
  );
  const isDark = theme === "dark";

  const handleVariantClick = useCallback(
    (variant: BriefVariant) => {
      setActiveVariant(variant);
      onBriefVariantChange?.(variant);
    },
    [onBriefVariantChange],
  );

  const handleDismiss = useCallback(() => {
    onDismissBrief?.();
    onRequestLayout?.("stack");
  }, [onDismissBrief, onRequestLayout]);

  const switcherBase = isDark
    ? "border-slate-700/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800/40"
    : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const switcherActive = isDark
    ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
    : "border-violet-300 bg-violet-50 text-violet-800";

  const switcher = (
    <div role="tablist" aria-label="Brief scope" className="inline-flex items-center gap-1">
      {VARIANTS.map((v) => {
        const isActive = v.id === activeVariant;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleVariantClick(v.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive ? switcherActive : switcherBase
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="brief"
      disTemplateId="brief-layout-v1"
      theme={theme}
      headerIcon={<Compass className="h-3.5 w-3.5" />}
      headerEyebrow="Brief"
      headerTitle={
        activeVariant === "cartridge"
          ? "Cartridge brief"
          : activeVariant === "project"
            ? "Project brief"
            : "Today's brief"
      }
      headerActions={switcher}
      onDismiss={handleDismiss}
      dismissLabel="Close brief"
      mobileStickyStrip={switcher}
      body={
        briefLoading && !brief ? (
          <BriefSkeleton isDark={isDark} />
        ) : briefError && !brief ? (
          <BriefErrorState message={briefError} isDark={isDark} />
        ) : brief ? (
          <BriefCard
            data={brief}
            loading={false}
            error={null}
            onActOnNbe={onNbeAct}
            onDismiss={undefined}
            theme={theme}
          />
        ) : (
          <BriefEmptyState isDark={isDark} />
        )
      }
    />
  );
}

function BriefSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box} space-y-5`} aria-busy="true">
      <div className="space-y-2">
        <div className={`h-3 w-24 rounded ${skel}`} />
        <div className={`h-5 w-2/3 rounded ${skel}`} />
        <div className={`h-3 w-1/2 rounded ${skel}`} />
      </div>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
        <span className="text-xs text-slate-500">Composing your brief…</span>
      </div>
      <div className="space-y-2">
        <div className={`h-3 w-full rounded ${skel}`} />
        <div className={`h-3 w-11/12 rounded ${skel}`} />
        <div className={`h-3 w-10/12 rounded ${skel}`} />
      </div>
    </div>
  );
}

function BriefEmptyState({ isDark }: { isDark: boolean }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  const muted = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <div className="flex items-start gap-3">
        <Compass className={`h-5 w-5 mt-0.5 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
        <div>
          <h3 className="text-sm font-semibold mb-1">Pick a scope to begin</h3>
          <p className={`text-xs leading-relaxed ${muted}`}>
            Choose Today, Project, or Cartridge above to compose a brief.
            Aigent Me will pull the relevant context and rank what matters now.
          </p>
        </div>
      </div>
    </div>
  );
}

function BriefErrorState({ message, isDark }: { message: string; isDark: boolean }) {
  const box = isDark ? "border-rose-500/40 bg-rose-500/5" : "border-rose-200 bg-rose-50";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <h3 className={`text-sm font-semibold mb-1 ${isDark ? "text-rose-200" : "text-rose-800"}`}>
        Brief unavailable
      </h3>
      <p className={`text-xs leading-relaxed ${isDark ? "text-rose-300/80" : "text-rose-700"}`}>
        {message}
      </p>
    </div>
  );
}

export const BriefLayout: RightPaneLayoutDefinition = {
  id: "brief",
  label: "Brief",
  component: BriefLayoutComponent,
  disTemplateId: "brief-layout-v1",
};
