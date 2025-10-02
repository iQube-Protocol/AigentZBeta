'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { TrendingUp, TrendingDown, Wallet, Zap, Globe, AlertCircle } from 'lucide-react';

interface TradingData {
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  liquidity: number;
}

interface QCTTradingCardProps {
  className?: string;
  title?: React.ReactNode;
}

export default function QCTTradingCard({ className, title }: QCTTradingCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedChain, setSelectedChain] = useState('sepolia');
  const [tradingAmount, setTradingAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tradingData, setTradingData] = useState<TradingData>({
    price: 0.001,
    volume24h: 125000,
    marketCap: 500000,
    priceChange24h: 5.2,
    liquidity: 75000
  });

  // Mock data for different chains
  const chainData = {
    sepolia: { name: 'Ethereum Sepolia', symbol: 'ETH', balance: '100.50' },
    amoy: { name: 'Polygon Amoy', symbol: 'MATIC', balance: '250.75' },
    arbitrum: { name: 'Arbitrum Sepolia', symbol: 'ETH', balance: '50.25' },
    base: { name: 'Base Sepolia', symbol: 'ETH', balance: '75.00' },
    optimism: { name: 'Optimism Sepolia', symbol: 'ETH', balance: '30.10' }
  };

  const handleTrade = async (type: 'buy' | 'sell') => {
    if (!tradingAmount || parseFloat(tradingAmount) <= 0) return;

    setIsLoading(true);
    try {
      // Here you would integrate with actual trading logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      console.log(`${type} ${tradingAmount} QCT on ${selectedChain}`);
      setTradingAmount('');
    } catch (error) {
      console.error('Trading error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              QCT Trading Interface
            </CardTitle>
            <CardDescription>
              Trade QCT tokens across multiple EVM chains
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Market Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-lg font-semibold">${tradingData.price.toFixed(6)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">24h Volume</p>
            <p className="text-lg font-semibold">${tradingData.volume24h.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Market Cap</p>
            <p className="text-lg font-semibold">${tradingData.marketCap.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">24h Change</p>
            <p className={`text-lg font-semibold ${tradingData.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {tradingData.priceChange24h >= 0 ? '+' : ''}{tradingData.priceChange24h}%
            </p>
          </div>
        </div>

        <Separator />

        {/* Chain Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Trading Chain</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
              />
              <Label className="text-sm">Advanced</Label>
            </div>
          </div>

          <Select value={selectedChain} onValueChange={setSelectedChain}>
            <SelectTrigger>
              <SelectValue placeholder="Select chain" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(chainData).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {data.name}
                    <Badge variant="outline" className="ml-auto">
                      {data.balance} {data.symbol}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm text-muted-foreground">Slippage Tolerance</Label>
                <Select defaultValue="0.5">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.1">0.1%</SelectItem>
                    <SelectItem value="0.5">0.5%</SelectItem>
                    <SelectItem value="1.0">1.0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Transaction Deadline</Label>
                <Select defaultValue="20">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Trading Interface */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Trade Amount (QCT)</Label>
            <Badge variant="outline">
              Balance: {chainData[selectedChain as keyof typeof chainData]?.balance} QCT
            </Badge>
          </div>

          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.00"
              value={tradingAmount}
              onChange={(e) => setTradingAmount(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => setTradingAmount(chainData[selectedChain as keyof typeof chainData]?.balance || '0')}
            >
              Max
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleTrade('buy')}
              disabled={isLoading || !tradingAmount}
              className="bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {isLoading ? 'Processing...' : 'Buy QCT'}
            </Button>
            <Button
              onClick={() => handleTrade('sell')}
              disabled={isLoading || !tradingAmount}
              variant="destructive"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              {isLoading ? 'Processing...' : 'Sell QCT'}
            </Button>
          </div>

          {tradingAmount && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Est. {tradingAmount} QCT</span>
                <span>≈ ${(parseFloat(tradingAmount) * tradingData.price).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Trading Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Trades are executed on {chainData[selectedChain as keyof typeof chainData]?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>Cross-chain bridging available for multi-chain trading</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
