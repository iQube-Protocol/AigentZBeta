/**
 * Social Analytics Dashboard for SmartTriad
 * Smart Wallet CSS styling with lucide icons and glass effects
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Share2, FileText, Users, Globe, Twitter, Linkedin, Facebook, MessageCircle, Send, Mail, Smartphone, Copy, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';
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
            'twitter': _jsx(Twitter, { className: "h-5 w-5" }),
            'linkedin': _jsx(Linkedin, { className: "h-5 w-5" }),
            'facebook': _jsx(Facebook, { className: "h-5 w-5" }),
            'whatsapp': _jsx(MessageCircle, { className: "h-5 w-5" }),
            'telegram': _jsx(Send, { className: "h-5 w-5" }),
            'email': _jsx(Mail, { className: "h-5 w-5" }),
            'native': _jsx(Smartphone, { className: "h-5 w-5" }),
            'clipboard': _jsx(Copy, { className: "h-5 w-5" })
        };
        return icons[platform] || _jsx(Globe, { className: "h-5 w-5" });
    };
    if (loading) {
        return (_jsx("div", { className: `min-h-screen bg-[#050f1f] p-6 ${className}`, children: _jsxs("div", { className: "animate-pulse", children: [_jsx("div", { className: "h-8 bg-white/10 backdrop-blur-sm rounded-lg mb-4" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: [1, 2, 3, 4].map(i => (_jsx("div", { className: "h-24 bg-white/10 backdrop-blur-sm rounded-lg" }, i))) })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: `min-h-screen bg-[#050f1f] p-6 ${className}`, children: _jsxs("div", { className: "text-center p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg", children: [_jsx(BarChart3, { className: "h-16 w-16 text-cyan-400 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-white mb-2", children: "Analytics Error" }), _jsx("p", { className: "text-gray-300 mb-4", children: error }), _jsxs("button", { onClick: fetchAnalytics, className: "bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Retry"] })] }) }));
    }
    if (!data) {
        return _jsx("div", { className: `min-h-screen bg-[#050f1f] p-6 ${className}`, children: _jsx("p", { className: "text-white", children: "No data available" }) });
    }
    return (_jsxs("div", { className: `min-h-screen bg-[#050f1f] p-6 space-y-6 ${className}`, children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-3xl font-bold text-white flex items-center gap-3", children: [_jsx(BarChart3, { className: "h-8 w-8 text-cyan-400" }), "Social Analytics Dashboard"] }), _jsx("p", { className: "text-gray-300 mt-2", children: "Comprehensive sharing analytics and insights" })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("select", { value: timeframe, onChange: (e) => setTimeframe(e.target.value), className: "px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400", children: [_jsx("option", { value: "7d", className: "bg-[#071327]", children: "Last 7 days" }), _jsx("option", { value: "30d", className: "bg-[#071327]", children: "Last 30 days" }), _jsx("option", { value: "90d", className: "bg-[#071327]", children: "Last 90 days" })] }), _jsxs("button", { onClick: fetchAnalytics, className: "px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-2", children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Refresh"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-3 bg-cyan-500/20 rounded-lg mr-4", children: _jsx(Share2, { className: "h-6 w-6 text-cyan-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400", children: "Total Shares" }), _jsx("p", { className: "text-2xl font-bold text-white", children: data.overview.totalShares.toLocaleString() })] })] }) }), _jsx("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-3 bg-purple-500/20 rounded-lg mr-4", children: _jsx(FileText, { className: "h-6 w-6 text-purple-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400", children: "Unique Articles" }), _jsx("p", { className: "text-2xl font-bold text-white", children: data.overview.uniqueArticles })] })] }) }), _jsx("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-3 bg-green-500/20 rounded-lg mr-4", children: _jsx(Users, { className: "h-6 w-6 text-green-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400", children: "Active Personas" }), _jsx("p", { className: "text-2xl font-bold text-white", children: data.overview.uniquePersonas })] })] }) }), _jsx("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-3 bg-orange-500/20 rounded-lg mr-4", children: _jsx(Globe, { className: "h-6 w-6 text-orange-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-400", children: "Platforms" }), _jsx("p", { className: "text-2xl font-bold text-white", children: data.overview.platforms })] })] }) })] }), _jsxs("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg", children: [_jsxs("h2", { className: "text-xl font-bold text-white mb-4 flex items-center gap-2", children: [_jsx(TrendingUp, { className: "h-5 w-5 text-cyan-400" }), "Platform Performance"] }), _jsx("div", { className: "space-y-3", children: data.platformBreakdown.map((platform) => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-cyan-500/20 rounded-lg text-cyan-400", children: getPlatformIcon(platform.platform) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-white capitalize", children: platform.platform }), _jsxs("p", { className: "text-sm text-gray-400", children: [platform.shares, " shares"] })] })] }), _jsx("div", { className: "text-right", children: _jsxs("span", { className: "bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg text-sm font-medium", children: [platform.percentage, "%"] }) })] }, platform.platform))) })] }), _jsxs("div", { className: "p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg", children: [_jsxs("h2", { className: "text-xl font-bold text-white mb-4 flex items-center gap-2", children: [_jsx(FileText, { className: "h-5 w-5 text-cyan-400" }), "Most Shared Articles"] }), _jsx("div", { className: "space-y-3", children: data.topArticles.slice(0, 5).map((article, index) => (_jsxs("div", { className: "flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("span", { className: "bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg text-sm font-bold", children: ["#", index + 1] }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-white line-clamp-1", children: article.title }), _jsxs("p", { className: "text-sm text-gray-400", children: [article.uniquePersonas, " personas \u2022 ", article.platformsUsed, " platforms"] })] })] }) }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-bold text-lg text-white", children: article.totalShares }), _jsx("p", { className: "text-xs text-gray-400", children: "shares" })] })] }, article.id))) })] })] }));
}
