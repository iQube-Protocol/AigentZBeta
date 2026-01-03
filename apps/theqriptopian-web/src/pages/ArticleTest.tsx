/**
 * Minimal Article Test Page - No external dependencies
 */

console.log('[ArticleTest] Module loading');

import { useEffect } from 'react';

export default function ArticleTest() {
  console.log('[ArticleTest] Component rendering');
  
  useEffect(() => {
    console.log('[ArticleTest] useEffect running');
    console.log('[ArticleTest] URL:', window.location.href);
    console.log('[ArticleTest] Search params:', window.location.search);
  }, []);

  return (
    <div className="min-h-screen bg-[#050f1f] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-[#071327] border border-[#1e2b40] rounded-lg p-8">
        <h1 className="text-3xl font-bold text-white mb-4">Article Test Page</h1>
        <p className="text-gray-300 mb-4">
          This is a minimal test page to verify routing works.
        </p>
        <div className="bg-[#0a1628] p-4 rounded border border-cyan-500/20">
          <p className="text-cyan-400 font-mono text-sm">
            URL: {window.location.href}
          </p>
          <p className="text-cyan-400 font-mono text-sm mt-2">
            Params: {window.location.search}
          </p>
        </div>
      </div>
    </div>
  );
}
