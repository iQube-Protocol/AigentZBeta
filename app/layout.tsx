import "./globals.css";
import { Sidebar } from "../components/Sidebar";
import { ToastProvider } from "../components/ui/Toaster";
import AgentiQBootstrap from "./providers/AgentiQBootstrap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
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
      </body>
    </html>
  );
}
