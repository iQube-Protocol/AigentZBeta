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
import AdminDashboard from "./pages/admin/Dashboard";
import SetupDID from "./pages/admin/SetupDID";
import HomeHeroManager from "./pages/admin/content/HomeHeroManager";
import LatestNewsManager from "./pages/admin/content/LatestNewsManager";
import SecondHeroManager from "./pages/admin/content/SecondHeroManager";
import PennyDropsManager from "./pages/admin/content/PennyDropsManager";
import ScrollsManager from "./pages/admin/content/ScrollsManager";
import KnowdZManager from "./pages/admin/content/KnowdZManager";
import StayBullManager from "./pages/admin/content/StayBullManager";
import ContentEditor from "./pages/admin/content/ContentEditor";
import ContentImporter from "./pages/admin/content/ContentImporter";
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
                  
                  {/* Admin Portal Routes */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/setup-did" element={<SetupDID />} />
                  <Route path="/admin/content/home-hero" element={<HomeHeroManager />} />
                  <Route path="/admin/content/latest-news" element={<LatestNewsManager />} />
                  <Route path="/admin/content/second-hero" element={<SecondHeroManager />} />
                  <Route path="/admin/content/pennydrops" element={<PennyDropsManager />} />
                  <Route path="/admin/content/scrolls" element={<ScrollsManager />} />
                  <Route path="/admin/content/knowdz" element={<KnowdZManager />} />
                  <Route path="/admin/content/21knowdz" element={<KnowdZManager />} />
                  <Route path="/admin/content/staybull" element={<StayBullManager />} />
                  <Route path="/admin/content/edit/:id" element={<ContentEditor />} />
                  <Route path="/admin/import" element={<ContentImporter />} />
                  <Route path="/admin/content/import" element={<ContentImporter />} />
                  
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
