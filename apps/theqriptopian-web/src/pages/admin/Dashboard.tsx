import { useNavigate } from 'react-router-dom';
import { useIsAdminAA } from '@/hooks/useIsAdminAA';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LayoutGrid,
  Newspaper,
  Image,
  DollarSign,
  Scroll,
  BookOpen,
  TrendingUp,
  Shield,
  Upload,
  Library,
  BarChart3
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, loading, method, did } = useIsAdminAA();

  // DEV MODE: Skip authentication in local development
  const isDevelopment = import.meta.env.DEV;
  const skipAuth = isDevelopment;

  if (loading && !skipAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !skipAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You need administrator privileges to access this area.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Debug: isAdmin = {String(isAdmin)}
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const sections = [
    { name: 'Social Analytics', path: '/analytics', icon: BarChart3, description: 'View social sharing analytics', highlight: true },
    { name: 'Bulk Import', path: '/admin/content/import', icon: Upload, description: 'Import multiple content items' },
    { name: 'Codex', path: '/admin/content/codex', icon: Library, description: 'Digital Scrolls & Collectibles' },
    { name: 'Home Hero', path: '/admin/content/home-hero', icon: LayoutGrid, description: '3 main hero articles' },
    { name: 'Latest News', path: '/admin/content/latest-news', icon: Newspaper, description: 'News carousel' },
    { name: 'Second Hero', path: '/admin/content/second-hero', icon: Image, description: 'Bottom featured article' },
    { name: 'PennyDrops', path: '/admin/content/pennydrops', icon: DollarSign, description: 'Financial insights' },
    { name: 'Scrolls', path: '/admin/content/scrolls', icon: BookOpen, description: 'metaKnyts & The SynthSims' },
    { name: 'Kn0wdZ', path: '/admin/content/21knowdz', icon: Scroll, description: 'Dev & Creative resources' },
    { name: 'StayBull', path: '/admin/content/staybull', icon: TrendingUp, description: 'Market updates' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 pr-[72px]">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Content Management</h1>
              <p className="text-muted-foreground">
                Manage content across all sections of the application
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <Badge variant={method === 'aa-api' ? 'default' : 'secondary'}>
                {method === 'aa-api' ? 'AA-API Auth' : 'Legacy Auth'}
              </Badge>
              {did && (
                <Badge variant="outline" className="font-mono text-xs">
                  {did.substring(0, 20)}...
                </Badge>
              )}
            </div>
          </div>
          {skipAuth && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                ⚠️ Development Mode: Authentication bypassed for local development
              </p>
            </div>
          )}
          {method === 'legacy' && !skipAuth && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                💡 You're using legacy authentication. 
                <button 
                  onClick={() => navigate('/admin/setup-did')}
                  className="ml-2 text-primary hover:underline font-medium"
                >
                  Set up DID authentication
                </button>
                {' '}for enhanced security with AA-API.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.path}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(section.path)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{section.name}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
