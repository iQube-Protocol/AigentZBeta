import { useState, useEffect } from 'react';
import { BUILD } from '@/config/build';

export default function DebugPage() {
  const [diagData, setDiagData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiag = async () => {
      try {
        const apiUrl = BUILD.api;
        console.log('[Debug] Fetching diag from:', apiUrl);
        
        if (!apiUrl || apiUrl === '(missing)') {
          throw new Error('API URL is missing or invalid');
        }
        
        const response = await fetch(`${apiUrl}/api/_diag`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setDiagData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiag();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Deployment Truth Probe</h1>
      
      <div className="space-y-8">
        {/* Frontend Build Info */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Frontend Build Info</h2>
          <div className="font-mono text-sm space-y-2">
            <div><span className="text-gray-400">BUILD.sha:</span> {BUILD.sha}</div>
            <div><span className="text-gray-400">BUILD.api:</span> {BUILD.api}</div>
            <div><span className="text-gray-400">Current URL:</span> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
          </div>
        </div>

        {/* Backend Diagnostics */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Backend Diagnostics</h2>
          {loading && <div>Loading...</div>}
          {error && (
            <div className="bg-red-900/50 p-4 rounded mb-4">
              <div className="text-red-300">Error: {error}</div>
            </div>
          )}
          {diagData && (
            <pre className="font-mono text-xs bg-black/50 p-4 rounded overflow-auto">
              {JSON.stringify(diagData, null, 2)}
            </pre>
          )}
        </div>

        {/* Quick Checks */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">Quick Checks</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Frontend API URL:</span>
              <span className={BUILD.api && BUILD.api !== '(missing)' ? 'text-green-400' : 'text-red-400'}>
                {BUILD.api || '(MISSING)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Backend reachable:</span>
              <span className={!error ? 'text-green-400' : 'text-red-400'}>
                {!error ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Supabase host:</span>
              <span className={diagData?.supabase?.urlHost ? 'text-green-400' : 'text-red-400'}>
                {diagData?.supabase?.urlHost || 'NOT FOUND'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
