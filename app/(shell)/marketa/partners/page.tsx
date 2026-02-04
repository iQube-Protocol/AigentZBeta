'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Users, TrendingUp, Mail, MessageSquare } from 'lucide-react';

// Mock data - replace with real API calls
const mockPartners = [
  {
    id: '1',
    name: 'Tech Influencer Co',
    type: 'creator',
    status: 'active',
    campaigns_count: 3,
    total_revenue: 15000,
    contact_email: 'contact@techinfluencer.com',
    description: 'Leading technology influencer with 1M+ followers'
  },
  {
    id: '2',
    name: 'Brand Agency Ltd',
    type: 'agency',
    status: 'pending',
    campaigns_count: 1,
    total_revenue: 8000,
    contact_email: 'hello@brandagency.com',
    description: 'Full-service digital marketing agency'
  },
  {
    id: '3',
    name: 'Media Partners LLC',
    type: 'brand',
    status: 'active',
    campaigns_count: 5,
    total_revenue: 25000,
    contact_email: 'partners@mediapartners.com',
    description: 'Media and entertainment brand partnership'
  }
];

export default function PartnersPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'inactive':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'creator':
        return <Users className="w-4 h-4" />;
      case 'agency':
        return <TrendingUp className="w-4 h-4" />;
      case 'brand':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <Users className="w-8 h-8" />
              Partner Management
            </h1>
            <p className="text-slate-300">
              Manage relationships with creators, agencies, and brand partners
            </p>
          </div>
          <Button className="bg-rose-500 hover:bg-rose-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockPartners.map((partner) => (
          <div key={partner.id} className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6 hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getTypeIcon(partner.type)}
                <Badge className={getStatusColor(partner.status)}>
                  {partner.status}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-2">{partner.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{partner.description}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Type:</span>
                <span className="text-white capitalize">{partner.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Campaigns:</span>
                <span className="text-white">{partner.campaigns_count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Revenue:</span>
                <span className="text-green-400 font-medium">{formatCurrency(partner.total_revenue)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 truncate">{partner.contact_email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
