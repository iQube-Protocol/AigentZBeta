import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { contentService, type Content, type ContentSection } from '@/services/contentService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Upload, Eye, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ContentEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') as ContentSection;
  const contentType = searchParams.get('type') as 'article' | 'resource' || 'article';
  const tab = searchParams.get('tab') || '';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [readText, setReadText] = useState('');
  const [readDuration, setReadDuration] = useState('');
  const [watchUrl, setWatchUrl] = useState('');
  const [watchDuration, setWatchDuration] = useState('');
  const [listenUrl, setListenUrl] = useState('');
  const [listenDuration, setListenDuration] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkAllowEmbed, setLinkAllowEmbed] = useState(true);
  const [issueRef, setIssueRef] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imagePosition, setImagePosition] = useState('center');
  const [imageScale, setImageScale] = useState(100);
  const [imageX, setImageX] = useState(50);
  const [imageY, setImageY] = useState(50);
  const [position, setPosition] = useState(1);

  useEffect(() => {
    if (id && id !== 'new') {
      loadContent();
    } else {
      setLoading(false);
    }
  }, [id]);

  async function loadContent() {
    try {
      const content = await contentService.getContent(id!);
      setTitle(content.title);
      setExcerpt(content.excerpt || '');
      setThumbnail(content.thumbnail || '');
      setIssueRef(content.issue_ref || '');
      
      const placement = content.placement as any || {};
      setImagePosition(placement.imagePosition || 'center');
      setImageScale(placement.imageScale || 100);
      setImageX(placement.imageX || 50);
      setImageY(placement.imageY || 50);
      setPosition(placement.position || 1);

      const modalities = content.modalities as any || {};
      if (modalities.read) {
        setReadText(modalities.read.text || '');
        setReadDuration(modalities.read.duration || '');
      }
      if (modalities.watch) {
        setWatchUrl(modalities.watch.video_url || '');
        setWatchDuration(modalities.watch.duration || '');
      }
      if (modalities.listen) {
        setListenUrl(modalities.listen.audio_url || '');
        setListenDuration(modalities.listen.duration || '');
      }
      if (modalities.link) {
        setLinkUrl(modalities.link.url || '');
        setLinkAllowEmbed(modalities.link.allow_embed !== false);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  function calculateReadDuration(text: string): string {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  }

  async function extractMediaDuration(file: File, type: 'video' | 'audio'): Promise<string> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const media = type === 'video' ? document.createElement('video') : document.createElement('audio');
      
      media.onloadedmetadata = () => {
        const duration = media.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        URL.revokeObjectURL(url);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };
      
      media.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      
      media.src = url;
    });
  }

  async function handleFileUpload(file: File, type: 'thumbnail' | 'video' | 'audio') {
    setUploading(true);
    
    // Check file size and show appropriate message
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 100) {
      toast.info(`Uploading ${fileSizeMB.toFixed(1)}MB file... This may take a moment.`);
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { data, error } = await supabase.storage
        .from('content-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Provide helpful error message for file size issues
        if (error.message?.includes('exceeded the maximum allowed size')) {
          throw new Error(
            `File size (${fileSizeMB.toFixed(1)}MB) exceeds the project limit. ` +
            'Go to Supabase Dashboard → Storage → Settings → "Global file size limit" and increase it.'
          );
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('content-media')
        .getPublicUrl(filePath);

      if (type === 'thumbnail') {
        setThumbnail(publicUrl);
      } else if (type === 'video') {
        setWatchUrl(publicUrl);
        const duration = await extractMediaDuration(file, 'video');
        if (duration) setWatchDuration(duration);
      } else if (type === 'audio') {
        setListenUrl(publicUrl);
        const duration = await extractMediaDuration(file, 'audio');
        if (duration) setListenDuration(duration);
      }

      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(publish = false) {
    if (!title) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      // Get current user for author_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save content');
        setSaving(false);
        return;
      }

      const modalities: any = {};
      if (readText) {
        modalities.read = { text: readText, duration: readDuration };
      }
      if (watchUrl) {
        modalities.watch = { video_url: watchUrl, duration: watchDuration };
      }
      if (listenUrl) {
        modalities.listen = { audio_url: listenUrl, duration: listenDuration };
      }
      if (linkUrl) {
        modalities.link = { url: linkUrl, allow_embed: linkAllowEmbed };
      }

      const contentData = {
        title,
        excerpt,
        thumbnail,
        modalities,
        placement: { section, tab, imagePosition, imageScale, imageX, imageY, position },
        status: publish ? ('published' as const) : ('draft' as const),
        domain: 'qriptopian',
        format: contentType === 'resource' ? 'link' : 'article',
        type: contentType,
        content: {},
        issue_ref: issueRef,
        author_type: 'agent' as const,
        author_id: user.id
      } as const;

      if (id && id !== 'new') {
        await contentService.updateContent(id, contentData);
        toast.success(publish ? 'Content published' : 'Content saved as draft');
      } else {
        await contentService.createContent(contentData);
        toast.success(publish ? 'Content published' : 'Content saved as draft');
      }

      // Navigate to the appropriate section manager
      const sectionRoutes: Record<ContentSection, string> = {
        'home-hero': '/admin/content/home-hero',
        'latest-news': '/admin/content/latest-news',
        'second-hero': '/admin/content/second-hero',
        'pennydrops': '/admin/content/pennydrops',
        'scrolls': '/admin/content/scrolls',
        '21knowdz': '/admin/content/21knowdz',
        'staybull': '/admin/content/staybull'
      };
      navigate(sectionRoutes[section] || '/admin');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  }

  function handlePreview() {
    window.open('/', '_blank');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                {id === 'new' ? `Create ${contentType === 'resource' ? 'Resource' : 'Article'}` : `Edit ${contentType === 'resource' ? 'Resource' : 'Article'}`}
              </h1>
              <p className="text-muted-foreground">Section: {section} {tab && `| Tab: ${tab}`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" />
              Preview on Site
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {saving ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={contentType === 'resource' ? 'Enter resource title' : 'Enter article title'}
                  />
                </div>

                <div>
                  <Label htmlFor="excerpt">{contentType === 'resource' ? 'Description' : 'Excerpt'}</Label>
                  <Textarea
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder={contentType === 'resource' ? 'Brief description of the resource' : 'Short summary or subtitle'}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="issueRef">Issue Reference</Label>
                  <Input
                    id="issueRef"
                    value={issueRef}
                    onChange={(e) => setIssueRef(e.target.value)}
                    placeholder="e.g., #0, #1, Issue 1"
                  />
                </div>

                <div>
                  <Label htmlFor="position">Display Position *</Label>
                  <Input
                    id="position"
                    type="number"
                    min="1"
                    value={position}
                    onChange={(e) => setPosition(parseInt(e.target.value) || 1)}
                    placeholder="1 = first, 2 = second, etc."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first in the section</p>
                </div>

                <div>
                  <Label htmlFor="thumbnail">Thumbnail URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="thumbnail"
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      disabled={uploading}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileUpload(file, 'thumbnail');
                        };
                        input.click();
                      }}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {contentType === 'resource' ? 'Resource Link' : 'Content Modalities'}
              </h3>
              {contentType === 'resource' ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resourceUrl">Resource URL *</Label>
                    <Input
                      id="resourceUrl"
                      value={readText}
                      onChange={(e) => setReadText(e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The URL this resource links to
                    </p>
                  </div>
                </div>
              ) : (
              <Tabs defaultValue="read">
                <TabsList className="w-full">
                  <TabsTrigger value="read" className="flex-1">Read</TabsTrigger>
                  <TabsTrigger value="watch" className="flex-1">Watch</TabsTrigger>
                  <TabsTrigger value="listen" className="flex-1">Listen</TabsTrigger>
                  <TabsTrigger value="link" className="flex-1">Link</TabsTrigger>
                </TabsList>

                <TabsContent value="read" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="readText">Article Content</Label>
                    <Textarea
                      id="readText"
                      value={readText}
                      onChange={(e) => {
                        setReadText(e.target.value);
                        if (e.target.value.trim()) {
                          setReadDuration(calculateReadDuration(e.target.value));
                        }
                      }}
                      placeholder="Full article text..."
                      rows={10}
                    />
                  </div>
                  <div>
                    <Label htmlFor="readDuration">Read Duration (auto-calculated)</Label>
                    <Input
                      id="readDuration"
                      value={readDuration}
                      onChange={(e) => setReadDuration(e.target.value)}
                      placeholder="e.g., 12 min read"
                      disabled
                    />
                  </div>
                </TabsContent>

                <TabsContent value="watch" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="watchUrl">Video URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="watchUrl"
                        value={watchUrl}
                        onChange={(e) => setWatchUrl(e.target.value)}
                        placeholder="YouTube, Vimeo, or direct video URL"
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        disabled={uploading}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'video/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleFileUpload(file, 'video');
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="watchDuration">Watch Duration (auto-detected)</Label>
                    <Input
                      id="watchDuration"
                      value={watchDuration}
                      onChange={(e) => setWatchDuration(e.target.value)}
                      placeholder="e.g., 15:30"
                      disabled
                    />
                  </div>
                </TabsContent>

                <TabsContent value="listen" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="listenUrl">Audio URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="listenUrl"
                        value={listenUrl}
                        onChange={(e) => setListenUrl(e.target.value)}
                        placeholder="Direct audio file URL or podcast link"
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        disabled={uploading}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'audio/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleFileUpload(file, 'audio');
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="listenDuration">Listen Duration (auto-detected)</Label>
                    <Input
                      id="listenDuration"
                      value={listenDuration}
                      onChange={(e) => setListenDuration(e.target.value)}
                      placeholder="e.g., 10:45"
                      disabled
                    />
                  </div>
                </TabsContent>

                <TabsContent value="link" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="linkUrl">Website URL</Label>
                    <Input
                      id="linkUrl"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com/article"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      External website to display or link to
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="linkAllowEmbed"
                      checked={linkAllowEmbed}
                      onChange={(e) => setLinkAllowEmbed(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="linkAllowEmbed" className="cursor-pointer">
                      Allow embedding in iframe
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If unchecked, will open in a new tab instead of embedding
                  </p>
                </TabsContent>
              </Tabs>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Image Positioning</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="imagePosition">Image Position</Label>
                  <select
                    id="imagePosition"
                    value={imagePosition}
                    onChange={(e) => setImagePosition(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="imageScale">Image Scale ({imageScale}%)</Label>
                  <input
                    type="range"
                    id="imageScale"
                    min="50"
                    max="200"
                    step="5"
                    value={imageScale}
                    onChange={(e) => setImageScale(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imageX">Horizontal ({imageX}%)</Label>
                    <input
                      type="range"
                      id="imageX"
                      min="0"
                      max="100"
                      step="5"
                      value={imageX}
                      onChange={(e) => setImageX(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">0=left, 50=center, 100=right</p>
                  </div>
                  <div>
                    <Label htmlFor="imageY">Vertical ({imageY}%)</Label>
                    <input
                      type="range"
                      id="imageY"
                      min="0"
                      max="100"
                      step="5"
                      value={imageY}
                      onChange={(e) => setImageY(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">0=top, 50=center, 100=bottom</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
              <div className="relative w-full aspect-video bg-[#050f1f] rounded-lg overflow-hidden">
                {thumbnail ? (
                  <>
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${thumbnail})`,
                        backgroundSize: `${imageScale}%`,
                        backgroundPosition: `${imageX}% ${imageY}%`,
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050f1f]" />
                    <div className="absolute inset-0 flex items-end p-4">
                      <div>
                        {title && (
                          <h4 className="font-bold text-[#d0f6ff] text-lg mb-1 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)]">
                            {title}
                          </h4>
                        )}
                        {excerpt && (
                          <p className="text-sm text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                            {excerpt}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No thumbnail uploaded
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {readText && (
                  <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded">Read</span>
                )}
                {watchUrl && (
                  <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded">Watch</span>
                )}
                {listenUrl && (
                  <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded">Listen</span>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
