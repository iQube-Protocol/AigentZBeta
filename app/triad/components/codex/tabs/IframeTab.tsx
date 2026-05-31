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
import { AlertCircle } from "lucide-react";

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
    <div className="flex flex-col w-full h-full min-h-[600px] bg-slate-950">
      {/* Open-in-new-tab affordance removed — the cartridge sub-header
          already shows the embed URL + label, and any chrome row above
          the iframe ate vertical space the embedded site needs. If a
          future cartridge wants its own embed open-link, surface it
          in the sub-header instead of in this component. */}
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
