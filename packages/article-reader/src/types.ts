/**
 * @agentiq/article-reader - Type Definitions
 * Franchise-styled article reader with markdown rendering
 */

import type { ArticleQube } from '@agentiq/codex';

export interface FranchiseStyleGuide {
  franchiseId: string;
  version: string;
  
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
    border: string;
  };
  
  typography: {
    fontFamily: {
      heading: string;
      body: string;
      code: string;
    };
    fontSize: {
      h1: string;
      h2: string;
      h3: string;
      body: string;
      small: string;
    };
    lineHeight: {
      heading: number;
      body: number;
      code: number;
    };
  };
  
  articleReader: {
    maxWidth: string;
    padding: string;
    backgroundColor: string;
    textColor: string;
    linkColor: string;
    linkHoverColor: string;
    codeBlockBackground: string;
    codeBlockBorder: string;
    blockquoteBorder: string;
    blockquoteBackground: string;
  };
  
  badges?: Record<string, {
    background: string;
    text: string;
    border?: string;
  }>;
}

export interface ArticleReaderProps {
  article: ArticleQube | null;
  isOpen: boolean;
  onClose: () => void;
  styleGuide?: FranchiseStyleGuide;
  zIndex?: number;
}

export interface ReadingControlsProps {
  fontSize: number;
  onFontSizeChange: (delta: number) => void;
  onClose: () => void;
}

export interface ReadingProgressProps {
  progress: number;
  color?: string;
}
