import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { ReadingProgress, useReadingProgress } from './ReadingProgress';
import { ReadingControls } from './ReadingControls';
import { theQriptopianStyleGuide } from './defaultStyles';
import type { ArticleReaderProps, FranchiseStyleGuide } from './types';

// Custom sanitization schema that allows HTML tables and common formatting
const customSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'h3'
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: ['className', 'style'],
    th: ['className', 'style', 'scope'],
    td: ['className', 'style'],
    tr: ['className', 'style'],
    '*': ['className', 'style'],
  },
};

export function ArticleReader({ 
  article, 
  isOpen, 
  onClose,
  styleGuide = theQriptopianStyleGuide,
  zIndex = 10000
}: ArticleReaderProps) {
  const [fontSize, setFontSize] = useState(18);
  const progress = useReadingProgress();

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize(prev => Math.min(24, Math.max(14, prev + delta)));
  }, []);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !article) return null;

  const styles = styleGuide.articleReader;
  const typography = styleGuide.typography;

  // Custom markdown components with franchise styling
  const components = {
    h1: ({ children }: any) => (
      <h1 
        style={{ 
          fontFamily: typography.fontFamily.heading,
          fontSize: typography.fontSize.h1,
          lineHeight: typography.lineHeight.heading,
          color: styleGuide.colors.primary,
          marginBottom: '1.5rem',
          marginTop: '2rem',
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 
        style={{ 
          fontFamily: typography.fontFamily.heading,
          fontSize: typography.fontSize.h2,
          lineHeight: typography.lineHeight.heading,
          color: styleGuide.colors.primary,
          marginBottom: '1rem',
          marginTop: '1.5rem',
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 
        style={{ 
          fontFamily: typography.fontFamily.heading,
          fontSize: typography.fontSize.h3,
          lineHeight: typography.lineHeight.heading,
          color: styleGuide.colors.secondary,
          marginBottom: '0.75rem',
          marginTop: '1.25rem',
        }}
      >
        {children}
      </h3>
    ),
    p: ({ children }: any) => (
      <p 
        style={{ 
          fontFamily: typography.fontFamily.body,
          fontSize: `${fontSize}px`,
          lineHeight: typography.lineHeight.body,
          color: styles.textColor,
          marginBottom: '1rem',
        }}
      >
        {children}
      </p>
    ),
    a: ({ href, children }: any) => (
      <a 
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ 
          color: styles.linkColor,
          textDecoration: 'underline',
          textDecorationColor: styles.linkColor + '40',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = styles.linkHoverColor}
        onMouseLeave={(e) => e.currentTarget.style.color = styles.linkColor}
      >
        {children}
      </a>
    ),
    code: ({ inline, children }: any) => inline ? (
      <code 
        style={{
          fontFamily: typography.fontFamily.code,
          fontSize: `${fontSize - 2}px`,
          backgroundColor: styles.codeBlockBackground,
          color: styleGuide.colors.accent,
          padding: '0.2em 0.4em',
          borderRadius: '0.25rem',
        }}
      >
        {children}
      </code>
    ) : (
      <code 
        style={{
          fontFamily: typography.fontFamily.code,
          fontSize: `${fontSize - 2}px`,
          lineHeight: typography.lineHeight.code,
          backgroundColor: styles.codeBlockBackground,
          color: styles.textColor,
          display: 'block',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: `1px solid ${styles.codeBlockBorder}`,
          marginBottom: '1rem',
          overflowX: 'auto',
        }}
      >
        {children}
      </code>
    ),
    blockquote: ({ children }: any) => (
      <blockquote 
        style={{
          borderLeft: `4px solid ${styles.blockquoteBorder}`,
          backgroundColor: styles.blockquoteBackground,
          padding: '1rem 1.5rem',
          marginBottom: '1rem',
          fontStyle: 'italic',
          color: styles.textColor,
        }}
      >
        {children}
      </blockquote>
    ),
    ul: ({ children }: any) => (
      <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: styles.textColor }}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: styles.textColor }}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li style={{ marginBottom: '0.5rem', fontSize: `${fontSize}px` }}>
        {children}
      </li>
    ),
    table: ({ children }: any) => (
      <table 
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '1.5rem',
          fontSize: `${fontSize - 2}px`,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        {children}
      </table>
    ),
    thead: ({ children }: any) => (
      <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody>{children}</tbody>
    ),
    tr: ({ children }: any) => (
      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th 
        style={{
          padding: '0.75rem 1rem',
          textAlign: 'left',
          fontWeight: 'bold',
          color: styleGuide.colors.primary,
          fontFamily: typography.fontFamily.heading,
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td 
        style={{
          padding: '0.75rem 1rem',
          color: styles.textColor,
          verticalAlign: 'top',
        }}
      >
        {children}
      </td>
    ),
    hr: () => (
      <hr 
        style={{
          border: 'none',
          borderTop: `1px solid ${styleGuide.colors.muted}40`,
          margin: '2rem 0',
        }}
      />
    ),
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Article Modal */}
      <div 
        className="fixed inset-0 overflow-y-auto"
        style={{ zIndex: zIndex + 1 }}
      >
        <div className="min-h-full flex items-start justify-center p-4 sm:p-6 lg:p-8">
          <div 
            className="relative w-full rounded-lg shadow-2xl"
            style={{ 
              maxWidth: styles.maxWidth,
              backgroundColor: styles.backgroundColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ReadingProgress progress={progress} color={styleGuide.colors.primary} />
            
            <ReadingControls
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeChange}
              onClose={onClose}
            />
            
            <article 
              className="prose prose-invert max-w-none"
              style={{ 
                padding: styles.padding,
                color: styles.textColor,
              }}
            >
              {/* Article Header */}
              <div style={{ marginBottom: '2rem' }}>
                {article.metadata?.badge && (
                  <span 
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
                    style={styleGuide.badges?.[article.metadata.badge] || {
                      background: styleGuide.colors.accent,
                      color: '#ffffff',
                    }}
                  >
                    {article.metadata.badge}
                  </span>
                )}
                
                <h1 
                  style={{ 
                    fontFamily: typography.fontFamily.heading,
                    fontSize: typography.fontSize.h1,
                    lineHeight: typography.lineHeight.heading,
                    color: styleGuide.colors.primary,
                    marginTop: 0,
                    marginBottom: '0.5rem',
                  }}
                >
                  {article.title}
                </h1>
                
                {article.description && (
                  <p 
                    style={{ 
                      fontSize: typography.fontSize.body,
                      color: styleGuide.colors.muted,
                      marginBottom: '1rem',
                    }}
                  >
                    {article.description}
                  </p>
                )}
                
                <div 
                  className="flex items-center gap-4 text-sm"
                  style={{ color: styleGuide.colors.muted }}
                >
                  {article.author && (
                    <span>{article.author.name}</span>
                  )}
                  {article.readingTime && (
                    <span>{article.readingTime} min read</span>
                  )}
                  {article.publishedAt && (
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              
              {/* Article Content */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, customSchema]]}
                components={components}
              >
                {article.content || ''}
              </ReactMarkdown>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}
