/**
 * Blockchain Viewer
 * 
 * Visualizes blockchain data including blocks, transactions, and network topology
 */

import { useState } from "react";
import { 
  Blocks, 
  ArrowRight, 
  Network, 
  Hash, 
  Clock, 
  Zap, 
  CheckCircle, 
  XCircle,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BlockchainVisualization } from "@/app/types/nakamoto";

interface BlockchainViewerProps {
  visualization: BlockchainVisualization;
  theme?: 'light' | 'dark';
  interactive?: boolean;
}

export function BlockchainViewer({ 
  visualization, 
  theme = 'dark', 
  interactive = true 
}: BlockchainViewerProps) {
  const [activeTab, setActiveTab] = useState<'blocks' | 'transactions' | 'network' | 'contracts'>('blocks');

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatValue = (value: string) => {
    return `${parseFloat(value).toFixed(6)} ETH`;
  };

  const renderBlocks = () => {
    const blocks = visualization.data.blocks || [];
    
    return (
      <div className="space-y-3">
        {blocks.map((block) => (
          <Card key={block.hash} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Blocks className="w-5 h-5 text-cyan-400" />
                <span className="font-medium">Block #{block.number}</span>
                <Badge variant="outline">{block.transactions} txs</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTimestamp(block.timestamp)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Hash:</span>
                <div className="font-mono text-xs">{formatHash(block.hash)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span>
                <div>{(block.size / 1024).toFixed(2)} KB</div>
              </div>
              {block.gasUsed && (
                <div>
                  <span className="text-muted-foreground">Gas Used:</span>
                  <div>{block.gasUsed.toLocaleString()}</div>
                </div>
              )}
              {block.miner && (
                <div>
                  <span className="text-muted-foreground">Miner:</span>
                  <div className="font-mono text-xs">{formatHash(block.miner)}</div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderTransactions = () => {
    const transactions = visualization.data.transactions || [];
    
    return (
      <div className="space-y-3">
        {transactions.map((tx) => (
          <Card key={tx.hash} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <ArrowRight className="w-5 h-5 text-purple-400" />
                <span className="font-medium">{formatValue(tx.value)}</span>
                <Badge 
                  variant={
                    tx.status === 'success' ? 'default' :
                    tx.status === 'failed' ? 'destructive' :
                    'secondary'
                  }
                >
                  {tx.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTimestamp(tx.timestamp)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">From:</span>
                <div className="font-mono text-xs">{formatHash(tx.from)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">To:</span>
                <div className="font-mono text-xs">{formatHash(tx.to)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Gas Used:</span>
                <div>{tx.gasUsed.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Gas Price:</span>
                <div>{tx.gasPrice} Gwei</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderNetwork = () => {
    const nodes = visualization.data.nodes || [];
    
    return (
      <div className="space-y-3">
        {nodes.map((node) => (
          <Card key={node.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-green-400" />
                <span className="font-medium">{node.address}</span>
                <Badge variant="outline">{node.type}</Badge>
                <Badge 
                  variant={node.status === 'online' ? 'default' : 'secondary'}
                >
                  {node.status}
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {node.latency && (
                <div>
                  <span className="text-muted-foreground">Latency:</span>
                  <div>{node.latency}ms</div>
                </div>
              )}
              {node.peers && (
                <div>
                  <span className="text-muted-foreground">Peers:</span>
                  <div>{node.peers}</div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderContracts = () => {
    const contracts = visualization.data.contracts || [];
    
    return (
      <div className="space-y-3">
        {contracts.map((contract) => (
          <Card key={contract.address} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Hash className="w-5 h-5 text-orange-400" />
                <span className="font-medium">{contract.name}</span>
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-muted-foreground">Address:</span>
              <div className="font-mono text-xs mb-3">{formatHash(contract.address)}</div>
              
              {contract.functions && contract.functions.length > 0 && (
                <div className="mb-3">
                  <span className="text-muted-foreground">Functions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contract.functions.map((func) => (
                      <Badge key={func.name} variant="outline" className="text-xs">
                        {func.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {contract.events && contract.events.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Events:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contract.events.map((event) => (
                      <Badge key={event.name} variant="secondary" className="text-xs">
                        {event.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{visualization.title}</CardTitle>
          <Badge variant="outline">{visualization.type}</Badge>
          {visualization.metadata?.network && (
            <Badge variant="secondary">{visualization.metadata.network}</Badge>
          )}
        </div>
        {visualization.metadata?.description && (
          <p className="text-sm text-muted-foreground">{visualization.metadata.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full">
          <div className="border-b border-border">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="blocks" className="flex items-center gap-2">
                <Blocks className="w-4 h-4" />
                Blocks
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                Network
              </TabsTrigger>
              <TabsTrigger value="contracts" className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Contracts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="blocks" className="flex-1 m-0 p-4 overflow-auto">
            {renderBlocks()}
          </TabsContent>

          <TabsContent value="transactions" className="flex-1 m-0 p-4 overflow-auto">
            {renderTransactions()}
          </TabsContent>

          <TabsContent value="network" className="flex-1 m-0 p-4 overflow-auto">
            {renderNetwork()}
          </TabsContent>

          <TabsContent value="contracts" className="flex-1 m-0 p-4 overflow-auto">
            {renderContracts()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
