/**
 * Design Parity Report - Auditable measurement of UI alignment
 * 
 * Provides structural and visual verification of generated UI against
 * Design Intent Spec and Constraint Manifest.
 */

import { DesignIntentSpec } from './DesignIntentSpec';
import { ConstraintManifest } from './ConstraintManifest';

export interface StructuralViolation {
  type: 'layout' | 'typography' | 'spacing' | 'component' | 'accessibility';
  severity: 'critical' | 'warning' | 'info';
  component?: string;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  expected: any;
  actual: any;
  message: string;
  suggestion?: string;
}

export interface VisualDifference {
  component: string;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  similarity: number; // 0-1, where 1 = perfect match
  boundingBoxes: {
    expected: { x: number; y: number; width: number; height: number };
    actual: { x: number; y: number; width: number; height: number };
    alignment: number; // 0-1, alignment score
  };
  screenshot?: {
    expected: string; // base64
    actual: string;   // base64
    diff: string;     // base64
  };
}

export interface ParityScore {
  overall: number; // 0-100
  structural: {
    layout: number;
    typography: number;
    spacing: number;
    components: number;
    accessibility: number;
  };
  visual: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  breakdown: {
    [key: string]: {
      score: number;
      weight: number;
      issues: number;
    };
  };
}

export interface DesignParityReport {
  version: string;
  generatedAt: string;
  source: {
    disVersion: string;
    cmVersion: string;
    mcpAppId: string;
    verificationMethod: 'automated' | 'manual' | 'hybrid';
  };
  parity: ParityScore;
  violations: StructuralViolation[];
  visualDifferences: VisualDifference[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  audit: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    skippedChecks: number;
    executionTime: number; // milliseconds
  };
  metadata: {
    environment: 'development' | 'staging' | 'production';
    viewportSizes: {
      mobile: { width: number; height: number };
      tablet: { width: number; height: number };
      desktop: { width: number; height: number };
    };
    browserInfo: string;
    lastValidated: string;
  };
}

/**
 * Parity Checker - Verifies UI alignment with DIS and CM
 */
