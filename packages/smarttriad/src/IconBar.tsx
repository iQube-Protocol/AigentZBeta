/**
 * IconBar - Left sidebar navigation with domain icons
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */

import { clsx } from 'clsx';
import type { Domain } from './types';

export interface IconBarProps {
  /** Primary navigation domains */
  domains: Domain[];
  /** System items (profile, settings, etc.) */
  systemItems?: Domain[];
  /** Currently active domain */
  activeDomain: string | null;
  /** Domain click handler */
  onDomainClick: (domainId: string) => void;
  /** Logo click handler */
  onLogoClick?: () => void;
  /** Custom logo element */
  logo?: React.ReactNode;
  /** Custom class names */
  className?: string;
}

export function IconBar({
  domains,
  systemItems = [],
  activeDomain,
  onDomainClick,
  onLogoClick,
  logo,
  className,
}: IconBarProps) {
  return (
    <div
      className={clsx(
        'fixed left-0 top-0 bottom-0 w-16',
        'bg-black/40 backdrop-blur-xl',
        'border-r border-white/5',
        'flex flex-col items-center py-6 z-50',
        className
      )}
    >
      {/* Logo */}
      <div
        className="mb-8 group cursor-pointer"
        onClick={onLogoClick}
        {...(onLogoClick && { role: 'button', tabIndex: 0 })}
      >
        {logo || (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary relative overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        )}
      </div>

      {/* Primary Domains */}
      <div className="flex-1 flex flex-col gap-3">
        {domains.map((domain) => {
          const Icon = domain.icon;
          const isActive = activeDomain === domain.id;

          return (
            <button
              key={domain.id}
              onClick={() => onDomainClick(domain.id)}
              aria-label={domain.label}
              className={clsx(
                'group relative w-12 h-12 rounded-xl',
                'flex items-center justify-center',
                'transition-all duration-300',
                'hover:scale-110',
                isActive
                  ? 'bg-gradient-to-br from-primary/20 to-secondary/20 text-primary shadow-[0_0_20px_rgba(94,234,212,0.3)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              {/* Glow effect on hover */}
              <div
                className={clsx(
                  'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                  'bg-gradient-to-br from-primary/10 to-secondary/10'
                )}
              />

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
              )}

              <Icon
                className={clsx(
                  'h-5 w-5 relative z-10 transition-all duration-300',
                  isActive && 'drop-shadow-[0_0_8px_rgba(94,234,212,0.6)]'
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Divider */}
      {systemItems.length > 0 && (
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
      )}

      {/* System Items */}
      {systemItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {systemItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onDomainClick(item.id)}
                aria-label={item.label}
                className={clsx(
                  'group relative w-12 h-12 rounded-xl',
                  'flex items-center justify-center',
                  'transition-all duration-300',
                  'text-muted-foreground hover:text-foreground hover:bg-white/5 hover:scale-110'
                )}
              >
                <div
                  className={clsx(
                    'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                    'bg-gradient-to-br from-primary/10 to-secondary/10'
                  )}
                />
                <Icon className="h-5 w-5 relative z-10" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
