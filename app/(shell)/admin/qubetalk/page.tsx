export default function QubeTalkAdminPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <h1 className="text-3xl font-semibold text-white mb-2">QubeTalk Admin</h1>
          <p className="text-slate-400 mb-6">
            Admin surface for cross-agent delegation oversight, receipts, and audit trails.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Planned Views</h2>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>Channel monitor</li>
                <li>Delegation queue</li>
                <li>Receipt/audit explorer</li>
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
