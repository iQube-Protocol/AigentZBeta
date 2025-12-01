"use client";

import React, { useState, useEffect, useCallback } from "react";
import SmartContentCard from "./SmartContentCard";
import type { SmartContentQube, SmartContentApp } from "@/types/smartContent";
import type { LibraryItem, UserShelf, LibraryStats } from "@/services/content/libraryService";

interface LibraryShelfProps {
  personaId: string;
  onContentSelect?: (content: SmartContentQube) => void;
  onContentPurchase?: (content: SmartContentQube) => void;
  variant?: "drawer" | "page";
}

type ShelfFilter = "all" | "reading" | "watching" | "listening" | "completed" | "favorites";

const SHELF_FILTERS: Array<{ key: ShelfFilter; label: string; icon: string }> = [
  { key: "all", label: "All", icon: "📚" },
  { key: "reading", label: "Reading", icon: "📖" },
  { key: "watching", label: "Watching", icon: "🎬" },
  { key: "listening", label: "Listening", icon: "🎧" },
  { key: "completed", label: "Completed", icon: "✅" },
  { key: "favorites", label: "Favorites", icon: "⭐" },
];

export default function LibraryShelf({
  personaId,
  onContentSelect,
  onContentPurchase,
  variant = "drawer",
}: LibraryShelfProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [shelves, setShelves] = useState<UserShelf[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<ShelfFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch library data
  const fetchLibrary = useCallback(async () => {
    if (!personaId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Map filter to API params
      switch (activeFilter) {
        case "reading":
          params.set("shelf", "Reading");
          break;
        case "watching":
          params.set("shelf", "Watching");
          break;
        case "listening":
          params.set("shelf", "Listening");
          break;
        case "completed":
          params.set("completed", "true");
          break;
        case "favorites":
          params.set("favorite", "true");
          break;
      }

      const response = await fetch(
        `/api/content/library/${personaId}?${params.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        setItems(data.data || []);
      } else {
        setError(data.error || "Failed to load library");
      }
    } catch (err) {
      setError("Failed to load library");
      console.error("Library fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [personaId, activeFilter]);

  // Fetch shelves
  const fetchShelves = useCallback(async () => {
    if (!personaId) return;

    try {
      const response = await fetch(`/api/content/library/${personaId}/shelves`);
      const data = await response.json();

      if (data.success) {
        setShelves(data.data || []);
      }
    } catch (err) {
      console.error("Shelves fetch error:", err);
    }
  }, [personaId]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!personaId) return;

    try {
      const response = await fetch(`/api/content/library/${personaId}/stats`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  }, [personaId]);

  useEffect(() => {
    fetchLibrary();
    fetchShelves();
    fetchStats();
  }, [fetchLibrary, fetchShelves, fetchStats]);

  // Toggle favorite
  const handleToggleFavorite = async (contentId: string) => {
    try {
      await fetch(`/api/content/library/${personaId}/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleFavorite: true }),
      });
      fetchLibrary();
    } catch (err) {
      console.error("Toggle favorite error:", err);
    }
  };

  // Remove from library
  const handleRemove = async (contentId: string) => {
    try {
      await fetch(`/api/content/library/${personaId}/${contentId}`, {
        method: "DELETE",
      });
      fetchLibrary();
      fetchStats();
    } catch (err) {
      console.error("Remove error:", err);
    }
  };

  if (variant === "drawer") {
    return (
      <div className="flex flex-col h-full">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-2 text-center">
              <div className="text-lg font-semibold text-white">{stats.totalItems}</div>
              <div className="text-[10px] text-slate-400">Total</div>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-2 text-center">
              <div className="text-lg font-semibold text-emerald-400">{stats.completedItems}</div>
              <div className="text-[10px] text-slate-400">Done</div>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-2 text-center">
              <div className="text-lg font-semibold text-fuchsia-400">{stats.inProgressItems}</div>
              <div className="text-[10px] text-slate-400">Reading</div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {SHELF_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === filter.key
                  ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              {filter.icon} {filter.label}
            </button>
          ))}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              No content in your library yet
            </div>
          )}

          {items.map((item) => (
            <div key={item.id} className="relative group">
              <SmartContentCard
                content={item.content}
                variant="compact"
                showProgress
                progressPercentage={item.progressPercentage}
                onSelect={onContentSelect}
                isOwned
                isInLibrary
              />
              {/* Quick Actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(item.content.id);
                  }}
                  className={`p-1 rounded ${
                    item.isFavorite
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-black/40 text-slate-400 hover:text-amber-400"
                  }`}
                  title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <svg className="w-3 h-3" fill={item.isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(item.content.id);
                  }}
                  className="p-1 rounded bg-black/40 text-slate-400 hover:text-red-400"
                  title="Remove from library"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Page variant - full page library view
  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            {stats?.totalItems || 0} items · {stats?.completedItems || 0} completed
          </p>
        </div>

        {stats && (
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-fuchsia-400">
                {Math.round((stats.totalTimeSpent || 0) / 3600)}h
              </div>
              <div className="text-xs text-slate-400">Time spent</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">
                {stats.recentActivity?.itemsCompleted || 0}
              </div>
              <div className="text-xs text-slate-400">This month</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {SHELF_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 ring-1 ring-white/10"
              }`}
            >
              {filter.icon} {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-red-400">{error}</div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-slate-400">Your library is empty</p>
          <p className="text-slate-500 text-sm mt-1">
            Start exploring content to build your collection
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((item) => (
          <div key={item.id} className="relative group">
            <SmartContentCard
              content={item.content}
              variant="standard"
              showProgress
              progressPercentage={item.progressPercentage}
              onSelect={onContentSelect}
              isOwned
              isInLibrary
            />
            {/* Favorite Badge */}
            {item.isFavorite && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-amber-500/80 text-white text-[10px] font-medium">
                ⭐ Favorite
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Shelves Section */}
      {shelves.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Your Shelves</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {shelves.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => {
                  // TODO: Navigate to shelf view
                }}
                className="rounded-xl bg-gradient-to-br from-white/5 to-white/10 ring-1 ring-white/10 p-4 text-left hover:ring-white/20 transition-all"
              >
                <div className="text-2xl mb-2">📁</div>
                <div className="text-sm font-medium text-white">{shelf.name}</div>
                <div className="text-xs text-slate-400">{shelf.itemCount} items</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
