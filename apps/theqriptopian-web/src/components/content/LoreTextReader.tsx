/**
 * LoreTextReader - Displays extracted lore text with styling
 * Similar to article display but for lore documents
 */

import { X, Scroll, BookOpen } from 'lucide-react';

interface LoreTextReaderProps {
  title: string;
  content: string;
  onClose: () => void;
}

export function LoreTextReader({ title, content, onClose }: LoreTextReaderProps) {
  // Parse content into paragraphs
  const paragraphs = content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] mx-4 bg-gradient-to-br from-[#0a1628] to-[#020818] rounded-xl ring-1 ring-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Scroll className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-xs text-white/50">Lore Document</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <article className="prose prose-invert prose-cyan max-w-none">
            {paragraphs.map((paragraph, index) => {
              // Check if it's a heading (starts with # or is all caps and short)
              if (paragraph.startsWith('#')) {
                const level = paragraph.match(/^#+/)?.[0].length || 1;
                const text = paragraph.replace(/^#+\s*/, '');
                if (level === 1) {
                  return <h1 key={index} className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">{text}</h1>;
                } else if (level === 2) {
                  return <h2 key={index} className="text-xl font-semibold text-cyan-400 mb-3 mt-5">{text}</h2>;
                } else {
                  return <h3 key={index} className="text-lg font-medium text-purple-400 mb-2 mt-4">{text}</h3>;
                }
              }
              
              // Check for bullet points
              if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                const items = paragraph.split(/\n/).filter(l => l.trim());
                return (
                  <ul key={index} className="list-disc list-inside space-y-1 mb-4 text-gray-300">
                    {items.map((item, i) => (
                      <li key={i}>{item.replace(/^[-*]\s*/, '')}</li>
                    ))}
                  </ul>
                );
              }

              // Check for numbered lists
              if (/^\d+\.\s/.test(paragraph)) {
                const items = paragraph.split(/\n/).filter(l => l.trim());
                return (
                  <ol key={index} className="list-decimal list-inside space-y-1 mb-4 text-gray-300">
                    {items.map((item, i) => (
                      <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                );
              }

              // Regular paragraph
              return (
                <p key={index} className="text-gray-300 leading-relaxed mb-4">
                  {paragraph}
                </p>
              );
            })}
          </article>

          {/* Footer decoration */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2 text-white/30">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs">From the Archives of the metaKnyts Codex</span>
          </div>
        </div>
      </div>
    </div>
  );
}
