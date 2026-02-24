import { Minus, Plus, X } from 'lucide-react';
import type { ReadingControlsProps } from './types';

export function ReadingControls({ 
  fontSize, 
  onFontSizeChange, 
  onClose 
}: ReadingControlsProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/30">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Text Size:</span>
        <button
          onClick={() => onFontSizeChange(-2)}
          disabled={fontSize <= 14}
          className="p-2 rounded-md hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease font size"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium w-8 text-center">{fontSize}px</span>
        <button
          onClick={() => onFontSizeChange(2)}
          disabled={fontSize >= 24}
          className="p-2 rounded-md hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Increase font size"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <button
        onClick={onClose}
        className="p-2 rounded-md hover:bg-accent/10 transition-colors"
        aria-label="Close article"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
