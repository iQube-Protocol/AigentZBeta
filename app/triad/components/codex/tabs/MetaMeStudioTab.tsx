"use client";

/**
 * MetaMeStudioTab — contained mount for ComposerStudio inside the metaMe cartridge shell.
 *
 * ComposerStudio's root uses `position: fixed; inset: 0; z-[95]`, which escapes
 * the cartridge shell viewport. Wrapping it in a `transform: translateZ(0)`
 * container makes that fixed positioning resolve to the wrapper (per CSS spec:
 * any non-`none` `transform` creates a containing block for fixed descendants),
 * keeping the cartridge header + tab menu visible above the studio.
 */

import React from "react";
import { ComposerStudio } from "@/components/composer/ComposerStudio";

export function MetaMeStudioTab(props: Record<string, unknown>) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
    >
      <ComposerStudio {...props} />
    </div>
  );
}

export default MetaMeStudioTab;
