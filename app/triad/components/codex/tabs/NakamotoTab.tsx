/**
 * Aigent Nakamoto Tab Component
 * 
 * The 6th tab in the Multi Codex Viewer, featuring:
 * - Blockchain and decentralized technology expertise
 * - Rich visual aids (Mermaid diagrams, charts, code examples)
 * - Tenant architecture (Nakamoto root + JMO tenant)
 * - QubeBase Core Hub integration
 * - Knowledge base management
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  BookOpen, 
  Code2, 
  GitBranch, 
  Network, 
  Settings, 
  Search, 
  Filter,
  Cpu,
  Database,
  Shield,
  Coins,
  BarChart3,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import type { 
  TenantId, 
  NakamotoContent, 
  NakamotoTabState, 
  VisualizationType,
  ContentType,
  SearchFilters,
  NakamotoTabProps 
} from "@/app/types/nakamoto";
import { getNakamotoCoreClient } from "@/app/services/nakamoto/nakamotoCoreClient";
import { TenantSwitcher } from "../nakamoto/TenantSwitcher";
import { ContentBrowser } from "../nakamoto/ContentBrowser";
import { MermaidDiagramRenderer } from "../nakamoto/MermaidDiagramRenderer";
import { CodeExampleViewer } from "../nakamoto/CodeExampleViewer";
import { ChartViewer } from "../nakamoto/ChartViewer";
import { BlockchainViewer } from "../nakamoto/BlockchainViewer";

export function NakamotoTab({ 
  theme = 'dark', 
  density = 'wide', 
  personaId, 
  issueSlug 
}: NakamotoTabProps) {
  const { toast } = useToast();
  const { state: smartTriadState } = useSmartTriad();
  const coreClient = useMemo(() => getNakamotoCoreClient(), []);

  // Core state
  const [tabState, setTabState] = useState<NakamotoTabState>({
    currentTenant: 'nakamoto',
    availableTenants: [],
    documents: [],
    prompts: [],
    content: [],
    selectedContent: undefined,
    activeVisualization: undefined,
    searchQuery: '',
    selectedTags: [],
    isLoading: false,
    connectionStatus: 'checking',
    mermaidDiagrams: [],
    codeExamples: [],
    charts: [],
    blockchainVisualizations: [],
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'browse' | 'visualize' | 'code' | 'blockchain' | 'knowledge'>('browse');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isTenantSwitching, setIsTenantSwitching] = useState(false);

  // Initialize connection and load data
  useEffect(() => {
    initializeNakamoto();
  }, []);

  const initializeNakamoto = async () => {
    setTabState(prev => ({ ...prev, isLoading: true, connectionStatus: 'checking' }));
    
    try {
      // Check Core Hub connection
      const connectionResult = await coreClient.checkConnection();
      if (!connectionResult.success) {
        throw new Error(connectionResult.error || 'Failed to connect to Core Hub');
      }

      // Load available tenants
      const tenants = await coreClient.getTenants();
      
      // Load initial content
      await loadContent();

      setTabState(prev => ({
        ...prev,
        availableTenants: tenants,
        connectionStatus: 'connected',
        isLoading: false,
      }));

      toast({
        title: "Nakamoto Initialized",
        description: `Connected to Core Hub with ${tenants.length} tenants`,
      });
    } catch (error) {
      console.error('Failed to initialize Nakamoto:', error);
      setTabState(prev => ({
        ...prev,
        connectionStatus: 'error',
        isLoading: false,
      }));
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const loadContent = async () => {
    try {
      const [documents, prompts] = await Promise.all([
        coreClient.getDocuments({ limit: 50 }),
        coreClient.getPrompts(),
      ]);

      // Transform documents into content items
      const content: NakamotoContent[] = documents.map(doc => ({
        id: doc.id,
        type: 'document',
        title: doc.title,
        description: doc.content_text?.substring(0, 200) + '...',
        tags: doc.tags,
        scope: doc.scope,
        tenant_id: doc.tenant_id,
        content: { document: doc },
        metadata: doc.metadata,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      }));

      setTabState(prev => ({
        ...prev,
        documents,
        prompts,
        content,
      }));
    } catch (error) {
      console.error('Failed to load content:', error);
      toast({
        title: "Content Load Failed",
        description: "Could not load knowledge base content",
        variant: "destructive",
      });
    }
  };

  const handleTenantSwitch = async (tenantId: TenantId) => {
    if (tenantId === tabState.currentTenant) return;
    
    setIsTenantSwitching(true);
    try {
      coreClient.setTenant(tenantId);
      await loadContent(); // Reload content for new tenant
      
      setTabState(prev => ({
        ...prev,
        currentTenant: tenantId,
        selectedContent: undefined,
      }));

      toast({
        title: "Tenant Switched",
        description: `Switched to ${tenantId === 'nakamoto' ? 'Nakamoto' : 'Aigent JMO'}`,
      });
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      toast({
        title: "Tenant Switch Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTenantSwitching(false);
    }
  };

  const handleContentSelect = (content: NakamotoContent) => {
    setTabState(prev => ({
      ...prev,
      selectedContent: content,
      activeVisualization: undefined,
    }));

    // Auto-switch to appropriate tab based on content type
    switch (content.type) {
      case 'mermaid-diagram':
        setActiveTab('visualize');
        break;
      case 'code-example':
        setActiveTab('code');
        break;
      case 'chart':
        setActiveTab('visualize');
        break;
      case 'blockchain-viz':
        setActiveTab('blockchain');
        break;
      default:
        setActiveTab('browse');
    }
  };

  const handleSearch = useCallback((query: string) => {
    setTabState(prev => ({ ...prev, searchQuery: query }));
    setSearchFilters(prev => ({ ...prev, query }));
  }, []);

  const handleTagsChange = useCallback((tags: string[]) => {
    setTabState(prev => ({ ...prev, selectedTags: tags }));
    setSearchFilters(prev => ({ ...prev, tags }));
  }, []);

  const filteredContent = useMemo(() => {
    let filtered = tabState.content;

    if (searchFilters.query) {
      const query = searchFilters.query.toLowerCase();
      filtered = filtered.filter(content => 
        content.title.toLowerCase().includes(query) ||
        content.description?.toLowerCase().includes(query) ||
        content.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (searchFilters.tags && searchFilters.tags.length > 0) {
      filtered = filtered.filter(content =>
        searchFilters.tags!.some(tag => content.tags.includes(tag))
      );
    }

    if (searchFilters.type) {
      filtered = filtered.filter(content => content.type === searchFilters.type);
    }

    if (searchFilters.scope) {
      filtered = filtered.filter(content => content.scope === searchFilters.scope);
    }

    if (searchFilters.tenant) {
      filtered = filtered.filter(content => 
        content.tenant_id === searchFilters.tenant || 
        (content.scope === 'root' && searchFilters.tenant === 'nakamoto')
      );
    }

    return filtered;
  }, [tabState.content, searchFilters]);

  const renderVisualization = () => {
    if (!tabState.selectedContent) return null;

    switch (tabState.selectedContent.type) {
      case 'mermaid-diagram':
        return (
          <MermaidDiagramRenderer
            diagram={tabState.selectedContent.content.diagram!}
            theme={theme}
            interactive={true}
          />
        );
      case 'code-example':
        return (
          <CodeExampleViewer
            codeExample={tabState.selectedContent.content.code!}
            theme={theme}
            interactive={true}
          />
        );
      case 'chart':
        return (
          <ChartViewer
            chart={tabState.selectedContent.content.chart!}
            theme={theme}
            interactive={true}
          />
        );
      case 'blockchain-viz':
        return (
          <BlockchainViewer
            visualization={tabState.selectedContent.content.blockchain!}
            theme={theme}
            interactive={true}
          />
        );
      default:
        return (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No visualization available for this content type</p>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  if (tabState.connectionStatus === 'checking') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-cyan-400">Connecting to Nakamoto Core Hub...</p>
        </div>
      </div>
    );
  }

  if (tabState.connectionStatus === 'error') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-semibold text-red-400 mb-2">Connection Failed</h3>
            <p className="text-muted-foreground mb-4">
              Unable to connect to Nakamoto Core Hub. Please check your configuration.
            </p>
            <Button onClick={initializeNakamoto} variant="outline">
              <Loader2 className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Aigent Nakamoto</h2>
          </div>
          
          <TenantSwitcher
            currentTenant={tabState.currentTenant}
            tenants={tabState.availableTenants}
            onTenantChange={handleTenantSwitch}
            disabled={isTenantSwitching}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {tabState.connectionStatus === 'connected' ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-400" />
                Connected
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Offline
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
          <div className="border-b border-border">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Browse
              </TabsTrigger>
              <TabsTrigger value="visualize" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Visualize
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="blockchain" className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                Blockchain
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Knowledge
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="browse" className="flex-1 m-0">
            <ContentBrowser
              content={filteredContent}
              selectedContent={tabState.selectedContent}
              onContentSelect={handleContentSelect}
              searchQuery={tabState.searchQuery}
              onSearchChange={handleSearch}
              selectedTags={tabState.selectedTags}
              onTagsChange={handleTagsChange}
              loading={tabState.isLoading}
            />
          </TabsContent>

          <TabsContent value="visualize" className="flex-1 m-0">
            <div className="h-full p-4">
              {tabState.selectedContent?.type === 'mermaid-diagram' || 
               tabState.selectedContent?.type === 'chart' ? (
                renderVisualization()
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a diagram or chart to visualize</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="code" className="flex-1 m-0">
            <div className="h-full p-4">
              {tabState.selectedContent?.type === 'code-example' ? (
                renderVisualization()
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                      <Code2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a code example to view</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="blockchain" className="flex-1 m-0">
            <div className="h-full p-4">
              {tabState.selectedContent?.type === 'blockchain-viz' ? (
                renderVisualization()
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                      <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a blockchain visualization to explore</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="flex-1 m-0">
            <div className="h-full p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Knowledge Base
                  </CardTitle>
                  <CardDescription>
                    {tabState.documents.length} documents • {tabState.prompts.length} prompts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Documents</p>
                              <p className="text-2xl font-bold text-cyan-400">{tabState.documents.length}</p>
                            </div>
                            <BookOpen className="w-8 h-8 text-cyan-400 opacity-50" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Prompts</p>
                              <p className="text-2xl font-bold text-purple-400">{tabState.prompts.length}</p>
                            </div>
                            <Cpu className="w-8 h-8 text-purple-400 opacity-50" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Recent Documents</h4>
                      {tabState.documents.slice(0, 5).map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border">
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {doc.scope === 'root' ? 'Root' : doc.tenant_id} • {doc.tags.join(', ')}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default NakamotoTab;
