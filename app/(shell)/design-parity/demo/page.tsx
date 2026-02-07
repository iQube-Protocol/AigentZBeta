/**
 * Design Parity Demo - Interactive demo for design → agentic UI parity
 * 
 * Shows the complete pipeline: DesignQube → DIS → CM → MCP App → Parity Report
 */

"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Code, 
  FileText, 
  BarChart3,
  Zap,
  Settings,
  Play,
  RefreshCw
} from "lucide-react";
import { DISGenerator, DesignIntentSpec } from "@/app/services/designParity/DesignIntentSpec";
import { ConstraintManifestGenerator, ConstraintManifest } from "@/app/services/designParity/ConstraintManifest";
import { ParityChecker, DesignParityReport } from "@/app/services/designParity/ParityChecker";

interface DemoState {
  status: 'idle' | 'loading' | 'success' | 'error';
  dis?: DesignIntentSpec;
  cm?: ConstraintManifest;
  parityReport?: DesignParityReport;
  error?: string;
}

export default function DesignParityDemo() {
  const [demoState, setDemoState] = useState<DemoState>({ status: 'idle' });
  const [activeTab, setActiveTab] = useState('pipeline');
  const GLASS_CARD = "bg-slate-900/70 backdrop-blur-xl border border-slate-700/60";
  const PANEL_CARD = "bg-slate-950/60 backdrop-blur-xl border border-slate-800/80";
  const textClass = "text-white";
  const mutedClass = "text-slate-400";

  const runPipeline = useCallback(async () => {
    setDemoState({ status: 'loading' });

    try {
      // Step 1: Generate DIS from mock DesignQube
      const mockDesignQube = {
        id: 'demo-designqube-1',
        name: 'Demo Design System',
        description: 'Interactive demo design system for parity verification',
        tags: ['demo', 'interactive', 'parity'],
        tokens: {
          themes: {
            dark: {
              color: {
                primary: '#3b82f6',
                secondary: '#64748b',
                accent: '#f59e0b',
                surface: '#1e293b',
                text: '#f8fafc',
                textSecondary: '#cbd5e1',
                textMuted: '#64748b',
                border: '#334155'
              }
            },
            fontFamily: {
              primary: 'Inter, sans-serif'
            }
          }
        },
        // New multi-modal additions
        styleQube: {
          id: 'demo-styleqube',
          name: 'Demo StyleQube',
          voice: {
            persona: 'Demo Assistant',
            accent: 'neutral American',
            pace: 'normal',
            pitch: 'medium',
            tone: 'professional'
          },
          text: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            lineHeight: '1.6',
            maxWidth: '65ch',
            textAlign: 'left',
            textRendering: 'optimizeLegibility'
          }
        },
        structureQube: {
          id: 'demo-structureqube',
          name: 'Demo StructureQube',
          breakpoints: {
            mobile: { maxWidth: 640, columns: 1 },
            tablet: { maxWidth: 1024, columns: 2 },
            desktop: { minWidth: 1025, columns: 3 }
          },
          templates: ['button-primary', 'card-default', 'navigation-header'],
          templateSelection: {
            priority: ['button-primary', 'card-default'],
            byModality: {
              read: ['card-reader'],
              browse: ['card-grid', 'navigation-header']
            },
            byDensity: {
              compact: ['button-compact'],
              balanced: ['button-primary', 'card-default'],
              rich: ['card-elevated']
            }
          },
          layoutRules: [
            'Primary buttons above fold on mobile',
            'Cards reflow to single column under 640px',
            'Navigation remains fixed at top'
          ]
        },
        sources: [
          {
            id: 'demo-style-guide',
            type: 'style-guide',
            label: 'Demo Style Guide',
            location: 'demo/style-guide.md',
            extractedAt: '2026-02-06T00:00:00Z',
            coverage: ['tokens', 'voice', 'text']
          }
        ]
      };

      const mockTemplateRegistry = [
        { id: 'button-primary', category: 'button', name: 'Primary Button' },
        { id: 'button-secondary', category: 'button', name: 'Secondary Button' },
        { id: 'card-default', category: 'card', name: 'Default Card' },
        { id: 'card-elevated', category: 'card', name: 'Elevated Card' },
        { id: 'navigation-header', category: 'navigation', name: 'Header Navigation' }
      ];

      const dis = await DISGenerator.generateFromDesignQube(
        mockDesignQube,
        mockTemplateRegistry,
        { strictMode: false }
      );

      // Step 2: Generate Constraint Manifest
      const cm = ConstraintManifestGenerator.generateFromDIS(dis);

      // Step 3: Create mock MCP app element (simulated)
      const mockMcpAppElement = createMockMcpAppElement();

      // Step 4: Generate Parity Report
      const parityReport = await ParityChecker.generateReport(
        mockMcpAppElement,
        dis,
        cm,
        {
          includeScreenshots: false,
          strictMode: false,
          breakpoints: ['mobile', 'tablet', 'desktop']
        }
      );

      setDemoState({
        status: 'success',
        dis,
        cm,
        parityReport
      });

    } catch (error) {
      console.error('Pipeline error:', error);
      setDemoState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, []);

  const createMockMcpAppElement = (): HTMLElement => {
    // Create a mock DOM element for testing
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="mcp-app">
        <header class="header" style="background-color: #1e293b; height: 64px; padding: 0.5rem 1.5rem; border-bottom: 1px solid #334155;">
          <nav style="display: flex; align-items: center; gap: 1rem;">
            <button class="primary btn-primary" style="background-color: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 1rem; font-weight: 500;">
              Primary Button
            </button>
            <button class="secondary btn-secondary" style="background-color: transparent; color: #f8fafc; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 1rem; font-weight: 500; border: 1px solid #334155;">
              Secondary Button
            </button>
          </nav>
        </header>
        <main style="padding: 3rem 1.5rem;">
          <div class="card" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #f8fafc; font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem;">Card Title</h2>
            <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.5;">Card content goes here with proper typography and spacing.</p>
          </div>
        </main>
      </div>
    `;
    return container;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Eye className="h-4 w-4 text-blue-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl text-slate-100">
      <div className={`mb-8 rounded-2xl p-6 ${PANEL_CARD}`}>
        <h1 className={`text-3xl font-bold mb-2 ${textClass}`}>Design → Agentic UI Parity Demo</h1>
        <p className={mutedClass}>
          Verifiable pipeline that proves generated UI honors design intent across breakpoints
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full grid-cols-4 ${PANEL_CARD}`}>
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="dis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            DIS
          </TabsTrigger>
          <TabsTrigger value="cm" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            CM
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-6">
          <Card className={PANEL_CARD}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Design Parity Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`text-center p-4 rounded-lg ${GLASS_CARD}`}>
                  <div className="font-semibold mb-2">1. Design Ingestion</div>
                  <p className={`text-sm ${mutedClass}`}>DesignQube + Templates</p>
                  {demoState.dis && getStatusIcon('success')}
                </div>
                <div className={`text-center p-4 rounded-lg ${GLASS_CARD}`}>
                  <div className="font-semibold mb-2">2. DIS Generation</div>
                  <p className={`text-sm ${mutedClass}`}>Design Intent Spec</p>
                  {demoState.dis && getStatusIcon('success')}
                </div>
                <div className={`text-center p-4 rounded-lg ${GLASS_CARD}`}>
                  <div className="font-semibold mb-2">3. CM Generation</div>
                  <p className={`text-sm ${mutedClass}`}>Constraint Manifest</p>
                  {demoState.cm && getStatusIcon('success')}
                </div>
                <div className={`text-center p-4 rounded-lg ${GLASS_CARD}`}>
                  <div className="font-semibold mb-2">4. Parity Check</div>
                  <p className={`text-sm ${mutedClass}`}>Verification Report</p>
                  {demoState.parityReport && getStatusIcon('success')}
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  onClick={runPipeline} 
                  disabled={demoState.status === 'loading'}
                  className="flex items-center gap-2"
                >
                  {demoState.status === 'loading' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Running Pipeline...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Pipeline
                    </>
                  )}
                </Button>
              </div>

              {demoState.status === 'error' && (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {demoState.error}
                  </AlertDescription>
                </Alert>
              )}

              {demoState.status === 'success' && demoState.parityReport && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Pipeline completed successfully! Overall parity score: 
                    <span className={`font-bold ml-2 ${getScoreColor(demoState.parityReport.parity.overall)}`}>
                      {demoState.parityReport.parity.overall}/100
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dis" className="space-y-6">
          {demoState.dis ? (
            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Design Intent Spec
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Metadata</h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Name:</strong> {demoState.dis.metadata.name}</p>
                        <p><strong>Version:</strong> {demoState.dis.version}</p>
                        <p><strong>Source:</strong> {demoState.dis.source.designQubeId}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Tokens</h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Primary:</strong> {demoState.dis.tokens.colors.primary}</p>
                        <p><strong>Font:</strong> {demoState.dis.tokens.typography.fontFamily.primary}</p>
                        <p><strong>Spacing:</strong> {demoState.dis.tokens.spacing.md}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Component Semantics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <strong>Buttons:</strong> {Object.keys(demoState.dis.semantics.buttons).length} types
                      </div>
                      <div>
                        <strong>Cards:</strong> {Object.keys(demoState.dis.semantics.cards).length} types
                      </div>
                      <div>
                        <strong>Navigation:</strong> {Object.keys(demoState.dis.semantics.navigation).length} types
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Responsive Rules</h4>
                    <div className="text-sm">
                      <p>Breakpoints: Mobile ({demoState.dis.responsive.breakpoints.mobile}), Tablet ({demoState.dis.responsive.breakpoints.tablet}), Desktop ({demoState.dis.responsive.breakpoints.desktop})</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={GLASS_CARD}>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">Run the pipeline first to generate the Design Intent Spec</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cm" className="space-y-6">
          {demoState.cm ? (
            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Constraint Manifest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Verification Settings</h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Strict Mode:</strong> {demoState.cm.verification.strictMode ? 'Yes' : 'No'}</p>
                        <p><strong>Color Tolerance:</strong> {(demoState.cm.verification.toleranceLevels.color * 100).toFixed(0)}%</p>
                        <p><strong>Spacing Tolerance:</strong> {(demoState.cm.verification.toleranceLevels.spacing * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Priority Order</h4>
                      <div className="text-sm">
                        {demoState.cm.verification.priorityOrdering.map((priority, index) => (
                          <Badge key={index} variant="outline" className="mr-1 mb-1">
                            {index + 1}. {priority}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Layout Constraints</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <strong>Grids:</strong> {Object.keys(demoState.cm.layout.grids).length} defined
                      </div>
                      <div>
                        <strong>Containers:</strong> {Object.keys(demoState.cm.layout.containers).length} defined
                      </div>
                      <div>
                        <strong>Sections:</strong> {Object.keys(demoState.cm.layout.sections).length} defined
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Component Contracts</h4>
                    <div className="space-y-2">
                      {Object.entries(demoState.cm.components.buttons).map(([key, contract]) => (
                        <div key={key} className="text-sm border rounded p-2">
                          <strong>Button {key}:</strong> {contract.backgroundColor.exact} background, {contract.textColor.exact} text
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={GLASS_CARD}>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">Run the pipeline first to generate the Constraint Manifest</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-6">
          {demoState.parityReport ? (
            <div className="space-y-6">
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Design Parity Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Overall Score</h4>
                        <div className={`text-2xl font-bold ${getScoreColor(demoState.parityReport.parity.overall)}`}>
                          {demoState.parityReport.parity.overall}/100
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Audit Summary</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>Total Checks:</strong> {demoState.parityReport.audit.totalChecks}</p>
                          <p><strong>Passed:</strong> {demoState.parityReport.audit.passedChecks}</p>
                          <p><strong>Failed:</strong> {demoState.parityReport.audit.failedChecks}</p>
                          <p><strong>Execution Time:</strong> {demoState.parityReport.audit.executionTime}ms</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Structural Scores</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Object.entries(demoState.parityReport.parity.structural).map(([key, score]) => (
                          <div key={key} className="text-center border rounded p-2">
                            <div className="text-xs text-muted-foreground capitalize">{key}</div>
                            <div className={`font-bold ${getScoreColor(score)}`}>{score}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Visual Scores</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(demoState.parityReport.parity.visual).map(([breakpoint, score]) => (
                          <div key={breakpoint} className="text-center border rounded p-2">
                            <div className="text-xs text-muted-foreground capitalize">{breakpoint}</div>
                            <div className={`font-bold ${getScoreColor(score)}`}>{score}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {demoState.parityReport.violations.length > 0 && (
                <Card className={GLASS_CARD}>
                  <CardHeader>
                    <CardTitle>Violations ({demoState.parityReport.violations.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {demoState.parityReport.violations.map((violation, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 border rounded">
                          {getStatusIcon(violation.severity)}
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{violation.type} - {violation.component}</div>
                            <div className="text-muted-foreground">{violation.message}</div>
                            {violation.suggestion && (
                              <div className="text-blue-600 text-xs mt-1">Suggestion: {violation.suggestion}</div>
                            )}
                          </div>
                          <Badge variant="outline">{violation.breakpoint}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-green-600">Immediate</h5>
                      <ul className="text-sm list-disc list-inside">
                        {demoState.parityReport.recommendations.immediate.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-yellow-600">Short Term</h5>
                      <ul className="text-sm list-disc list-inside">
                        {demoState.parityReport.recommendations.shortTerm.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-blue-600">Long Term</h5>
                      <ul className="text-sm list-disc list-inside">
                        {demoState.parityReport.recommendations.longTerm.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className={GLASS_CARD}>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">Run the pipeline first to generate the Design Parity Report</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
