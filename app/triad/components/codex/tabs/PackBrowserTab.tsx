"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, FileText, Folder, Loader2 } from "lucide-react";

interface PackCollectionNode {
  id: string;
  title: string;
  items?: string[];
  collections?: PackCollectionNode[];
}

interface PackCollectionsFile {
  collections?: PackCollectionNode[];
}

interface FileResponse {
  ok: boolean;
  format: "markdown" | "json";
  path: string;
  content?: string;
  data?: unknown;
  error?: string;
}

interface PackBrowserTabProps {
  packId: string;
  collectionId?: string;
  defaultPath?: string;
  theme?: "light" | "dark";
}

function formatLabel(path: string): string {
  const parts = path.split("/");
  const name = parts[parts.length - 1] || path;
  return name.replace(/\.md$/i, "").replace(/[_-]+/g, " ");
}

function findNodeById(nodes: PackCollectionNode[] | undefined, id: string | undefined): PackCollectionNode | null {
  if (!nodes || !id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNodeById(node.collections, id);
    if (hit) return hit;
  }
  return null;
}

function findFirstLeaf(nodes: PackCollectionNode[] | undefined): PackCollectionNode | null {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.items && node.items.length > 0) return node;
    const hit = findFirstLeaf(node.collections);
    if (hit) return hit;
  }
  return null;
}

export function PackBrowserTab({ packId, collectionId, defaultPath, theme = "dark" }: PackBrowserTabProps) {
  const [root, setRoot] = useState<PackCollectionsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(collectionId ?? null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCollections() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/codex/packs/${packId}/file?path=collections.json`);
        if (!response.ok) {
          throw new Error(`Failed to load collections for ${packId}`);
        }

        const payload: FileResponse = await response.json();
        if (!payload.ok || payload.format !== "json") {
          throw new Error(payload.error || "Invalid collections response");
        }

        const data = payload.data as PackCollectionsFile | undefined;
        const collections = data?.collections ?? [];

        if (!isMounted) return;
        setRoot(data ?? { collections: [] });

        const requested = findNodeById(collections, collectionId ?? undefined);
        const initial = requested || findFirstLeaf(collections);

        setActiveCollectionId(initial?.id ?? null);
        setActivePath(defaultPath ?? initial?.items?.[0] ?? null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load collections.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCollections();

    return () => {
      isMounted = false;
    };
  }, [packId, collectionId, defaultPath]);

  const activeCollection = useMemo(() => {
    const collections = root?.collections ?? [];
    return findNodeById(collections, activeCollectionId ?? undefined);
  }, [root, activeCollectionId]);

  const activeItems = useMemo(() => activeCollection?.items ?? [], [activeCollection]);

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      if (!activePath) return;
      setContentLoading(true);
      setError(null);

      try {
        const encoded = encodeURIComponent(activePath);
        const response = await fetch(`/api/codex/packs/${packId}/file?path=${encoded}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${activePath}`);
        }

        const payload: FileResponse = await response.json();
        if (!isMounted) return;

        if (!payload.ok) {
          throw new Error(payload.error || "Failed to load file");
        }

        if (payload.format === "json") {
          setContent(JSON.stringify(payload.data ?? {}, null, 2));
        } else {
          setContent(payload.content ?? "");
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load content.");
      } finally {
        if (isMounted) setContentLoading(false);
      }
    }

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [packId, activePath]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading pack...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const bgClass = theme === "dark" ? "bg-slate-900/40" : "bg-slate-50";
  const borderClass = theme === "dark" ? "border-slate-800" : "border-slate-200";

  return (
    <div className="flex h-full">
      <div className={`w-72 flex-shrink-0 border-r ${borderClass} ${bgClass} p-4 overflow-y-auto`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Collections</h3>
        <div className="mt-4">
          <CollectionTree
            nodes={root?.collections ?? []}
            activeId={activeCollectionId}
            onSelect={(id) => {
              setActiveCollectionId(id);
              const node = findNodeById(root?.collections ?? [], id);
              const firstItem = node?.items?.[0] ?? null;
              setActivePath(firstItem);
            }}
          />
        </div>
      </div>

      <div className={`w-72 flex-shrink-0 border-r ${borderClass} ${bgClass} p-4 overflow-y-auto`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {activeCollection?.title ?? "Items"}
        </h3>
        <div className="mt-4 space-y-2">
          {activeItems.length === 0 ? (
            <div className="text-sm text-slate-500">No items in this collection.</div>
          ) : (
            activeItems.map((item) => (
              <button
                key={item}
                onClick={() => setActivePath(item)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  item === activePath
                    ? "bg-blue-500/20 text-blue-200"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="truncate">{formatLabel(item)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {contentLoading ? (
          <div className="flex items-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading content...
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-200">{content || "No content available."}</pre>
        )}
      </div>
    </div>
  );
}

function CollectionTree({
  nodes,
  activeId,
  onSelect,
}: {
  nodes: PackCollectionNode[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <CollectionTreeNode key={node.id} node={node} activeId={activeId} onSelect={onSelect} depth={0} />
      ))}
    </div>
  );
}

function CollectionTreeNode({
  node,
  activeId,
  onSelect,
  depth,
}: {
  node: PackCollectionNode;
  activeId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = (node.collections?.length ?? 0) > 0;
  const isLeaf = (node.items?.length ?? 0) > 0;
  const isActive = node.id === activeId;

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => (hasChildren ? setOpen((v) => !v) : onSelect(node.id))}
          className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
            isActive ? "bg-blue-500/20 text-blue-200" : "text-slate-300 hover:bg-white/10"
          }`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )
          ) : (
            <span className="w-4" />
          )}
          {isLeaf ? (
            <FileText className="h-4 w-4 text-slate-400" />
          ) : (
            <Folder className="h-4 w-4 text-slate-400" />
          )}
          <span className="truncate">{node.title}</span>
        </button>
        {hasChildren && isLeaf && (
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="ml-2 rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
          >
            Open
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="mt-1 space-y-1">
          {node.collections!.map((child) => (
            <CollectionTreeNode
              key={child.id}
              node={child}
              activeId={activeId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
