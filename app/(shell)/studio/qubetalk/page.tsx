import QubeTalkConsole from "@/components/qubetalk/QubeTalkConsole";
import { Suspense } from "react";

export default function QubeTalkStudioPage() {
  return (
    <Suspense fallback={null}>
      <QubeTalkConsole mode="studio" />
    </Suspense>
  );
}
