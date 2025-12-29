/**
 * SmartTriad Embed Layout
 * 
 * Minimal layout for iframe embedding in Lovable and other thin clients.
 * No global nav, sidebar, or chrome - just the embed content.
 */

import "../../globals.css";
import { ToastProvider } from "../../../components/ui/toaster";
import AgentiQBootstrap from "../../providers/AgentiQBootstrap";
import { AGUIProvider } from "../../components/AGUIProvider";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
        <AGUIProvider runtimeUrl="/api/copilotkit">
          <ToastProvider>
            {/* Full viewport container for iframe embedding */}
            <div className="smarttriad-root w-full h-screen overflow-hidden">
              {children}
            </div>
            <AgentiQBootstrap />
          </ToastProvider>
        </AGUIProvider>
      </body>
    </html>
  );
}
