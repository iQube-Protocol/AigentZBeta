import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@agentiq/smartwallet";
import { CodexProvider } from "@agentiq/codex";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { issue0 } from "./data/issue-0";
import { AvatarProvider, AvatarHost } from "@agentiq/avatar-host";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <CodexProvider
        source={{ type: 'local' }}
        initialCodex={issue0}
        autoLoadCodexId="theqriptopian-issue-0"
      >
        <AvatarProvider
          context={{
            franchiseId: 'theqriptopian',
            tenantId: 'main',
          }}
          enablePersistence={true}
        >
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/console" element={<Index />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </BrowserRouter>
            
            {/* Global persistent metaAvatar */}
            <AvatarHost
              position="bottom-right"
              defaultAgent="copilot"
              zIndex={10000}
            />
          </TooltipProvider>
        </AvatarProvider>
      </CodexProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
