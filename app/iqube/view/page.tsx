"use client";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

interface IQubeData {
  id: string;
  meta: {
    ownerType: string;
    contentType: string;
    sensitivity?: number;
    verifiable?: number;
    accuracy?: number;
    risk?: number;
    creator?: string;
    transactionDate?: string;
    [key: string]: any;
  };
  blak?: {
    [key: string]: any;
  };
  token?: {
    id: string;
    status: string;
    [key: string]: any;
  };
}

export default function ViewQube() {
  const [iQubeId, setIQubeId] = useState("");
  const [data, setData] = useState<IQubeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchIQubeData() {
    if (!iQubeId.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/core/view-iqube?id=${encodeURIComponent(iQubeId)}`);
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      
      const responseData = await res.json();
      setData(responseData);
    } catch (err) {
      console.error("Error fetching iQube data:", err);
      setError("Failed to fetch iQube data. Please check the ID and try again.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-semibold">View iQube</h1>
      <p className="text-slate-300 mb-4">
        View detailed information about an iQube including its MetaQube, BlakQube, and TokenQube components.
      </p>
      
      <div className="flex gap-3">
        <Input 
          value={iQubeId} 
          onChange={e => setIQubeId(e.target.value)} 
          placeholder="Enter iQube ID" 
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && fetchIQubeData()}
        />
        <Button onClick={fetchIQubeData} disabled={isLoading || !iQubeId.trim()}>
          {isLoading ? "Loading..." : "View"}
        </Button>
      </div>
      
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
          {error}
        </div>
      )}
      
      {data && (
        <div className="space-y-6">
          <div className="bg-black/30 p-6 rounded-2xl">
            <h2 className="text-xl font-medium mb-4">MetaQube</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">ID</p>
                <p>{data.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Owner Type</p>
                <p>{data.meta.ownerType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Content Type</p>
                <p>{data.meta.contentType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Creator</p>
                <p>{data.meta.creator || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Transaction Date</p>
                <p>{data.meta.transactionDate || "N/A"}</p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Sensitivity</p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(data.meta.sensitivity || 0) * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs">{data.meta.sensitivity || 0}/10</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Verifiable</p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500" 
                    style={{ width: `${(data.meta.verifiable || 0) * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs">{data.meta.verifiable || 0}/10</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Accuracy</p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500" 
                    style={{ width: `${(data.meta.accuracy || 0) * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs">{data.meta.accuracy || 0}/10</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-sm">Risk</p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500" 
                    style={{ width: `${(data.meta.risk || 0) * 10}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs">{data.meta.risk || 0}/10</p>
              </div>
            </div>
          </div>
          
          {data.blak && (
            <div className="bg-black/30 p-6 rounded-2xl">
              <h2 className="text-xl font-medium mb-4">BlakQube</h2>
              <p className="text-slate-300 mb-2">Private data (requires authorization)</p>
              <Button variant="outline" size="sm">Request Access</Button>
            </div>
          )}
          
          {data.token && (
            <div className="bg-black/30 p-6 rounded-2xl">
              <h2 className="text-xl font-medium mb-4">TokenQube</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-slate-400 text-sm">Token ID</p>
                  <p>{data.token.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-sm">Status</p>
                  <p>{data.token.status}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
