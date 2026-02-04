import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SmartThumbnail - Reusable thumbnail component for SmartTriad content
 * Provides consistent thumbnail rendering with optional action overlay
 */
import { clsx } from 'clsx';
export function SmartThumbnail({ id, image, title, badge, badgeColor = 'bg-cyan-500/80', aspectRatio = 'aspect-video', isSelected = false, onClick, actions, size = 'md', className, showTitle = true, }) {
    const sizeClasses = {
        sm: 'text-[10px]',
        md: 'text-xs',
        lg: 'text-sm',
    };
    const badgeSizeClasses = {
        sm: 'px-1.5 py-0.5 text-[8px]',
        md: 'px-2 py-0.5 text-[10px]',
        lg: 'px-2.5 py-1 text-xs',
    };
    return (_jsxs("div", { onClick: onClick, className: clsx('group relative w-full overflow-hidden rounded-lg bg-black cursor-pointer transition-all', aspectRatio, isSelected ? 'ring-2 ring-cyan-400' : 'opacity-80 hover:opacity-100', className), role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, onKeyDown: onClick ? (e) => e.key === 'Enter' && onClick() : undefined, children: [_jsx("img", { src: image, alt: title, className: "absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" }), badge && (_jsx("div", { className: "absolute top-2 left-2 z-10", children: _jsx("span", { className: clsx('backdrop-blur-sm text-white font-bold rounded', badgeColor, badgeSizeClasses[size]), children: badge }) })), actions && (_jsx("div", { className: "absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10", children: actions })), showTitle && (_jsx("div", { className: "absolute bottom-2 left-2 right-2 z-[5]", children: _jsx("p", { className: clsx('text-white font-medium line-clamp-2', sizeClasses[size], actions ? 'pr-8' : '' // Leave space for actions
                    ), children: title }) }))] }));
}
