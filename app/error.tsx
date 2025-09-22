"use client";

import React from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 24, color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8' }}>{error?.message}</pre>
      {error?.digest && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Digest: {error.digest}</p>
      )}
      <button
        onClick={() => reset()}
        style={{
          marginTop: 16,
          padding: '6px 12px',
          background: 'rgba(59,130,246,0.2)',
          border: '1px solid rgba(59,130,246,0.3)',
          color: '#bfdbfe',
          borderRadius: 6,
        }}
      >
        Try again
      </button>
    </div>
  );
}
