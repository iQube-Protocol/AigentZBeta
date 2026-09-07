/**
 * IframeTab — render a third-party site inside a cartridge tab.
 *
 * Used for embedding external surfaces (e.g. metame.com) as first-class
 * persistent tabs that don't fit the Activations system.
 *
 * Hard constraint: the embedded origin MUST permit framing from the
 * aigentz.me / metame.live domains. If the response carries
 * `X-Frame-Options: DENY` / `SAMEORIGIN`, or a CSP
 * `frame-ancestors` directive that excludes our host, the iframe will
 * render blank with no error in our code. Operator action is to add
 * the host(s) to the target site's CSP / X-Frame-Options config.
 */

"use client";

import React from "react";
import { AlertCircle, ExternalLink } from "lucide-react";

interface IframeTabProps {
  src?: string;
  title?: string;
  /** Sandbox flags. Leaving undefined means no sandbox (default,
   *  full-trust). Set when embedding less-trusted origins. */
  sandbox?: string;
  /** Optional referrer policy override. Default 'strict-origin-when-cross-origin'. */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  theme?: "light" | "dark";
}

export function IframeTab({
  src,
  title = "Embedded site",
  sandbox,
  referrerPolicy = "strict-origin-when-cross-origin",
  theme = "dark",
}: IframeTabProps) {
  if (!src) {
    return (
      <div className={`p-6 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
        <div className="flex items-start gap-3 max-w-xl">
          <AlertCircle className="w-5 h-5 mt-0.5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">No URL configured for this tab.</p>
            <p className={`text-xs mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Set <code>config.props.src</code> on the tab definition to point at
              the URL you want to embed.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex flex-col w-full h-full min-h-[600px] bg-slate-950">
      {/* Pop-out — a small floating overlay, not a chrome row (a prior
          attempt at this affordance ate vertical space the embedded site
          needs; the cartridge sub-header this comment used to point to
          doesn't reliably render for a singleton-group embed tab, so it
          lives here instead, positioned to cost no layout height). */}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        aria-label="Open embed URL in new tab"
        className="absolute right-2 top-2 z-10 flex items-center justify-center rounded-md bg-slate-900/70 p-1.5 text-slate-300 backdrop-blur hover:bg-slate-900/90 hover:text-white transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <iframe
        src={src}
        title={title}
        className="flex-1 w-full border-0"
        loading="lazy"
        referrerPolicy={referrerPolicy}
        {...(sandbox ? { sandbox } : {})}
      />
    </div>
  );
}
