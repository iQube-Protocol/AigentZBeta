import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * DrawerLayer - Base drawer component for domain content
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
export function DrawerLayer({ isOpen, onClose, title, subtitle, columns = 2, tabs, activeTabId, onTabChange, children, className, }) {
    const [internalActiveTab, setInternalActiveTab] = useState(tabs?.[0]?.id || '');
    // Use controlled state if provided, otherwise use internal state
    const activeTab = activeTabId ?? internalActiveTab;
    const handleTabChange = (tabId) => {
        setInternalActiveTab(tabId);
        onTabChange?.(tabId);
    };
    if (!isOpen)
        return null;
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity", onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { className: clsx('fixed right-[80px] top-[88px] h-[calc(100vh-88px)] w-[calc(100vw-160px)]', 'bg-background/80 backdrop-blur-xl', 'border-l border-border/30', 'shadow-[0_0_60px_rgba(0,0,0,0.5)]', 'z-50 overflow-hidden flex flex-col', 'transition-transform duration-300 ease-out', isOpen ? 'translate-x-0' : 'translate-x-full', className), children: [_jsx("div", { className: "flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm", children: _jsxs("div", { className: "p-6 flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex-shrink-0", children: [_jsx("h2", { className: "text-2xl font-bold text-foreground mb-1", children: title }), subtitle && _jsx("p", { className: "text-sm text-muted-foreground", children: subtitle })] }), _jsxs("div", { className: "flex items-center gap-6", children: [tabs && tabs.length > 0 && (_jsx("div", { className: "flex gap-2", children: tabs.map((tab) => (_jsx("button", { onClick: () => handleTabChange(tab.id), className: clsx('px-4 py-2 text-sm font-medium transition-all whitespace-nowrap border-b-2', activeTab === tab.id
                                                    ? 'text-primary border-primary'
                                                    : 'text-muted-foreground border-transparent hover:text-foreground'), children: tab.label }, tab.id))) })), _jsx("button", { onClick: onClose, "aria-label": "Close drawer", className: "flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-4 p-2 rounded-md transition-colors", children: _jsx(X, { className: "h-5 w-5" }) })] })] }) }), _jsx("div", { className: "flex-1 overflow-y-auto p-6", children: _jsx("div", { className: `grid ${columnClasses[columns]} gap-6`, children: children }) })] })] }));
}
