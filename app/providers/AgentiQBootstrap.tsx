"use client";

import { useEffect, useRef } from "react";

function getEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
}

export default function AgentiQBootstrap() {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const supabaseUrl =
      getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
      getEnv("VITE_SUPABASE_URL") ||
      (typeof window !== "undefined" && (window as any).VITE_SUPABASE_URL);

    const supabaseAnonKey =
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
      getEnv("VITE_SUPABASE_ANON_KEY") ||
      (typeof window !== "undefined" && (window as any).VITE_SUPABASE_ANON_KEY);

    (async () => {
      try {
        const mod: any = await import("@qriptoagentiq/core-client");
        const { initAgentiqClient } = mod;
        const core = initAgentiqClient({
          supabaseUrl: supabaseUrl as string,
          supabaseAnonKey: supabaseAnonKey as string,
        });
        core.ensureIamUser().catch(() => {});
      } catch (e) {
        // silent: envs may be missing or package not ready
      }
    })();
  }, []);

  return null;
}
