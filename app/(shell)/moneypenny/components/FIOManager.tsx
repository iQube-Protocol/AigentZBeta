/**
 * FIO Manager Component
 * 
 * FIO handle management and crypto address resolution
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, CheckCircle, AlertCircle, Plus, ExternalLink } from "lucide-react";

interface FIOHandle {
  fioAddress: string;
  personaId?: string;
  walletAddresses: Array<{
    chain: string;
    address: string;
    verified: boolean;
  }>;
  createdAt: string;
  expiresAt?: string;
}

export function FIOManager() {
  const [handles, setHandles] = useState<FIOHandle[]>([
    {
      fioAddress: 'moneypenny@aigent',
      personaId: 'persona-123',
      walletAddresses: [
        { chain: 'ETH', address: '0x8D286CcECf7B838172A45c26a11F019C4303E742', verified: true },
        { chain: 'BTC', address: 'tb1qc27aa6a09634b15167ab91c25b5b1c8bbb09f7', verified: true },
        { chain: 'SOL', address: '5yznife7x22rrJ9w7Kg41rcH1CHXnBYvBBW9nHeG7W4j', verified: true },
      ],
      createdAt: '2024-01-20T10:00:00Z',
    },
    {
      fioAddress: 'trading@qripto',
      walletAddresses: [
        { chain: 'ETH', address: '0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844', verified: true },
        { chain: 'ARB', address: '0x875E825E0341b330065152ddaE37CBb843FC8D84', verified: false },
      ],
      createdAt: '2024-01-22T14:30:00Z',
      expiresAt: '2025-01-22T14:30:00Z',
    },
  ]);

  const [isRegistering, setIsRegistering] = useState(false);
  const [newHandle, setNewHandle] = useState({
    handle: '',
    domain: 'aigent',
  });

  const [resolvingAddress, setResolvingAddress] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<FIOHandle | null>(null);

  const handleRegister = () => {
    if (!newHandle.handle.trim()) return;

    const fioAddress = `${newHandle.handle}@${newHandle.domain}`;
    const handle: FIOHandle = {
      fioAddress,
      walletAddresses: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };

    setHandles([handle, ...handles]);
    setNewHandle({ handle: '', domain: 'aigent' });
    setIsRegistering(false);
  };

  const handleResolve = () => {
    if (!resolvingAddress.trim()) return;

    const found = handles.find(h => h.fioAddress.toLowerCase() === resolvingAddress.toLowerCase());
    setResolvedAddress(found || null);
  };

  const getChainIcon = (chain: string) => {
    switch (chain.toLowerCase()) {
      case 'eth': return '🔷';
      case 'btc': return '🟧';
      case 'sol': return '🟣';
      case 'arb': return '🔵';
      case 'polygon': return '🟣';
      case 'base': return '🔵';
      default: return '⚪';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-500" />
                FIO Manager
              </CardTitle>
              <CardDescription>
                FIO handle management and crypto address resolution
              </CardDescription>
            </div>
            <Button onClick={() => setIsRegistering(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register Handle
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Register Handle Form */}
      {isRegistering && (
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle>Register New FIO Handle</CardTitle>
            <CardDescription>
              Create a new human-readable crypto address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="handle">Handle Name</Label>
                <Input
                  id="handle"
                  value={newHandle.handle}
                  onChange={(e) => setNewHandle({...newHandle, handle: e.target.value})}
                  placeholder="Enter handle name"
                />
              </div>
              <div>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={newHandle.domain}
                  onChange={(e) => setNewHandle({...newHandle, domain: e.target.value})}
                  placeholder="Enter domain"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsRegistering(false)}>
                Cancel
              </Button>
              <Button onClick={handleRegister}>
                Register Handle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address Resolver */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="text-lg">Resolve FIO Address</CardTitle>
          <CardDescription>
            Look up crypto addresses for any FIO handle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={resolvingAddress}
              onChange={(e) => setResolvingAddress(e.target.value)}
              placeholder="Enter FIO address (e.g., user@domain)"
            />
            <Button onClick={handleResolve}>
              Resolve
            </Button>
          </div>

          {resolvedAddress && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{resolvedAddress.fioAddress}</span>
                  </div>
                  {resolvedAddress.walletAddresses.length > 0 ? (
                    <div className="space-y-2">
                      {resolvedAddress.walletAddresses.map((wallet, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center gap-2">
                            <span>{getChainIcon(wallet.chain)}</span>
                            <span className="text-sm">{wallet.chain}</span>
                            {wallet.verified && (
                              <Badge variant="secondary" className="text-xs">Verified</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {formatAddress(wallet.address)}
                            </code>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No wallet addresses registered for this handle
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Registered Handles */}
      <div className="space-y-4">
        {handles.map((handle) => (
          <Card key={handle.fioAddress} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">{handle.fioAddress}</div>
                      <div className="text-sm text-muted-foreground">
                        Registered {new Date(handle.createdAt).toLocaleDateString()}
                        {handle.expiresAt && ` • Expires ${new Date(handle.expiresAt).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  {handle.personaId && (
                    <Badge variant="outline">Persona Linked</Badge>
                  )}
                </div>

                {handle.walletAddresses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Wallet Addresses</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {handle.walletAddresses.map((wallet, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded border bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span>{getChainIcon(wallet.chain)}</span>
                            <span className="text-sm">{wallet.chain}</span>
                            {wallet.verified && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                          <code className="text-xs bg-background px-2 py-1 rounded">
                            {formatAddress(wallet.address)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
