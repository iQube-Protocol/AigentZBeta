import "./globals.css";
import { Sidebar } from "../components/Sidebar";
import { Toaster } from "../components/ui/Toaster";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 lg:p-10">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
