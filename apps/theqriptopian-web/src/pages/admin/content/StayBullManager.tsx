import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentService, Content } from '@/services/contentService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StayBullManager() {
  const navigate = useNavigate();
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContent = async () => {
    try {
      const data = await contentService.getAllContentBySection('staybull');
      setContent(data);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const handleDelete = async (id: string) => {
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
  };

  const handleToggleStatus = async (item: Content) => {
    try {
      const newStatus = item.status === 'published' ? 'draft' : 'published';
      await contentService.updateContent(item.id, { status: newStatus });
      toast.success(`Article ${newStatus === 'published' ? 'published' : 'unpublished'}`);
      loadContent();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleToggleArchive = async (item: Content) => {
    try {
      const newStatus = item.status === 'archived' ? 'draft' : 'archived';
      await contentService.updateContent(item.id, { status: newStatus });
      toast.success(newStatus === 'archived' ? 'Article archived' : 'Article restored to draft');
      loadContent();
    } catch (error) {
      console.error('Error updating archive status:', error);
      toast.error('Failed to update archive status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground">StayBull</h1>
            <p className="text-muted-foreground mt-1">
              Manage market updates and trading insights
            </p>
          </div>
          <Button onClick={() => navigate('/admin/content/edit/new?section=staybull')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Article
          </Button>
        </div>

        {content.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No articles yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first StayBull article to get started
            </p>
            <Button onClick={() => navigate('/admin/content/edit/new?section=staybull')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Article
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {content.map((item) => (
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
                        <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                        {item.issue_ref && (
                          <Badge variant="outline" className="mb-2">
                            Issue #{item.issue_ref}
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={item.status === 'published' ? 'default' : 'secondary'}
                        className={item.status === 'archived' ? 'border-amber-500/30 bg-amber-500/10 text-amber-500' : undefined}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {item.excerpt && (
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {item.excerpt}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('/', '_blank')}
                        title="Preview on site"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={item.status === 'published' ? 'secondary' : 'default'}
                        size="sm"
                        onClick={() => handleToggleStatus(item)}
                      >
                        {item.status === 'published' ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button
                        variant={item.status === 'archived' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleArchive(item)}
                      >
                        {item.status === 'archived' ? 'Restore' : 'Archive'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/content/edit/${item.id}?section=staybull`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
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
