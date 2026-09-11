/**
 * MarkdownLite — the one shared "copilot formatting" renderer.
 *
 * No markdown library is installed in this repo (checked before adding one —
 * Extend, Don't Duplicate). Assistant/inference text (Copilot chat, MoneyPenny
 * Architect's design proposals) is model-generated prose that regularly comes
 * back with `#`/`##` headings, `**bold**`, and `-`/`1.` lists — rendered
 * previously as literal characters (`whitespace-pre-wrap` over the raw
 * string). This is a small, dependency-free parser for exactly the subset
 * those surfaces actually produce, so it renders as formatted copy instead of
 * visible markup — never a full CommonMark implementation, and never
 * `dangerouslySetInnerHTML` (everything is built as React elements from
 * matched substrings, so there is no HTML-injection surface here).
 *
 * ONE renderer, used by both the Copilot chat (SmartWalletDrawer.tsx's
 * assistant messages) and MoneyPenny Architect (ArchitectPanel.tsx's design
 * proposal body) — the reuse IS what makes "the copilot formatting
 * stylesheet" a real, singular thing rather than two surfaces each guessing
 * at their own treatment.
 */

import React from 'react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // **bold** and *italic* — non-greedy, applied in one pass left to right.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-b-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={`${keyPrefix}-i-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

interface MarkdownLiteProps {
  text: string;
  className?: string;
}

export function MarkdownLite({ text, className }: MarkdownLiteProps) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const ListTag = listOrdered ? 'ol' : 'ul';
    blocks.push(
      <ListTag key={key} className={listOrdered ? 'ml-4 list-decimal space-y-0.5' : 'ml-4 list-disc space-y-0.5'}>
        {listItems.map((item, i) => (
          <li key={`${key}-li-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ListTag>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);

    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const HeadingTag = (level === 1 ? 'h4' : level === 2 ? 'h5' : 'h6') as 'h4' | 'h5' | 'h6';
      const sizeClass = level === 1 ? 'text-sm font-semibold' : level === 2 ? 'text-[13px] font-semibold' : 'text-xs font-semibold';
      blocks.push(
        <HeadingTag key={`h-${idx}`} className={`${sizeClass} text-white/90 mt-2`}>
          {renderInline(heading[2], `h-${idx}`)}
        </HeadingTag>,
      );
      return;
    }

    if (bullet || numbered) {
      if (listItems.length > 0 && listOrdered !== Boolean(numbered)) flushList(`list-${idx}`);
      listOrdered = Boolean(numbered);
      listItems.push((bullet ?? numbered)![1]);
      return;
    }

    flushList(`list-${idx}`);
    if (line.length === 0) return;
    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flushList('list-end');

  return <div className={className ?? 'space-y-1.5 text-sm text-white/80'}>{blocks}</div>;
}

export default MarkdownLite;
