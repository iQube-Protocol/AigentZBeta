"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  data?: any;
  duration?: number;
}

export default function TestPage() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customIQubeId, setCustomIQubeId] = useState("");
  const [customTokenId, setCustomTokenId] = useState("");

  const testSuites = [
    {
      name: "Canister Health Check",
      endpoint: "/api/ops/canisters/health",
      description: "Test ICP canister connectivity and health"
    },
    {
      name: "BTC Anchor Status",
      endpoint: "/api/ops/btc/status", 
      description: "Test BTC anchor and testnet connectivity"
    },
    {
      name: "Ethereum Sepolia RPC",
      endpoint: "/api/ops/ethereum/sepolia",
      description: "Test live Ethereum Sepolia testnet data"
    },
    {
      name: "Polygon Amoy RPC", 
      endpoint: "/api/ops/polygon/amoy",
      description: "Test live Polygon Amoy testnet data"
    },
    {
      name: "DVN Status Check",
      endpoint: "/api/ops/dvn/status",
      description: "Test ICP DVN canister status"
    },
    {
      name: "Cross-Chain Status",
      endpoint: "/api/ops/crosschain/status", 
      description: "Test cross-chain service connectivity"
    }
  ];

  async function runTest(test: typeof testSuites[0]): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(test.endpoint, { cache: 'no-store' });
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        return {
          name: test.name,
          status: 'error',
          message: `HTTP ${response.status}: ${data.message || 'Request failed'}`,
          duration
        };
      }
      
      return {
        name: test.name,
        status: 'success',
        message: data.ok ? 'Service healthy' : `Service issue: ${data.error || 'Unknown error'}`,
        data,
        duration
      };
    } catch (error: any) {
      return {
        name: test.name,
        status: 'error',
        message: error.message || 'Network error',
        duration: Date.now() - startTime
      };
    }
  }

  async function runAllTests() {
    setIsRunning(true);
    setTests(testSuites.map(t => ({ name: t.name, status: 'pending', message: 'Waiting...' })));
    
    for (let i = 0; i < testSuites.length; i++) {
      const test = testSuites[i];
      
      // Update status to running
      setTests(prev => prev.map((t, idx) => 
        idx === i ? { ...t, status: 'running', message: 'Testing...' } : t
      ));
      
      const result = await runTest(test);
      
      // Update with result
      setTests(prev => prev.map((t, idx) => idx === i ? result : t));
    }
    
    setIsRunning(false);
  }

  async function testMinting() {
    if (!customIQubeId.trim()) {
      alert("Please enter an iQube ID to test minting");
      return;
    }

    const startTime = Date.now();
    setTests(prev => [...prev, {
      name: "TokenQube Minting",
      status: 'running',
      message: 'Attempting to mint TokenQube...'
    }]);

    try {
      const response = await fetch("/api/core/mint-tokenqube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaIdentifier: customIQubeId,
          tokenId: customTokenId || undefined,
          network: "Ethereum"
        })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: "TokenQube Minting",
        status: response.ok ? 'success' : 'error',
        message: response.ok 
          ? `Minted successfully! TX: ${data.tx || 'N/A'}` 
          : `Minting failed: ${data.message || 'Unknown error'}`,
        data,
        duration
      };

      setTests(prev => [...prev.slice(0, -1), result]);
    } catch (error: any) {
      setTests(prev => [...prev.slice(0, -1), {
        name: "TokenQube Minting",
        status: 'error',
        message: `Network error: ${error.message}`,
        duration: Date.now() - startTime
      }]);
    }
  }

  function getStatusIcon(status: TestResult['status']) {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'running': return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold">Testing Dashboard</h1>
        <p className="text-slate-300 mt-2">
          Comprehensive testing suite for iQube infrastructure and application features
        </p>
      </div>

      {/* System Tests */}
      <div className="bg-black/30 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium">System Health Tests</h2>
          <Button onClick={runAllTests} disabled={isRunning}>
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? "Running..." : "Run All Tests"}
          </Button>
        </div>
        
        <div className="space-y-3">
          {testSuites.map((suite, idx) => {
            const result = tests.find(t => t.name === suite.name);
            return (
              <div key={suite.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {result ? getStatusIcon(result.status) : <AlertCircle className="w-5 h-5 text-gray-400" />}
                    <div>
                      <p className="font-medium">{suite.name}</p>
                      <p className="text-sm text-slate-400">{suite.description}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {result && (
                    <>
                      <p className={`text-sm ${result.status === 'success' ? 'text-green-400' : result.status === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                        {result.message}
                      </p>
                      {result.duration && (
                        <p className="text-xs text-slate-500">{result.duration}ms</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Application Tests */}
      <div className="bg-black/30 p-6 rounded-2xl">
        <h2 className="text-xl font-medium mb-4">Application Feature Tests</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="iQube ID for Testing"
              value={customIQubeId}
              onChange={(e) => setCustomIQubeId(e.target.value)}
              placeholder="Enter iQube ID to test minting"
            />
            <Input
              label="Custom Token ID (Optional)"
              value={customTokenId}
              onChange={(e) => setCustomTokenId(e.target.value)}
              placeholder="Leave blank for auto-generation"
            />
          </div>
          
          <Button onClick={testMinting} disabled={!customIQubeId.trim()}>
            <Play className="w-4 h-4 mr-2" />
            Test TokenQube Minting
          </Button>
        </div>
      </div>

      {/* Test Results */}
      {tests.length > 0 && (
        <div className="bg-black/30 p-6 rounded-2xl">
          <h2 className="text-xl font-medium mb-4">Test Results</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tests.map((test, idx) => (
              <div key={`${test.name}-${idx}`} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <span className="font-medium">{test.name}</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${test.status === 'success' ? 'text-green-400' : test.status === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                    {test.message}
                  </p>
                  {test.duration && (
                    <p className="text-xs text-slate-500">{test.duration}ms</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
