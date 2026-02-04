"use client";

import QubeTalkConsole from "@/components/qubetalk/QubeTalkConsole";
import { Suspense } from "react";

export default function QubeTalkAdminPage() {
  return (
    <Suspense fallback={null}>
      <QubeTalkConsole mode="admin" />
    </Suspense>
  );
}
