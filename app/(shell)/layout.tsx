"use client";

import "../globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState, useMemo } from 'react';
import { ToastProvider } from "../../components/ui/toaster";
import { AGUIProvider } from "../components/AGUIProvider";
import { Sidebar } from "../../components/Sidebar";
import { MetaAvatarProvider } from "../contexts/MetaAvatarContext";
import MetaAvatar from "../components/metaVatar/MetaAvatar";
import { useMetaAvatar } from "../contexts/MetaAvatarContext";
import AgentiQBootstrap from "../providers/AgentiQBootstrap";
import { usePathname, useSearchParams } from "next/navigation";
// Global SmartContent provider
import { SmartContentActionProvider } from "../contexts/SmartContentActionContext";

function ShellLayoutContent({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  }));
  
  const { avatarInitialized, activeContainer, avatarRefreshKey } = useMetaAvatar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEmbeddedSurface = useMemo(() => {
    if (searchParams?.get("embed") !== "1") return false;
    return (
      pathname?.startsWith("/metame/runtime") ||
      pathname?.startsWith("/demo/smart-drawer") ||
      pathname?.startsWith("/demo/smart-drawer-new")
    );
  }, [searchParams, pathname]);

  // CSS positioning classes for each MetaAvatar container type
  const METAAVATAR_POSITION_CLASSES = {
    hidden: 'opacity-0 pointer-events-none -z-10',
    immersive: 'block right-4 top-[96px] left-4 h-[calc(100vh-104px)] md:right-[80px] md:top-[172px] md:left-auto md:w-[calc(100vw-80px)] md:h-[calc(100vh-172px)] opacity-100 z-[100]',
    sidebar: 'block inset-x-0 top-[88px] h-[calc(50vh-88px)] md:right-[92px] md:top-[206px] md:left-auto md:inset-x-auto md:w-[calc((100vw-92px)/3-40px)] md:h-[400px] opacity-100 z-[100]',
    copilot: 'block opacity-100 z-[110]',
    codexCopilot: 'block opacity-100 z-[110]',
  } as const;

  // Get position classes based on active container
  const getAvatarPositionClasses = () => {
    if (!activeContainer) return METAAVATAR_POSITION_CLASSES.hidden;
    const key = activeContainer as keyof typeof METAAVATAR_POSITION_CLASSES;
    return METAAVATAR_POSITION_CLASSES[key] || METAAVATAR_POSITION_CLASSES.hidden;
  };

  const getAvatarPositionStyle = (): React.CSSProperties => {
    if (activeContainer === "copilot") {
      return {
        position: "fixed",
        zIndex: 110,
        left: "var(--metaavatar-copilot-x, 16px)",
        top: "var(--metaavatar-copilot-y, 96px)",
        width: "var(--metaavatar-copilot-w, 400px)",
        height: "var(--metaavatar-copilot-h, 320px)",
      };
    }
    if (activeContainer === "codexCopilot") {
      return {
        position: "fixed",
        zIndex: 110,
        left: "var(--metaavatar-codex-x, 16px)",
        top: "var(--metaavatar-codex-y, 96px)",
        width: "var(--metaavatar-codex-w, 320px)",
        height: "var(--metaavatar-codex-h, 240px)",
      };
    }
    return { position: "fixed", zIndex: 100 };
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AGUIProvider runtimeUrl="/api/copilotkit">
        <SmartContentActionProvider>
          <ToastProvider>
            <div className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
              {pathname?.startsWith("/metame/runtime") && (
                <style jsx global>{`
                  .copilotkit-launcher,
                  .copilotkit-button,
                  .copilotkit-floating-button {
                    display: none !important;
                  }
                `}</style>
              )}
              <div className="flex h-screen overflow-hidden">
                {!isEmbeddedSurface && (
                  <div className="flex-shrink-0">
                    <Sidebar />
                  </div>
                )}
                <main className={`flex-1 ${isEmbeddedSurface ? "overflow-hidden" : "overflow-y-auto"}` }>
                  <div className={isEmbeddedSurface ? "h-full w-full p-0" : "p-6 md:p-8 lg:p-10"}>
                    <Suspense fallback={null}>{children}</Suspense>
                  </div>
                </main>
              </div>
            </div>
          </ToastProvider>
        </SmartContentActionProvider>
      </AGUIProvider>
      
      {/* GLOBAL PERSISTENT METAAVATAR */}
      {avatarInitialized && (
        <div 
          className={getAvatarPositionClasses()}
          style={getAvatarPositionStyle()}
        >
          <MetaAvatar key={avatarRefreshKey} />
        </div>
      )}
      
      <AgentiQBootstrap />
    </QueryClientProvider>
  );
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MetaAvatarProvider>
      <ShellLayoutContent>{children}</ShellLayoutContent>
    </MetaAvatarProvider>
  );
}
