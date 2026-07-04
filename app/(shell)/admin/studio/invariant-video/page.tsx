"use client";

import { Suspense } from "react";
import InvariantVideoExperimentRunner from "@/components/composer/InvariantVideoExperimentRunner";

export default function InvariantVideoExperimentPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <InvariantVideoExperimentRunner />
      </Suspense>
    </div>
  );
}
