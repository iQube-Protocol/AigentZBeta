"use client";

import React from "react";
import { SmartTriadProvider } from "@/app/components/content";
import ContentHubView from "./ContentHubView";

export default function ContentPage() {
  return (
    <SmartTriadProvider personaId="00000000-0000-0000-0000-000000000001" agentId="aigent-z">
      <ContentHubView />
    </SmartTriadProvider>
  );
}
