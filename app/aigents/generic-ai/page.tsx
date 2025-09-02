"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { personas } from "../../data/personas";
import { ContextPanel } from "../../../components/ContextPanel";

export default function GenericAIPage() {
  const searchParams = useSearchParams();
  const iqube = searchParams.get("iqube");
  
  // Use the generic-ai persona as default
  const persona = personas["generic-ai"];
  
  // Optionally handle iQube parameter for context
  useEffect(() => {
    if (iqube) {
      console.log(`iQube parameter detected: ${iqube}`);
      // Here you can add any iQube-specific logic if needed
    }
  }, [iqube]);

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
