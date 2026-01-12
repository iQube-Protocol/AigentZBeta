import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentService, type Content } from '@/services/contentService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Edit, Trash2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function HomeHeroManager() {
  const navigate = useNavigate();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const data = await contentService.getAllContentBySection('home-hero');
      setContent(data);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      setContent(prev => prev.filter(item => item.id !== id));
      await contentService.deleteContent(id);
      toast.success('Article deleted');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete article');
      loadContent();
    }
  }

  async function handleToggleStatus(item: Content) {
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    
    try {
      console.log('[HomeHeroManager] Updating status:', { id: item.id, newStatus });
      const result = await contentService.updateContent(item.id, { status: newStatus });
      console.log('[HomeHeroManager] Update successful:', result);
      toast.success(`Article ${newStatus === 'published' ? 'published' : 'unpublished'}`);
      loadContent();
    } catch (error) {
      console.error('[HomeHeroManager] Error updating status:', error);
      toast.error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleToggleArchive(item: Content) {
    const newStatus = item.status === 'archived' ? 'draft' : 'archived';

    try {
      console.log('[HomeHeroManager] Updating archive status:', { id: item.id, newStatus });
      const result = await contentService.updateContent(item.id, { status: newStatus });
      console.log('[HomeHeroManager] Archive update successful:', result);
      toast.success(newStatus === 'archived' ? 'Article archived' : 'Article restored to draft');
      loadContent();
    } catch (error) {
      console.error('[HomeHeroManager] Error updating archive status:', error);
      toast.error(`Failed to update archive status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Home Hero Articles</h1>
              <p className="text-muted-foreground">Manage the 3 main hero articles</p>
            </div>
          </div>
          <Button onClick={() => navigate('/admin/content/edit/new?section=home-hero')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Article
          </Button>
        </div>

        {content.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No hero articles yet</p>
            <Button onClick={() => navigate('/admin/content/edit/new?section=home-hero')}>
              Create First Article
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {content.map((item, index) => (
              <Card key={item.id} className="p-6">
                <div className="flex gap-6">
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-48 h-32 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-muted-foreground">Position {index + 1}</span>
                          {item.issue_ref && (
                            <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                              {item.issue_ref}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              item.status === 'published'
                                ? 'bg-green-500/10 text-green-500'
                                : item.status === 'archived'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-yellow-500/10 text-yellow-500'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold">{item.title}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open('/', '_blank')}
                          title="Preview on site"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'published' ? 'secondary' : 'default'}
                          onClick={() => handleToggleStatus(item)}
                          title={item.status === 'published' ? 'Unpublish' : 'Publish'}
                        >
                          {item.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'archived' ? 'secondary' : 'outline'}
                          onClick={() => handleToggleArchive(item)}
                          title={item.status === 'archived' ? 'Restore' : 'Archive'}
                        >
                          {item.status === 'archived' ? 'Restore' : 'Archive'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/content/edit/${item.id}?section=home-hero`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {item.excerpt || 'No excerpt available'}
                    </p>
                    <div className="flex gap-2">
                      {contentService.hasModality(item, 'read') && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Read</span>
                      )}
                      {contentService.hasModality(item, 'watch') && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Watch</span>
                      )}
                      {contentService.hasModality(item, 'listen') && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Listen</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
