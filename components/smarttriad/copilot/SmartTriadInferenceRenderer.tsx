/**
 * SmartTriad Inference Renderer
 * 
 * Core component for rendering AI inference responses with the SmartTriad
 * Copilot Inference Rendering System. Handles message processing, markdown
 * transformation, and line-level rendering with cyan-based theming.
 */

import React, { useMemo, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User, AlertTriangle, Clock, Zap } from 'lucide-react';
import { AgentModelSelector, type AgentOption, type ModelOption } from './AgentModelSelector';

// Types
export interface SmartTriadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  variant?: 'bubble' | 'panel';
  metadata?: {
    model?: string;
    provider?: string;
    trustScore?: number;
    reliabilityScore?: number;
    riskScore?: number;
    processingTime?: number;
    mcpVersion?: string;
    profileCard?: string;
    theme?: 'iqubes' | 'coyn' | 'learn' | 'earn' | 'connect' | 'aigent' | 'default';
  };
}

export interface SmartTriadInferenceRendererProps {
  message: SmartTriadMessage;
  className?: string;
  showMetadata?: boolean;
  showScores?: boolean;
  enableModelSelector?: boolean;
  onModelChange?: (model: string, provider: string) => void;
  tenantConfig?: {
    enableModelSelection?: boolean;
    availableAgents?: string[];
    defaultAgent?: string;
    accentColor?: string;
  };
  // Agent/Model selector props
  selectedAgent?: AgentOption;
  selectedModel?: ModelOption | null;
  availableAgents?: AgentOption[];
  modelOptions?: ModelOption[];
  onAgentChange?: (agent: AgentOption) => void;
  onModelSelectorChange?: (model: ModelOption) => void;
}

// Key terms for highlighting
const KEY_TERMS = [
  'iQube', 'COYN', 'QryptoCOYN', 'blockchain', 'smart contract',
  'token', 'wallet', 'DeFi', 'NFT', 'Web3', 'cryptocurrency',
  'metaKnyts', 'mẹtaKnyts', 'VFT', 'BlakQube', 'MetaQube', 'TokenQube',
  'SmartTriad', 'Qriptopian', 'KNYT', 'metaMe', 'Runtime', 'Studio'
];