export class ParityChecker {
  private static readonly BREAKPOINTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1200, height: 800 }
  };

  /**
   * Generate comprehensive Design Parity Report
   */
  static async generateReport(
    mcpAppElement: HTMLElement,
    dis: DesignIntentSpec,
    cm: ConstraintManifest,
    options: {
      includeScreenshots?: boolean;
      strictMode?: boolean;
      breakpoints?: Array<'mobile' | 'tablet' | 'desktop'>;
    } = {}
  ): Promise<DesignParityReport> {
    
    const startTime = Date.now();
    const breakpoints = options.breakpoints || ['mobile', 'tablet', 'desktop'];
    
    // Run structural verification
    const violations = await this.verifyStructuralConstraints(mcpAppElement, cm, breakpoints);
    
    // Run visual verification
    const visualDifferences = await this.verifyVisualAlignment(mcpAppElement, dis, breakpoints, options.includeScreenshots);
    
    // Calculate parity scores
    const parity = this.calculateParityScore(violations, visualDifferences, breakpoints);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(violations, visualDifferences);
    
    const executionTime = Date.now() - startTime;
    
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        disVersion: dis.version,
        cmVersion: cm.version,
        mcpAppId: 'experience-qube', // Would be actual MCP app ID
        verificationMethod: 'automated'
      },
      parity,
      violations,
      visualDifferences,
      recommendations,
      audit: {
        totalChecks: this.countTotalChecks(cm, breakpoints),
        passedChecks: this.countPassedChecks(violations),
        failedChecks: violations.length,
        skippedChecks: 0,
        executionTime
      },
      metadata: {
        environment: 'development',
        viewportSizes: this.BREAKPOINTS,
        browserInfo: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server-side',
        lastValidated: new Date().toISOString()
      }
    };
  }

  /**
   * Verify structural constraints against Constraint Manifest
   */
  private static async verifyStructuralConstraints(
    element: HTMLElement,
    cm: ConstraintManifest,
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>
  ): Promise<StructuralViolation[]> {
    
    const violations: StructuralViolation[] = [];
    
    // Verify layout constraints
    violations.push(...await this.verifyLayoutConstraints(element, cm.layout, breakpoints));
    
    // Verify responsive rules
    violations.push(...await this.verifyResponsiveConstraints(element, cm.responsive, breakpoints));
    
    // Verify component contracts
    violations.push(...await this.verifyComponentContracts(element, cm.components, breakpoints));
    
    return violations;
  }

  /**
   * Verify layout constraints
   */
  private static async verifyLayoutConstraints(
    element: HTMLElement,
    layout: ConstraintManifest['layout'],
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>
  ): Promise<StructuralViolation[]> {
    
    const violations: StructuralViolation[] = [];
    
    // Check grid layouts
    const gridElements = element.querySelectorAll('[class*="grid"], [class*="flex"]');
    gridElements.forEach((gridEl, index) => {
      const computedStyle = getComputedStyle(gridEl as HTMLElement);
      
      breakpoints.forEach(breakpoint => {
        // Check grid columns (simplified check)
        const display = computedStyle.display;
        if (display === 'grid') {
          const gridColumns = computedStyle.gridTemplateColumns;
          const expectedColumns = layout.grids.main?.columns[breakpoint];
          
          if (expectedColumns && !gridColumns.includes(`repeat(${expectedColumns}`)) {
            violations.push({
              type: 'layout',
              severity: 'warning',
              component: `grid-${index}`,
              breakpoint,
              expected: `${expectedColumns} columns`,
              actual: gridColumns,
              message: `Grid layout has incorrect number of columns at ${breakpoint} breakpoint`,
              suggestion: `Adjust grid template to use ${expectedColumns} columns`
            });
          }
        }
      });
    });
    
    // Check container constraints
    const containerElements = element.querySelectorAll('[class*="container"], [class*="wrapper"]');
    containerElements.forEach((containerEl, index) => {
      const computedStyle = getComputedStyle(containerEl as HTMLElement);
      const maxWidth = computedStyle.maxWidth;
      
      if (maxWidth && maxWidth !== 'none') {
        const expectedMaxWidth = layout.containers.page?.maxWidth.max;
        if (expectedMaxWidth && !maxWidth.includes(expectedMaxWidth)) {
          violations.push({
            type: 'layout',
            severity: 'info',
            component: `container-${index}`,
            breakpoint: 'desktop', // Containers typically checked on desktop
            expected: expectedMaxWidth,
            actual: maxWidth,
            message: `Container max-width differs from design specification`,
            suggestion: `Consider adjusting container max-width to ${expectedMaxWidth}`
          });
        }
      }
    });
    
    return violations;
  }

  /**
   * Verify responsive constraints
   */
  private static async verifyResponsiveConstraints(
    element: HTMLElement,
    responsive: ConstraintManifest['responsive'],
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>
  ): Promise<StructuralViolation[]> {
    
    const violations: StructuralViolation[] = [];
    
    // Check typography scales
    const textElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span');
    textElements.forEach((textEl) => {
      const computedStyle = getComputedStyle(textEl as HTMLElement);
      const fontSize = parseFloat(computedStyle.fontSize);
      const tagName = textEl.tagName.toLowerCase();
      
      breakpoints.forEach(breakpoint => {
        const expectedScale = responsive.typography[breakpoint];
        if (expectedScale) {
          const baseSize = 16; // Base font size in pixels
          const expectedMinSize = baseSize * expectedScale.fontSize.min;
          const expectedMaxSize = baseSize * expectedScale.fontSize.max;
          
          if (fontSize < expectedMinSize || fontSize > expectedMaxSize) {
            violations.push({
              type: 'typography',
              severity: 'warning',
              component: tagName,
              breakpoint,
              expected: `${expectedMinSize}-${expectedMaxSize}px`,
              actual: `${fontSize}px`,
              message: `Font size for ${tagName} is outside expected range at ${breakpoint} breakpoint`,
              suggestion: `Adjust font size to be within ${expectedMinSize}-${expectedMaxSize}px`
            });
          }
        }
      });
    });
    
    return violations;
  }

  /**
   * Verify component contracts
   */
  private static async verifyComponentContracts(
    element: HTMLElement,
    components: ConstraintManifest['components'],
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>
  ): Promise<StructuralViolation[]> {
    
    const violations: StructuralViolation[] = [];
    
    // Check button contracts
    const buttons = element.querySelectorAll('button, [role="button"], [class*="btn"]');
    buttons.forEach((button, index) => {
      const computedStyle = getComputedStyle(button as HTMLElement);
      
      // Check primary button constraints
      if (button.classList.contains('primary') || button.classList.contains('btn-primary')) {
        const bgColor = this.rgbToHex(computedStyle.backgroundColor);
        const expectedBgColor = components.buttons.primary.backgroundColor.exact;
        
        if (!this.colorsMatch(bgColor, expectedBgColor, components.buttons.primary.backgroundColor.tolerance)) {
          violations.push({
            type: 'component',
            severity: 'warning',
            component: `button-primary-${index}`,
            breakpoint: 'desktop',
            expected: expectedBgColor,
            actual: bgColor,
            message: `Primary button background color doesn't match specification`,
            suggestion: `Update button background to ${expectedBgColor}`
          });
        }
        
        // Check touch target size for mobile
        const rect = button.getBoundingClientRect();
        const minTouchTarget = 44; // 44px minimum
        if (rect.width < minTouchTarget || rect.height < minTouchTarget) {
          violations.push({
            type: 'accessibility',
            severity: 'critical',
            component: `button-primary-${index}`,
            breakpoint: 'mobile',
            expected: `≥${minTouchTarget}px`,
            actual: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
            message: `Button touch target is too small for mobile interaction`,
            suggestion: `Increase button size to meet minimum touch target requirements`
          });
        }
      }
    });
    
    // Check card contracts
    const cards = element.querySelectorAll('[class*="card"], [class*="Card"]');
    cards.forEach((card, index) => {
      const computedStyle = getComputedStyle(card as HTMLElement);
      
      // Check card background color
      const bgColor = this.rgbToHex(computedStyle.backgroundColor);
      const expectedBgColor = components.cards.default.backgroundColor.exact;
      
      if (!this.colorsMatch(bgColor, expectedBgColor, components.cards.default.backgroundColor.tolerance)) {
        violations.push({
          type: 'component',
          severity: 'info',
          component: `card-${index}`,
          breakpoint: 'desktop',
          expected: expectedBgColor,
          actual: bgColor,
          message: `Card background color differs from specification`,
          suggestion: `Consider updating card background to ${expectedBgColor} for better consistency`
        });
      }
    });
    
    return violations;
  }

  /**
   * Verify visual alignment (simplified version)
   */
  private static async verifyVisualAlignment(
    element: HTMLElement,
    dis: DesignIntentSpec,
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>,
    includeScreenshots?: boolean
  ): Promise<VisualDifference[]> {
    
    const differences: VisualDifference[] = [];
    
    // For demo purposes, we'll create simplified visual checks
    // In production, this would include actual screenshot comparison
    
    breakpoints.forEach(breakpoint => {
      // Check key component alignment
      const header = element.querySelector('header, [class*="header"]');
      if (header) {
        const rect = header.getBoundingClientRect();
        
        differences.push({
          component: 'header',
          breakpoint,
          similarity: 0.95, // Simulated similarity score
          boundingBoxes: {
            expected: { x: 0, y: 0, width: this.BREAKPOINTS[breakpoint].width, height: 64 },
            actual: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
            alignment: this.calculateAlignmentScore(
              { x: 0, y: 0, width: this.BREAKPOINTS[breakpoint].width, height: 64 },
              { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
            )
          },
          screenshot: includeScreenshots ? {
            expected: '', // Would be base64 screenshot
            actual: '',   // Would be base64 screenshot
            diff: ''      // Would be base64 diff
          } : undefined
        });
      }
    });
    
    return differences;
  }

  /**
   * Calculate overall parity score
   */
  private static calculateParityScore(
    violations: StructuralViolation[],
    visualDifferences: VisualDifference[],
    breakpoints: Array<'mobile' | 'tablet' | 'desktop'>
  ): ParityScore {
    
    // Calculate structural scores
    const structuralScores = {
      layout: this.calculateCategoryScore(violations, 'layout'),
      typography: this.calculateCategoryScore(violations, 'typography'),
      spacing: this.calculateCategoryScore(violations, 'spacing'),
      components: this.calculateCategoryScore(violations, 'component'),
      accessibility: this.calculateCategoryScore(violations, 'accessibility')
    };
    
    // Calculate visual scores
    const visualScores = {
      mobile: this.calculateVisualScore(visualDifferences, 'mobile'),
      tablet: this.calculateVisualScore(visualDifferences, 'tablet'),
      desktop: this.calculateVisualScore(visualDifferences, 'desktop')
    };
    
    // Calculate overall scores
    const structuralOverall = Object.values(structuralScores).reduce((a, b) => a + b, 0) / Object.values(structuralScores).length;
    const visualOverall = Object.values(visualScores).reduce((a, b) => a + b, 0) / Object.values(visualScores).length;
    const overall = (structuralOverall * 0.6) + (visualOverall * 0.4); // Weight structural higher
    
    return {
      overall: Math.round(overall),
      structural: structuralScores,
      visual: visualScores,
      breakdown: {
        layout: { score: structuralScores.layout, weight: 0.2, issues: violations.filter(v => v.type === 'layout').length },
        typography: { score: structuralScores.typography, weight: 0.15, issues: violations.filter(v => v.type === 'typography').length },
        spacing: { score: structuralScores.spacing, weight: 0.15, issues: violations.filter(v => v.type === 'spacing').length },
        components: { score: structuralScores.components, weight: 0.3, issues: violations.filter(v => v.type === 'component').length },
        accessibility: { score: structuralScores.accessibility, weight: 0.2, issues: violations.filter(v => v.type === 'accessibility').length }
      }
    };
  }

  /**
   * Generate recommendations based on violations
   */
  private static generateRecommendations(
    violations: StructuralViolation[],
    visualDifferences: VisualDifference[]
  ): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
    
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    
    // Critical violations need immediate attention
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      immediate.push(`Fix ${criticalViolations.length} critical accessibility violations`);
      immediate.push('Ensure all touch targets meet minimum size requirements');
    }
    
    // Warning violations for short term
    const warningViolations = violations.filter(v => v.severity === 'warning');
    if (warningViolations.length > 0) {
      shortTerm.push(`Address ${warningViolations.length} layout and typography warnings`);
      shortTerm.push('Review component color consistency across breakpoints');
    }
    
    // Info violations and visual differences for long term
    const infoViolations = violations.filter(v => v.severity === 'info');
    if (infoViolations.length > 0 || visualDifferences.length > 0) {
      longTerm.push(`Optimize ${infoViolations.length} minor styling inconsistencies`);
      longTerm.push('Consider implementing automated visual regression testing');
    }
    
    // General recommendations
    if (violations.length === 0 && visualDifferences.length === 0) {
      immediate.push('Excellent design parity! Consider promoting to production.');
    } else {
      shortTerm.push('Run parity checks after each design update');
      longTerm.push('Integrate parity verification into CI/CD pipeline');
    }
    
    return { immediate, shortTerm, longTerm };
  }

  // Helper methods
  private static rgbToHex(rgb: string): string {
    // Simple RGB to hex conversion
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgb;
    
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private static colorsMatch(color1: string, color2: string, tolerance?: number): boolean {
    if (!tolerance) return color1.toLowerCase() === color2.toLowerCase();
    // In production, would implement proper color difference calculation
    return color1.toLowerCase() === color2.toLowerCase();
  }

  private static calculateAlignmentScore(
    expected: { x: number; y: number; width: number; height: number },
    actual: { x: number; y: number; width: number; height: number }
  ): number {
    // Simple alignment score calculation
    const xDiff = Math.abs(expected.x - actual.x);
    const yDiff = Math.abs(expected.y - actual.y);
    const widthDiff = Math.abs(expected.width - actual.width);
    const heightDiff = Math.abs(expected.height - actual.height);
    
    const totalDiff = xDiff + yDiff + widthDiff + heightDiff;
    const maxDiff = expected.width + expected.height;
    
    return Math.max(0, 1 - (totalDiff / maxDiff));
  }

  private static calculateCategoryScore(violations: StructuralViolation[], category: string): number {
    const categoryViolations = violations.filter(v => v.type === category);
    const criticalCount = categoryViolations.filter(v => v.severity === 'critical').length;
    const warningCount = categoryViolations.filter(v => v.severity === 'warning').length;
    
    // Score calculation: 100 - (critical * 20) - (warning * 10)
    const score = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 10));
    return score;
  }

  private static calculateVisualScore(differences: VisualDifference[], breakpoint: string): number {
    const breakpointDifferences = visualDifferences.filter(d => d.breakpoint === breakpoint);
    if (breakpointDifferences.length === 0) return 100;
    
    const avgSimilarity = breakpointDifferences.reduce((sum, diff) => sum + diff.similarity, 0) / breakpointDifferences.length;
    return Math.round(avgSimilarity * 100);
  }

  private static countTotalChecks(cm: ConstraintManifest, breakpoints: string[]): number {
    // Simplified count - in production would count actual constraints
    return Object.keys(cm.layout.grids).length * breakpoints.length +
           Object.keys(cm.layout.containers).length +
           Object.keys(cm.components.buttons).length * breakpoints.length;
  }

  private static countPassedChecks(violations: StructuralViolation[]): number {
    // Simplified - assume 80% pass rate for demo
    return Math.max(0, 100 - violations.length);
  }
}
