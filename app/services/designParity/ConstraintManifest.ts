/**
 * Constraint Manifest (CM) - Machine-readable verification rules
 * 
 * Converts Design Intent Spec into constraint assertions that can be
 * automatically verified against generated UI.
 */

import { DesignIntentSpec, DesignTokens, ComponentSemantics, LayoutIntent, ResponsiveRules } from './DesignIntentSpec';

export interface LayoutConstraints {
  grids: {
    [key: string]: {
      columns: {
        mobile: { min: number; max: number };
        tablet: { min: number; max: number };
        desktop: { min: number; max: number };
      };
      gap: { min: string; max: string };
      padding: { min: string; max: string };
      alignment: {
        horizontal: 'start' | 'center' | 'end' | 'stretch';
        vertical: 'start' | 'center' | 'end' | 'stretch';
      };
    };
  };
  containers: {
    [key: string]: {
      maxWidth: { min: string; max: string };
      padding: { min: string; max: string };
      centering: boolean;
    };
  };
  sections: {
    [key: string]: {
      spacing: { min: string; max: string };
      background: { exact?: string; pattern?: string };
      maxWidth?: { min: string; max: string };
    };
  };
  hierarchy: {
    primary: {
      order: { min: number; max: number };
      prominence: 'highest' | 'high' | 'medium' | 'low';
      aboveFold: boolean;
    };
    secondary: {
      order: { min: number; max: number };
      prominence: 'high' | 'medium' | 'low';
      aboveFold: boolean;
    };
    tertiary: {
      order: { min: number; max: number };
      prominence: 'medium' | 'low';
      aboveFold: boolean;
    };
  };
}

