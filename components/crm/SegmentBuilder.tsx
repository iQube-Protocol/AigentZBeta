'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Users, TrendingUp, Calendar, Star, Loader2, AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface SegmentRule {
  id: string;
  field: string;
  operator: string;
  value: string | number;
}

interface SegmentBuilderProps {
  tenantId: string;
  onClose: () => void;
  onSuccess?: (segment: any) => void;
  existingSegment?: { id: string; name: string; description: string; isDynamic: boolean; ruleDefinition?: any };
}

const RULE_FIELDS = [
  { value: 'totalPokw', label: 'Total PoKW', type: 'number', icon: TrendingUp },
  { value: 'contributionCount', label: 'Contributions', type: 'number', icon: Zap },
  { value: 'reputationBucket', label: 'Reputation', type: 'select', icon: Star },
  { value: 'personaState', label: 'Status', type: 'select', icon: Users },
  { value: 'lastActiveWithinDays', label: 'Last Active (days)', type: 'number', icon: Calendar },
];

const OPERATORS = {
  number: [
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'eq', label: '=' },
  ],
  select: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
};

const SELECT_OPTIONS: Record<string, string[]> = {
  reputationBucket: ['trusted', 'verified', 'new', 'flagged'],
  personaState: ['active', 'pending', 'suspended', 'inactive'],
};

export default function SegmentBuilder({ tenantId, onClose, onSuccess, existingSegment }: SegmentBuilderProps) {
  const [name, setName] = useState(existingSegment?.name || '');
  const [description, setDescription] = useState(existingSegment?.description || '');
  const [isDynamic, setIsDynamic] = useState(existingSegment?.isDynamic ?? true);
  const [rules, setRules] = useState<SegmentRule[]>(existingSegment?.ruleDefinition?.rules || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addRule = () => {
    setRules([...rules, { id: `rule-${Date.now()}`, field: 'totalPokw', operator: 'gte', value: 0 }]);
  };

  const updateRule = (id: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const getFieldConfig = (fieldValue: string) => RULE_FIELDS.find(f => f.value === fieldValue);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a segment name'); return; }

    setLoading(true);
    setError(null);

    try {
      const endpoint = existingSegment ? `/api/crm/segments/${existingSegment.id}` : '/api/crm/segments';
      const method = existingSegment ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, name, description, isDynamic, ruleDefinition: isDynamic ? { rules } : undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save segment');
      }

      const segment = await response.json();
      setSuccess(true);
      if (onSuccess) onSuccess(segment);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save segment');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md ring-1 ring-white/10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Segment {existingSegment ? 'Updated' : 'Created'}!</h3>
          <p className="text-slate-400">{name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden ring-1 ring-white/10 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-semibold">{existingSegment ? 'Edit Segment' : 'Create Segment'}</h2>
            <p className="text-sm text-slate-400 mt-1">Define rules to automatically group personas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition" aria-label="Close">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg p-3 bg-red-500/10 ring-1 ring-red-500/20 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Segment Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Top Contributors"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe who belongs in this segment..." rows={2}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
              <div className="flex-1">
                <p className="font-medium">Dynamic Segment</p>
                <p className="text-sm text-slate-400">Automatically updates based on rules</p>
              </div>
              <button type="button" onClick={() => setIsDynamic(!isDynamic)}
                className={`relative w-12 h-6 rounded-full transition ${isDynamic ? 'bg-cyan-500' : 'bg-white/20'}`} aria-label="Toggle dynamic segment">
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${isDynamic ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {isDynamic && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Segment Rules</h3>
                </div>

                {rules.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                    <Users size={32} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-slate-400 text-sm mb-3">No rules defined yet</p>
                    <button type="button" onClick={addRule} className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">+ Add your first rule</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule, index) => {
                      const fieldConfig = getFieldConfig(rule.field);
                      const fieldType = fieldConfig?.type || 'number';
                      const ops = OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.number;

                      return (
                        <div key={rule.id} className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                          <span className="text-slate-500 text-sm w-8">{index === 0 ? 'If' : 'And'}</span>
                          <select value={rule.field} onChange={(e) => updateRule(rule.id, { field: e.target.value, value: fieldType === 'select' ? '' : 0 })}
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm" title="Select field">
                            {RULE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select value={rule.operator} onChange={(e) => updateRule(rule.id, { operator: e.target.value })}
                            className="w-16 px-2 py-2 bg-white/5 border border-white/10 rounded text-sm text-center" title="Select operator">
                            {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {fieldType === 'select' ? (
                            <select value={rule.value as string} onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm capitalize" title="Select value">
                              <option value="">Select...</option>
                              {(SELECT_OPTIONS[rule.field] || []).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input type="number" value={rule.value as number} onChange={(e) => updateRule(rule.id, { value: parseInt(e.target.value) || 0 })}
                              className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm" title="Enter value" />
                          )}
                          <button type="button" onClick={() => removeRule(rule.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded transition" aria-label="Remove rule">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addRule} className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium">
                      <Plus size={16} /> Add Rule
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
              {loading ? <><Loader2 size={16} className="animate-spin" />Saving...</> : <><Users size={16} />{existingSegment ? 'Update' : 'Create'} Segment</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
