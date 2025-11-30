'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCrmContext } from '@/app/crm/CrmContext';
import { CrmTaskTemplate, TaskCategory } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

const categories: TaskCategory[] = ['technical', 'creative', 'entrepreneurial', 'data', 'iqube_design', 'community'];

export default function TaskAdminPage() {
  const { currentTenantId } = useCrmContext();
  const [tasks, setTasks] = useState<CrmTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTaskTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ slug: '', title: '', description: '', category: 'technical' as TaskCategory, difficultyLevel: 2, expectedImpactLevel: 2, rewardQct: 100, rewardQoyn: 50, rewardKnyt: 0, maxClaims: '', isActive: true, isKnowledgePillar: false });
  const { toast } = useToast();
  const tenantId = currentTenantId || 'default';

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/tasks?tenantId=${tenantId}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch { toast({ title: 'Error', description: 'Failed to load tasks', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [tenantId]);

  const openCreate = () => { setEditingTask(null); setForm({ slug: '', title: '', description: '', category: 'technical', difficultyLevel: 2, expectedImpactLevel: 2, rewardQct: 100, rewardQoyn: 50, rewardKnyt: 0, maxClaims: '', isActive: true, isKnowledgePillar: false }); setDialogOpen(true); };
  
  const openEdit = (t: CrmTaskTemplate) => { setEditingTask(t); setForm({ slug: t.slug, title: t.title, description: t.description || '', category: t.category, difficultyLevel: t.difficultyLevel, expectedImpactLevel: t.expectedImpactLevel, rewardQct: t.rewardQct, rewardQoyn: t.rewardQoyn, rewardKnyt: t.rewardKnyt, maxClaims: t.maxClaims?.toString() || '', isActive: t.isActive, isKnowledgePillar: t.isKnowledgePillar }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingTask ? `/api/crm/tasks/${editingTask.id}` : '/api/crm/tasks';
      const res = await fetch(url, { method: editingTask ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...form, maxClaims: form.maxClaims ? Number(form.maxClaims) : null }) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editingTask ? 'Task Updated' : 'Task Created' });
      setDialogOpen(false); fetchTasks();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (t: CrmTaskTemplate) => {
    try {
      await fetch(`/api/crm/tasks/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, isActive: !t.isActive }) });
      toast({ title: t.isActive ? 'Deactivated' : 'Activated' }); fetchTasks();
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/tasks"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div><h1 className="text-2xl font-bold">Task Administration</h1><p className="text-muted-foreground">Create and manage task templates</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Create Task</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Tasks ({tasks.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : tasks.length === 0 ? <p className="text-center py-8 text-muted-foreground">No tasks yet</p> : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{t.category}</Badge>
                      <Badge variant="secondary">L{t.difficultyLevel}</Badge>
                      {t.isKnowledgePillar && <Badge className="bg-amber-500">📚 Knowledge</Badge>}
                      <span className="text-xs text-muted-foreground">{t.currentClaims} claims</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.isActive ? 'default' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(t)}>{t.isActive ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTask ? 'Edit' : 'Create'} Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Category</Label><Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as TaskCategory }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Difficulty (1-5)</Label><Input type="number" min={1} max={5} value={form.difficultyLevel} onChange={e => setForm(f => ({ ...f, difficultyLevel: Number(e.target.value) }))} /></div>
              <div><Label>Impact (1-5)</Label><Input type="number" min={1} max={5} value={form.expectedImpactLevel} onChange={e => setForm(f => ({ ...f, expectedImpactLevel: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>QCT</Label><Input type="number" value={form.rewardQct} onChange={e => setForm(f => ({ ...f, rewardQct: Number(e.target.value) }))} /></div>
              <div><Label>QOYN</Label><Input type="number" value={form.rewardQoyn} onChange={e => setForm(f => ({ ...f, rewardQoyn: Number(e.target.value) }))} /></div>
              <div><Label>KNYT</Label><Input type="number" value={form.rewardKnyt} onChange={e => setForm(f => ({ ...f, rewardKnyt: Number(e.target.value) }))} /></div>
              <div><Label>Max Claims</Label><Input type="number" value={form.maxClaims} onChange={e => setForm(f => ({ ...f, maxClaims: e.target.value }))} placeholder="∞" /></div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isKnowledgePillar" checked={form.isKnowledgePillar} onChange={e => setForm(f => ({ ...f, isKnowledgePillar: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="isKnowledgePillar" className="cursor-pointer">📚 Knowledge Pillar Task (contributes to 5 knowledge dimensions)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.slug}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