export interface ResponsiveConstraints {
  breakpoints: {
    mobile: { min: string; max: string };
    tablet: { min: string; max: string };
    desktop: { min: string; max: string };
  };
  typography: {
    mobile: {
      fontSize: { min: number; max: number };
      lineHeight: { min: number; max: number };
    };
    tablet: {
      fontSize: { min: number; max: number };
      lineHeight: { min: number; max: number };
    };
    desktop: {
      fontSize: { min: number; max: number };
      lineHeight: { min: number; max: number };
    };
  };
  spacing: {
    mobile: { scale: { min: number; max: number } };
    tablet: { scale: { min: number; max: number } };
    desktop: { scale: { min: number; max: number } };
  };
  layout: {
    mobile: {
      gridColumns: { min: number; max: number };
      containerPadding: { min: string; max: string };
      sectionSpacing: { min: string; max: string };
    };
    tablet: {
      gridColumns: { min: number; max: number };
      containerPadding: { min: string; max: string };
      sectionSpacing: { min: string; max: string };
    };
    desktop: {
      gridColumns: { min: number; max: number };
      containerPadding: { min: string; max: string };
      sectionSpacing: { min: string; max: string };
    };
  };
  interactions: {
    mobile: {
      touchTargets: {
        minSize: { min: string; max: string };
        spacing: { min: string; max: string };
      };
      gestures: {
        swipe: boolean;
        pinch: boolean;
      };
    };
    tablet: {
      touchTargets: {
        minSize: { min: string; max: string };
        spacing: { min: string; max: string };
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

export interface ComponentContracts {
  buttons: {
    primary: {
      backgroundColor: { exact: string; tolerance?: number };
      textColor: { exact: string; tolerance?: number };
      padding: { min: string; max: string };
      borderRadius: { min: string; max: string };
      fontSize: { min: string; max: string };
      fontWeight: { min: number; max: number };
      hoverState: {
        backgroundColor: { exact: string; tolerance?: number };
        transform?: { exact: string };
      };
      accessibility: {
        minContrastRatio: number;
        hasFocusIndicator: boolean;
        keyboardAccessible: boolean;
      };
    };
    secondary: {
      backgroundColor: { exact: string; tolerance?: number };
      textColor: { exact: string; tolerance?: number };
      padding: { min: string; max: string };
      borderRadius: { min: string; max: string };
      fontSize: { min: string; max: string };
      fontWeight: { min: number; max: number };
      border: { exact: string; tolerance?: number };
      hoverState: {
        backgroundColor: { exact: string; tolerance?: number };
        textColor: { exact: string; tolerance?: number };
      };
      accessibility: {
        minContrastRatio: number;
        hasFocusIndicator: boolean;
        keyboardAccessible: boolean;
      };
    };
  };
  cards: {
    default: {
      backgroundColor: { exact: string; tolerance?: number };
      borderColor: { exact: string; tolerance?: number };
      borderRadius: { min: string; max: string };
      padding: { min: string; max: string };
      shadow: { exact: string; tolerance?: number };
      accessibility: {
        minContrastRatio: number;
        hasSemanticStructure: boolean;
      };
    };
    elevated: {
      backgroundColor: { exact: string; tolerance?: number };
      borderColor: { exact: string; tolerance?: number };
      borderRadius: { min: string; max: string };
      padding: { min: string; max: string };
      shadow: { exact: string; tolerance?: number };
      transform?: { exact: string };
      accessibility: {
        minContrastRatio: number;
        hasSemanticStructure: boolean;
      };
    };
  };
  navigation: {
    header: {
      backgroundColor: { exact: string; tolerance?: number };
      height: { min: string; max: string };
      padding: { min: string; max: string };
      borderBottom: { exact: string; tolerance?: number };
      accessibility: {
        hasLandmark: boolean;
        hasSkipLinks: boolean;
      };
    };
    navItem: {
      textColor: { exact: string; tolerance?: number };
      fontSize: { min: string; max: string };
      fontWeight: { min: number; max: number };
      padding: { min: string; max: string };
      hoverState: {
        textColor: { exact: string; tolerance?: number };
        backgroundColor: { exact: string; tolerance?: number };
      };
      accessibility: {
        hasActiveState: boolean;
        keyboardAccessible: boolean;
      };
    };
    mobileMenu: {
      backgroundColor: { exact: string; tolerance?: number };
      maxWidth: { max: string };
      animation: { exact: string };
      accessibility: {
        hasToggle: boolean;
        focusTrapped: boolean;
      };
    };
  };
}

export interface ConstraintManifest {
  version: string;
  generatedAt: string;
  source: {
    disVersion: string;
    designQubeId: string;
  };
  layout: LayoutConstraints;
  responsive: ResponsiveConstraints;
  components: ComponentContracts;
  verification: {
    strictMode: boolean;
    toleranceLevels: {
      color: number;      // 0-1, where 0 = exact match
      spacing: number;    // 0-1, percentage tolerance
      typography: number; // 0-1, percentage tolerance
    };
    priorityOrdering: string[];
  };
  metadata: {
    name: string;
    description: string;
    tags: string[];
    lastValidated: string;
  };
}

/**
 * Constraint Manifest Generator - Converts DIS to verification rules
 */
export class ConstraintManifestGenerator {
  /**
   * Generate Constraint Manifest from Design Intent Spec
   */
  static generateFromDIS(dis: DesignIntentSpec): ConstraintManifest {
    
    // Convert layout intent to constraints
    const layout = this.generateLayoutConstraints(dis.layout);
    
    // Convert responsive rules to constraints
    const responsive = this.generateResponsiveConstraints(dis.responsive);
    
    // Convert component semantics to contracts
    const components = this.generateComponentContracts(dis.semantics, dis.tokens);
    
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        disVersion: dis.version,
        designQubeId: dis.source.designQubeId
      },
      layout,
      responsive,
      components,
      verification: {
        strictMode: dis.metadata.constraints.strict,
        toleranceLevels: {
          color: 0.05,      // 5% color tolerance
          spacing: 0.1,     // 10% spacing tolerance
          typography: 0.05  // 5% typography tolerance
        },
        priorityOrdering: dis.metadata.constraints.priorityOrdering
      },
      metadata: {
        name: `${dis.metadata.name} - Constraint Manifest`,
        description: `Verification constraints for ${dis.metadata.description}`,
        tags: [...dis.metadata.tags, 'constraints', 'verification'],
        lastValidated: new Date().toISOString()
      }
    };
  }

  /**
   * Generate layout constraints from layout intent
   */
  private static generateLayoutConstraints(layout: LayoutIntent): LayoutConstraints {
    return {
      grids: Object.entries(layout.grids).reduce((acc, [key, grid]) => {
        acc[key] = {
          columns: {
            mobile: { min: grid.columns.mobile, max: grid.columns.mobile },
            tablet: { min: grid.columns.tablet, max: grid.columns.tablet },
            desktop: { min: grid.columns.desktop, max: grid.columns.desktop }
          },
          gap: { min: grid.gap, max: grid.gap },
          padding: { min: grid.padding, max: grid.padding },
          alignment: {
            horizontal: grid.alignItems,
            vertical: 'stretch'
          }
        };
        return acc;
      }, {} as LayoutConstraints['grids']),
      containers: Object.entries(layout.containers).reduce((acc, [key, container]) => {
        acc[key] = {
          maxWidth: { min: container.maxWidth, max: container.maxWidth },
          padding: { min: container.padding, max: container.padding },
          centering: container.centerContent
        };
        return acc;
      }, {} as LayoutConstraints['containers']),
      sections: Object.entries(layout.sections).reduce((acc, [key, section]) => {
        acc[key] = {
          spacing: { min: section.spacing, max: section.spacing },
          background: section.background ? { exact: section.background } : {},
          maxWidth: section.maxWidth ? { min: section.maxWidth, max: section.maxWidth } : undefined
        };
        return acc;
      }, {} as LayoutConstraints['sections']),
      hierarchy: {
        primary: {
          order: { min: layout.hierarchy.primary.order, max: layout.hierarchy.primary.order },
          prominence: layout.hierarchy.primary.prominence,
          aboveFold: layout.hierarchy.primary.prominence === 'highest' || layout.hierarchy.primary.prominence === 'high'
        },
        secondary: {
          order: { min: layout.hierarchy.secondary.order, max: layout.hierarchy.secondary.order },
          prominence: layout.hierarchy.secondary.prominence,
          aboveFold: layout.hierarchy.secondary.prominence === 'high'
        },
        tertiary: {
          order: { min: layout.hierarchy.tertiary.order, max: layout.hierarchy.tertiary.order },
          prominence: layout.hierarchy.tertiary.prominence,
          aboveFold: false
        }
      }
    };
  }

  /**
   * Generate responsive constraints from responsive rules
   */
  private static generateResponsiveConstraints(responsive: ResponsiveRules): ResponsiveConstraints {
    return {
      breakpoints: {
        mobile: { min: '0px', max: responsive.breakpoints.mobile },
        tablet: { min: responsive.breakpoints.mobile, max: responsive.breakpoints.tablet },
        desktop: { min: responsive.breakpoints.tablet, max: '9999px' }
      },
      typography: {
        mobile: {
          fontSize: { min: responsive.typography.mobile.scale * 0.9, max: responsive.typography.mobile.scale * 1.1 },
          lineHeight: { min: responsive.typography.mobile.lineHeight * 0.95, max: responsive.typography.mobile.lineHeight * 1.05 }
        },
        tablet: {
          fontSize: { min: responsive.typography.tablet.scale * 0.95, max: responsive.typography.tablet.scale * 1.05 },
          lineHeight: { min: responsive.typography.tablet.lineHeight * 0.98, max: responsive.typography.tablet.lineHeight * 1.02 }
        },
        desktop: {
          fontSize: { min: responsive.typography.desktop.scale * 0.98, max: responsive.typography.desktop.scale * 1.02 },
          lineHeight: { min: responsive.typography.desktop.lineHeight * 0.99, max: responsive.typography.desktop.lineHeight * 1.01 }
        }
      },
      spacing: {
        mobile: { scale: { min: responsive.spacing.mobile.scale * 0.9, max: responsive.spacing.mobile.scale * 1.1 } },
        tablet: { scale: { min: responsive.spacing.tablet.scale * 0.95, max: responsive.spacing.tablet.scale * 1.05 } },
        desktop: { scale: { min: responsive.spacing.desktop.scale * 0.98, max: responsive.spacing.desktop.scale * 1.02 } }
      },
      layout: {
        mobile: {
          gridColumns: { min: responsive.layout.mobile.gridColumns, max: responsive.layout.mobile.gridColumns },
          containerPadding: { min: responsive.layout.mobile.containerPadding, max: responsive.layout.mobile.containerPadding },
          sectionSpacing: { min: responsive.layout.mobile.sectionSpacing, max: responsive.layout.mobile.sectionSpacing }
        },
        tablet: {
          gridColumns: { min: responsive.layout.tablet.gridColumns, max: responsive.layout.tablet.gridColumns },
          containerPadding: { min: responsive.layout.tablet.containerPadding, max: responsive.layout.tablet.containerPadding },
          sectionSpacing: { min: responsive.layout.tablet.sectionSpacing, max: responsive.layout.tablet.sectionSpacing }
        },
        desktop: {
          gridColumns: { min: responsive.layout.desktop.gridColumns, max: responsive.layout.desktop.gridColumns },
          containerPadding: { min: responsive.layout.desktop.containerPadding, max: responsive.layout.desktop.containerPadding },
          sectionSpacing: { min: responsive.layout.desktop.sectionSpacing, max: responsive.layout.desktop.sectionSpacing }
        }
      },
      interactions: {
        mobile: {
          touchTargets: {
            minSize: { min: responsive.interactions.mobile.touchTargets.minSize, max: responsive.interactions.mobile.touchTargets.minSize },
            spacing: { min: responsive.interactions.mobile.touchTargets.spacing, max: responsive.interactions.mobile.touchTargets.spacing }
          },
          gestures: {
            swipe: responsive.interactions.mobile.gestures.swipe,
            pinch: responsive.interactions.mobile.gestures.pinch
          }
        },
        tablet: {
          touchTargets: {
            minSize: { min: responsive.interactions.tablet.touchTargets.minSize, max: responsive.interactions.tablet.touchTargets.minSize },
            spacing: { min: responsive.interactions.tablet.touchTargets.spacing, max: responsive.interactions.tablet.touchTargets.spacing }
          },
          gestures: {
            swipe: responsive.interactions.tablet.gestures.swipe,
            pinch: responsive.interactions.tablet.gestures.pinch
          }
        },
        desktop: {
          hoverStates: responsive.interactions.desktop.hoverStates,
          focusStates: responsive.interactions.desktop.focusStates,
          keyboardNavigation: responsive.interactions.desktop.keyboardNavigation
        }
      }
    };
  }

  /**
   * Generate component contracts from semantics and tokens
   */
  private static generateComponentContracts(semantics: ComponentSemantics, tokens: DesignTokens): ComponentContracts {
    return {
      buttons: {
        primary: {
          backgroundColor: { exact: semantics.buttons.primary.backgroundColor, tolerance: 0.05 },
          textColor: { exact: semantics.buttons.primary.textColor, tolerance: 0.05 },
          padding: { min: semantics.buttons.primary.padding, max: semantics.buttons.primary.padding },
          borderRadius: { min: semantics.buttons.primary.borderRadius, max: semantics.buttons.primary.borderRadius },
          fontSize: { min: semantics.buttons.primary.fontSize, max: semantics.buttons.primary.fontSize },
          fontWeight: { min: semantics.buttons.primary.fontWeight, max: semantics.buttons.primary.fontWeight },
          hoverState: {
            backgroundColor: { exact: semantics.buttons.primary.hoverState.backgroundColor, tolerance: 0.1 },
            transform: semantics.buttons.primary.hoverState.transform ? { exact: semantics.buttons.primary.hoverState.transform } : undefined
          },
          accessibility: {
            minContrastRatio: 4.5,
            hasFocusIndicator: true,
            keyboardAccessible: true
          }
        },
        secondary: {
          backgroundColor: { exact: semantics.buttons.secondary.backgroundColor, tolerance: 0.05 },
          textColor: { exact: semantics.buttons.secondary.textColor, tolerance: 0.05 },
          padding: { min: semantics.buttons.secondary.padding, max: semantics.buttons.secondary.padding },
          borderRadius: { min: semantics.buttons.secondary.borderRadius, max: semantics.buttons.secondary.borderRadius },
          fontSize: { min: semantics.buttons.secondary.fontSize, max: semantics.buttons.secondary.fontSize },
          fontWeight: { min: semantics.buttons.secondary.fontWeight, max: semantics.buttons.secondary.fontWeight },
          border: { exact: semantics.buttons.secondary.border, tolerance: 0.05 },
          hoverState: {
            backgroundColor: { exact: semantics.buttons.secondary.hoverState.backgroundColor, tolerance: 0.1 },
            textColor: { exact: semantics.buttons.secondary.hoverState.textColor, tolerance: 0.05 }
          },
          accessibility: {
            minContrastRatio: 4.5,
            hasFocusIndicator: true,
            keyboardAccessible: true
          }
        }
      },
      cards: {
        default: {
          backgroundColor: { exact: semantics.cards.default.backgroundColor, tolerance: 0.05 },
          borderColor: { exact: semantics.cards.default.borderColor, tolerance: 0.05 },
          borderRadius: { min: semantics.cards.default.borderRadius, max: semantics.cards.default.borderRadius },
          padding: { min: semantics.cards.default.padding, max: semantics.cards.default.padding },
          shadow: { exact: semantics.cards.default.shadow, tolerance: 0.1 },
          accessibility: {
            minContrastRatio: 3.0,
            hasSemanticStructure: true
          }
        },
        elevated: {
          backgroundColor: { exact: semantics.cards.elevated.backgroundColor, tolerance: 0.05 },
          borderColor: { exact: semantics.cards.elevated.borderColor, tolerance: 0.05 },
          borderRadius: { min: semantics.cards.elevated.borderRadius, max: semantics.cards.elevated.borderRadius },
          padding: { min: semantics.cards.elevated.padding, max: semantics.cards.elevated.padding },
          shadow: { exact: semantics.cards.elevated.shadow, tolerance: 0.1 },
          transform: semantics.cards.elevated.transform ? { exact: semantics.cards.elevated.transform } : undefined,
          accessibility: {
            minContrastRatio: 3.0,
            hasSemanticStructure: true
          }
        }
      },
      navigation: {
        header: {
          backgroundColor: { exact: semantics.navigation.header.backgroundColor, tolerance: 0.05 },
          height: { min: semantics.navigation.header.height, max: semantics.navigation.header.height },
          padding: { min: semantics.navigation.header.padding, max: semantics.navigation.header.padding },
          borderBottom: { exact: semantics.navigation.header.borderBottom, tolerance: 0.05 },
          accessibility: {
            hasLandmark: true,
            hasSkipLinks: false
          }
        },
        navItem: {
          textColor: { exact: semantics.navigation.navItem.textColor, tolerance: 0.05 },
          fontSize: { min: semantics.navigation.navItem.fontSize, max: semantics.navigation.navItem.fontSize },
          fontWeight: { min: semantics.navigation.navItem.fontWeight, max: semantics.navigation.navItem.fontWeight },
          padding: { min: semantics.navigation.navItem.padding, max: semantics.navigation.navItem.padding },
          hoverState: {
            textColor: { exact: semantics.navigation.navItem.hoverState.textColor, tolerance: 0.05 },
            backgroundColor: { exact: semantics.navigation.navItem.hoverState.backgroundColor, tolerance: 0.05 }
          },
          accessibility: {
            hasActiveState: true,
            keyboardAccessible: true
          }
        },
        mobileMenu: {
          backgroundColor: { exact: semantics.navigation.mobileMenu.backgroundColor, tolerance: 0.05 },
          maxWidth: { max: semantics.navigation.mobileMenu.maxWidth },
          animation: { exact: semantics.navigation.mobileMenu.animation },
          accessibility: {
            hasToggle: true,
            focusTrapped: false
          }
        }
      }
    };
  }
}
