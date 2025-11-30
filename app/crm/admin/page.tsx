'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Plus,
  Users,
  Building2,
  Layers,
  Crown,
  Star,
  MoreVertical,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { useAdminRoles, useAdminCategories } from '../hooks/useCrmApi';
import AdminRoleModal from '@/components/crm/AdminRoleModal';

interface AdminRole {
  id: string;
  displayName: string;
  kybeDid?: string;
  roleType: string;
  categoryName?: string;
  franchiseName?: string;
  tenantName?: string;
  scopeDescription: string;
  accessLevel: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

const ROLE_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  uber_admin: { label: 'Uber Admin', color: 'bg-red-500/20 text-red-400', icon: <Crown size={14} /> },
  category_uber_admin: { label: 'Category Uber Admin', color: 'bg-orange-500/20 text-orange-400', icon: <Star size={14} /> },
  platform_super_admin: { label: 'Platform Super Admin', color: 'bg-purple-500/20 text-purple-400', icon: <Shield size={14} /> },
  franchise_super_admin: { label: 'Franchise Super Admin', color: 'bg-blue-500/20 text-blue-400', icon: <Building2 size={14} /> },
  tenant_super_admin: { label: 'Tenant Super Admin', color: 'bg-cyan-500/20 text-cyan-400', icon: <Layers size={14} /> },
  category_admin: { label: 'Category Admin', color: 'bg-emerald-500/20 text-emerald-400', icon: <Users size={14} /> },
};

