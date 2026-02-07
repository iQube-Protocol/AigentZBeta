"use client";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";

export default function DecryptQube() {
  const [iQubeId, setIQubeId] = useState("");
  const [decryptionKey, setDecryptionKey] = useState("");
  const [justification, setJustification] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);
  const [decryptedData, setDecryptedData] = useState<any>(null);

  async function handleDecryptionRequest(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);
    setDecryptedData(null);

    try {
      const response = await fetch("/api/core/decrypt-blakqube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: iQubeId,
          decryptionKey,
          justification,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to decrypt BlakQube");
      }

      setStatus({
        success: true,
        message: "BlakQube decrypted successfully!",
      });
      
      setDecryptedData(data.decryptedData);
    } catch (error) {
      console.error("Decryption error:", error);
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
      <h1 className="text-3xl font-semibold">Decrypt BlakQube</h1>
      <p className="text-slate-300 mb-4">
        Request decryption of a BlakQube's private data by providing the necessary credentials and justification.
      </p>

      {status && (
        <div className={`p-4 rounded-xl ${status.success ? "bg-green-500/20 border border-green-500/50 text-green-200" : "bg-red-500/20 border border-red-500/50 text-red-200"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleDecryptionRequest} className="space-y-4 bg-black/30 p-6 rounded-2xl">
        <Input
          label="iQube Identifier"
          value={iQubeId}
          onChange={(e) => setIQubeId(e.target.value)}
          placeholder="Enter iQube ID"
          required
        />

        <Input
          label="Decryption Key"
          value={decryptionKey}
          onChange={(e) => setDecryptionKey(e.target.value)}
          placeholder="Enter your decryption key"
          type="password"
          required
        />

        <Textarea
          label="Justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Explain why you need access to this private data"
          required
          className="min-h-[100px]"
        />

        <div className="pt-2">
          <Button type="submit" disabled={isLoading || !iQubeId.trim() || !decryptionKey.trim() || !justification.trim()}>
            {isLoading ? "Processing..." : "Request Decryption"}
          </Button>
        </div>
      </form>

      {decryptedData && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Decrypted BlakQube Data</h2>
          <div className="bg-black/40 p-4 rounded-xl overflow-auto">
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(decryptedData, null, 2)}</pre>
          </div>
          <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 p-4 rounded-xl">
            <p className="text-sm">
              <strong>Security Notice:</strong> This decryption event has been logged and will be audited.
              The data shown is sensitive and should be handled according to your organization's security policies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
