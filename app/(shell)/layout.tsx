"use client";

import "../globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from "../../components/ui/toaster";
import { AGUIProvider } from "../components/AGUIProvider";
import { Sidebar } from "../../components/Sidebar";
import { MetaAvatarProvider } from "../contexts/MetaAvatarContext";
import MetaAvatar from "../components/metaVatar/MetaAvatar";
import { useMetaAvatar } from "../contexts/MetaAvatarContext";
import AgentiQBootstrap from "../providers/AgentiQBootstrap";

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

  // CSS positioning classes for each MetaAvatar container type
  const METAAVATAR_POSITION_CLASSES = {
    hidden: 'opacity-0 pointer-events-none -z-10',
    immersive: 'block right-4 top-[96px] left-4 h-[calc(100vh-104px)] md:right-[80px] md:top-[172px] md:left-auto md:w-[calc(100vw-80px)] md:h-[calc(100vh-172px)] opacity-100 z-[100]',
    sidebar: 'block inset-x-0 top-[88px] h-[calc(50vh-88px)] md:right-[92px] md:top-[206px] md:left-auto md:inset-x-auto md:w-[calc((100vw-92px)/3-40px)] md:h-[400px] opacity-100 z-[100]',
    copilot: 'block right-4 top-[96px] w-[400px] h-[300px] md:right-[80px] md:top-[172px] opacity-100 z-[100]',
    codexCopilot: 'block right-4 top-[96px] w-[320px] h-[240px] md:right-[80px] md:top-[172px] opacity-100 z-[100]',
  } as const;

  // Get position classes based on active container
  const getAvatarPositionClasses = () => {
    if (!activeContainer) return METAAVATAR_POSITION_CLASSES.hidden;
    const key = activeContainer as keyof typeof METAAVATAR_POSITION_CLASSES;
    return METAAVATAR_POSITION_CLASSES[key] || METAAVATAR_POSITION_CLASSES.hidden;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AGUIProvider runtimeUrl="/api/copilotkit">
        <ToastProvider>
          <div className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
            <div className="flex h-screen overflow-hidden">
              {/* Original Sidebar */}
              <div className="flex-shrink-0">
                <Sidebar />
              </div>
              {/* Content Area */}
              <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 lg:p-10">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </ToastProvider>
      </AGUIProvider>
      
      {/* GLOBAL PERSISTENT METAAVATAR */}
      {avatarInitialized && (
        <div 
          className={getAvatarPositionClasses()}
          style={{ position: 'fixed', zIndex: 100 }}
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
