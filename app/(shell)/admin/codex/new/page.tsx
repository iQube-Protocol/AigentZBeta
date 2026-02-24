'use client';

import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function NewCodexPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Create Codex</h1>
            <p className="mt-2 text-slate-400">Create a new codex definition for the admin registry.</p>
          </div>
          <Link
            href="/admin/codex"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-6">
          <div className="inline-flex items-center gap-2 rounded-md bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
            <Plus className="h-3.5 w-3.5" />
            Scaffold
          </div>
          <p className="mt-4 text-sm text-slate-300">
            The dedicated create flow is now routed correctly at <code>/admin/codex/new</code>.
            If you want, I can implement a full create form next (name, slug, owner, metadata, permissions, tabs)
            and wire it to a POST admin endpoint.
          </p>
        </div>
      </div>
    </div>
  );
}
