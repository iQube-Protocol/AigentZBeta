/**
 * Code Example Viewer
 * 
 * Displays syntax-highlighted code with copy functionality,
 * line numbers, and interactive features.
 */

import { useState } from "react";
import { Copy, Check, Play, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CodeExample } from "@/app/types/nakamoto";

interface CodeExampleViewerProps {
  codeExample: CodeExample;
  theme?: 'light' | 'dark';
  interactive?: boolean;
}

export function CodeExampleViewer({ 
  codeExample, 
  theme = 'dark', 
  interactive = true 
}: CodeExampleViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeExample.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeExample.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = codeExample.filename || `${codeExample.title}.${codeExample.language}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{codeExample.title}</CardTitle>
            <Badge variant="outline">{codeExample.language}</Badge>
            {codeExample.metadata?.difficulty && (
              <Badge 
                variant={
                  codeExample.metadata.difficulty === 'beginner' ? 'secondary' :
                  codeExample.metadata.difficulty === 'intermediate' ? 'default' :
                  'destructive'
                }
              >
                {codeExample.metadata.difficulty}
              </Badge>
            )}
          </div>
          
          {interactive && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLineNumbers(!showLineNumbers)}>
                <span className="text-xs">#</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWrapLines(!wrapLines)}>
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        {codeExample.description && (
          <p className="text-sm text-muted-foreground">{codeExample.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className="h-full overflow-auto">
          <SyntaxHighlighter
            language={codeExample.language}
            style={theme === 'dark' ? oneDark : oneLight}
            showLineNumbers={showLineNumbers}
            wrapLines={wrapLines}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '14px',
              lineHeight: '1.5',
              background: 'transparent',
            }}
          >
            {codeExample.code}
          </SyntaxHighlighter>
        </div>
      </CardContent>
    </Card>
  );
}
