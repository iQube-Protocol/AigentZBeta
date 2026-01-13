export default function QubeTalkStudioPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <h1 className="text-3xl font-semibold text-white mb-2">QubeTalk Studio</h1>
          <p className="text-slate-400 mb-6">
            Studio surface for creating delegations, testing agent handoffs, and reviewing outcomes.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Planned Tools</h2>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>Delegation composer</li>
                <li>Channel messages</li>
                <li>Receipt drawer</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Spec Reference</h2>
              <p className="text-sm text-slate-400">
                See `docs/qubetalk/QUBETALK_SPEC_V0.json` and
                `docs/qubetalk/QUBETALK_FIXTURES.json` for the current contract.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
