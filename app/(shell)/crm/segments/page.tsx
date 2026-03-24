'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Search,
  Plus,
  Users,
  Settings,
  MoreVertical,
  Zap,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
} from 'lucide-react';
import { useCrmContext } from '../CrmContext';
import { useSegments } from '../hooks/useCrmApi';
import SegmentBuilder from '@/components/crm/SegmentBuilder';

interface Segment {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  isDynamic: boolean;
  ruleDefinition?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  kind?: 'system' | 'custom';
}

interface MemberProfile {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
  reputationBucket: string | null;
}

export default function SegmentsPage() {
  const router = useRouter();
  const { currentTenantId } = useCrmContext();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [search, setSearch] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [uniquePersonaCount, setUniquePersonaCount] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const segmentsApi = useSegments(currentTenantId);
  const loading = segmentsApi.loading;

  useEffect(() => {
    async function fetchSegments() {
      setApiError(null);
      try {
        const [customResult, systemResult, personaStats] = await Promise.all([
          segmentsApi.fetch({ limit: 100 }),
          fetch(`/api/crm/segments/system?tenantId=${currentTenantId}`).then((res) => res.json()),
          fetch(`/api/crm/personas?tenantId=${currentTenantId}&source=live&stats=true`).then((res) => res.json()),
        ]);

        const customSegments = (customResult?.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          memberCount: s.memberCount || 0,
          isDynamic: s.isDynamic || false,
          ruleDefinition: s.ruleDefinition,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          kind: 'custom' as const,
        }));

        const systemSegments = (systemResult?.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          memberCount: s.memberCount || 0,
          isDynamic: true,
          ruleDefinition: s.ruleDefinition,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          kind: 'system' as const,
        }));

        setSegments([...systemSegments, ...customSegments]);
        setUniquePersonaCount(personaStats?.data?.total || 0);
      } catch (err: any) {
        setApiError(err.message || 'Failed to load segments');
        setSegments([]);
        setUniquePersonaCount(0);
      }
    }
    fetchSegments();
  }, [currentTenantId]);

  async function openMembers(segment: Segment) {
    setSelectedSegment(segment);
    setMembers([]);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/crm/segments?tenantId=${currentTenantId}&segmentId=${segment.id}`);
      const json = await res.json();
      setMembers(json.data?.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  const filteredSegments = segments.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMemberships = segments.reduce((sum, s) => sum + s.memberCount, 0);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-400/10';
      case 'pending': return 'text-amber-400 bg-amber-400/10';
      case 'suspended': return 'text-red-400 bg-red-400/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Layers className="text-pink-400" />
            Segments
          </h1>
          <p className="text-slate-400 mt-1">
            Create and manage persona segments for targeted engagement
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Create Segment
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load segments</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Segments</p>
          <p className="text-2xl font-semibold mt-1">{segments.length}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Unique Personas</p>
          <p className="text-2xl font-semibold mt-1">{uniquePersonaCount.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{totalMemberships.toLocaleString()} total memberships</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Dynamic Segments</p>
          <p className="text-2xl font-semibold mt-1">{segments.filter(s => s.isDynamic).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search segments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            Loading segments...
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            No segments found
          </div>
        ) : (
          filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {segment.isDynamic ? (
                    <Zap size={16} className="text-amber-400" />
                  ) : (
                    <Clock size={16} className="text-slate-400" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    segment.isDynamic
                      ? 'bg-amber-400/20 text-amber-400'
                      : 'bg-slate-400/20 text-slate-400'
                  }`}>
                    {segment.isDynamic ? 'Dynamic' : 'Static'}
                  </span>
                  {segment.kind === 'system' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-300">
                      System
                    </span>
                  )}
                </div>
                <button className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition" aria-label="More options">
                  <MoreVertical size={16} className="text-slate-400" />
                </button>
              </div>

              <h3 className="text-lg font-medium mt-3">{segment.name}</h3>
              {segment.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{segment.description}</p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-cyan-400" />
                  <span className="text-sm font-medium">{segment.memberCount.toLocaleString()} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openMembers(segment)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-400/10 rounded transition"
                    title="View Members"
                  >
                    <Users size={12} />
                    View
                    <ChevronRight size={12} />
                  </button>
                  <button className="p-1.5 hover:bg-white/10 rounded transition" title="Edit Segment">
                    <Settings size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Updated {new Date(segment.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Members Panel */}
      {selectedSegment && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={() => setSelectedSegment(null)}
          />
          {/* Drawer */}
          <div className="w-full max-w-md bg-[#0f0f1a] border-l border-white/10 flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-lg font-semibold">{selectedSegment.name}</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {selectedSegment.memberCount.toLocaleString()} members
                </p>
              </div>
              <button
                onClick={() => setSelectedSegment(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {membersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No members in this segment
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => router.push(`/crm/personas/${member.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {(member.displayName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.displayName}</p>
                      {member.email && (
                        <p className="text-xs text-slate-400 truncate">{member.email}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(member.status)}`}>
                      {member.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Segment Builder Modal */}
      {showBuilder && (
        <SegmentBuilder
          tenantId={currentTenantId}
          onClose={() => setShowBuilder(false)}
          onSuccess={() => segmentsApi.fetch({ limit: 100 })}
        />
      )}
    </div>
  );
}
