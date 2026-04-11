"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./CopilotInferenceBodyRenderer.module.css";
import { splitMarkdownTables, parseTableRow } from "@/utils/splitMarkdownTables";
import {
  clearMermaidProcessedAttributes,
  enqueueMermaidRender,
  renderMermaidSvg,
  validateMermaidSource,
} from "./mermaidSafe";

interface CopilotInferenceBodyRendererProps {
  content: string;
  onPromptSuggestion?: (prompt: string, meta?: PromptSuggestionMeta) => void;
}

interface MermaidBlockProps {
  code: string;
}

export type PromptSuggestionMeta = {
  source: "explore_further";
  index: number;
};

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

function cleanSuggestionLine(line: string): string {
  return line
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .trim();
}

function extractExploreFurtherPrompts(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const prompts: string[] = [];
  let inExploreFurtherSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const normalized = line.toLowerCase().replace(/[*_#:`]/g, "").trim();

    if (normalized.includes("explore further")) {
      inExploreFurtherSection = true;
      continue;
    }

    if (!inExploreFurtherSection) continue;

    const isListItem = /^\s*[-*•]\s+/.test(rawLine) || /^\s*\d+\.\s+/.test(rawLine);
    const isSectionBoundary = line.startsWith("#") || /^[-=]{3,}$/.test(line);

    if (isListItem) {
      const prompt = cleanSuggestionLine(rawLine);
      if (prompt) prompts.push(prompt);
      continue;
    }

    if (!line) {
      continue;
    }

    if (isSectionBoundary || prompts.length > 0) {
      break;
    }
  }

  return Array.from(new Set(prompts)).slice(0, 6);
}

function stripExploreFurtherSection(content: string): string {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  let inExploreFurtherSection = false;
  let sawExploreListItem = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const normalized = trimmed.toLowerCase().replace(/[*_#:`]/g, "").trim();

    if (!inExploreFurtherSection && normalized.includes("explore further")) {
      inExploreFurtherSection = true;
      sawExploreListItem = false;
      continue;
    }

    if (!inExploreFurtherSection) {
      output.push(rawLine);
      continue;
    }

    const isListItem = /^\s*[-*•]\s+/.test(rawLine) || /^\s*\d+\.\s+/.test(rawLine);
    if (isListItem) {
      sawExploreListItem = true;
      continue;
    }

    // Skip blank spacer lines inside the Explore Further block.
    if (!trimmed) {
      continue;
    }

    // Boundary reached: resume normal rendering from this line onward.
    inExploreFurtherSection = false;
    sawExploreListItem = false;
    output.push(rawLine);
  }

  // Trim trailing blank lines introduced by section stripping.
  while (output.length > 0 && output[output.length - 1].trim() === "") {
    output.pop();
  }

  // If section marker existed but no list items were found, keep original content.
  if (inExploreFurtherSection && !sawExploreListItem) {
    return content;
  }

  return output.join("\n");
}

function InlineGfmTable({ content }: { content: string }) {
  const lines = content.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const headers = parseTableRow(lines[0]);
  const bodyLines = lines.slice(2); // skip header + separator
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-slate-800/60 border-b border-slate-700">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-200 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((row, ri) => (
            <tr key={ri} className="border-b border-slate-800 last:border-0">
              {parseTableRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-300 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MermaidBlock({ code }: MermaidBlockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);

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
        setSvgMarkup("");

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
            setSvgMarkup(svg);
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
      setSvgMarkup("");
    };
  }, [code, isVisible]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isModalOpen]);

  const closeModal = () => setIsModalOpen(false);

  const modalScaleStyle: CSSProperties = {
    transform: `scale(${modalZoom})`,
  };

  if (error) {
    return (
      <div className={styles.mermaidError}>
        {error}
      </div>
    );
  }

  return (
    <div ref={hostRef} className={styles.mermaidContainer}>
      <div className={styles.mermaidToolbar}>
        <button
          type="button"
          className={styles.mermaidExpandButton}
          onClick={() => {
            setModalZoom(1);
            setIsModalOpen(true);
          }}
          disabled={loading || !svgMarkup}
          aria-label="Expand diagram"
        >
          Expand
        </button>
      </div>
      {!isVisible ? <div className={styles.mermaidLoading}>[Diagram - Loading...]</div> : null}
      {isVisible && loading ? <div className={styles.mermaidLoading}>Rendering diagram...</div> : null}
      <div ref={containerRef} className={styles.mermaidCanvas} />

      {isModalOpen && svgMarkup ? (
        <div className={styles.mermaidModalBackdrop} onClick={closeModal}>
          <div
            className={styles.mermaidModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded mermaid diagram"
          >
            <div className={styles.mermaidModalHeader}>
              <span>Diagram</span>
              <div className={styles.mermaidModalActions}>
                <button
                  type="button"
                  className={styles.mermaidModalButton}
                  onClick={() => setModalZoom((prev) => Math.max(0.6, prev - 0.1))}
                  aria-label="Zoom out"
                >
                  -
                </button>
                <span className={styles.mermaidZoomValue}>{Math.round(modalZoom * 100)}%</span>
                <button
                  type="button"
                  className={styles.mermaidModalButton}
                  onClick={() => setModalZoom((prev) => Math.min(2.5, prev + 0.1))}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.mermaidModalButton}
                  onClick={() => setModalZoom(1)}
                >
                  Reset
                </button>
                <button type="button" className={styles.mermaidModalButton} onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
            <div className={styles.mermaidModalBody}>
              <div
                className={styles.mermaidModalScale}
                style={modalScaleStyle}
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CopilotInferenceBodyRenderer({ content, onPromptSuggestion }: CopilotInferenceBodyRendererProps) {
  const exploreFurtherPrompts = extractExploreFurtherPrompts(content);
  const renderedContent = stripExploreFurtherSection(content);

  const mdComponents = {
    p: ({ children }: { children?: React.ReactNode }) =>
      isCallout(children) ? (
        <p className={styles.callout}>{children}</p>
      ) : (
        <p className={styles.paragraph}>{children}</p>
      ),
    ul: ({ children }: { children?: React.ReactNode }) => <ul className={styles.unorderedList}>{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className={styles.orderedList}>{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className={styles.listItem}>{children}</li>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>{children}</a>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className={styles.blockquote}>{children}</blockquote>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => <strong className={styles.strong}>{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className={styles.em}>{children}</em>,
    code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      const inline = (props as { inline?: boolean }).inline === true;
      const code = String(children).replace(/\n$/, "");
      const language = className?.replace("language-", "").trim().toLowerCase();
      if (!inline && language === "mermaid") return <MermaidBlock code={code} />;
      if (inline) return <code className={styles.inlineCode}>{children}</code>;
      return <pre className={styles.codeBlock}><code className={styles.codeBlockCode}>{children}</code></pre>;
    },
  };

  return (
    <div className={styles.rendererRoot}>
      {splitMarkdownTables(renderedContent).map((seg, idx) =>
        seg.type === "table" ? (
          <InlineGfmTable key={idx} content={seg.content} />
        ) : seg.content.trim() ? (
          <ReactMarkdown key={idx} components={mdComponents}>{seg.content}</ReactMarkdown>
        ) : null
      )}
      {exploreFurtherPrompts.length > 0 && onPromptSuggestion ? (
        <div className={styles.suggestionSection}>
          <div className={styles.suggestionTitle}>Explore Further</div>
          <div className={styles.suggestionList}>
            {exploreFurtherPrompts.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                className={styles.suggestionLink}
                onClick={() =>
                  onPromptSuggestion(prompt, {
                    source: "explore_further",
                    index,
                  })
                }
                title={`Ask: ${prompt}`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
