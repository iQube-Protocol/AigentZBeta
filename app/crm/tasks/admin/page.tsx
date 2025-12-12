'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCrmContext } from '@/app/crm/CrmContext';
import { CrmTaskTemplate, TaskCategory } from '@/types/crm';

const CATEGORIES: TaskCategory[] = ['technical', 'creative', 'entrepreneurial', 'data', 'iqube_design', 'community'];

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  technical: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  creative: 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
  entrepreneurial: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  data: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
  iqube_design: 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/30',
  community: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
};

export default function TaskAdminPage() {
  const { currentTenantId } = useCrmContext();
  const [tasks, setTasks] = useState<CrmTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTaskTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slug: '',
    title: '',
    description: '',
    category: 'technical' as TaskCategory,
    difficultyLevel: 2,
    expectedImpactLevel: 2,
    rewardQct: 100,
    rewardQoyn: 50,
    rewardKnyt: 0,
    maxClaims: '',
    isActive: true,
    isKnowledgePillar: false,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const tenantId = currentTenantId || 'default';

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/tasks?tenantId=${tenantId}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [tenantId]);

  const openCreate = () => {
    setEditingTask(null);
    setForm({
      slug: '',
      title: '',
      description: '',
      category: 'technical',
      difficultyLevel: 2,
      expectedImpactLevel: 2,
      rewardQct: 100,
      rewardQoyn: 50,
      rewardKnyt: 0,
      maxClaims: '',
      isActive: true,
      isKnowledgePillar: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (t: CrmTaskTemplate) => {
    setEditingTask(t);
    setForm({
      slug: t.slug,
      title: t.title,
      description: t.description || '',
      category: t.category,
      difficultyLevel: t.difficultyLevel,
      expectedImpactLevel: t.expectedImpactLevel,
      rewardQct: t.rewardQct,
      rewardQoyn: t.rewardQoyn,
      rewardKnyt: t.rewardKnyt,
      maxClaims: t.maxClaims?.toString() || '',
      isActive: t.isActive,
      isKnowledgePillar: t.isKnowledgePillar,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingTask ? `/api/crm/tasks/${editingTask.id}` : '/api/crm/tasks';
      const res = await fetch(url, {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...form,
          maxClaims: form.maxClaims ? Number(form.maxClaims) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(editingTask ? 'Task Updated' : 'Task Created');
      setDialogOpen(false);
      fetchTasks();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: CrmTaskTemplate) => {
    try {
      await fetch(`/api/crm/tasks/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, isActive: !t.isActive }),
      });
      showToast(t.isActive ? 'Deactivated' : 'Activated');
      fetchTasks();
    } catch {
      showToast('Error', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${
          toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/tasks"
            className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-slate-300 hover:bg-white/10 transition-colors"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Task Administration</h1>
            <p className="text-slate-400 text-sm">Create and manage task templates</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? '⟳' : '↻'}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium hover:from-fuchsia-400 hover:to-purple-400"
          >
            + Create Task
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">Tasks ({tasks.length})</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10"
                >
                  <div>
                    <p className="font-medium text-white">{t.title}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${CATEGORY_COLORS[t.category]}`}>
                        {t.category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                        L{t.difficultyLevel}
                      </span>
                      {t.isKnowledgePillar && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          📚 Knowledge
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">{t.currentClaims} claims</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${
                      t.isActive ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30' : 'bg-slate-500/20 text-slate-400 ring-slate-500/30'
                    }`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => toggleActive(t)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                      {t.isActive ? '❌' : '✅'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-slate-900 ring-1 ring-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingTask ? 'Edit' : 'Create'} Task
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 resize-none"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TaskCategory }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-slate-900">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Difficulty (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.difficultyLevel}
                    onChange={(e) => setForm((f) => ({ ...f, difficultyLevel: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Impact (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.expectedImpactLevel}
                    onChange={(e) => setForm((f) => ({ ...f, expectedImpactLevel: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">QCT</label>
                  <input
                    type="number"
                    value={form.rewardQct}
                    onChange={(e) => setForm((f) => ({ ...f, rewardQct: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">QOYN</label>
                  <input
                    type="number"
                    value={form.rewardQoyn}
                    onChange={(e) => setForm((f) => ({ ...f, rewardQoyn: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">KNYT</label>
                  <input
                    type="number"
                    value={form.rewardKnyt}
                    onChange={(e) => setForm((f) => ({ ...f, rewardKnyt: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Claims</label>
                  <input
                    type="number"
                    value={form.maxClaims}
                    onChange={(e) => setForm((f) => ({ ...f, maxClaims: e.target.value }))}
                    placeholder="∞"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 placeholder:text-slate-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isKnowledgePillar"
                  checked={form.isKnowledgePillar}
                  onChange={(e) => setForm((f) => ({ ...f, isKnowledgePillar: e.target.checked }))}
                  className="w-4 h-4 rounded bg-white/10 border-white/20"
                />
                <label htmlFor="isKnowledgePillar" className="text-sm text-slate-300 cursor-pointer">
                  📚 Knowledge Pillar Task
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDialogOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.slug}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-medium disabled:opacity-50"
              >
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