export function SmartTriadInferenceRenderer({
  message,
  className = '',
  showMetadata = true,
  showScores = false,
  enableModelSelector = false,
  onModelChange,
  tenantConfig,
  selectedAgent,
  selectedModel,
  availableAgents = [],
  modelOptions = [],
  onAgentChange,
  onModelSelectorChange,
}: SmartTriadInferenceRendererProps) {
  
  // Process content through sanitization and markdown transformation
  const processedContent = useMemo(() => {
    return processMessageContent(message.content);
  }, [message.content]);

  // Render line-level content
  const renderContent = useCallback(() => {
    return renderLineLevelContent(processedContent);
  }, [processedContent]);

  // Get message container class
  const getMessageClass = useCallback(() => {
    const baseClass = 'smarttriad-message-container';
    const roleClass = message.role === 'user' ? 'smarttriad-user-message' :
                     message.role === 'system' ? 'smarttriad-system-message' :
                     'smarttriad-agent-message';
    
    const themeClass = message.metadata?.theme ? 
      `smarttriad-historic-response ${message.metadata.theme}` : '';
    
    return `${baseClass} ${roleClass} ${themeClass} ${className}`.trim();
  }, [message.role, message.metadata?.theme, className]);

  return (
    <div className={getMessageClass()}>
      {/* Score Indicators */}
      {showScores && message.metadata && (
        <ScoreIndicators metadata={message.metadata} />
      )}
      
      {/* Message Header */}
      <div className="flex items-center gap-2 mb-2">
        {message.role === 'user' ? (
          <User className="w-4 h-4 text-cyan-600" />
        ) : message.role === 'system' ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : (
          <Bot className="w-4 h-4 text-cyan-600" />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {message.role === 'user' ? 'You' : 
           message.role === 'system' ? 'System' : 
           message.metadata?.model || 'Assistant'}
        </span>
      </div>

      {/* Processed Content */}
      <div className="smarttriad-conversational-content">
        {renderContent()}
      </div>

      {/* Metadata Badges */}
      {showMetadata && (
        <MetadataBadges 
          message={message}
          showMetadata={showMetadata}
          tenantConfig={tenantConfig}
          selectedAgent={selectedAgent}
          selectedModel={selectedModel}
          availableAgents={availableAgents}
          modelOptions={modelOptions}
          onAgentChange={onAgentChange}
          onModelSelectorChange={onModelSelectorChange}
          enableModelSelector={enableModelSelector}
          onModelChange={onModelChange}
        />
      )}
    </div>
  );
}

// ========================================
// Content Processing Pipeline
// ========================================

function processMessageContent(content: string): string {
  // Step 1: Protect Mermaid code blocks
  const mermaidBlocks: string[] = [];
  let processedContent = content.replace(
    /```[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)\r?\n```/g,
    (match, code) => {
      const index = mermaidBlocks.length;
      mermaidBlocks.push(code.trim());
      return `__MERMAID_BLOCK_${index}__`;
    }
  );

  // Step 2: Strip HTML div wrappers and clean up
  processedContent = processedContent
    .replace(/<\/?div[^>]*>/g, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 3: Markdown transformation
  processedContent = transformMarkdown(processedContent);

  // Step 4: Restore Mermaid blocks
  mermaidBlocks.forEach((code, index) => {
    processedContent = processedContent.replace(
      `__MERMAID_BLOCK_${index}__`,
      `\`\`\`mermaid\n${code}\n\`\`\``
    );
  });

  return processedContent;
}

function transformMarkdown(content: string): string {
  // Headers transformation
  content = content
    .replace(/^### (.+)$/gm, 'Here\'s what you need to know about $1:')
    .replace(/^## (.+)$/gm, 'Let me explain $1:')
    .replace(/^# (.+)$/gm, 'The key thing about $1:');

  // Bold formatting (strip for inline processing)
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Bullet points
  content = content.replace(/^[\*\-] /gm, '• ');

  // Paragraph spacing
  content = content.replace(/\n\n/g, '\n\n\n');

  // Conversational transitions
  const transitions = ['Here\'s', 'Let me', 'To', 'For', 'When', 'If', 'The key', 'Important', 'Remember'];
  transitions.forEach(transition => {
    content = content.replace(new RegExp(`(${transition})`, 'g'), '\n$1');
  });

  // Whitespace cleanup
  content = content.replace(/ +/g, ' ');

  return content;
}

// ========================================
// Line-Level Rendering
// ========================================

function renderLineLevelContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Empty line
    if (!line) {
      elements.push(<div key={i} className="smarttriad-empty-line" />);
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const { blockLines, endIndex } = extractCodeBlock(lines, i);
      elements.push(
        <CodeBlock key={i} lines={blockLines} />
      );
      i = endIndex + 1;
      continue;
    }

    // Mermaid diagram
    if (line === '```mermaid') {
      const { blockLines, endIndex } = extractCodeBlock(lines, i);
      elements.push(
        <MermaidDiagram key={i} code={blockLines.join('\n')} />
      );
      i = endIndex + 1;
      continue;
    }

    // Bullet point
    if (line.startsWith('• ')) {
      elements.push(
        <BulletPoint key={i} text={line.substring(2)} />
      );
      i++;
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\d+)\. (.+)$/);
    if (numberedMatch) {
      elements.push(
        <NumberedList key={i} number={numberedMatch[1]} text={numberedMatch[2]} />
      );
      i++;
      continue;
    }

    // Conversational intro
    if (isConversationalIntro(line)) {
      elements.push(
        <ConversationalIntro key={i} text={line} />
      );
      i++;
      continue;
    }

    // Callout
    if (isCallout(line)) {
      elements.push(
        <Callout key={i} text={line} />
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <Blockquote key={i} text={line.substring(2)} />
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <Paragraph key={i} text={line} />
    );
    i++;
  }

  return <>{elements}</>;
}

function extractCodeBlock(lines: string[], startIndex: number): { blockLines: string[], endIndex: number } {
  const blockLines: string[] = [];
  let endIndex = startIndex + 1;
  
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      endIndex = i;
      break;
    }
    blockLines.push(lines[i]);
  }
  
  return { blockLines, endIndex };
}

// ========================================
// Render Components
// ========================================

function BulletPoint({ text }: { text: string }) {
  const processedText = processInlineFormatting(text);
  return (
    <div className="smarttriad-bullet-point">
      <span className="bullet">•</span>
      <span className="text" dangerouslySetInnerHTML={{ __html: processedText }} />
    </div>
  );
}

function NumberedList({ number, text }: { number: string; text: string }) {
  const processedText = processInlineFormatting(text);
  return (
    <div className="smarttriad-numbered-list">
      <span className="number">{number}</span>
      <span className="text" dangerouslySetInnerHTML={{ __html: processedText }} />
    </div>
  );
}

function ConversationalIntro({ text }: { text: string }) {
  return (
    <div className="smarttriad-conversational-intro">
      {text}
    </div>
  );
}

function Callout({ text }: { text: string }) {
  return (
    <div className="smarttriad-callout">
      {text}
    </div>
  );
}

function Blockquote({ text }: { text: string }) {
  const processedText = processInlineFormatting(text);
  return (
    <div className="smarttriad-blockquote">
      <span dangerouslySetInnerHTML={{ __html: processedText }} />
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  const processedText = processInlineFormatting(text);
  return (
    <p className="smarttriad-paragraph" dangerouslySetInnerHTML={{ __html: processedText }} />
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  const code = lines.join('\n');
  const language = detectLanguage(code);
  
  return (
    <div className="smarttriad-code-block">
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'hsl(220, 14%, 8%)',
          fontSize: '0.875rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MermaidDiagram({ code }: { code: string }) {
  return (
    <div className="smarttriad-mermaid-container">
      <MermaidDiagramSafe code={code} />
    </div>
  );
}

// ========================================
// Inline Processing
// ========================================

function processInlineFormatting(text: string): string {
  // Key term highlighting
  KEY_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    text = text.replace(regex, `<span class="smarttriad-key-term">${term}</span>`);
  });

  // Bold formatting
  text = text.replace(/\*\*([^*]+)\*\*/g, '<span class="smarttriad-bold">$1</span>');

  // Inline code
  text = text.replace(/`([^`]+)`/g, '<span class="smarttriad-inline-code">$1</span>');

  // Images
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<div class="smarttriad-image-container"><img src="$2" alt="$1" class="smarttriad-image" /><div class="smarttriad-image-caption">$1</div></div>'
  );

  return text;
}

// ========================================
// Helper Functions
// ========================================

function isConversationalIntro(line: string): boolean {
  const intros = ['Here\'s what you need to know', 'Let me explain', 'The key thing about'];
  return intros.some(intro => line.startsWith(intro));
}

function isCallout(line: string): boolean {
  const callouts = ['Important:', 'Remember:', 'Note:'];
  return callouts.some(callout => line.startsWith(callout));
}

function detectLanguage(code: string): string {
  // Simple language detection
  if (code.includes('function') || code.includes('const') || code.includes('let')) return 'javascript';
  if (code.includes('def ') || code.includes('import ')) return 'python';
  if (code.includes('public class') || code.includes('private ')) return 'java';
  if (code.includes('interface ') || code.includes(': string')) return 'typescript';
  return 'javascript';
}

// ========================================
// Metadata Components
// ========================================

function ScoreIndicators({ metadata }: { metadata: SmartTriadMessage['metadata'] }) {
  if (!metadata) return null;

  const getScoreColor = (score: number, type: 'trust' | 'reliability' | 'risk') => {
    if (type === 'risk') {
      if (score <= 4) return 'green';
      if (score <= 7) return 'yellow';
      return 'red';
    } else {
      if (score <= 3) return 'red';
      if (score <= 6) return 'yellow';
      return type === 'reliability' ? 'purple' : 'green';
    }
  };

  const renderDots = (score: number, type: 'trust' | 'reliability' | 'risk') => {
    const filledCount = Math.ceil(score / 2);
    const color = getScoreColor(score, type);
    
    return Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className={`smarttriad-score-dot ${i < filledCount ? `filled ${color}` : ''}`}
      />
    ));
  };

  return (
    <div className="smarttriad-score-container active">
      {metadata.trustScore && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Trust</span>
          <div className="smarttriad-score-dots">
            {renderDots(metadata.trustScore, 'trust')}
          </div>
        </div>
      )}
      {metadata.reliabilityScore && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Reliability</span>
          <div className="smarttriad-score-dots">
            {renderDots(metadata.reliabilityScore, 'reliability')}
          </div>
        </div>
      )}
      {metadata.riskScore && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Risk</span>
          <div className="smarttriad-score-dots">
            {renderDots(metadata.riskScore, 'risk')}
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataBadges({
  message,
  showMetadata,
  tenantConfig,
  selectedAgent,
  selectedModel,
  availableAgents,
  modelOptions,
  onAgentChange,
  onModelSelectorChange,
  enableModelSelector,
  onModelChange,
}: {
  message: SmartTriadMessage;
  showMetadata?: boolean;
  tenantConfig?: SmartTriadInferenceRendererProps['tenantConfig'];
  selectedAgent?: AgentOption;
  selectedModel?: ModelOption | null;
  availableAgents?: AgentOption[];
  modelOptions?: ModelOption[];
  onAgentChange?: (agent: AgentOption) => void;
  onModelSelectorChange?: (model: ModelOption) => void;
  enableModelSelector?: boolean;
  onModelChange?: (model: string, provider: string) => void;
}) {
  if (!showMetadata || !message.metadata) return null;

  const renderMetadataBadges = () => {
    if (!showMetadata || !message.metadata) return null;

    return (
      <div className="smarttriad-metadata-badges flex items-center gap-2 text-xs text-slate-400 mb-3">
        {message.metadata.mcpVersion && (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {message.metadata.mcpVersion}
          </span>
        )}
        
        {/* AgentModelSelector Integration */}
        {tenantConfig?.enableModelSelection && enableModelSelector && selectedAgent ? (
          <div className="flex items-center gap-1">
            <AgentModelSelector
              selectedAgent={selectedAgent}
              selectedModel={selectedModel || null}
              availableAgents={availableAgents || []}
              modelOptions={modelOptions || []}
              onAgentChange={onAgentChange || (() => {})}
              onModelChange={onModelSelectorChange || (() => {})}
              size="sm"
              showLabels={false}
              className="metadata-agent-selector"
            />
          </div>
        ) : enableModelSelector && onModelChange ? (
          <ModelSelector
            currentModel={message.metadata.model}
            currentProvider={message.metadata.provider}
            onModelChange={onModelChange}
          />
        ) : null}
        
        {/* Profile Card (stubbed for future Persona integration) */}
        {message.metadata.profileCard && (
          <div className="inline-flex items-center px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Bot className="w-3 h-3 mr-1" />
            {message.metadata.profileCard}
          </div>
        )}
        
        <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-700/50 text-slate-300">
          <Clock className="w-3 h-3 mr-1" />
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  };

  return renderMetadataBadges();
}

// ========================================
// Model Selector (Stub - to be replaced with metaMe runtime component)
// ========================================

function ModelSelector({ 
  currentModel, 
  currentProvider, 
  onModelChange 
}: {
  currentModel?: string;
  currentProvider?: string;
  onModelChange?: (model: string, provider: string) => void;
}) {
  // This is a stub - will be replaced with metaMe runtime AgentModelSelector
  return (
    <span className="smarttriad-badge smarttriad-badge-outline">
      {currentProvider} {currentModel}
    </span>
  );
}

// ========================================
// Mermaid Diagram Safe Component
// ========================================

function MermaidDiagramSafe({ code }: { code: string }) {
  const [diagramState, setDiagramState] = React.useState<'loading' | 'error' | 'success'>('loading');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // This is a simplified implementation
    // In production, this would use the full MermaidCleanupManager
    const timer = setTimeout(() => {
      // Simulate rendering
      if (code.length > 50000) {
        setDiagramState('error');
        setError('Diagram too complex');
      } else {
        setDiagramState('success');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [code]);

  if (diagramState === 'loading') {
    return (
      <div className="smarttriad-mermaid-loading">
        <Clock className="w-4 h-4 inline mr-2 animate-spin" />
        Rendering diagram...
      </div>
    );
  }

  if (diagramState === 'error') {
    return (
      <div className="smarttriad-mermaid-error">
        <AlertTriangle className="w-4 h-4 inline mr-2" />
        {error || 'Failed to render diagram'}
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      <Zap className="w-4 h-4 inline mr-2" />
      Mermaid Diagram (Safe Rendering)
      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
        {code}
      </pre>
    </div>
  );
}
