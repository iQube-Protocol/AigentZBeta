"use client";

/**
 * LayoutShell — shared chrome for every Phase 2 right-pane layout.
 *
 * Locks the symmetry contract (DIS `aigentme-phase-2.dis.json` + handbook
 * §8a/§8b) in one place so each layout doesn't have to re-implement it:
 *
 *   - Outer card: rounded-2xl, border, dark/light surface tokens
 *   - Header strip: 56 px, icon-left / title-center / actions-right
 *   - Dismiss X: right-aligned in header, 6×6 button, identical coordinate
 *   - Body: scrollable, p-4 md:p-5 lg:p-6
 *   - Footer: optional, p-3 lg:p-4, right-aligned actions
 *   - Mobile sticky strip slot: respects iOS env(safe-area-inset-bottom)
 *
 * Layouts pass header content (icon + title + actions + dismiss), body, and
 * optional footer / mobile sticky strip. Anything outside these slots is a
 * design fidelity violation — flagged by the Parity Checker.
 */

import React, { type ReactNode } from "react";
import { X } from "lucide-react";

interface LayoutShellProps {
  surfaceId: string;
  disTemplateId: string;
  theme?: "light" | "dark";
  headerIcon: ReactNode;
  headerEyebrow?: ReactNode;
  headerTitle: ReactNode;
  headerActions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  body: ReactNode;
  footer?: ReactNode;
  /** Mobile-only sticky strip (e.g. switcher tabs, action bar). */
  mobileStickyStrip?: ReactNode;
}

export function LayoutShell({
  surfaceId,
  disTemplateId,
  theme = "dark",
  headerIcon,
  headerEyebrow,
  headerTitle,
  headerActions,
  onDismiss,
  dismissLabel = "Close",
  body,
  footer,
  mobileStickyStrip,
}: LayoutShellProps) {
  const isDark = theme === "dark";
  const outerClass = isDark
    ? "border-slate-700/60 bg-slate-900/40"
    : "border-slate-200 bg-white";
  const headerBorder = isDark ? "border-slate-800/60" : "border-slate-200";
  const footerBorder = isDark ? "border-slate-800/60" : "border-slate-200";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const iconBg = isDark
    ? "bg-violet-500/10 text-violet-300"
    : "bg-violet-100 text-violet-700";
  const dismissBtn = isDark
    ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100";

  return (
    <div
      data-aigentme-right-pane={surfaceId}
      data-aigentme-layout={disTemplateId}
      className={`relative h-full flex flex-col overflow-hidden rounded-2xl border ${outerClass}`}
    >
      {/* Header strip — 56 px, icon / eyebrow+title / actions / dismiss */}
      <header
        className={`h-14 shrink-0 flex items-center gap-3 px-4 border-b ${headerBorder}`}
      >
        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${iconBg}`}>
          {headerIcon}
        </span>
        <div className="flex-1 min-w-0">
          {headerEyebrow && (
            <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
              {headerEyebrow}
            </div>
          )}
          <div className="text-sm font-semibold leading-tight truncate">
            {headerTitle}
          </div>
        </div>
        {headerActions && <div className="hidden md:flex items-center gap-1">{headerActions}</div>}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            title={dismissLabel}
            className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${dismissBtn}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Body — scrollable, padded. Always reserves bottom clearance so
          the last card's content scrolls above the floating compose
          strip pinned at the bottom of the right pane (`bottom-3`,
          ~64px of chrome). Mobile sticky strip + safe-area inset
          stack on top when present. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 lg:p-6"
        style={{
          paddingBottom: mobileStickyStrip
            ? "calc(env(safe-area-inset-bottom, 0px) + 4rem + 5rem)"
            : "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
        }}
      >
        {body}
      </div>

      {/* Optional footer — right-aligned actions */}
      {footer && (
        <footer
          className={`shrink-0 flex items-center justify-end gap-2 p-3 lg:p-4 border-t ${footerBorder}`}
        >
          {footer}
        </footer>
      )}

      {/* Mobile sticky strip (e.g. tab switcher) */}
      {mobileStickyStrip && (
        <div
          className={`md:hidden absolute inset-x-0 bottom-0 border-t backdrop-blur ${
            isDark
              ? "bg-slate-950/85 border-slate-800/60"
              : "bg-white/90 border-slate-200"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center justify-center gap-1 p-3">
            {mobileStickyStrip}
          </div>
        </div>
      )}
    </div>
  );
}
