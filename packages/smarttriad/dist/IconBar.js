import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * IconBar - Left sidebar navigation with domain icons
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */
import { clsx } from 'clsx';
export function IconBar({ domains, systemItems = [], activeDomain, onDomainClick, onLogoClick, logo, className, }) {
    return (_jsxs("div", { className: clsx('fixed left-0 top-0 bottom-0 w-16', 'bg-black/40 backdrop-blur-xl', 'border-r border-white/5', 'flex flex-col items-center py-6 z-50', className), children: [_jsx("div", { className: "mb-8 group cursor-pointer", onClick: onLogoClick, ...(onLogoClick && { role: 'button', tabIndex: 0 }), children: logo || (_jsx("div", { className: "h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary relative overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]", children: _jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" }) })) }), _jsx("div", { className: "flex-1 flex flex-col gap-3", children: domains.map((domain) => {
                    const Icon = domain.icon;
                    const isActive = activeDomain === domain.id;
                    return (_jsxs("button", { onClick: () => onDomainClick(domain.id), "aria-label": domain.label, className: clsx('group relative w-12 h-12 rounded-xl', 'flex items-center justify-center', 'transition-all duration-300', 'hover:scale-110', isActive
                            ? 'bg-gradient-to-br from-primary/20 to-secondary/20 text-primary shadow-[0_0_20px_rgba(94,234,212,0.3)]'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'), children: [_jsx("div", { className: clsx('absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300', 'bg-gradient-to-br from-primary/10 to-secondary/10') }), isActive && (_jsx("div", { className: "absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" })), _jsx(Icon, { className: clsx('h-5 w-5 relative z-10 transition-all duration-300', isActive && 'drop-shadow-[0_0_8px_rgba(94,234,212,0.6)]') })] }, domain.id));
                }) }), systemItems.length > 0 && (_jsx("div", { className: "w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" })), systemItems.length > 0 && (_jsx("div", { className: "flex flex-col gap-3", children: systemItems.map((item) => {
                    const Icon = item.icon;
                    return (_jsxs("button", { onClick: () => onDomainClick(item.id), "aria-label": item.label, className: clsx('group relative w-12 h-12 rounded-xl', 'flex items-center justify-center', 'transition-all duration-300', 'text-muted-foreground hover:text-foreground hover:bg-white/5 hover:scale-110'), children: [_jsx("div", { className: clsx('absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300', 'bg-gradient-to-br from-primary/10 to-secondary/10') }), _jsx(Icon, { className: "h-5 w-5 relative z-10" })] }, item.id));
                }) }))] }));
}
