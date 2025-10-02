"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import Select from "../ui/select";
import { Textarea } from "../ui/Textarea";
import { useToast } from "../ui/Toaster";
import { DotsInline } from "./scoreUtils";

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
  const router = useRouter();
  const { toast } = useToast();
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
  const [businessModel, setBusinessModel] = useState<
    'Buy' | 'Sell' | 'Rent' | 'Lease' | 'Subscribe' | 'Stake' | 'License' | 'Donate' | ''
  >('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message: string } | null>(null);
  const [price, setPrice] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      // Lightweight validation
      const errors: string[] = [];
      if (!meta.identifier && !meta.creator) errors.push('Please provide an Identifier or Creator.');
      const scores = [
        { k: 'Sensitivity', v: meta.sensitivity },
        { k: 'Accuracy', v: meta.accuracy },
        { k: 'Verifiability', v: meta.verifiable },
        { k: 'Risk', v: meta.risk },
      ];
      scores.forEach(s => {
        if (Number.isNaN(Number(s.v)) || Number(s.v) < 0 || Number(s.v) > 10) {
          errors.push(`${s.k} must be between 0 and 10.`);
        }
      });
      if (price !== "") {
        const pv = Number(price);
        if (Number.isNaN(pv) || pv < 0) errors.push('Price must be a non-negative number.');
      }
      if (errors.length) {
        setStatus({ success: false, message: errors.join(' ') });
        setIsLoading(false);
        return;
      }
      // Map form fields to Registry Template payload
      const iQubeTypeMap: Record<string, any> = {
        Data: 'DataQube',
        Content: 'ContentQube',
        Tool: 'ToolQube',
        Model: 'ModelQube',
        Aigent: 'AigentQube',
        Credential: 'ToolQube', // closest match in current enum
      };
      const payload = {
        name: meta.identifier || `${meta.creator || 'Untitled'} iQube`,
        description: meta.description || '',
        iQubeType: iQubeTypeMap[meta.contentType] || 'DataQube',
        iQubeInstanceType: 'template' as const,
        businessModel: businessModel || undefined,
        price: price === "" ? undefined : Number(price),
        sensitivityScore: Number(meta.sensitivity) || 0,
        accuracyScore: Number(meta.accuracy) || 0,
        verifiabilityScore: Number(meta.verifiable) || 0,
        riskScore: Number(meta.risk) || 0,
      };

      const res = await fetch('/api/registry/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const created = await res.json();
      if (!res.ok) {
        throw new Error(created?.error || 'Failed to create template');
      }

      setStatus({
        success: true,
        message: "Template created successfully. Redirecting…",
      });
      toast('Template created successfully', 'success');

      // Reset form on success
      resetForm();

      // Redirect to registry and let the list fetch include the new item
      setTimeout(() => router.push('/registry'), 400);
    } catch (error) {
      console.error("Error creating iQube:", error);
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      });
      toast(error instanceof Error ? error.message : 'Failed to create template', 'error');
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
          {/* Live Preview */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30" title="iQube Type">
                {(meta.contentType || 'Data') + 'Qube'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30" title="Instance">
                Template
              </span>
              {businessModel ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" title="Business Model">
                  {businessModel}
                </span>
              ) : null}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30" title="Provenance depth (fork generations from origin)">
                Prov 0
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-300">
              <div className="flex flex-col items-center" title="Sensitivity">
                <span>Sensitivity</span>
                <DotsInline value={Number(meta.sensitivity) || 0} kind='sensitivity' title="Sensitivity" />
              </div>
              <div className="flex flex-col items-center" title="Accuracy">
                <span>Accuracy</span>
                <DotsInline value={Number(meta.accuracy) || 0} kind='accuracy' title="Accuracy" />
              </div>
              <div className="flex flex-col items-center" title="Verifiability">
                <span>Verifiability</span>
                <DotsInline value={Number(meta.verifiable) || 0} kind='verifiability' title="Verifiability" />
              </div>
              <div className="flex flex-col items-center" title="Risk">
                <span>Risk</span>
                <DotsInline value={Number(meta.risk) || 0} kind='risk' title="Risk" />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input 
              label="iQube Identifier" 
              value={meta.identifier} 
              onChange={e => setMeta({...meta, identifier: e.target.value})} 
              placeholder="Enter identifier"
              title="iQube Identifier"
              aria-label="iQube Identifier"
              required
            />
            <Input 
              label="iQube Creator" 
              value={meta.creator} 
              onChange={e => setMeta({...meta, creator: e.target.value})} 
              placeholder="Creator ID"
              title="iQube Creator"
              aria-label="iQube Creator"
              required
            />
            <Select 
              label="Owner Type" 
              value={meta.ownerType} 
              onValueChange={v => setMeta({...meta, ownerType: v})} 
              options={["Individual", "Organization", "DAO", "Anonymous"]} 
              title="Owner Type"
              aria-label="Owner Type"
            />
            <Select 
              label="Content Type" 
              value={meta.contentType} 
              onValueChange={v => setMeta({...meta, contentType: v})} 
              options={["Data", "Content", "Tool", "Model", "Aigent", "Credential"]} 
              title="Content Type"
              aria-label="Content Type"
            />
            <Select 
              label="Owner Identifiability" 
              value={meta.ownerIdentifiability} 
              onValueChange={v => setMeta({...meta, ownerIdentifiability: v})} 
              options={["Identifiable", "Pseudonymous", "Anonymous"]} 
              title="Owner Identifiability"
              aria-label="Owner Identifiability"
            />
            <Select 
              label="Business Model" 
              value={businessModel}
              onValueChange={(v: any) => setBusinessModel(v)}
              options={["Buy", "Sell", "Rent", "Lease", "Subscribe", "Stake", "License", "Donate"]}
              title="Business Model"
              aria-label="Business Model"
            />
            <Input 
              label="Price"
              type="number"
              placeholder="0.00"
              value={price}
              onChange={e => setPrice(e.target.value)}
              min={0}
              step="0.01"
              title="Price"
              aria-label="Price"
            />
            <Input 
              type="date" 
              label="Transaction Date" 
              value={meta.transactionDate} 
              onChange={e => setMeta({...meta, transactionDate: e.target.value})} 
              title="Transaction Date"
              aria-label="Transaction Date"
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
              <label htmlFor="sensitivityRange" className="block text-sm mb-1 text-slate-300">Sensitivity Score</label>
              <div className="flex items-center gap-2">
                <input 
                  id="sensitivityRange"
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.sensitivity} 
                  onChange={e => setMeta({...meta, sensitivity: Number(e.target.value)})}
                  className="w-full"
                  title="Sensitivity Score"
                  aria-label="Sensitivity Score"
                />
                <span className="text-sm">{meta.sensitivity}/10</span>
              </div>
            </div>
            <div>
              <label htmlFor="verifiableRange" className="block text-sm mb-1 text-slate-300">Verifiable Score</label>
              <div className="flex items-center gap-2">
                <input 
                  id="verifiableRange"
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.verifiable} 
                  onChange={e => setMeta({...meta, verifiable: Number(e.target.value)})}
                  className="w-full"
                  title="Verifiable Score"
                  aria-label="Verifiable Score"
                />
                <span className="text-sm">{meta.verifiable}/10</span>
              </div>
            </div>
            <div>
              <label htmlFor="accuracyRange" className="block text-sm mb-1 text-slate-300">Accuracy Score</label>
              <div className="flex items-center gap-2">
                <input 
                  id="accuracyRange"
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.accuracy} 
                  onChange={e => setMeta({...meta, accuracy: Number(e.target.value)})}
                  className="w-full"
                  title="Accuracy Score"
                  aria-label="Accuracy Score"
                />
                <span className="text-sm">{meta.accuracy}/10</span>
              </div>
            </div>
            <div>
              <label htmlFor="riskRange" className="block text-sm mb-1 text-slate-300">Risk Score</label>
              <div className="flex items-center gap-2">
                <input 
                  id="riskRange"
                  type="range" 
                  min="1" 
                  max="10" 
                  value={meta.risk} 
                  onChange={e => setMeta({...meta, risk: Number(e.target.value)})}
                  className="w-full"
                  title="Risk Score"
                  aria-label="Risk Score"
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
