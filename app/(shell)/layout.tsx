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
import { PersonaProvider } from "../contexts/PersonaContext";
import { ActivationsProvider } from "@/services/activations/ActivationsContext";
// Global SmartContent Listen (text-to-speech) controller — the ONE shared
// audio coordinator for Qriptopian cards, feeds, and the article reader.
// Mounted at the same shell level as SmartContentActionProvider so playback
// survives navigating between a content list and the full article reader
// within the same app session.
import { SmartContentAudioProvider } from "@/services/smartcontent/smartContentAudioController";

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

  // Experience viewer pages render in isolation (no sidebar/nav shell)
  const isIsolatedContent = useMemo(() => {
    return (
      isEmbeddedSurface ||
      pathname?.startsWith("/studio/composer/experience/")
    );
  }, [isEmbeddedSurface, pathname]);

  // CSS positioning classes for each MetaAvatar container type
  const METAAVATAR_POSITION_CLASSES = {
    hidden: 'opacity-0 pointer-events-none -z-10',
    immersive: 'block right-4 top-[96px] left-4 h-[calc(100vh-104px)] md:right-[80px] md:top-[172px] md:left-auto md:w-[calc(100vw-80px)] md:h-[calc(100vh-172px)] opacity-100 z-[100]',
    sidebar: 'block inset-x-0 top-[88px] h-[calc(50vh-88px)] md:right-[92px] md:top-[206px] md:left-auto md:inset-x-auto md:w-[calc((100vw-92px)/3-40px)] md:h-[400px] opacity-100 z-[100]',
    copilot: 'block opacity-100 z-[140]',
    codexCopilot: 'block opacity-100 z-[140]',
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
        zIndex: 140,
        left: "var(--metaavatar-copilot-x, 16px)",
        top: "var(--metaavatar-copilot-y, 96px)",
        width: "var(--metaavatar-copilot-w, 415px)",
        height: "var(--metaavatar-copilot-h, 320px)",
      };
    }
    if (activeContainer === "codexCopilot") {
      return {
        position: "fixed",
        zIndex: 140,
        left: "var(--metaavatar-codex-x, 16px)",
        top: "var(--metaavatar-codex-y, 96px)",
        width: "var(--metaavatar-codex-w, 320px)",
        height: "var(--metaavatar-codex-h, 240px)",
      };
    }
    // NO ACTIVE CONTAINER — the host stays MOUNTED (rebuilding the avatar
    // session is expensive; this file"s whole design is "move it with CSS,
    // never unmount it") but it must be genuinely INERT.
    //
    // It was not. `avatarInitialized` latches true on the first avatar use and
    // never resets, so from then on this branch rendered a permanently mounted
    // `position: fixed` element — and its INLINE z-index overrode the `-z-10`
    // in the hidden class, parking an auto-sized, opacity-0 layer above the
    // copilot. An `opacity < 1` fixed layer forms its own composited stacking
    // context, which is exactly what stops `backdrop-filter` resolving on the
    // panel beneath it: the frosted backdrop silently stops rendering and the
    // near-transparent panel fill lets the page bleed through. Operator report
    // 2026-07-26 — "after the avatar has been clicked... the opacity has
    // disappeared", plus broken scrolling from the stray full-size layer.
    //
    // Zero-size + hidden + behind everything: mounted, costless, invisible.
    if (!activeContainer) {
      // display:none, nothing weaker. The first fix used visibility+zIndex on a
      // zero-size box — but a zero-size overflow:hidden wrapper does NOT clip
      // position:fixed descendants (fixed positions against the viewport), a
      // child can override inherited visibility, and an opacity-0 layer still
      // composites. display:none removes the entire subtree from rendering; no
      // child can escape it by any positioning scheme. This is the property the
      // operator's "once and for all" requires (third report, 2026-07-26).
      return { display: "none" };
    }
    return { position: "fixed", zIndex: 100 };
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AGUIProvider runtimeUrl="/api/copilotkit">
        <SmartContentAudioProvider>
        <SmartContentActionProvider>
          <ToastProvider>
            <div className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
              {isIsolatedContent && (
                <style jsx global>{`
                  .copilotkit-launcher,
                  .copilotkit-button,
                  .copilotkit-floating-button {
                    display: none !important;
                  }
                `}</style>
              )}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    .agentiq-shell-sidebar-host {
                      width: 0 !important;
                      min-width: 0 !important;
                      flex-basis: 0 !important;
                      overflow: visible !important;
                    }

                    .agentiq-shell-main {
                      width: 100% !important;
                    }
                  `,
                }}
              />
              <div className="flex h-screen overflow-hidden">
                {!isIsolatedContent && (
                  <div className="agentiq-shell-sidebar-host flex-shrink-0">
                    <Sidebar />
                  </div>
                )}
                <main className={`agentiq-shell-main flex-1 ${isIsolatedContent ? "overflow-hidden" : "overflow-y-auto"}`}>
                  <div className="h-full w-full p-0">
                    <Suspense fallback={null}>{children}</Suspense>
                  </div>
                </main>
              </div>
            </div>
          </ToastProvider>
        </SmartContentActionProvider>
        </SmartContentAudioProvider>
      </AGUIProvider>
      
      {/* GLOBAL PERSISTENT METAAVATAR — mounted only while a container owns it.
          `avatarInitialized` latches true permanently, so gating on it alone
          kept the D-ID SDK's DOCUMENT-BODY-level nodes alive for the rest of
          the session after one avatar use; no wrapper style can reach those,
          which is why every "hide the host" fix left the panel beneath it
          broken. Unmounting sweeps them (MetaAvatar.tsx, 2026-07-27). */}
      {avatarInitialized && activeContainer && (
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
    <PersonaProvider>
      <ActivationsProvider>
        <MetaAvatarProvider>
          <ShellLayoutContent>{children}</ShellLayoutContent>
        </MetaAvatarProvider>
      </ActivationsProvider>
    </PersonaProvider>
  );
}