export default function AdminRolesPage() {
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  
  const adminRolesApi = useAdminRoles();
  const adminCategoriesApi = useAdminCategories();
  const loading = adminRolesApi.loading || adminCategoriesApi.loading;

  useEffect(() => {
    async function fetchAdminData() {
      setApiError(null);
      try {
        // Fetch admin roles and categories in parallel
        const [rolesRes, categoriesRes] = await Promise.all([
          adminRolesApi.fetchByScope({}),
          adminCategoriesApi.fetch(),
        ]);

        if (rolesRes?.data) {
          // Handle both array and object responses
          const rolesData = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data.roles || [];
          setAdminRoles(rolesData.map((r: any) => ({
            id: r.id,
            displayName: r.displayName || r.kybeDid?.slice(0, 16) + '...',
            kybeDid: r.kybeDid,
            roleType: r.roleType,
            categoryName: r.categoryName,
            franchiseName: r.franchiseName,
            tenantName: r.tenantName,
            scopeDescription: r.scopeDescription || '',
            accessLevel: r.accessLevel || 6,
            isActive: r.isActive !== false,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
          })));
        }

        if (categoriesRes?.data) {
          setCategories(categoriesRes.data.map((c: any) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            description: c.description,
            color: c.color || '#6366F1',
          })));
        }
      } catch (err: any) {
        setApiError(err.message || 'Failed to load admin data');
        setAdminRoles([]);
        setCategories([]);
      }
    }
    fetchAdminData();
  }, []);

  const filteredRoles = adminRoles.filter(r => {
    const matchesSearch = 
      r.displayName.toLowerCase().includes(search.toLowerCase()) ||
      r.kybeDid?.toLowerCase().includes(search.toLowerCase()) ||
      r.scopeDescription.toLowerCase().includes(search.toLowerCase());
    const matchesType = roleTypeFilter === 'all' || r.roleType === roleTypeFilter;
    return matchesSearch && matchesType;
  });

  const rolesByType = Object.entries(ROLE_TYPE_LABELS).map(([type, config]) => ({
    type,
    ...config,
    count: adminRoles.filter(r => r.roleType === type && r.isActive).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Shield className="text-red-400" />
            Admin Roles
          </h1>
          <p className="text-slate-400 mt-1">
            Manage admin access across the platform hierarchy
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <button 
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Grant Admin Role
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load admin data</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Role Type Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {rolesByType.map((role) => (
          <div
            key={role.type}
            onClick={() => setRoleTypeFilter(roleTypeFilter === role.type ? 'all' : role.type)}
            className={`rounded-xl p-3 cursor-pointer transition ${
              roleTypeFilter === role.type 
                ? 'ring-2 ring-white/30 bg-white/10' 
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`p-1.5 rounded ${role.color}`}>
                {role.icon}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{role.label}</p>
            <p className="text-lg font-semibold">{role.count}</p>
          </div>
        ))}
      </div>

      {/* Admin Hierarchy Info */}
      <div className="rounded-xl p-4 bg-gradient-to-r from-red-500/10 to-purple-500/10 ring-1 ring-white/10">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          Admin Hierarchy
        </h3>
        <div className="text-sm text-slate-400 space-y-1">
          <p><strong className="text-red-400">Uber Admins</strong> → Estate-wide access, can manage all Super Admins</p>
          <p><strong className="text-orange-400">Category Uber Admins</strong> → Domain-specific estate-wide access (e.g., Content, Ecommerce)</p>
          <p><strong className="text-purple-400">Platform Super Admins</strong> → Platform-wide access across all franchises/tenants</p>
          <p><strong className="text-blue-400">Franchise Super Admins</strong> → Access across all tenants in their franchise</p>
          <p><strong className="text-cyan-400">Tenant Super Admins</strong> → Access within their specific tenant</p>
          <p><strong className="text-emerald-400">Category Admins</strong> → Domain-specific access at their assigned scope</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <select
          value={roleTypeFilter}
          onChange={(e) => setRoleTypeFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          title="Filter by role type"
        >
          <option value="all">All Role Types</option>
          {Object.entries(ROLE_TYPE_LABELS).map(([type, config]) => (
            <option key={type} value={type}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Admin Roles Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Admin</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Role Type</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Scope</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Granted</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Loading admin roles...
                </td>
              </tr>
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No admin roles found
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => {
                const typeConfig = ROLE_TYPE_LABELS[role.roleType];
                return (
                  <tr key={role.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          role.roleType === 'uber_admin' 
                            ? 'bg-gradient-to-br from-red-400 to-orange-500' 
                            : 'bg-gradient-to-br from-slate-400 to-slate-600'
                        }`}>
                          {typeConfig?.icon || <Users size={16} />}
                        </div>
                        <div>
                          <p className="font-medium">{role.displayName}</p>
                          {role.kybeDid && (
                            <p className="text-xs text-slate-500 font-mono">{role.kybeDid}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig?.color}`}>
                        {typeConfig?.icon}
                        {typeConfig?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">{role.scopeDescription}</p>
                      {role.categoryName && (
                        <p className="text-xs text-slate-500">Category: {role.categoryName}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {role.isActive ? (
                          <>
                            <CheckCircle size={14} className="text-emerald-400" />
                            <span className="text-sm text-emerald-400">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} className="text-red-400" />
                            <span className="text-sm text-red-400">Inactive</span>
                          </>
                        )}
                      </div>
                      {role.expiresAt && (
                        <p className="text-xs text-slate-500 mt-1">
                          Expires: {new Date(role.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">
                      {new Date(role.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition" aria-label="More options">
                        <MoreVertical size={16} className="text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Categories Section */}
      <div className="rounded-2xl p-6 bg-white/5 ring-1 ring-white/10">
        <h2 className="text-lg font-medium mb-4">Admin Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              <div 
                className="w-3 h-3 rounded-full mb-2"
                style={{ backgroundColor: cat.color }}
              />
              <p className="font-medium text-sm">{cat.name}</p>
              <p className="text-xs text-slate-500">{cat.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Role Modal */}
      {showRoleModal && (
        <AdminRoleModal
          onClose={() => setShowRoleModal(false)}
          onSuccess={() => adminRolesApi.fetchByScope({})}
        />
      )}
    </div>
  );
}
