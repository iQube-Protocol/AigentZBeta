/**
 * Simple Markdown renderer for chat messages
 * Supports: bold, italic, bullets, headers, horizontal rules
 */

import React from 'react';

interface MarkdownMessageProps {
  content: string;
  className?: string;
  onQuickLinkClick?: (prompt: string) => void;
}

export function MarkdownMessage({ content, className = '', onQuickLinkClick }: MarkdownMessageProps) {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inList = false;
    let lastWasEmpty = false;

    const isExploreFurtherHeader = (line: string) => {
      const t = line.trim().toLowerCase();
      return t === '**explore further:**' || t === 'explore further:' || t === '**explore further**';
    };

    const parseExploreFurtherItems = (): string[] => {
      const out: string[] = [];
      let inSection = false;

      for (const raw of lines) {
        const trimmed = raw.trim();

        if (!inSection) {
          if (isExploreFurtherHeader(trimmed)) {
            inSection = true;
          }
          continue;
        }

        if (!trimmed) continue;
        if (trimmed === '---' || trimmed === '***') break;
        const bulletMatch = trimmed.match(/^[•\-*]\s+(.+)/);
        if (!bulletMatch) break;
        const rawItem = bulletMatch[1].trim();
        const cleaned = rawItem.replace(/^\[(.*)\]$/, '$1').trim();
        out.push(cleaned);
      }

      return out;
    };

    const exploreFurtherItems = onQuickLinkClick ? parseExploreFurtherItems() : [];
    const shouldHideExploreFurtherList = exploreFurtherItems.length > 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-1 my-2 ml-1">
            {listItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">•</span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    const renderInline = (text: string): React.ReactNode => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let key = 0;

      while (remaining.length > 0) {
        // Bold: **text**
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Italic: *text*
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
        // Arrow sidebar: → text
        const arrowMatch = remaining.match(/^→\s*(.+)/);

        if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
          if (boldMatch.index! > 0) {
            parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
          }
          parts.push(
            <strong key={key++} className="font-semibold text-white">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
        } else if (italicMatch) {
          if (italicMatch.index! > 0) {
            parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>);
          }
          parts.push(
            <em key={key++} className="italic text-white/80">
              {italicMatch[1]}
            </em>
          );
          remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
        } else if (arrowMatch && parts.length === 0) {
          parts.push(
            <span key={key++} className="flex items-start gap-2">
              <span className="text-purple-400">→</span>
              <span className="text-white/70">{arrowMatch[1]}</span>
            </span>
          );
          remaining = '';
        } else {
          parts.push(<span key={key++}>{remaining}</span>);
          remaining = '';
        }
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    // Helper to render inline text with line breaks after "Label:" patterns
    const renderInlineWithBreaks = (text: string): React.ReactNode => {
      // Split on patterns like "Character Focus:" or "Focus:" followed by content
      const labelPattern = /([A-Z][a-zA-Z\s]+:)\s*/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      let key = 0;

      while ((match = labelPattern.exec(text)) !== null) {
        // Add text before the label
        if (match.index > lastIndex) {
          parts.push(<span key={key++}>{renderInline(text.slice(lastIndex, match.index))}</span>);
        }
        // Add the label with a line break after
        parts.push(
          <span key={key++} className="block mt-1">
            <strong className="text-cyan-300">{match[1]}</strong>{' '}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(<span key={key++}>{renderInline(text.slice(lastIndex))}</span>);
      }

      return parts.length > 0 ? <>{parts}</> : renderInline(text);
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      const headerTopMargin = () => {
        if (elements.length === 0 || lastWasEmpty) return 'mt-1';
        return 'mt-4';
      };

      const subHeaderTopMargin = () => {
        if (elements.length === 0 || lastWasEmpty) return 'mt-1';
        return 'mt-3';
      };

      if (shouldHideExploreFurtherList) {
        if (isExploreFurtherHeader(trimmed)) {
          flushList();
          elements.push(
            <div key={`explore-${index}`} className="mt-3">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">
                Explore further
              </div>
              <div className="flex flex-wrap gap-2">
                {exploreFurtherItems.map((item, i) => (
                  <button
                    key={`explore-link-${index}-${i}`}
                    type="button"
                    onClick={() => onQuickLinkClick?.(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-left text-xs text-cyan-200 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          );
          return;
        }

        const isBullet = /^[•\-*]\s+(.+)/.test(trimmed);
        if (exploreFurtherItems.length > 0 && isBullet) {
          return;
        }
      }

      // Horizontal rule
      if (trimmed === '---' || trimmed === '***') {
        flushList();
        lastWasEmpty = false;
        elements.push(
          <hr key={`hr-${index}`} className="border-white/10 my-3" />
        );
        return;
      }

      // ### Header (cyan, uppercase, with sidebar accent)
      const h3Match = trimmed.match(/^###\s*(.+)/);
      if (h3Match) {
        flushList();
        const mt = headerTopMargin();
        lastWasEmpty = false;
        elements.push(
          <div key={`h3-${index}`} className={`flex items-center gap-2 ${mt} mb-2`}>
            <div className="w-1 h-4 bg-cyan-500 rounded-full" />
            <span className="font-bold text-cyan-400 text-sm uppercase tracking-wide">
              {h3Match[1]}
            </span>
          </div>
        );
        return;
      }

      // ## Header (slightly smaller than ###)
      const h2Match = trimmed.match(/^##\s*(.+)/);
      if (h2Match) {
        flushList();
        const mt = subHeaderTopMargin();
        lastWasEmpty = false;
        elements.push(
          <div key={`h2-${index}`} className={`flex items-center gap-2 ${mt} mb-1`}>
            <div className="w-1 h-3.5 bg-cyan-500/70 rounded-full" />
            <span className="font-semibold text-cyan-300 text-xs uppercase tracking-wide">
              {h2Match[1]}
            </span>
          </div>
        );
        return;
      }

      // Bullet points (•, -, *)
      const bulletMatch = trimmed.match(/^[•\-*]\s+(.+)/);
      if (bulletMatch) {
        inList = true;
        listItems.push(bulletMatch[1]);
        lastWasEmpty = false;
        return;
      }

      // If we were in a list but this line isn't a bullet, flush
      if (inList && trimmed) {
        flushList();
      }

      // Empty line
      if (!trimmed) {
        flushList();
        if (!lastWasEmpty) {
          elements.push(<div key={`space-${index}`} className="h-2" />);
        }
        lastWasEmpty = true;
        return;
      }

      lastWasEmpty = false;

      // Header with **text:** at start of line (treat as subheader)
      if (trimmed.startsWith('**') && trimmed.includes(':**')) {
        flushList();
        elements.push(
          <div key={`header-${index}`} className="flex items-center gap-2 mt-3 mb-1">
            <div className="w-1 h-4 bg-cyan-500/50 rounded-full" />
            <span className="font-semibold text-white text-sm">{renderInline(trimmed)}</span>
          </div>
        );
        return;
      }

      // Arrow sidebar line
      if (trimmed.startsWith('→')) {
        flushList();
        elements.push(
          <div key={`arrow-${index}`} className="flex items-start gap-2 pl-2 border-l-2 border-purple-500/30 my-1">
            <span className="text-white/70 text-sm">{renderInline(trimmed.slice(1).trim())}</span>
          </div>
        );
        return;
      }

      // Regular paragraph - check for Label: patterns
      flushList();
      const hasLabelPattern = /[A-Z][a-zA-Z\s]+:\s/.test(trimmed);
      elements.push(
        <p key={`p-${index}`} className="text-sm leading-relaxed">
          {hasLabelPattern ? renderInlineWithBreaks(trimmed) : renderInline(trimmed)}
        </p>
      );
    });

    // Flush any remaining list items
    flushList();

    return elements;
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
}
