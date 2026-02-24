/**
 * Design Parity API - End-to-end pipeline for design → agentic UI parity verification
 * 
 * Provides API endpoints for generating DIS, CM, and parity reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DISGenerator, DesignIntentSpec } from '@/app/services/designParity/DesignIntentSpec';
import { ConstraintManifestGenerator, ConstraintManifest } from '@/app/services/designParity/ConstraintManifest';
import { ParityChecker, DesignParityReport } from '@/app/services/designParity/ParityChecker';

/**
 * Generate Design Intent Spec from DesignQube
 */
export async function POST(request: NextRequest) {
  try {
    const { designQube, templateRegistry, options } = await request.json();
    
    if (!designQube) {
      return NextResponse.json(
        { error: 'DesignQube is required' },
        { status: 400 }
      );
    }

    // Generate DIS
    const dis = await DISGenerator.generateFromDesignQube(
      designQube,
      templateRegistry || [],
      options
    );

    // Generate Constraint Manifest
    const cm = ConstraintManifestGenerator.generateFromDIS(dis);

    // For demo purposes, create a mock MCP app element
    // In production, this would be the actual rendered MCP app
    const mockMcpAppElement = createMockMcpAppElement();

    // Generate Parity Report
    const parityReport = await ParityChecker.generateReport(
      mockMcpAppElement,
      dis,
      cm,
      {
        includeScreenshots: false, // Skip screenshots for API response
        strictMode: options?.strictMode || false,
        breakpoints: ['mobile', 'tablet', 'desktop']
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        dis,
        cm,
        parityReport
      }
    });

  } catch (error) {
    console.error('Design parity pipeline error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get existing Design Intent Spec
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const designQubeId = searchParams.get('designQubeId');

    if (!designQubeId) {
      return NextResponse.json(
        { error: 'designQubeId parameter is required' },
        { status: 400 }
      );
    }

    // In production, would fetch from database
    // For demo, return a sample DIS
    const sampleDIS = await generateSampleDIS(designQubeId);

    return NextResponse.json({
      success: true,
      data: sampleDIS
    });

  } catch (error) {
    console.error('Get DIS error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Create mock MCP app element for testing
 */
function createMockMcpAppElement(): HTMLElement {
  if (typeof window === 'undefined') {
    // Server-side - create a simple mock
    return {
      querySelectorAll: (selector: string) => {
        // Return mock elements based on selector
        if (selector.includes('button')) {
          return [
            { 
              tagName: 'BUTTON', 
              className: 'primary btn-primary',
              getBoundingClientRect: () => ({ width: 120, height: 44, left: 0, top: 0 })
            }
          ];
        }
        if (selector.includes('card')) {
          return [
            {
              tagName: 'DIV',
              className: 'card',
              getBoundingClientRect: () => ({ width: 300, height: 200, left: 0, top: 100 })
            }
          ];
        }
        return [];
      },
      querySelector: (selector: string) => {
        if (selector.includes('header')) {
          return {
            tagName: 'HEADER',
            className: 'header',
            getBoundingClientRect: () => ({ width: 1200, height: 64, left: 0, top: 0 })
          };
        }
        return null;
      }
    } as any;
  }

  // Client-side - create actual DOM element
  const container = document.createElement('div');
  container.innerHTML = `
    <header class="header">
      <nav>
        <button class="primary btn-primary">Primary Button</button>
      </nav>
    </header>
    <main>
      <div class="card">
        <h2>Card Title</h2>
        <p>Card content goes here</p>
      </div>
    </main>
  `;
  
  return container;
}

/**
 * Helper: Generate sample DIS for demo
 */
async function generateSampleDIS(designQubeId: string): Promise<DesignIntentSpec> {
  const mockDesignQube = {
    id: designQubeId,
    name: 'Sample DesignQube',
    description: 'Sample design for demo purposes',
    tags: ['demo', 'sample'],
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
    }
  };

  const mockTemplateRegistry = [
    { id: 'button-primary', category: 'button' },
    { id: 'card-default', category: 'card' },
    { id: 'navigation-header', category: 'navigation' }
  ];

  return await DISGenerator.generateFromDesignQube(
    mockDesignQube,
    mockTemplateRegistry,
    { strictMode: false }
  );
}
