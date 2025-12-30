/**
 * Simple Social Analytics Dashboard for SmartTriad
 * Minimal dependencies version for package compatibility
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export function SocialAnalyticsDashboard({ className = '' }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('7d');
    const [error, setError] = useState(null);
    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            const apiUrl = import.meta.env?.VITE_API_URL || 'https://dev-beta.aigentz.me';
            const response = await fetch(`${apiUrl}/api/analytics/dashboard?timeframe=${timeframe}&limit=50`);
            if (!response.ok) {
                throw new Error(`Failed to fetch analytics: ${response.statusText}`);
            }
            const analyticsData = await response.json();
            setData(analyticsData);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchAnalytics();
    }, [timeframe]);
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };
    const getPlatformIcon = (platform) => {
        const icons = {
            'twitter': '🐦',
            'linkedin': '💼',
            'facebook': '📘',
            'whatsapp': '💬',
            'telegram': '✈️',
            'email': '📧',
            'native': '📱',
            'clipboard': '📋'
        };
        return icons[platform] || '🔗';
    };
    if (loading) {
        return (_jsx("div", { className: `p-6 ${className}`, children: _jsxs("div", { className: "animate-pulse", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded mb-4" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: [1, 2, 3, 4].map(i => (_jsx("div", { className: "h-24 bg-gray-200 rounded" }, i))) })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: `p-6 ${className}`, children: _jsxs("div", { className: "text-center p-6 border rounded-lg", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDCCA" }), _jsx("h3", { className: "text-lg font-medium mb-2", children: "Analytics Error" }), _jsx("p", { className: "text-gray-600 mb-4", children: error }), _jsx("button", { onClick: fetchAnalytics, className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded", children: "Retry" })] }) }));
    }
    if (!data) {
        return _jsx("div", { className: `p-6 ${className}`, children: "No data available" });
    }
    return (_jsxs("div", { className: `p-6 space-y-6 ${className}`, children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold", children: "Social Analytics Dashboard" }), _jsx("p", { className: "text-gray-600", children: "Comprehensive sharing analytics and insights" })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("select", { value: timeframe, onChange: (e) => setTimeframe(e.target.value), className: "px-3 py-2 border rounded", children: [_jsx("option", { value: "7d", children: "Last 7 days" }), _jsx("option", { value: "30d", children: "Last 30 days" }), _jsx("option", { value: "90d", children: "Last 90 days" })] }), _jsx("button", { onClick: fetchAnalytics, className: "px-4 py-2 border rounded hover:bg-gray-50", children: "\uD83D\uDD04 Refresh" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx("div", { className: "p-6 border rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-3xl mr-4", children: "\uD83D\uDCE4" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Shares" }), _jsx("p", { className: "text-2xl font-bold", children: data.overview.totalShares.toLocaleString() })] })] }) }), _jsx("div", { className: "p-6 border rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-3xl mr-4", children: "\uD83D\uDCC8" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Unique Articles" }), _jsx("p", { className: "text-2xl font-bold", children: data.overview.uniqueArticles })] })] }) }), _jsx("div", { className: "p-6 border rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-3xl mr-4", children: "\uD83D\uDC65" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Active Personas" }), _jsx("p", { className: "text-2xl font-bold", children: data.overview.uniquePersonas })] })] }) }), _jsx("div", { className: "p-6 border rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-3xl mr-4", children: "\uD83C\uDF10" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Platforms" }), _jsx("p", { className: "text-2xl font-bold", children: data.overview.platforms })] })] }) })] }), _jsxs("div", { className: "p-6 border rounded-lg", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Platform Performance" }), _jsx("div", { className: "space-y-4", children: data.platformBreakdown.map((platform) => (_jsxs("div", { className: "flex items-center justify-between p-4 border rounded", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: "text-2xl", children: getPlatformIcon(platform.platform) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium capitalize", children: platform.platform }), _jsxs("p", { className: "text-sm text-gray-600", children: [platform.shares, " shares"] })] })] }), _jsx("div", { className: "text-right", children: _jsxs("span", { className: "bg-gray-100 px-2 py-1 rounded text-sm", children: [platform.percentage, "%"] }) })] }, platform.platform))) })] }), _jsxs("div", { className: "p-6 border rounded-lg", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Most Shared Articles" }), _jsx("div", { className: "space-y-4", children: data.topArticles.slice(0, 5).map((article, index) => (_jsxs("div", { className: "flex items-center justify-between p-4 border rounded", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("span", { className: "bg-gray-100 px-2 py-1 rounded text-sm", children: ["#", index + 1] }), _jsxs("div", { children: [_jsx("p", { className: "font-medium line-clamp-1", children: article.title }), _jsxs("p", { className: "text-sm text-gray-600", children: [article.uniquePersonas, " personas \u2022 ", article.platformsUsed, " platforms"] })] })] }) }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-bold text-lg", children: article.totalShares }), _jsx("p", { className: "text-xs text-gray-500", children: "shares" })] })] }, article.id))) })] })] }));
}
