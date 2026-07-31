/**
 * Minimal Root Layout
 * 
 * This layout provides only the bare HTML structure.
 * Route groups (shell) and (embed) define their own layouts:
 * - (shell) = full AigentiQ UI with sidebar and chrome
 * - (embed) = chrome-free embed routes for thin clients
 */

import "./globals.css";
import { Suspense } from "react";
import ScrollbarActivity from "@/components/ScrollbarActivity";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <ScrollbarActivity />
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
