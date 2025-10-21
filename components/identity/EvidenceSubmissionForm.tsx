"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Send, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface EvidenceSubmissionFormProps {
  bucketId: string;
  partitionId?: string;
  onSuccess?: () => void;
}

const evidenceTypes = [
  { value: 'github_contribution', label: 'GitHub Contribution' },
  { value: 'project_completion', label: 'Project Completion' },
  { value: 'peer_endorsement', label: 'Peer Endorsement' },
  { value: 'certification', label: 'Certification' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'community_contribution', label: 'Community Contribution' },
  { value: 'other', label: 'Other' }
];

export function EvidenceSubmissionForm({ bucketId, partitionId, onSuccess }: EvidenceSubmissionFormProps) {
  const [evidenceType, setEvidenceType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [weight, setWeight] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentBucket, setCurrentBucket] = useState<number | null>(null);

  useEffect(() => {
    // Fetch current reputation score
    fetch(`/api/identity/reputation/bucket?partitionId=${partitionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) {
          setCurrentScore(data.data.score);
          setCurrentBucket(data.data.bucket);
        }
      })
      .catch(() => {});
  }, [partitionId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-purple-400';
    if (score >= 60) return 'text-green-400';
    if (score >= 40) return 'text-blue-400';
    if (score >= 20) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getBucketColor = (bucket: number) => {
    if (bucket >= 4) return 'text-purple-400';
    if (bucket >= 3) return 'text-green-400';
    if (bucket >= 2) return 'text-blue-400';
    if (bucket >= 1) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!evidenceType || !title || !description) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const evidenceData = {
        title,
        description,
        url: url || null,
        timestamp: new Date().toISOString()
      };

      const res = await fetch('/api/identity/reputation/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketId,
          evidenceType,
          evidenceData,
          weight
        })
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
        setTitle('');
        setDescription('');
        setUrl('');
        setEvidenceType('');
        setWeight(0.5);
        
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        setError(data.error || 'Failed to submit evidence');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={20} className="text-purple-400" />
        <h3 className="text-lg font-semibold text-slate-100">Submit Evidence</h3>
      </div>

      {/* Current Reputation Score Display */}
      {currentScore !== null && currentBucket !== null && (
        <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className={getScoreColor(currentScore)} />
              <span className="text-xs text-slate-400 font-medium">Current Reputation</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500">Score</div>
                <div className={`text-xl font-bold ${getScoreColor(currentScore)}`}>
                  {Math.round(currentScore)} / 100
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Bucket</div>
                <div className={`text-xl font-bold ${getBucketColor(currentBucket)}`}>
                  {currentBucket}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Evidence Type */}
        <div>
          <label htmlFor="evidence-type" className="block text-xs font-medium text-slate-400 mb-2">
            Evidence Type <span className="text-red-400">*</span>
          </label>
          <select
            id="evidence-type"
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
            aria-label="Evidence Type"
          >
            <option value="">Select type...</option>
            {evidenceTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief title of the evidence..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the evidence..."
            rows={4}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            required
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            URL (optional)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Weight */}
        <div>
          <label htmlFor="evidence-weight" className="block text-xs font-medium text-slate-400 mb-2">
            Weight: {weight.toFixed(2)}
          </label>
          <input
            id="evidence-weight"
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
            className="w-full"
            aria-label="Evidence Weight"
            title="Evidence Weight"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Low Impact</span>
            <span>High Impact</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-md">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/50 rounded-md">
            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            <span className="text-green-400 text-xs">Evidence submitted successfully!</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !evidenceType || !title || !description}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Submitting...
            </>
          ) : (
            <>
              <Send size={16} />
              Submit Evidence
            </>
          )}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">
          Evidence will be recorded on the IC RQH canister and may require verification before affecting your reputation score.
        </p>
      </div>
    </div>
  );
}
