import { notFound } from "next/navigation";
import { personas } from "../../data/personas";
import { ContextPanel } from "../../../components/ContextPanel";

export default function AgentPage({ params }: { params: { agentKey: string } }) {
  const persona = personas[params.agentKey as keyof typeof personas];
  
  if (!persona) {
    return notFound();
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{persona.title}</h1>
      <p className="text-slate-300 mb-4">
        Interact with the {persona.title} persona through the Context Transformation panel below.
      </p>
      <ContextPanel persona={persona} />
    </div>
  );
}
