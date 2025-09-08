"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { personas } from "../../data/personas";
import { ContextPanel } from "../../../components/ContextPanel";

function GenericAIContent() {
  const searchParams = useSearchParams();
  const iqube = searchParams?.get("iqube");
  
  // Map iQube parameters to persona keys
  const iqubeToPersona: Record<string, keyof typeof personas> = {
    "qrypto": "aigent-z",
    "knyt": "aigent-kn0w1",
    "metaMe": "metaMe"
  };
  
  // Determine which persona to use based on iQube parameter
  const personaKey = iqube && iqubeToPersona[iqube] ? iqubeToPersona[iqube] : "aigent-z";
  const persona = personas[personaKey];
  
  // Log the detected iQube and selected persona
  useEffect(() => {
    if (iqube) {
      console.log(`iQube parameter detected: ${iqube}, using persona: ${personaKey}`);
    }
  }, [iqube, personaKey]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{persona.title}</h1>
      <p className="text-slate-300 mb-4">
        {iqube ? 
          `Interact with ${persona.title} with ${iqube} iQube integration.` : 
          `Interact with ${persona.title} through the Context Transformation panel below.`
        }
      </p>
      <ContextPanel persona={persona} />
    </div>
  );
}

export default function GenericAIPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GenericAIContent />
    </Suspense>
  );
}
