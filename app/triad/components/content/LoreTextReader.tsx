/**
 * LoreTextReader - Text Content Reader
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Displays text content with formatting and reading controls.
 */

import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Type, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LoreTextReaderProps {
  title: string;
  content: string;
  onClose: () => void;
}

export function LoreTextReader({ title, content, onClose }: LoreTextReaderProps) {
  const [fontSize, setFontSize] = useState(16);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 32));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12));
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Format content with basic markdown-like formatting
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Handle headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mb-4 text-white">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mb-3 text-white">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mb-2 text-white">{line.slice(4)}</h3>;
        }
        
        // Handle list items
        if (line.startsWith('- ')) {
          return <li key={index} className="ml-4 mb-1 text-white/80">{line.slice(2)}</li>;
        }
        
        // Handle empty lines
        if (!line.trim()) {
          return <br key={index} />;
        }
        
        // Regular paragraph
        return <p key={index} className="mb-4 text-white/80 leading-relaxed">{line}</p>;
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={decreaseFontSize}
            >
              <Type className="w-4 h-4" />
            </Button>
            <span className="text-sm text-white/60 w-8 text-center">{fontSize}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={increaseFontSize}
            >
              <Type className="w-4 h-4 scale-125" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={toggleTheme}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-8">
            <div 
              className={`prose prose-invert max-w-none ${
                isDarkMode ? 'prose-invert' : 'prose'
              }`}
              style={{ fontSize: `${fontSize}px` }}
            >
              {formatContent(content)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
