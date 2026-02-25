"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface CopilotInferenceBodyRendererProps {
  content: string;
}

interface MermaidBlockProps {
  code: string;
}

function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        setLoading(true);
        setError(null);

        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
        });

        await mermaid.parse(code);
        const renderId = `copilot-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(renderId, code);

        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) {
          setError("Unable to render diagram.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [code]);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-950/70 px-3 py-2">
      {loading ? <div className="text-xs text-slate-400">Rendering diagram...</div> : null}
      <div ref={containerRef} className="overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full" />
    </div>
  );
}

export function CopilotInferenceBodyRenderer({ content }: CopilotInferenceBodyRendererProps) {
  return (
    <div className="space-y-2 text-sm leading-6 text-slate-100">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-slate-100">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="rounded-r border-l-2 border-cyan-400/40 pl-3 text-slate-300">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children }) => {
            const code = String(children).replace(/\n$/, "");
            const language = className?.replace("language-", "").trim();

            if (!inline && language === "mermaid") {
              return <MermaidBlock code={code} />;
            }

            if (inline) {
              return (
                <code className="rounded bg-slate-900/80 px-1 py-0.5 text-xs text-cyan-200 ring-1 ring-white/10">
                  {children}
                </code>
              );
            }

            return (
              <pre className="overflow-x-auto rounded-lg bg-slate-950/80 p-3 text-xs text-slate-100 ring-1 ring-white/10">
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

