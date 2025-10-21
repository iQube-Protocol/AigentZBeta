"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Send, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface EvidenceSubmissionFormProps {
  bucketId?: string;
  partitionId: string;
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

const skillCategories = [
  { value: 'blockchain_development', label: 'Blockchain Development' },
  { value: 'smart_contract_security', label: 'Smart Contract Security' },
  { value: 'defi_protocols', label: 'DeFi Protocols' },
  { value: 'web3_frontend', label: 'Web3 Frontend' },
  { value: 'backend_development', label: 'Backend Development' },
  { value: 'devops_infrastructure', label: 'DevOps & Infrastructure' },
  { value: 'data_analysis', label: 'Data Analysis' },
  { value: 'community_management', label: 'Community Management' },
  { value: 'technical_writing', label: 'Technical Writing' },
  { value: 'other', label: 'Other' }
];

export function EvidenceSubmissionForm({ bucketId, partitionId, onSuccess }: EvidenceSubmissionFormProps) {
  const [skillCategory, setSkillCategory] = useState('');
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
  const [availableBuckets, setAvailableBuckets] = useState<any[]>([]);

  useEffect(() => {
    if (!partitionId) return;
    // Fetch all reputation buckets for this persona
    fetch(`/api/identity/persona/${partitionId}/reputation/all`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) {
          setAvailableBuckets(data.data);
          // Set default to first bucket if no bucketId provided
          if (!bucketId && data.data.length > 0) {
            setSkillCategory(data.data[0].skill_category);
            setCurrentScore(data.data[0].score);
            setCurrentBucket(data.data[0].bucket);
          } else if (bucketId) {
            const bucket = data.data.find((b: any) => b.id === bucketId);
            if (bucket) {
              setSkillCategory(bucket.skill_category);
              setCurrentScore(bucket.score);
              setCurrentBucket(bucket.bucket);
            }
          }
        }
      })
      .catch(() => {});
  }, [partitionId, bucketId]);

  // Update current score when skill category changes
  useEffect(() => {
    if (skillCategory && availableBuckets.length > 0) {
      const bucket = availableBuckets.find(b => b.skill_category === skillCategory);
      if (bucket) {
        setCurrentScore(bucket.score);
        setCurrentBucket(bucket.bucket);
      } else {
        setCurrentScore(0);
        setCurrentBucket(0);
      }
    }
  }, [skillCategory, availableBuckets]);

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
    
    if (!skillCategory || !evidenceType || !title || !description) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Find or create bucket for this skill category
      let targetBucketId = bucketId;
      const existingBucket = availableBuckets.find(b => b.skill_category === skillCategory);
      
      if (existingBucket) {
        targetBucketId = existingBucket.id;
      } else {
        // Create new bucket for this skill category
        const createRes = await fetch('/api/identity/reputation/bucket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partitionId,
            skillCategory,
            initialScore: 0
          })
        });
        
        const createData = await createRes.json();
        if (!createData.ok) {
          setError('Failed to create reputation bucket');
          setLoading(false);
          return;
        }
        
        targetBucketId = createData.data.id;
      }

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
          bucketId: targetBucketId,
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
        // Don't reset skill category - keep it selected for next submission
        
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
    <div className="p-6">
      {/* Domain Selector & Current Reputation */}
      <div className="mb-6 space-y-3">
        {/* Domain Selector */}
        <div>
          <label htmlFor="domain-selector" className="block text-xs font-medium text-slate-400 mb-2">
            Select Domain
          </label>
          <select
            id="domain-selector"
            value={skillCategory}
            onChange={(e) => setSkillCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Select reputation domain"
          >
            <option value="">Select a domain...</option>
            {skillCategories.map(cat => {
              const existingBucket = availableBuckets.find(b => b.skill_category === cat.value);
              return (
                <option key={cat.value} value={cat.value}>
                  {cat.label} {existingBucket ? `(Score: ${Math.round(existingBucket.score)})` : '(New)'}
                </option>
              );
            })}
          </select>
        </div>

        {/* Current Reputation Score Display */}
        {currentScore !== null && currentBucket !== null && skillCategory && (
          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className={getScoreColor(currentScore)} />
                  <span className="text-xs text-slate-400 font-medium">
                    {skillCategories.find(c => c.value === skillCategory)?.label || skillCategory.replace(/_/g, ' ')}
                  </span>
                </div>
                {availableBuckets.find(b => b.skill_category === skillCategory) ? (
                  <span className="text-xs text-emerald-400">✓ Existing</span>
                ) : (
                  <span className="text-xs text-yellow-400">⚠ New Domain</span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-slate-500">Score</div>
                  <div className={`text-2xl font-bold ${getScoreColor(currentScore)}`}>
                    {Math.round(currentScore)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Bucket</div>
                  <div className={`text-2xl font-bold ${getBucketColor(currentBucket)}`}>
                    {currentBucket}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Evidence</div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {availableBuckets.find(b => b.skill_category === skillCategory)?.evidence_count || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
