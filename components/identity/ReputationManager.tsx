"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, FileText, AlertCircle } from 'lucide-react';
import { ReputationBadge } from './ReputationBadge';
import { EvidenceSubmissionForm } from './EvidenceSubmissionForm';

interface ReputationManagerProps {
  personaId: string;
}

export function ReputationManager({ personaId }: ReputationManagerProps) {
  const [hasReputation, setHasReputation] = useState<boolean | null>(null);
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkReputationStatus();
  }, [personaId]);

  const checkReputationStatus = async () => {
    if (!personaId) return;
    
    try {
      const response = await fetch(`/api/identity/persona/${personaId}/reputation`);
      const data = await response.json();
      
      if (data.ok) {
        const hasRep = !!data.data?.reputation;
        setHasReputation(hasRep);
        if (hasRep && data.data?.reputation?.id) {
          setBucketId(data.data.reputation.id);
        }
      } else {
        setHasReputation(false);
      }
    } catch (error) {
      console.error('Failed to check reputation status:', error);
      setHasReputation(false);
    }
  };

  const initializeReputation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/identity/persona/${personaId}/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillCategory: 'blockchain_development',
          initialScore: 50
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        setHasReputation(true);
        setBucketId(data.data?.id || null);
        setError(null);
      } else {
        setError(data.error || 'Failed to initialize reputation');
      }
    } catch (error: any) {
      setError(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (hasReputation === null) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-100">Reputation</h3>
          <p className="text-sm text-slate-400">Your current reputation bucket</p>
        </div>
        
        <div className="space-y-4">
          <ReputationBadge partitionId={personaId} refreshKey={refreshKey} />
          
          {hasReputation ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowEvidenceForm(true)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                Submit Evidence
              </button>
              <p className="text-xs text-slate-500 text-center">
                Submit evidence to improve your reputation score
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  <p className="text-sm font-medium text-amber-300">No Reputation Bucket</p>
                </div>
                <p className="text-xs text-amber-200">
                  Initialize your reputation to start building credibility and submit evidence.
                </p>
              </div>
              
              <button
                onClick={initializeReputation}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} />
                {loading ? 'Initializing...' : 'Initialize Reputation'}
              </button>
              
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Evidence Submission Modal */}
      {showEvidenceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-100">Submit Evidence</h3>
              <button
                onClick={() => setShowEvidenceForm(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            {bucketId && (
              <EvidenceSubmissionForm
                bucketId={bucketId}
                onSuccess={() => {
                  setShowEvidenceForm(false);
                  checkReputationStatus(); // Refresh reputation status
                  setRefreshKey(prev => prev + 1); // Trigger badge refresh
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
