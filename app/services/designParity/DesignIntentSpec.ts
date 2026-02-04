/**
 * Design Intent Spec (DIS) - Normalized design semantics
 * 
 * Converts DesignQube + templates into structured design intent
 * that can drive both generation and verification.
 */

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    border: string;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary?: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

export interface ComponentSemantics {
  buttons: {
    primary: {
      backgroundColor: string;
      textColor: string;
      padding: string;
      borderRadius: string;
      fontSize: string;
      fontWeight: number;
      hoverState: {
        backgroundColor: string;
        transform?: string;
      };
    };
    secondary: {
      backgroundColor: string;
      textColor: string;
      padding: string;
      borderRadius: string;
      fontSize: string;
      fontWeight: number;
      border: string;
      hoverState: {
        backgroundColor: string;
        textColor: string;
      };
    };
  };
  cards: {
    default: {
      backgroundColor: string;
      borderColor: string;
      borderRadius: string;
      padding: string;
      shadow: string;
    };
    elevated: {
      backgroundColor: string;
      borderColor: string;
      borderRadius: string;
      padding: string;
      shadow: string;
      transform?: string;
    };
  };
  navigation: {
    header: {
      backgroundColor: string;
      height: string;
      padding: string;
      borderBottom: string;
    };
    navItem: {
      textColor: string;
      fontSize: string;
      fontWeight: number;
      padding: string;
      hoverState: {
        textColor: string;
        backgroundColor: string;
      };
    };
    mobileMenu: {
      backgroundColor: string;
      maxWidth: string;
      animation: string;
    };
  };
  layout: {
    container: {
      maxWidth: string;
      padding: string;
    };
    grid: {
      columns: number;
      gap: string;
    };
    section: {
      padding: string;
      gap: string;
    };
  };
}

export interface LayoutIntent {
  grids: {
    [key: string]: {
      columns: {
        mobile: number;
        tablet: number;
        desktop: number;
      };
      gap: string;
      padding: string;
      alignItems: 'start' | 'center' | 'end' | 'stretch';
    };
  };
  containers: {
    [key: string]: {
      maxWidth: string;
      padding: string;
      centerContent: boolean;
    };
  };
  sections: {
    [key: string]: {
      spacing: string;
      maxWidth?: string;
      background?: string;
    };
  };
  hierarchy: {
    primary: {
      order: number;
      prominence: 'highest' | 'high' | 'medium' | 'low';
    };
    secondary: {
      order: number;
      prominence: 'high' | 'medium' | 'low';
    };
    tertiary: {
      order: number;
      prominence: 'medium' | 'low';
    };
  };
}

export interface ResponsiveRules {
  breakpoints: {
    mobile: string;    // '640px'
    tablet: string;    // '1024px'
    desktop: string;   // '1280px'
  };
  typography: {
    mobile: {
      scale: number; // 0.875 for mobile
      lineHeight: number;
    };
    tablet: {
      scale: number; // 1.0 for tablet
      lineHeight: number;
    };
    desktop: {
      scale: number; // 1.125 for desktop
      lineHeight: number;
    };
  };
  spacing: {
    mobile: {
      scale: number; // 0.75 for mobile
    };
    tablet: {
      scale: number; // 1.0 for tablet
    };
    desktop: {
      scale: number; // 1.25 for desktop
    };
  };
  layout: {
    mobile: {
      gridColumns: number;
      containerPadding: string;
      sectionSpacing: string;
    };
    tablet: {
      gridColumns: number;
      containerPadding: string;
      sectionSpacing: string;
    };
    desktop: {
      gridColumns: number;
      containerPadding: string;
      sectionSpacing: string;
    };
  };
  interactions: {
    mobile: {
      touchTargets: {
        minSize: string; // '44px'
        spacing: string;
      };
      gestures: {
        swipe: boolean;
        pinch: boolean;
      };
    };
    tablet: {
      touchTargets: {
        minSize: string; // '40px'
        spacing: string;
      };
      gestures: {
        swipe: boolean;
        pinch: boolean;
      };
    };
    desktop: {
      hoverStates: boolean;
      focusStates: boolean;
      keyboardNavigation: boolean;
    };
  };
}

