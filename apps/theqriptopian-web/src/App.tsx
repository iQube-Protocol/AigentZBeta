import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@agentiq/smartwallet";
import { Layout } from "@/components/Layout";
import { LiveCodexProvider } from "@/providers/LiveCodexProvider";
import { SmartContentActionProvider } from "@/contexts/SmartContentActionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
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
import CodexManager from "./pages/admin/content/CodexManager";
import { AvatarProvider } from "@agentiq/avatar-host";
import { AGUIProvider } from "@/providers/AGUIProvider";

// SmartTriad Embed Routes
import WalletEmbed from "./pages/triad/embed/WalletEmbed";
import CodexEmbed from "./pages/triad/embed/CodexEmbed";
import AdminDashboardEmbed from "./pages/triad/admin/AdminDashboard";
import CodexManagerEmbed from "./pages/triad/admin/CodexManagerEmbed";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AGUIProvider platformUrl={import.meta.env.VITE_API_URL || "http://localhost:3000"}>
      <WalletProvider>
        <LiveCodexProvider>
          <SmartContentActionProvider>
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
                <Routes>
                  {/* SmartTriad Embed Routes - No Layout wrapper */}
                  <Route path="/triad/embed/wallet" element={<WalletEmbed />} />
                  <Route path="/triad/embed/codex" element={<CodexEmbed />} />
                  <Route path="/triad/admin" element={<AdminDashboardEmbed />} />
                  <Route path="/triad/admin/codex" element={<CodexManagerEmbed />} />
                  
                  {/* Main App Routes - With Layout wrapper */}
                  <Route path="/" element={<Layout><Index /></Layout>} />
                  <Route path="/console" element={<Layout><Index /></Layout>} />
                  <Route path="/auth" element={<Layout><Auth /></Layout>} />
                  <Route path="/onboarding" element={<Layout><Onboarding /></Layout>} />
                  
                  {/* Admin Portal Routes */}
                  <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
                  <Route path="/admin/setup-did" element={<Layout><SetupDID /></Layout>} />
                  <Route path="/admin/content/home-hero" element={<Layout><HomeHeroManager /></Layout>} />
                  <Route path="/admin/content/latest-news" element={<Layout><LatestNewsManager /></Layout>} />
                  <Route path="/admin/content/second-hero" element={<Layout><SecondHeroManager /></Layout>} />
                  <Route path="/admin/content/pennydrops" element={<Layout><PennyDropsManager /></Layout>} />
                  <Route path="/admin/content/scrolls" element={<Layout><ScrollsManager /></Layout>} />
                  <Route path="/admin/content/knowdz" element={<Layout><KnowdZManager /></Layout>} />
                  <Route path="/admin/content/21knowdz" element={<Layout><KnowdZManager /></Layout>} />
                  <Route path="/admin/content/staybull" element={<Layout><StayBullManager /></Layout>} />
                  <Route path="/admin/content/edit/:id" element={<Layout><ContentEditor /></Layout>} />
                  <Route path="/admin/import" element={<Layout><ContentImporter /></Layout>} />
                  <Route path="/admin/content/import" element={<Layout><ContentImporter /></Layout>} />
                  <Route path="/admin/content/codex" element={<Layout><CodexManager /></Layout>} />
                  
                  {/* Catch-all */}
                  <Route path="*" element={<Layout><NotFound /></Layout>} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AvatarProvider>
        </SmartContentActionProvider>
      </LiveCodexProvider>
    </WalletProvider>
    </AGUIProvider>
  </QueryClientProvider>
);

export default App;
