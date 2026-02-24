import type { Metadata } from "next";
import { QubeTalkProvider } from "@metame/qubetalk-client/react";
import type { QubeTalkAuthority } from "@metame/qubetalk-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "metaMe Runtime Shell",
  description: "Thin client runtime shell for metaMe",
};

function resolveAuthority(input: string | undefined): QubeTalkAuthority {
  if (
    input === "aigent_z" ||
    input === "chatgpt" ||
    input === "lovable" ||
    input === "windsurf" ||
    input === "codex"
  ) {
    return input;
  }
  return "lovable";
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const wsUrl = process.env.NEXT_PUBLIC_QUBETALK_WS_URL ?? "";
  const authToken = process.env.QUBETALK_AUTH_TOKEN ?? process.env.NEXT_PUBLIC_QUBETALK_AUTH_TOKEN ?? "";
  const authority = resolveAuthority(process.env.NEXT_PUBLIC_QUBETALK_AUTHORITY);

  return (
    <html lang="en">
      <body>
        <QubeTalkProvider wsUrl={wsUrl} authToken={authToken} authority={authority}>
          {children}
        </QubeTalkProvider>
      </body>
    </html>
  );
}
