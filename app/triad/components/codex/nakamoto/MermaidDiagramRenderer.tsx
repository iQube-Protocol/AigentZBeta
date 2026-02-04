/**
 * Mermaid Diagram Renderer
 * 
 * Renders Mermaid diagrams with proper state management to prevent:
 * - State contamination between diagrams
 * - Text visibility issues
 * - Lifecycle management problems
 * - Rendering chaos
 */

import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MermaidDiagram } from "@/app/types/nakamoto";

interface MermaidDiagramRendererProps {
  diagram: MermaidDiagram;
  theme?: 'light' | 'dark';
  interactive?: boolean;
  onInteraction?: (type: string, data: any) => void;
}

export function MermaidDiagramRenderer({ 
  diagram, 
  theme = 'dark', 
  interactive = true,
  onInteraction 
}: MermaidDiagramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [renderId, setRenderId] = useState(0); // Force re-render on changes

  // Initialize Mermaid with proper configuration
  useEffect(() => {
    // Configure Mermaid to prevent state contamination
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      themeVariables: {
        darkMode: theme === 'dark',
        primaryColor: theme === 'dark' ? '#00bcd4' : '#2196f3',
        primaryTextColor: theme === 'dark' ? '#ffffff' : '#000000',
        primaryBorderColor: theme === 'dark' ? '#00bcd4' : '#2196f3',
        lineColor: theme === 'dark' ? '#ffffff' : '#000000',
        secondaryColor: theme === 'dark' ? '#ff4081' : '#ff5722',
        tertiaryColor: theme === 'dark' ? '#4caf50' : '#8bc34a',
        background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        mainBkg: theme === 'dark' ? '#333333' : '#f5f5f5',
        secondBkg: theme === 'dark' ? '#444444' : '#e0e0e0',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
      sequence: {
        useMaxWidth: true,
        wrap: true,
        mirrorActors: false,
      },
      gantt: {
        useMaxWidth: true,
        titleTopMargin: 25,
        barHeight: 20,
        fontSize: 11,
      },
      securityLevel: 'loose', // Allow HTML in labels for better text visibility
    });
  }, [theme]);

  // Render diagram with proper cleanup
  const renderDiagram = useCallback(async () => {
    if (!containerRef.current || !diagram.definition) return;

    setIsLoading(true);
    setError(null);

    try {
      // Clear previous content to prevent contamination
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Generate unique ID for this render
      const uniqueId = `mermaid-${diagram.id}-${renderId}-${Date.now()}`;
      
      // Validate diagram definition
      try {
        await mermaid.parse(diagram.definition);
      } catch (parseError) {
        throw new Error(`Invalid Mermaid syntax: ${(parseError as Error).message}`);
      }

      // Render the diagram
      const { svg } = await mermaid.render(uniqueId, diagram.definition);
      
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        
        // Get reference to the SVG element
        const svgElement = containerRef.current.querySelector('svg');
        if (svgElement instanceof SVGSVGElement) {
          svgRef.current = svgElement;
          
          // Apply text visibility fixes
          fixTextVisibility(svgElement);
          
          // Add interactive features
          if (interactive) {
            addInteractiveFeatures(svgElement);
          }
        }
      }

      onInteraction?.('rendered', { diagramId: diagram.id, success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown rendering error';
      setError(errorMessage);
      console.error('Mermaid rendering error:', err);
      onInteraction?.('error', { diagramId: diagram.id, error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [diagram, renderId, theme, interactive, onInteraction]);

  // Fix text visibility issues
  const fixTextVisibility = (svgElement: SVGSVGElement) => {
    // Ensure text elements are visible
    const textElements = svgElement.querySelectorAll('text');
    textElements.forEach(text => {
      const currentFill = text.getAttribute('fill');
      if (!currentFill || currentFill === 'none') {
        text.setAttribute('fill', theme === 'dark' ? '#ffffff' : '#000000');
      }
      
      // Ensure proper font size
      const currentFontSize = text.getAttribute('font-size');
      if (!currentFontSize || parseFloat(currentFontSize) < 12) {
        text.setAttribute('font-size', '14px');
      }
    });

    // Fix node labels
    const nodeLabels = svgElement.querySelectorAll('.nodeLabel');
    nodeLabels.forEach(label => {
      if (label instanceof SVGElement) {
        label.style.opacity = '1';
        label.style.visibility = 'visible';
      }
    });

    // Fix edge labels
    const edgeLabels = svgElement.querySelectorAll('.edgeLabel');
    edgeLabels.forEach(label => {
      if (label instanceof SVGElement) {
        label.style.opacity = '1';
        label.style.visibility = 'visible';
      }
    });
  };

  // Add interactive features
  const addInteractiveFeatures = (svgElement: SVGSVGElement) => {
    // Add hover effects to nodes
    const nodes = svgElement.querySelectorAll('.node');
    nodes.forEach(node => {
      if (!(node instanceof SVGElement)) return;
      node.addEventListener('mouseenter', () => {
        node.style.opacity = '0.8';
        node.style.cursor = 'pointer';
      });
      
      node.addEventListener('mouseleave', () => {
        node.style.opacity = '1';
        node.style.cursor = 'default';
      });
      
      node.addEventListener('click', () => {
        const nodeId = node.getAttribute('id');
        onInteraction?.('node-click', { diagramId: diagram.id, nodeId });
      });
    });

    // Add click handlers to edges
    const edges = svgElement.querySelectorAll('.edge');
    edges.forEach(edge => {
      if (!(edge instanceof SVGElement)) return;
      edge.addEventListener('click', () => {
        const edgeId = edge.getAttribute('id');
        onInteraction?.('edge-click', { diagramId: diagram.id, edgeId });
      });
    });
  };

  // Render diagram when dependencies change
  useEffect(() => {
    renderDiagram();
    
    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [renderDiagram]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  // Toggle labels visibility
  const toggleLabels = () => {
    setShowLabels(prev => !prev);
    if (svgRef.current) {
      const textElements = svgRef.current.querySelectorAll('text');
      textElements.forEach(text => {
        text.style.display = showLabels ? 'none' : 'block';
      });
    }
  };

  // Export diagram
  const exportDiagram = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagram.title || 'diagram'}.svg`;
      link.click();
      URL.revokeObjectURL(url);
      
      onInteraction?.('export', { diagramId: diagram.id, format: 'svg' });
    }
  };

  // Force re-render
  const forceRerender = () => {
    setRenderId(prev => prev + 1);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{diagram.title}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {diagram.type}
            </Badge>
            {diagram.metadata?.complexity && (
              <Badge 
                variant={
                  diagram.metadata.complexity === 'simple' ? 'secondary' :
                  diagram.metadata.complexity === 'medium' ? 'default' :
                  'destructive'
                }
                className="text-xs"
              >
                {diagram.metadata.complexity}
              </Badge>
            )}
          </div>
          
          {interactive && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetZoom}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleLabels}>
                {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={exportDiagram}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={forceRerender}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        {diagram.metadata?.description && (
          <p className="text-sm text-muted-foreground">
            {diagram.metadata.description}
          </p>
        )}
        
        {diagram.metadata?.tags && diagram.metadata.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {diagram.metadata.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className="relative h-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Rendering diagram...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Card className="max-w-md border-red-200">
                <CardContent className="p-4 text-center">
                  <p className="text-red-400 font-medium mb-2">Rendering Error</p>
                  <p className="text-sm text-muted-foreground mb-3">{error}</p>
                  <Button size="sm" onClick={forceRerender}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full overflow-auto flex items-center justify-center"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            {/* Mermaid diagram will be rendered here */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
