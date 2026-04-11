"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// /codex?id=<codexId>&tab=<tab> → /codex/viewer?id=<codexId>&tab=<tab>
// All existing links in the codebase use this pattern; the viewer lives at /codex/viewer.
export default function CodexRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/codex/viewer${qs ? `?${qs}` : ""}`);
  }, [router, searchParams]);

  return null;
}
