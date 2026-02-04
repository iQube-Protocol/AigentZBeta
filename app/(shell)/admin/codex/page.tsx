'use client';

import { useState } from 'react';
import { useCodexList } from '@/app/hooks/useCodexConfig';
import { Plus, BookOpen, Settings, Eye, EyeOff, Edit, Trash2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CodexManagementPage() {
  const { data: codexes, isLoading, error, refetch } = useCodexList();
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  const filteredCodexes = codexes?.filter((codex: any) => {
    if (filter === 'enabled') return codex.enabled;
    if (filter === 'disabled') return !codex.enabled;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-purple-400" />
              Codex Management
            </h1>
            <p className="text-slate-400 mt-2">
              Manage multi-codex system configurations, tabs, and permissions
            </p>
          </div>
          <Link
            href="/admin/codex/new"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Codex
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'enabled', 'disabled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="ml-3 text-slate-400">Loading codexes...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error loading codexes: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Codex List */}
        {filteredCodexes && filteredCodexes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCodexes.map((codex: any) => (
              <div
                key={codex.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{codex.name}</h3>
                      {codex.enabled ? (
                        <Eye className="w-4 h-4 text-green-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{codex.slug}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    codex.enabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {codex.enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                  {codex.metadata.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Settings className="w-4 h-4" />
                    <span>{codex.tabCount} tabs</span>
                  </div>
                  {codex.metadata.category && (
                    <div className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-300">
                      {codex.metadata.category}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {codex.metadata.tags && codex.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {codex.metadata.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {codex.metadata.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                        +{codex.metadata.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                  <Link
                    href={`/admin/codex/${codex.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                  <Link
                    href={`/triad/embed/codex/${codex.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredCodexes && filteredCodexes.length === 0 && !isLoading && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {filter === 'all' ? 'No codexes found' : `No ${filter} codexes`}
            </h3>
            <p className="text-slate-400 mb-6">
              {filter === 'all'
                ? 'Get started by creating your first codex'
                : `There are no ${filter} codexes at the moment`}
            </p>
            {filter === 'all' && (
              <Link
                href="/admin/codex/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Your First Codex
              </Link>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {codexes && codexes.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white mb-1">{codexes.length}</div>
              <div className="text-sm text-slate-400">Total Codexes</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {codexes.filter((c: any) => c.enabled).length}
              </div>
              <div className="text-sm text-slate-400">Active Codexes</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {codexes.reduce((sum: number, c: any) => sum + c.tabCount, 0)}
              </div>
              <div className="text-sm text-slate-400">Total Tabs</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
