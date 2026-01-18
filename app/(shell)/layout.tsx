"use client";

import "../globals.css";
import { Sidebar } from "../../components/Sidebar";
import { ToastProvider } from "../../components/ui/toaster";
import AgentiQBootstrap from "../providers/AgentiQBootstrap";
import { AGUIProvider } from "../components/AGUIProvider";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MetaAvatarProvider } from "../contexts/MetaAvatarContext";
import MetaAvatar from "../components/metaVatar/MetaAvatar";
import { useMetaAvatar } from "../contexts/MetaAvatarContext";

/**
 * CSS positioning classes for each MetaAvatar container type
 * These are generic and can be reused across the estate
 */
const METAAVATAR_POSITION_CLASSES = {
  // Immersive: Full drawer size (AigentDrawer, full-screen experiences)
  immersive: `
    block right-4 top-[96px] left-4 h-[calc(100vh-104px)]
    md:right-[80px] md:top-[172px] md:left-auto
    md:w-[calc(100vw-80px)] md:h-[calc(100vh-172px)]
    opacity-100 z-[100]
  `,
  // Sidebar: Compact sidebar placement (1/3 width, ~400px height)
  sidebar: `
    block inset-x-0 top-[88px] h-[calc(50vh-88px)]
    md:right-[92px] md:top-[206px] md:left-auto md:inset-x-auto
    md:w-[calc((100vw-92px)/3-40px)] md:h-[400px]
    opacity-100 z-[100] md:rounded-lg overflow-hidden
  `,
  // Copilot: Wallet copilot modal size
  copilot: `
    block right-4 top-[163px]
    w-[calc(28rem-2rem)] h-[280px]
    opacity-100 z-[100] rounded-xl overflow-hidden
  `,
  // Codex Copilot: Positioned inside the codex copilot drawer chat area
  codexCopilot: `
    block bottom-[134px] right-[19px]
    w-[460px] h-[466px]
    opacity-100 z-[110] rounded-lg overflow-hidden
  `,
  // Mini: Small floating pip
  mini: `
    block right-4 bottom-4
    w-[120px] h-[120px]
    opacity-100 z-[100] rounded-full overflow-hidden
  `,
  // Hidden: Invisible but iframe stays loaded
  hidden: `
    opacity-0 pointer-events-none -z-10
  `,
} as const;

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

  // Get position classes based on active container
  const getAvatarPositionClasses = () => {
    if (!activeContainer) return METAAVATAR_POSITION_CLASSES.hidden;
    const key = activeContainer as keyof typeof METAAVATAR_POSITION_CLASSES;
    return METAAVATAR_POSITION_CLASSES[key] || METAAVATAR_POSITION_CLASSES.hidden;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
        <AGUIProvider runtimeUrl="/api/copilotkit">
          <ToastProvider>
            <div className="flex h-screen overflow-hidden">
              {/* Fixed Sidebar */}
              <div className="flex-shrink-0">
                <Sidebar />
              </div>
              {/* Scrollable Content Area */}
              <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 lg:p-10">
                  {children}
                </div>
              </main>
            </div>
            
            {/* GLOBAL PERSISTENT METAAVATAR
                This is rendered ONCE and NEVER unmounts.
                CSS positioning moves it between containers.
                The D-ID iframe stays connected across navigation. */}
            {avatarInitialized && (
              <div 
                className={`fixed transition-all duration-300 ease-in-out ${getAvatarPositionClasses()}`}
              >
                <MetaAvatar key={avatarRefreshKey} />
              </div>
            )}
            
            <AgentiQBootstrap />
          </ToastProvider>
        </AGUIProvider>
      </div>
    </QueryClientProvider>
  );
}

/**
 * Shell Layout
 * 
 * Full AigentiQ platform UI with sidebar, navigation, and chrome.
 * Used for all internal dashboard, persona, orchestrator, and admin routes.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MetaAvatarProvider defaultAgent="aigent-z">
      <ShellLayoutContent>{children}</ShellLayoutContent>
    </MetaAvatarProvider>
  );
}
