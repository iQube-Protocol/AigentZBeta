'use client';

import { useState } from 'react';
import { 
  X, 
  FileText, 
  MessageSquare, 
  CheckSquare, 
  Share2, 
  ThumbsUp,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ContributionFormProps {
  tenantId: string;
  personaId?: string;
  onClose: () => void;
  onSuccess?: (contribution: any) => void;
}

const CONTRIBUTION_TYPES = [
  { value: 'article_created', label: 'Article Created', icon: FileText, pokwBase: 100 },
  { value: 'comment_posted', label: 'Comment Posted', icon: MessageSquare, pokwBase: 10 },
  { value: 'quiz_completed', label: 'Quiz Completed', icon: CheckSquare, pokwBase: 25 },
  { value: 'content_shared', label: 'Content Shared', icon: Share2, pokwBase: 15 },
  { value: 'feedback_given', label: 'Feedback Given', icon: ThumbsUp, pokwBase: 20 },
  { value: 'task_completed', label: 'Task Completed', icon: Zap, pokwBase: 50 },
];

export default function ContributionForm({ 
  tenantId, 
  personaId: initialPersonaId, 
  onClose, 
  onSuccess 
}: ContributionFormProps) {
  const [personaId, setPersonaId] = useState(initialPersonaId || '');
  const [contributionType, setContributionType] = useState('');
  const [units, setUnits] = useState(1);
  const [source, setSource] = useState('manual');
  const [metadata, setMetadata] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedType = CONTRIBUTION_TYPES.find(t => t.value === contributionType);
  const estimatedPokw = selectedType ? selectedType.pokwBase * units : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personaId || !contributionType) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/crm/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          personaId,
          contributionType,
          units,
          source,
          metadata: metadata ? JSON.parse(metadata) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record contribution');
      }

      const contribution = await response.json();
      setSuccess(true);
      
      if (onSuccess) {
        onSuccess(contribution);
      }

      // Close after brief success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to record contribution');
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
          <h3 className="text-xl font-semibold mb-2">Contribution Recorded!</h3>
          <p className="text-slate-400">
            +{estimatedPokw} PoKW awarded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Record Contribution</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
            aria-label="Close"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg p-3 bg-red-500/10 ring-1 ring-red-500/20 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Persona ID */}
          {!initialPersonaId && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Persona ID *
              </label>
              <input
                type="text"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                placeholder="Enter persona ID"
                className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
          )}

          {/* Contribution Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Contribution Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTRIBUTION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setContributionType(type.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition text-left ${
                      contributionType === type.value
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon size={18} />
                    <div>
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="text-xs text-slate-500">+{type.pokwBase} PoKW</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Units */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Units
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={100}
                value={units}
                onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                title="Number of units"
                placeholder="1"
              />
              <span className="text-slate-400 text-sm">
                × {selectedType?.pokwBase || 0} = 
                <span className="text-emerald-400 font-medium ml-1">
                  {estimatedPokw} PoKW
                </span>
              </span>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
              title="Select source"
            >
              <option value="manual" className="bg-slate-800 text-white">Manual Entry</option>
              <option value="api" className="bg-slate-800 text-white">API Integration</option>
              <option value="webhook" className="bg-slate-800 text-white">Webhook</option>
              <option value="import" className="bg-slate-800 text-white">Bulk Import</option>
            </select>
          </div>

          {/* Metadata (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Metadata (JSON, optional)
            </label>
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder='{"title": "My Article", "url": "https://..."}'
              rows={3}
              className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !contributionType}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Record Contribution
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