export interface DesignIntentSpec {
  version: string;
  generatedAt: string;
  source: {
    designQubeId: string;
    templateRegistry: string[];
    ingestionMethod: 'figma' | 'xd' | 'code' | 'manual';
  };
  tokens: DesignTokens;
  semantics: ComponentSemantics;
  layout: LayoutIntent;
  responsive: ResponsiveRules;
  metadata: {
    name: string;
    description: string;
    tags: string[];
    constraints: {
      strict: boolean;
      allowFallbacks: boolean;
      priorityOrdering: string[];
    };
  };
}

/**
 * DIS Generator - Converts DesignQube + templates into Design Intent Spec
 */
export class DISGenerator {
  /**
   * Generate DIS from existing DesignQube and template registry
   */
  static async generateFromDesignQube(
    designQube: any,
    templateRegistry: any[],
    options: {
      strictMode?: boolean;
      includeExperimental?: boolean;
    } = {}
  ): Promise<DesignIntentSpec> {
    
    // Extract tokens from DesignQube
    const tokens = this.extractDesignTokens(designQube);
    
    // Extract semantics from template registry
    const semantics = await this.extractComponentSemantics(templateRegistry, tokens);
    
    // Extract layout intent from DesignQube + templates
    const layout = this.extractLayoutIntent(designQube, templateRegistry);
    
    // Generate responsive rules
    const responsive = this.generateResponsiveRules(designQube, tokens);
    
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        designQubeId: designQube.id || 'unknown',
        templateRegistry: templateRegistry.map(t => t.id),
        ingestionMethod: 'code' // Since we're using existing code assets
      },
      tokens,
      semantics,
      layout,
      responsive,
      metadata: {
        name: designQube.name || 'Generated DIS',
        description: designQube.description || 'Design Intent Spec generated from DesignQube',
        tags: designQube.tags || [],
        constraints: {
          strict: options.strictMode || false,
          allowFallbacks: true,
          priorityOrdering: ['layout', 'typography', 'color', 'interaction']
        }
      }
    };
  }

  /**
   * Extract design tokens from DesignQube
   */
  private static extractDesignTokens(designQube: any): DesignTokens {
    const themes = designQube.tokens?.themes || {};
    const darkTheme = themes.dark || {};
    const colorTokens = darkTheme.color || {};
    
    return {
      colors: {
        primary: colorTokens.primary || '#3b82f6',
        secondary: colorTokens.secondary || '#64748b',
        accent: colorTokens.accent || '#f59e0b',
        surface: colorTokens.surface || '#1e293b',
        text: {
          primary: colorTokens.text || '#f8fafc',
          secondary: colorTokens.textSecondary || '#cbd5e1',
          muted: colorTokens.textMuted || '#64748b'
        },
        border: colorTokens.border || '#334155'
      },
      typography: {
        fontFamily: {
          primary: designQube.tokens?.fontFamily?.primary || 'Inter, sans-serif',
          secondary: designQube.tokens?.fontFamily?.secondary
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        }
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        full: '9999px'
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
      }
    };
  }

  /**
   * Extract component semantics from template registry
   */
  private static async extractComponentSemantics(
    templateRegistry: any[],
    tokens: DesignTokens
  ): Promise<ComponentSemantics> {
    
    // Analyze template registry to extract semantic patterns
    const buttonTemplates = templateRegistry.filter(t => t.category === 'button');
    const cardTemplates = templateRegistry.filter(t => t.category === 'card');
    const navigationTemplates = templateRegistry.filter(t => t.category === 'navigation');
    
    return {
      buttons: {
        primary: {
          backgroundColor: tokens.colors.primary,
          textColor: tokens.colors.text.primary,
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
          borderRadius: tokens.borderRadius.md,
          fontSize: tokens.typography.fontSize.base,
          fontWeight: tokens.typography.fontWeight.medium,
          hoverState: {
            backgroundColor: this.adjustColor(tokens.colors.primary, 10),
            transform: 'translateY(-1px)'
          }
        },
        secondary: {
          backgroundColor: 'transparent',
          textColor: tokens.colors.text.primary,
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
          borderRadius: tokens.borderRadius.md,
          fontSize: tokens.typography.fontSize.base,
          fontWeight: tokens.typography.fontWeight.medium,
          border: `1px solid ${tokens.colors.border}`,
          hoverState: {
            backgroundColor: tokens.colors.surface,
            textColor: tokens.colors.text.secondary
          }
        }
      },
      cards: {
        default: {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.lg,
          shadow: tokens.shadows.md
        },
        elevated: {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.lg,
          shadow: tokens.shadows.lg,
          transform: 'translateY(-2px)'
        }
      },
      navigation: {
        header: {
          backgroundColor: tokens.colors.surface,
          height: '4rem',
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
          borderBottom: `1px solid ${tokens.colors.border}`
        },
        navItem: {
          textColor: tokens.colors.text.secondary,
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
          hoverState: {
            textColor: tokens.colors.text.primary,
            backgroundColor: 'transparent'
          }
        },
        mobileMenu: {
          backgroundColor: tokens.colors.surface,
          maxWidth: '20rem',
          animation: 'slide-in 0.2s ease-out'
        }
      },
      layout: {
        container: {
          maxWidth: '1200px',
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`
        },
        grid: {
          columns: 12,
          gap: tokens.spacing.lg
        },
        section: {
          padding: tokens.spacing['3xl'],
          gap: tokens.spacing.xl
        }
      }
    };
  }

  /**
   * Extract layout intent from DesignQube and templates
   */
  private static extractLayoutIntent(designQube: any, templateRegistry: any[]): LayoutIntent {
    return {
      grids: {
        main: {
          columns: {
            mobile: 1,
            tablet: 2,
            desktop: 3
          },
          gap: '1.5rem',
          padding: '1.5rem',
          alignItems: 'stretch'
        },
        sidebar: {
          columns: {
            mobile: 1,
            tablet: 3,
            desktop: 4
          },
          gap: '1rem',
          padding: '1rem',
          alignItems: 'start'
        }
      },
      containers: {
        page: {
          maxWidth: '1200px',
          padding: '0 1.5rem',
          centerContent: true
        },
        section: {
          maxWidth: '100%',
          padding: '3rem 1.5rem',
          centerContent: false
        }
      },
      sections: {
        hero: {
          spacing: '4rem',
          maxWidth: '1200px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
        },
        content: {
          spacing: '3rem',
          maxWidth: '100%'
        },
        footer: {
          spacing: '2rem',
          background: '#0f172a'
        }
      },
      hierarchy: {
        primary: {
          order: 1,
          prominence: 'highest'
        },
        secondary: {
          order: 2,
          prominence: 'high'
        },
        tertiary: {
          order: 3,
          prominence: 'medium'
        }
      }
    };
  }

  /**
   * Generate responsive rules
   */
  private static generateResponsiveRules(designQube: any, tokens: DesignTokens): ResponsiveRules {
    return {
      breakpoints: {
        mobile: '640px',
        tablet: '1024px',
        desktop: '1280px'
      },
      typography: {
        mobile: {
          scale: 0.875,
          lineHeight: 1.5
        },
        tablet: {
          scale: 1.0,
          lineHeight: 1.5
        },
        desktop: {
          scale: 1.125,
          lineHeight: 1.6
        }
      },
      spacing: {
        mobile: {
          scale: 0.75
        },
        tablet: {
          scale: 1.0
        },
        desktop: {
          scale: 1.25
        }
      },
      layout: {
        mobile: {
          gridColumns: 1,
          containerPadding: '1rem',
          sectionSpacing: '2rem'
        },
        tablet: {
          gridColumns: 2,
          containerPadding: '1.5rem',
          sectionSpacing: '3rem'
        },
        desktop: {
          gridColumns: 3,
          containerPadding: '2rem',
          sectionSpacing: '4rem'
        }
      },
      interactions: {
        mobile: {
          touchTargets: {
            minSize: '44px',
            spacing: '0.5rem'
          },
          gestures: {
            swipe: true,
            pinch: false
          }
        },
        tablet: {
          touchTargets: {
            minSize: '40px',
            spacing: '0.5rem'
          },
          gestures: {
            swipe: true,
            pinch: true
          }
        },
        desktop: {
          hoverStates: true,
          focusStates: true,
          keyboardNavigation: true
        }
      }
    };
  }

  /**
   * Helper: Adjust color brightness
   */
  private static adjustColor(color: string, percent: number): string {
    // Simple color adjustment - in production would use proper color utilities
    return color; // Placeholder
  }
}
