/**
 * Default style guide for The Qriptopian
 */

import type { FranchiseStyleGuide } from './types';

export const theQriptopianStyleGuide: FranchiseStyleGuide = {
  franchiseId: 'theqriptopian',
  version: '0.1',
  
  colors: {
    primary: '#5eead4',      // cyan-400
    secondary: '#2dd4bf',    // teal-400
    accent: '#a78bfa',       // purple-400
    background: '#020818',
    text: '#d0f6ff',
    muted: '#6b7280',
    border: '#1a2942',
  },
  
  typography: {
    fontFamily: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      code: 'JetBrains Mono, Consolas, Monaco, monospace',
    },
    fontSize: {
      h1: '2.5rem',      // 40px
      h2: '2rem',        // 32px
      h3: '1.5rem',      // 24px
      body: '1.125rem',  // 18px
      small: '0.875rem', // 14px
    },
    lineHeight: {
      heading: 1.2,
      body: 1.7,
      code: 1.5,
    },
  },
  
  articleReader: {
    maxWidth: '42rem',
    padding: '3rem 2rem',
    backgroundColor: '#0a1628',
    textColor: '#d0f6ff',
    linkColor: '#5eead4',
    linkHoverColor: '#2dd4bf',
    codeBlockBackground: '#1e293b',
    codeBlockBorder: '#334155',
    blockquoteBorder: '#5eead4',
    blockquoteBackground: 'rgba(94, 234, 212, 0.05)',
  },
  
  badges: {
    'Q¢': {
      background: 'rgba(94, 234, 212, 0.8)',
      text: '#ffffff',
    },
    'LIVE': {
      background: 'rgba(239, 68, 68, 0.8)',
      text: '#ffffff',
    },
    'COMIC': {
      background: 'rgba(168, 85, 247, 0.8)',
      text: '#ffffff',
    },
    'DEV': {
      background: 'rgba(59, 130, 246, 0.8)',
      text: '#ffffff',
    },
  },
};
