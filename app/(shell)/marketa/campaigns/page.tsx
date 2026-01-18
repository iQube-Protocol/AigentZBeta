'use client';

/**
 * Marketa Campaign Manager
 * 
 * Campaign management interface within the Marketa Aigent view
 * for managing partner campaigns, sequences, and participation
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, Eye, Users, Calendar, Filter, Target, TrendingUp, Trash2, Archive } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';

// Marketa styling constants
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";
const ROSE_GLOW = "shadow-rose-500/20 shadow-lg hover:shadow-rose-500/30";

const GlassCard = ({ children, className = "", hover = true }: { 
  children: React.ReactNode; 
  className?: string; 
  hover?: boolean;
}) => (
  <div className={`${GLASS_CARD} ${hover ? GLASS_HOVER : ""} ${className} rounded-xl`}>
    {children}
  </div>
);

interface Campaign {
  id: string;
  name: string;
  description: string;
  campaign_type: 'wpp' | 'custom' | 'sequence';
  phase: string;
  status: string;
  created_at: string;
  participating_tenants_count: number;
  sequence_length?: number;
  helix_thread?: string;
}

interface ApiResponse {
  success: boolean;
  campaigns?: Campaign[];
  error?: string;
}

export default function MarketaCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/marketa/admin/campaigns?action=list', {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true', // Developer override
        },
      });

      const data: ApiResponse = await response.json();
      
      if (data.success && data.campaigns) {
        setCampaigns(data.campaigns);
      } else {
        setError(data.error || 'Failed to load campaigns');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const seed21Awakenings = async () => {
    try {
      setSeeding(true);
      const response = await fetch('/api/marketa/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true', // Developer override
        },
        body: JSON.stringify({
          action: 'seed_21_awakenings',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        await loadCampaigns(); // Refresh the list
        // Show success message
        toast('21 Awakenings campaign created successfully! You can now view it in the campaigns list.', 'success');
      } else {
        setError(data.error || 'Failed to seed campaign');
        toast(data.error || 'Failed to seed campaign', 'error');
      }
    } catch (err) {
      const errorMessage = 'Failed to seed campaign: ' + (err as Error).message;
      setError(errorMessage);
      toast(errorMessage, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const deleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to delete "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/marketa/admin/campaigns?action=delete&campaignId=${campaignId}`, {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        await loadCampaigns(); // Refresh the list
        toast(`Campaign "${campaignName}" deleted successfully`, 'success');
      } else {
        toast(data.error || 'Failed to delete campaign', 'error');
      }
    } catch (err) {
      const errorMessage = 'Failed to delete campaign: ' + (err as Error).message;
      toast(errorMessage, 'error');
    }
  };

  const archiveCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to archive "${campaignName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/marketa/admin/campaigns?action=archive&campaignId=${campaignId}`, {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        await loadCampaigns(); // Refresh the list
        toast(`Campaign "${campaignName}" archived successfully`, 'success');
      } else {
        toast(data.error || 'Failed to archive campaign', 'error');
      }
    } catch (err) {
      const errorMessage = 'Failed to archive campaign: ' + (err as Error).message;
      toast(errorMessage, 'error');
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || campaign.campaign_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case 'sequence': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-blue-100 text-blue-800';
      case 'wpp': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const is21Awakenings = (campaign: Campaign) => 
    campaign.id === '21-awakenings-campaign' || 
    campaign.name.toLowerCase().includes('21 awakenings');

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <Target className="w-8 h-8" />
              Campaign Manager
            </h1>
            <p className="text-slate-300">
              Manage partner campaigns and monitor participation
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={seed21Awakenings}
              disabled={seeding}
              variant="outline"
              className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
            >
              {seeding ? 'Seeding...' : 'Seed 21 Awakenings'}
            </Button>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Quick Jump */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Quick Jump</h3>
            <p className="text-slate-300 text-sm">
              Jump to a specific campaign by ID or name
            </p>
          </div>
          <Search className="w-5 h-5 text-rose-400" />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter campaign ID or name (e.g., '21 awakenings')"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-slate-800/50 border-white/20 text-white placeholder:text-slate-400"
          />
          <Button variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
      </GlassCard>

      {/* Campaigns Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Campaigns</h3>
            <p className="text-slate-300 text-sm">
              All Marketa campaigns and their participation status
            </p>
          </div>
          <TrendingUp className="w-5 h-5 text-rose-400" />
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className={filterType === 'all' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50'}
          >
            All
          </Button>
          <Button
            variant={filterType === 'sequence' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('sequence')}
            className={filterType === 'sequence' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50'}
          >
            Sequence
          </Button>
          <Button
            variant={filterType === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('custom')}
            className={filterType === 'custom' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50'}
          >
            Custom
          </Button>
          <Button
            variant={filterType === 'wpp' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('wpp')}
            className={filterType === 'wpp' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50'}
          >
            WPP
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

          <Table className="border-separate border-spacing-0">
            <TableHeader>
              <TableRow className="border-b border-white/10">
                <TableHead className="text-slate-300 font-semibold">Name</TableHead>
                <TableHead className="text-slate-300 font-semibold">Type</TableHead>
                <TableHead className="text-slate-300 font-semibold">Status</TableHead>
                <TableHead className="text-slate-300 font-semibold">Participants</TableHead>
                <TableHead className="text-slate-300 font-semibold">Created</TableHead>
                <TableHead className="text-slate-300 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => (
                <TableRow 
                  key={campaign.id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    is21Awakenings(campaign) ? 'bg-purple-900/20 border-purple-500/30' : ''
                  }`}
                >
                  <TableCell className="text-white">
                    <div>
                      <div className="font-medium">
                        {campaign.name}
                        {is21Awakenings(campaign) && (
                          <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                            21 Awakenings
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-400">
                        {campaign.description}
                      </div>
                      {campaign.sequence_length && (
                        <div className="text-xs text-slate-500">
                          {campaign.sequence_length} days
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-white">
                    <Badge className={getCampaignTypeColor(campaign.campaign_type)}>
                      {campaign.campaign_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white">
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white">
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-slate-400" />
                      <span className="font-medium">
                        {campaign.participating_tenants_count || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-white">
                    <div className="flex items-center text-sm text-slate-400">
                      <Calendar className="mr-2 h-4 w-4" />
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-white">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" asChild className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                        <Link href={`/marketa/campaigns/${campaign.id}`}>
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Link>
                      </Button>
                      {campaign.status === 'draft' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-red-900/50 border-red-500/20 text-red-300 hover:bg-red-800/50"
                          onClick={() => deleteCampaign(campaign.id, campaign.name)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      )}
                      {campaign.status === 'completed' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-amber-900/50 border-amber-500/20 text-amber-300 hover:bg-amber-800/50"
                          onClick={() => archiveCampaign(campaign.id, campaign.name)}
                        >
                          <Archive className="mr-1 h-3 w-3" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredCampaigns.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              {campaigns.length === 0 
                ? 'No campaigns found. Create your first campaign to get started.'
                : 'No campaigns match your search criteria.'
              }
            </div>
          )}
        </GlassCard>
    </div>
  );
}
