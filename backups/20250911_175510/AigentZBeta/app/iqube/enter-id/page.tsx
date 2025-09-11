"use client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

export default function EnterId() {
  const [id, setId] = useState("");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!id.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/core/metaqube?id=${encodeURIComponent(id)}`);
      
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      
      const responseData = await res.json();
      setData(responseData);
    } catch (err) {
      console.error("Error looking up iQube:", err);
      setError("Failed to lookup iQube. Please try again.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-semibold">Enter iQube ID</h1>
      <p className="text-slate-300 mb-4">
        Enter an iQube identifier to view its metadata and details.
      </p>
      
      <div className="flex gap-3">
        <Input 
          value={id} 
          onChange={e => setId(e.target.value)} 
          placeholder="iQube Identifier" 
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <Button onClick={lookup} disabled={isLoading || !id.trim()}>
          {isLoading ? "Loading..." : "Lookup"}
        </Button>
      </div>
      
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
          {error}
        </div>
      )}
      
      {data && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium">iQube Details</h2>
          <div className="bg-black/40 p-4 rounded-xl overflow-auto">
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
