"use client";

import { Suspense } from "react";
import InvariantExperimentLab from "@/components/composer/InvariantExperimentLab";

// Route kept at /admin/studio/invariant-video for bookmark stability — the
// page grew from the EXP-002 video runner into the full Experiment Lab
// (EXP-001/002/003). The same lab also mounts as the AgentiQ cartridge's
// Experiment Lab tab (multi-cartridge viewer).
export default function InvariantVideoExperimentPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <InvariantExperimentLab />
      </Suspense>
    </div>
  );
}
