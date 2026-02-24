/**
 * X402 Dashboard Component
 * 
 * Payment settlements and X402 management
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, ArrowRight, CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";

interface Claim {
  id: string;
  status: 'pending' | 'settled' | 'redeemed' | 'expired';
  amount: number;
  asset: string;
  settlementType: 'remote_custody' | 'deferred_minting' | 'canonical_minting';
  createdAt: string;
  expiresAt?: string;
}

export function X402Dashboard() {
  const [claims, setClaims] = useState<Claim[]>([
    {
      id: '1',
      status: 'settled',
      amount: 1000,
      asset: 'Q¢',
      settlementType: 'remote_custody',
      createdAt: '2024-01-23T10:30:00Z',
    },
    {
      id: '2',
      status: 'pending',
      amount: 500,
      asset: 'Q¢',
      settlementType: 'deferred_minting',
      createdAt: '2024-01-23T14:15:00Z',
      expiresAt: '2024-01-23T20:15:00Z',
    },
    {
      id: '3',
      status: 'redeemed',
      amount: 750,
      asset: 'Q¢',
      settlementType: 'canonical_minting',
      createdAt: '2024-01-22T09:00:00Z',
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [newClaim, setNewClaim] = useState({
    amount: '',
    asset: 'Q¢',
    settlementType: 'remote_custody' as const,
  });

  const getStatusColor = (status: Claim['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'settled': return 'bg-green-500';
      case 'redeemed': return 'bg-blue-500';
      case 'expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: Claim['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'settled': return <CheckCircle className="h-4 w-4" />;
      case 'redeemed': return <CheckCircle className="h-4 w-4" />;
      case 'expired': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getSettlementTypeLabel = (type: Claim['settlementType']) => {
    switch (type) {
      case 'remote_custody': return 'Remote Custody';
      case 'deferred_minting': return 'Deferred Minting';
      case 'canonical_minting': return 'Canonical Minting';
      default: return type;
    }
  };

  const handleCreateClaim = () => {
    if (!newClaim.amount || parseFloat(newClaim.amount) <= 0) return;

    const claim: Claim = {
      id: Date.now().toString(),
      status: 'pending',
      amount: parseFloat(newClaim.amount),
      asset: newClaim.asset,
      settlementType: newClaim.settlementType,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
    };

    setClaims([claim, ...claims]);
    setNewClaim({
      amount: '',
      asset: 'Q¢',
      settlementType: 'remote_custody',
    });
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                X402 Settlements
              </CardTitle>
              <CardDescription>
                Payment settlements with remote custody, deferred minting, and canonical minting
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Claim
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Create Claim Form */}
      {isCreating && (
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle>Create New Claim</CardTitle>
            <CardDescription>
              Create a new X402 payment settlement claim
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={newClaim.amount}
                  onChange={(e) => setNewClaim({...newClaim, amount: e.target.value})}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label htmlFor="asset">Asset</Label>
                <Select value={newClaim.asset} onValueChange={(value) => setNewClaim({...newClaim, asset: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q¢">Q¢ (QriptoCENT)</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="settlementType">Settlement Type</Label>
                <Select 
                  value={newClaim.settlementType} 
                  onValueChange={(value: any) => setNewClaim({...newClaim, settlementType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote_custody">Remote Custody</SelectItem>
                    <SelectItem value="deferred_minting">Deferred Minting</SelectItem>
                    <SelectItem value="canonical_minting">Canonical Minting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateClaim}>
                Create Claim
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claims List */}
      <div className="space-y-4">
        {claims.map((claim) => (
          <Card key={claim.id} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(claim.status)}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(claim.status)}
                      <span className="font-medium">
                        {claim.amount} {claim.asset}
                      </span>
                      <Badge variant="outline">
                        {getSettlementTypeLabel(claim.settlementType)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(claim.createdAt).toLocaleString()}
                      {claim.expiresAt && ` • Expires ${new Date(claim.expiresAt).toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={claim.status === 'pending' ? 'default' : 'secondary'}>
                    {claim.status}
                  </Badge>
                  {claim.status === 'settled' && (
                    <Button variant="outline" size="sm">
                      Redeem
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settlement Types Info */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="text-lg">Settlement Types</CardTitle>
          <CardDescription>
            Understanding the different X402 settlement mechanisms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Remote Custody</h4>
              <p className="text-sm text-muted-foreground">
                Funds held in secure escrow until conditions are met. Ideal for high-value transactions.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Deferred Minting</h4>
              <p className="text-sm text-muted-foreground">
                Tokens minted on-demand when settlement conditions are satisfied. Gas-efficient approach.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Canonical Minting</h4>
              <p className="text-sm text-muted-foreground">
                Immediate token minting with standard blockchain settlement. Full on-chain transparency.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
