"use client";

import { Suspense } from "react";
import OpsPage from "@/app/(shell)/ops/page";

export default function SettingsOpsPage() {
  return (
    <Suspense fallback={null}>
      <OpsPage />
    </Suspense>
  );
}
