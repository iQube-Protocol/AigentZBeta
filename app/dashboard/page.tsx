export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-slate-300">Welcome to Aigent Z. Use the left menu to navigate between Aigents, iQube Operations, and the Registry.</p>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
          <h2 className="text-xl font-medium mb-2">Aigents</h2>
          <p className="text-slate-300 text-sm">Access Context Transformation with 5 specialized personas</p>
        </div>
        
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
          <h2 className="text-xl font-medium mb-2">iQube Operations</h2>
          <p className="text-slate-300 text-sm">Manage iQubes: Enter ID, Activate, View, Decrypt, and Mint</p>
        </div>
        
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
          <h2 className="text-xl font-medium mb-2">Registry</h2>
          <p className="text-slate-300 text-sm">Browse, add, and analyze iQubes in the registry</p>
        </div>
      </div>
    </div>
  );
}
