"use client";

import "../globals.css";
import { Sidebar } from "../../components/Sidebar";
import { ToastProvider } from "../../components/ui/toaster";
import AgentiQBootstrap from "../providers/AgentiQBootstrap";
import { AGUIProvider } from "../components/AGUIProvider";

/**
 * Shell Layout
 * 
 * Full AigentiQ platform UI with sidebar, navigation, and chrome.
 * Used for all internal dashboard, persona, orchestrator, and admin routes.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
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
          <AgentiQBootstrap />
        </ToastProvider>
      </AGUIProvider>
    </div>
  );
}
