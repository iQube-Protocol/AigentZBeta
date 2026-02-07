import Link from "next/link";
import { personas } from "../data/personas";

export default function AigentsIndex() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Aigents</h1>
      <p className="text-slate-300 mb-4">Select an agent persona to start a Context Transformation session.</p>
      
      <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(personas).map(agent => (
          <li key={agent.key} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
            <Link href={`/aigents/${agent.key}`} className="block">
              <h2 className="text-xl font-medium mb-2">{agent.title}</h2>
              <p className="text-slate-300 text-sm line-clamp-2">{agent.systemPrompt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
