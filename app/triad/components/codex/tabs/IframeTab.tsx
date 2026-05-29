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
import { ExternalLink, AlertCircle } from "lucide-react";

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
    <div className="relative w-full h-full min-h-[600px] bg-slate-950">
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        loading="lazy"
        referrerPolicy={referrerPolicy}
        {...(sandbox ? { sandbox } : {})}
      />
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-slate-300 backdrop-blur-md hover:bg-slate-800/80"
      >
        <ExternalLink className="w-3 h-3" />
        Open
      </a>
    </div>
  );
}
