'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCodexConfig } from '@/app/hooks/useCodexConfig';
import { 
  ArrowLeft, Save, Plus, Trash2, Eye, EyeOff, GripVertical, 
  Settings, BookOpen, AlertCircle, CheckCircle 
} from 'lucide-react';
import Link from 'next/link';

export default function CodexDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codexId = params?.codexId as string | undefined;

  if (!codexId) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">Invalid Codex Route</h2>
            <p className="text-red-300 mb-4">Missing codex id parameter.</p>
            <Link
              href="/admin/codex"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Codex List
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const { data: codex, isLoading, error } = useCodexConfig({ codexId, useDefaults: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-slate-400">Loading codex...</span>
      </div>
    );
  }

  if (error || !codex) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Codex</h2>
            <p className="text-red-300 mb-4">{error?.message || 'Codex not found'}</p>
            <Link
              href="/admin/codex"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Codex List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      // TODO: Implement save functionality via API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    // TODO: Implement toggle via API
    console.log('Toggle enabled:', codex.id);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/codex"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-purple-400" />
                {codex.name}
              </h1>
              <p className="text-slate-400 mt-1">
                Manage codex configuration, tabs, and settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Error</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Basic Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Codex Name
                  </label>
                  <input
                    type="text"
                    value={codex.name}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Slug (URL identifier)
                  </label>
                  <input
                    type="text"
                    value={codex.slug}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Used in URLs: /triad/embed/codex/{codex.slug}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={codex.metadata.description}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    readOnly
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white">Codex Status</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {codex.enabled ? 'Visible to users' : 'Hidden from users'}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleEnabled}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      codex.enabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {codex.enabled ? (
                      <>
                        <Eye className="w-4 h-4" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Disabled
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs Management */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Tabs ({codex.tabs.length})
                </h2>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Tab
                </button>
              </div>

              <div className="space-y-2">
                {codex.tabs.map((tab, index) => (
                  <div
                    key={tab.id}
                    className="flex items-center gap-3 p-4 bg-slate-900 rounded-lg hover:bg-slate-800/80 transition-colors"
                  >
                    <GripVertical className="w-5 h-5 text-slate-600 cursor-move" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{tab.label}</span>
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                          {tab.type}
                        </span>
                        {tab.metadata?.badge && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                            {tab.metadata.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400">
                        {tab.metadata?.description || tab.slug}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {tab.enabled ? (
                        <Eye className="w-4 h-4 text-green-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-600" />
                      )}
                      <button className="p-2 hover:bg-slate-700 rounded transition-colors">
                        <Settings className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="p-2 hover:bg-red-500/20 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/triad/embed/codex/${codex.slug}`}
                  target="_blank"
                  className="flex items-center gap-2 w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Preview Codex
                </Link>
                <Link
                  href={`/codex/viewer?codex=${codex.id}`}
                  target="_blank"
                  className="flex items-center gap-2 w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Test in Viewer
                </Link>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Metadata</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-slate-400 mb-1">ID</div>
                  <div className="text-white font-mono text-xs">{codex.id}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Version</div>
                  <div className="text-white">{codex.version}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Owner</div>
                  <div className="text-white">{codex.owner}</div>
                </div>
                {codex.metadata.category && (
                  <div>
                    <div className="text-slate-400 mb-1">Category</div>
                    <div className="px-2 py-1 bg-slate-700 text-slate-300 rounded inline-block">
                      {codex.metadata.category}
                    </div>
                  </div>
                )}
                {codex.metadata.tags && codex.metadata.tags.length > 0 && (
                  <div>
                    <div className="text-slate-400 mb-1">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {codex.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Permissions</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-slate-400 mb-1">View</div>
                  <div className="text-white">
                    {codex.permissions.view.includes('*') ? 'Public' : codex.permissions.view.join(', ')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Edit</div>
                  <div className="text-white">{codex.permissions.edit.join(', ')}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Admin</div>
                  <div className="text-white">{codex.permissions.admin.join(', ')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
