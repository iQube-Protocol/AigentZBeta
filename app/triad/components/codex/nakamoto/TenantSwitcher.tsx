/**
 * Tenant Switcher Component
 * 
 * Allows switching between Nakamoto root and JMO tenant contexts.
 * Shows current tenant and available options with visual indicators.
 */

import { useState } from "react";
import { ChevronDown, Users, Building, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TenantId, TenantSwitcherProps } from "@/app/types/nakamoto";

export function TenantSwitcher({ 
  currentTenant, 
  tenants, 
  onTenantChange, 
  disabled = false 
}: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTenantInfo = (tenantId: TenantId) => {
    return tenants.find(t => t.tenant_id === tenantId);
  };

  const currentTenantInfo = getTenantInfo(currentTenant);

  const getTenantIcon = (tenantId: TenantId) => {
    switch (tenantId) {
      case 'nakamoto':
        return <Building className="w-4 h-4" />;
      case 'aigent-jmo':
        return <Users className="w-4 h-4" />;
      default:
        return <Building className="w-4 h-4" />;
    }
  };

  const getTenantColor = (tenantId: TenantId) => {
    switch (tenantId) {
      case 'nakamoto':
        return 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10';
      case 'aigent-jmo':
        return 'text-purple-400 border-purple-400/20 bg-purple-400/10';
      default:
        return 'text-gray-400 border-gray-400/20 bg-gray-400/10';
    }
  };

  const getTenantLabel = (tenantId: TenantId) => {
    switch (tenantId) {
      case 'nakamoto':
        return 'Nakamoto';
      case 'aigent-jmo':
        return 'Aigent JMO';
      default:
        return tenantId;
    }
  };

  const handleTenantSelect = (tenantId: TenantId) => {
    if (tenantId !== currentTenant && !disabled) {
      onTenantChange(tenantId);
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`flex items-center gap-2 ${getTenantColor(currentTenant)}`}
        >
          {getTenantIcon(currentTenant)}
          <span className="font-medium">{getTenantLabel(currentTenant)}</span>
          {currentTenantInfo && (
            <Badge variant="secondary" className="text-xs">
              {currentTenant === 'nakamoto' ? 'Root' : 'Tenant'}
            </Badge>
          )}
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">Select Tenant Context</p>
        </div>
        
        <DropdownMenuSeparator />
        
        {tenants.map((tenant) => {
          const isActive = tenant.tenant_id === currentTenant;
          const colorClass = getTenantColor(tenant.tenant_id);
          
          return (
            <DropdownMenuItem
              key={tenant.tenant_id}
              onClick={() => handleTenantSelect(tenant.tenant_id)}
              disabled={isActive || disabled}
              className={`flex items-center gap-3 p-3 ${isActive ? colorClass : ''}`}
            >
              <div className="flex items-center gap-2 flex-1">
                {getTenantIcon(tenant.tenant_id)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getTenantLabel(tenant.tenant_id)}</span>
                    {isActive && <Check className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tenant.display_name}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant={tenant.tenant_id === 'nakamoto' ? 'default' : 'secondary'} 
                  className="text-xs"
                >
                  {tenant.tenant_id === 'nakamoto' ? 'Root' : 'Tenant'}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    tenant.status === 'active' 
                      ? 'text-green-400 border-green-400/30' 
                      : 'text-gray-400 border-gray-400/30'
                  }`}
                >
                  {tenant.status}
                </Badge>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            Switching tenants will reload content for the selected context.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
