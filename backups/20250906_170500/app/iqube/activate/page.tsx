"use client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";

export default function Activate() {
  const [iQubeId, setIQubeId] = useState("");
  const [activationType, setActivationType] = useState("Standard");
  const [activationKey, setActivationKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);

  async function handleActivation(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/core/activate-iqube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: iQubeId,
          activationType,
          activationKey: activationKey.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to activate iQube");
      }

      setStatus({
        success: true,
        message: `iQube ${iQubeId} activated successfully!`,
      });
      
      // Reset form on success
      setIQubeId("");
      setActivationKey("");
    } catch (error) {
      console.error("Activation error:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-semibold">Activate iQube</h1>
      <p className="text-slate-300 mb-4">
        Activate an iQube by providing its identifier and activation details.
      </p>

      {status && (
        <div className={`p-4 rounded-xl ${status.success ? "bg-green-500/20 border border-green-500/50 text-green-200" : "bg-red-500/20 border border-red-500/50 text-red-200"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleActivation} className="space-y-4 bg-black/30 p-6 rounded-2xl">
        <Input
          label="iQube Identifier"
          value={iQubeId}
          onChange={(e) => setIQubeId(e.target.value)}
          placeholder="Enter iQube ID"
          required
        />

        <Select
          label="Activation Type"
          options={["Standard", "Premium", "Enterprise"]}
          value={activationType}
          onValueChange={setActivationType}
        />

        <Input
          label="Activation Key (optional)"
          value={activationKey}
          onChange={(e) => setActivationKey(e.target.value)}
          placeholder="Enter activation key if required"
        />

        <div className="pt-2">
          <Button type="submit" disabled={isLoading || !iQubeId.trim()}>
            {isLoading ? "Activating..." : "Activate iQube"}
          </Button>
        </div>
      </form>
    </div>
  );
}
