"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./CopilotInferenceBodyRenderer.module.css";
import {
  clearMermaidProcessedAttributes,
  enqueueMermaidRender,
  renderMermaidSvg,
  validateMermaidSource,
} from "./mermaidSafe";

interface CopilotInferenceBodyRendererProps {
  content: string;
}

interface MermaidBlockProps {
  code: string;
}

const CALLOUT_PATTERN = /^\s*(Important|Remember|Note|Warning)\s*:/i;

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => flattenText(item)).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: ReactNode } };
    return flattenText(element.props?.children ?? "");
  }

  return "";
}

function isCallout(children: ReactNode): boolean {
  const text = flattenText(children);
  return CALLOUT_PATTERN.test(text);
}

function MermaidBlock({ code }: MermaidBlockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const target = hostRef.current;
    if (!target) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!isVisible) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const validation = validateMermaidSource(code);
        if (!validation.ok) {
          setError(validation.error);
          return;
        }

        await enqueueMermaidRender(async () => {
          if (cancelled || !containerRef.current) {
            return;
          }

          clearMermaidProcessedAttributes(containerRef.current);

          const renderId = `copilot-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const svg = await renderMermaidSvg(validation.normalized, renderId);

          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        });
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Unable to render diagram.");
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
  }, [code, isVisible]);

  if (error) {
    return (
      <div className={styles.mermaidError}>
        {error}
      </div>
    );
  }

  return (
    <div ref={hostRef} className={styles.mermaidContainer}>
      {!isVisible ? <div className={styles.mermaidLoading}>[Diagram - Loading...]</div> : null}
      {isVisible && loading ? <div className={styles.mermaidLoading}>Rendering diagram...</div> : null}
      <div ref={containerRef} className={styles.mermaidCanvas} />
    </div>
  );
}

export function CopilotInferenceBodyRenderer({ content }: CopilotInferenceBodyRendererProps) {
  return (
    <div className={styles.rendererRoot}>
      <ReactMarkdown
        components={{
          p: ({ children }) =>
            isCallout(children) ? (
              <p className={styles.callout}>{children}</p>
            ) : (
              <p className={styles.paragraph}>{children}</p>
            ),
          ul: ({ children }) => <ul className={styles.unorderedList}>{children}</ul>,
          ol: ({ children }) => <ol className={styles.orderedList}>{children}</ol>,
          li: ({ children }) => <li className={styles.listItem}>{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className={styles.blockquote}>
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const inline = (props as { inline?: boolean }).inline === true;
            const code = String(children).replace(/\n$/, "");
            const language = className?.replace("language-", "").trim().toLowerCase();

            if (!inline && language === "mermaid") {
              return <MermaidBlock code={code} />;
            }

            if (inline) {
              return (
                <code className={styles.inlineCode}>
                  {children}
                </code>
              );
            }

            return (
              <pre className={styles.codeBlock}>
                <code className={styles.codeBlockCode}>{children}</code>
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
