"use client";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

interface MetaQubeData {
  identifier: string;
  creator: string;
  ownerType: string;
  contentType: string;
  ownerIdentifiability: string;
  transactionDate: string;
  sensitivity: number;
  verifiable: number;
  accuracy: number;
  risk: number;
  description?: string;
}

interface BlakQubeData {
  profession: string;
  interests: string;
  city: string;
  email: string;
  evmPub: string;
  btcPub: string;
}

export function AddIQuBeForm() {
  // MetaQube fields
  const [meta, setMeta] = useState<MetaQubeData>({
    identifier: "",
    creator: "",
    ownerType: "Individual",
    contentType: "Data",
    ownerIdentifiability: "Identifiable",
    transactionDate: new Date().toISOString().split('T')[0],
    sensitivity: 5,
    verifiable: 7,
    accuracy: 6,
    risk: 4,
    description: "",
  });

  // BlakQube fields
  const [blak, setBlak] = useState<BlakQubeData>({
    profession: "",
    interests: "",
    city: "",
    email: "",
    evmPub: "",
    btcPub: "",
  });

  // TokenQube
  const [tokenId, setTokenId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      // 1) Create in Core (MetaQube + BlakQube)
      const coreRes = await fetch("/api/core/create-iqube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meta, blak }),
      });

      if (!coreRes.ok) {
        throw new Error("Failed to create iQube in Core");
      }

      const core = await coreRes.json();

      // 2) Register with Registry (template/instance linkage)
      const regRes = await fetch("/api/registry/iqube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meta, blak, coreRef: core.ref }),
      });

      if (!regRes.ok) {
        throw new Error("Failed to register iQube in Registry");
      }

      const reg = await regRes.json();

      // 3) (Optional) Mint TokenQube
      if (tokenId) {
        const mintRes = await fetch("/api/core/mint-tokenqube", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tokenId, metaIdentifier: meta.identifier }),
        });

        if (!mintRes.ok) {
          throw new Error("Failed to mint TokenQube");
        }

        const mint = await mintRes.json();
      }

      setStatus({
        success: true,
        message: "iQube created & registered successfully!",
      });

      // Reset form on success
      resetForm();
    } catch (error) {
      console.error("Error creating iQube:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setMeta({
      identifier: "",
      creator: "",
      ownerType: "Individual",
      contentType: "Data",
      ownerIdentifiability: "Identifiable",
      transactionDate: new Date().toISOString().split('T')[0],
      sensitivity: 5,
      verifiable: 7,
      accuracy: 6,
      risk: 4,
      description: "",
    });

    setBlak({
      profession: "",
      interests: "",
      city: "",
      email: "",
      evmPub: "",
      btcPub: "",
    });

    setTokenId("");
  }

  return (
    <div className="space-y-6">
      {status && (
        <div className={`p-4 rounded-xl ${status.success ? "bg-green-500/20 border border-green-500/50 text-green-200" : "bg-red-500/20 border border-red-500/50 text-red-200"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-black/30 p-6 space-y-4">
          <h3 className="text-xl font-semibold">MetaQube</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input 
              label="iQube Identifier" 
              value={meta.identifier} 
              onChange={e => setMeta({...meta, identifier: e.target.value})} 
              required
            />
            <Input 
              label="iQube Creator" 
              value={meta.creator} 
              onChange={e => setMeta({...meta, creator: e.target.value})} 
              required
            />
            <Select 
              label="Owner Type" 
              value={meta.ownerType} 
              onValueChange={v => setMeta({...meta, ownerType: v})} 
              options={["Individual", "Organization", "DAO", "Anonymous"]} 
            />
            <Select 
              label="Content Type" 
              value={meta.contentType} 
              onValueChange={v => setMeta({...meta, contentType: v})} 
              options={["Data", "Content", "Tool", "Model", "Aigent", "Credential"]} 
            />
            <Select 
              label="Owner Identifiability" 
              value={meta.ownerIdentifiability} 
              onValueChange={v => setMeta({...meta, ownerIdentifiability: v})} 
              options={["Identifiable", "Pseudonymous", "Anonymous"]} 
            />
            <Input 
              type="date" 
              label="Transaction Date" 
              value={meta.transactionDate} 
              onChange={e => setMeta({...meta, transactionDate: e.target.value})} 
              required
            />
          </div>

          <Textarea
            label="Description"
            value={meta.description || ""}
            onChange={e => setMeta({...meta, description: e.target.value})}
            placeholder="Describe this iQube..."
            className="min-h-[80px]"
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-300">Sensitivity Score</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.sensitivity} 
                  onChange={e => setMeta({...meta, sensitivity: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-sm">{meta.sensitivity}/10</span>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-300">Verifiable Score</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.verifiable} 
                  onChange={e => setMeta({...meta, verifiable: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-sm">{meta.verifiable}/10</span>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-300">Accuracy Score</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.accuracy} 
                  onChange={e => setMeta({...meta, accuracy: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-sm">{meta.accuracy}/10</span>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-300">Risk Score</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.risk} 
                  onChange={e => setMeta({...meta, risk: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-sm">{meta.risk}/10</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-black/30 p-6 space-y-4">
          <h3 className="text-xl font-semibold">BlakQube</h3>
          <p className="text-slate-400 text-sm">
            This information will be encrypted and only accessible with proper authorization.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input 
              label="Profession" 
              value={blak.profession} 
              onChange={e => setBlak({...blak, profession: e.target.value})} 
            />
            <Input 
              label="Web3 Interests" 
              value={blak.interests} 
              onChange={e => setBlak({...blak, interests: e.target.value})} 
            />
            <Input 
              label="Local City" 
              value={blak.city} 
              onChange={e => setBlak({...blak, city: e.target.value})} 
            />
            <Input 
              type="email" 
              label="Email" 
              value={blak.email} 
              onChange={e => setBlak({...blak, email: e.target.value})} 
            />
            <Input 
              label="EVM Public Key" 
              value={blak.evmPub} 
              onChange={e => setBlak({...blak, evmPub: e.target.value})} 
              placeholder="0x..."
            />
            <Input 
              label="BTC Public Key" 
              value={blak.btcPub} 
              onChange={e => setBlak({...blak, btcPub: e.target.value})} 
            />
          </div>
        </section>

        <section className="rounded-2xl bg-black/30 p-6 space-y-4 lg:col-span-2">
          <h3 className="text-xl font-semibold">TokenQube Operations</h3>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <Input 
              label="Token ID (optional)" 
              value={tokenId} 
              onChange={e => setTokenId(e.target.value)} 
              placeholder="Leave blank for auto-generation"
            />
            <Button type="submit" disabled={isLoading || !meta.identifier || !meta.creator}>
              {isLoading ? "Creating..." : "Create & Register"}
            </Button>
          </div>
          <p className="text-slate-400 text-sm">
            When Token ID is supplied, a mint request will be sent after creation & registry add.
          </p>
        </section>
      </form>
    </div>
  );
}
