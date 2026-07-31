"use client";

/**
 * OverviewTemplate — cartridge identity + purpose card.
 *
 * Phase 5 reference template. Renders the cartridge's title, purpose,
 * category, visibility, and audience snapshot from `config`. The
 * wizard (Phase 6) writes `config` from the myCartridge block of the
 * v0.4 Venture iQube payload.
 *
 * Expected config keys (all optional — graceful empty states for any
 * missing field):
 *   title:       string
 *   description: string
 *   purpose:     string
 *   category:    CartridgeCategory
 *   visibility:  CartridgeVisibility
 *   audience:    { kind?: string; estimatedSize?: string; languages?: string[] }
 *
 * Unknown keys are ignored.
 */

import React from "react";
import type { TabTemplateProps } from "./types";

function asString(x: unknown): string | null {
  return typeof x === "string" && x.length > 0 ? x : null;
}

export function OverviewTemplate({ cartridgeSlug, theme, config }: TabTemplateProps) {
  const dark = theme === "dark";
  const title = asString(config?.title) ?? cartridgeSlug;
  const description = asString(config?.description);
  const purpose = asString(config?.purpose);
  const category = asString(config?.category);
  const visibility = asString(config?.visibility);
  const audienceObj =
    config?.audience && typeof config.audience === "object"
      ? (config.audience as Record<string, unknown>)
      : null;
  const audienceKind = audienceObj ? asString(audienceObj.kind) : null;
  const audienceSize = audienceObj ? asString(audienceObj.estimatedSize) : null;
  const languages =
    audienceObj && Array.isArray(audienceObj.languages)
      ? audienceObj.languages.filter((l): l is string => typeof l === "string")
      : [];

  const chipClass = dark
    ? "bg-slate-800 text-slate-300 border-slate-700"
    : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className={`space-y-6 ${dark ? "text-slate-200" : "text-slate-900"}`}>
      <header>
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {category && (
            <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
              {category}
            </span>
          )}
          {visibility && (
            <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
              {visibility}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
            {cartridgeSlug}
          </span>
        </div>
      </header>

      {description && (
        <section>
          <h3 className={`text-sm font-medium mb-1 ${dark ? "text-slate-400" : "text-slate-600"}`}>
            Description
          </h3>
          <p className="text-sm">{description}</p>
        </section>
      )}

      {purpose && (
        <section>
          <h3 className={`text-sm font-medium mb-1 ${dark ? "text-slate-400" : "text-slate-600"}`}>
            Purpose
          </h3>
          <p className="text-sm whitespace-pre-line">{purpose}</p>
        </section>
      )}

      {(audienceKind || audienceSize || languages.length > 0) && (
        <section>
          <h3 className={`text-sm font-medium mb-2 ${dark ? "text-slate-400" : "text-slate-600"}`}>
            Audience
          </h3>
          <div className="flex flex-wrap gap-2">
            {audienceKind && (
              <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
                {audienceKind}
              </span>
            )}
            {audienceSize && (
              <span className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}>
                {audienceSize}
              </span>
            )}
            {languages.map((lang, i) => (
              <span
                key={`lang-${i}`}
                className={`text-xs px-2 py-0.5 rounded border ${chipClass}`}
              >
                {lang}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>
        Template: overview-v1 · Phase 5a reference.
      </p>
    </div>
  );
}
