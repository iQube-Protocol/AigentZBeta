import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileJson, AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { contentService } from "@/services/contentService";

interface ImportItem {
  id?: string;
  title: string;
  excerpt?: string;
  thumbnail?: string;
  domain: string;
  placement: {
    section: string;
    tab?: string;
    position?: number;
    imageScale?: number;
    imageX?: number;
    imageY?: number;
    imagePosition?: string;
  };
  modalities?: {
    read?: { text: string; duration?: string };
    watch?: { video_url: string; duration?: string; thumbnail?: string };
    listen?: { audio_url: string; duration?: string; cover_image?: string };
    link?: { url: string; allow_embed?: boolean };
  };
  tags?: string[];
  format?: string;
  type?: string;
  status?: 'draft' | 'published' | 'archived';
  issue_ref?: string;
  author_id?: string;
  author_type?: 'agent' | 'human';
}

interface PreviewItem extends ImportItem {
  _action: 'insert' | 'update' | 'skip';
  _reason?: string;
  _existingId?: string;
}

interface ImportStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

// Required fields for validation
const REQUIRED_FIELDS = ['title', 'domain', 'placement'];

export default function ContentImporter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [existingContent, setExistingContent] = useState<any[]>([]);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    loadExistingContent();
  }, []);

  const loadExistingContent = async () => {
    try {
      const { data } = await supabase
        .from('content')
        .select('id, title, domain, placement');
      setExistingContent(data || []);
    } catch (error) {
      console.error('Error loading existing content:', error);
    }
  };

  // Validate a single item against the spec
  const validateItem = (item: any, index: number): string[] => {
    const errors: string[] = [];
    
    for (const field of REQUIRED_FIELDS) {
      if (!item[field]) {
        errors.push(`Item ${index + 1}: Missing required field "${field}"`);
      }
    }
    
    if (item.placement && !item.placement.section) {
      errors.push(`Item ${index + 1}: placement.section is required`);
    }
    
    if (item.domain && !['home', 'pennydrops', 'scrolls', 'kn0wdz', 'signals', 'staybull'].includes(item.domain)) {
      errors.push(`Item ${index + 1}: Invalid domain "${item.domain}"`);
    }
    
    if (item.status && !['draft', 'published', 'archived'].includes(item.status)) {
      errors.push(`Item ${index + 1}: Invalid status "${item.status}"`);
    }
    
    return errors;
  };

  // Check if item already exists (by ID or title+domain+section)
  const checkDuplicate = (item: ImportItem): { action: 'insert' | 'update' | 'skip'; existingId?: string; reason?: string } => {
    // Check by ID first
    if (item.id) {
      const existingById = existingContent.find(e => e.id === item.id);
      if (existingById) {
        return { action: 'update', existingId: existingById.id, reason: 'ID match' };
      }
    }
    
    // Check by title + domain + section
    const titleKey = `${item.title.toLowerCase()}-${item.domain}-${item.placement?.section}`;
    const existingByTitle = existingContent.find(e => {
      const eKey = `${e.title?.toLowerCase()}-${e.domain}-${(e.placement as any)?.section}`;
      return eKey === titleKey;
    });
    
    if (existingByTitle) {
      return { action: 'skip', existingId: existingByTitle.id, reason: 'Duplicate (title+domain+section)' };
    }
    
    return { action: 'insert' };
  };

  // Calculate read duration if missing
  const calculateReadDuration = (text: string): string => {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  };

  const handlePreview = () => {
    setValidationErrors([]);
    setImportStats(null);
    
    try {
      const parsed = JSON.parse(jsonInput);
      const items: ImportItem[] = Array.isArray(parsed) ? parsed : parsed.content_items || [];
      
      if (items.length === 0) {
        toast({
          title: "No items found",
          description: "JSON must be an array of content items",
          variant: "destructive",
        });
        return;
      }
      
      // Validate all items
      const allErrors: string[] = [];
      items.forEach((item, index) => {
        allErrors.push(...validateItem(item, index));
      });
      
      if (allErrors.length > 0) {
        setValidationErrors(allErrors);
        toast({
          title: "Validation errors",
          description: `${allErrors.length} validation error(s) found`,
          variant: "destructive",
        });
        return;
      }
      
      // Check for duplicates and assign actions
      const previewWithActions: PreviewItem[] = items.map(item => {
        const { action, existingId, reason } = checkDuplicate(item);
        return {
          ...item,
          _action: action,
          _existingId: existingId,
          _reason: reason,
        };
      });
      
      setPreviewItems(previewWithActions);
      
      const insertCount = previewWithActions.filter(i => i._action === 'insert').length;
      const updateCount = previewWithActions.filter(i => i._action === 'update').length;
      const skipCount = previewWithActions.filter(i => i._action === 'skip').length;
      
      toast({
        title: "Preview ready",
        description: `${insertCount} new, ${updateCount} updates, ${skipCount} skipped`,
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON syntax",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (previewItems.length === 0) {
      toast({
        title: "No items to import",
        description: "Please preview your content first",
        variant: "destructive",
      });
      return;
    }

    // Skip auth check in dev mode
    if (!isDev) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Session expired",
          description: "Please sign in again",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
    }

    setIsImporting(true);
    const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

    try {
      for (const item of previewItems) {
        if (item._action === 'skip') {
          stats.skipped++;
          continue;
        }
        
        try {
          // Auto-calculate read duration if needed
          if (item.modalities?.read?.text && !item.modalities.read.duration) {
            item.modalities.read.duration = calculateReadDuration(item.modalities.read.text);
          }
          
          // Prepare content data
          const contentData = {
            title: item.title,
            excerpt: item.excerpt || '',
            thumbnail: item.thumbnail || null,
            domain: item.domain,
            format: item.format || 'article',
            type: item.type || 'article',
            status: item.status || 'published',
            placement: {
              section: item.placement.section,
              tab: item.placement.tab || '',
              position: item.placement.position || 1,
              imageScale: item.placement.imageScale || 100,
              imageX: item.placement.imageX || 50,
              imageY: item.placement.imageY || 50,
              imagePosition: item.placement.imagePosition || 'center',
            },
            modalities: item.modalities || {},
            tags: item.tags || [],
            issue_ref: item.issue_ref || '',
            author_id: item.author_id || null,
            author_type: item.author_type || null,
            content: {},
          };
          
          if (item._action === 'update' && item._existingId) {
            await contentService.updateContent(item._existingId, contentData);
            stats.updated++;
          } else {
            await contentService.createContent(contentData as any);
            stats.inserted++;
          }
        } catch (error) {
          console.error(`Error importing "${item.title}":`, error);
          stats.errors++;
        }
      }

      setImportStats(stats);
      
      toast({
        title: "Import complete",
        description: `${stats.inserted} inserted, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`,
      });

      // Refresh existing content list
      await loadExistingContent();
      
      if (stats.errors === 0) {
        setJsonInput("");
        setPreviewItems([]);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: (error as Error).message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Bulk Content Import</h1>
          <p className="text-muted-foreground">
            Import multiple content items at once using JSON
          </p>
          {isDev && (
            <Badge variant="outline" className="mt-2 bg-yellow-500/10 text-yellow-600 border-yellow-500/50">
              Development Mode - Auth bypassed
            </Badge>
          )}
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                JSON Input
              </CardTitle>
              <CardDescription>
                Paste your content items JSON array. Required fields: title, domain, placement.section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[
  {
    "title": "Article Title",
    "domain": "home",
    "placement": { "section": "home-hero", "position": 1 },
    "modalities": {
      "read": { "text": "Full article content..." }
    },
    "status": "published"
  }
]`}
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handlePreview} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Preview Items
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={previewItems.length === 0 || isImporting}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? "Importing..." : `Import ${previewItems.filter(i => i._action !== 'skip').length} Items`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Validation Errors ({validationErrors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Import Stats */}
          {importStats && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Import Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {importStats.inserted} inserted</span>
                  <span className="text-blue-600">↻ {importStats.updated} updated</span>
                  <span className="text-yellow-600">⊘ {importStats.skipped} skipped</span>
                  {importStats.errors > 0 && (
                    <span className="text-red-600">✗ {importStats.errors} errors</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Table */}
          {previewItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Preview ({previewItems.length} items)</span>
                  <div className="flex gap-2 text-sm font-normal">
                    <Badge variant="default" className="bg-green-600">
                      {previewItems.filter(i => i._action === 'insert').length} new
                    </Badge>
                    <Badge variant="default" className="bg-blue-600">
                      {previewItems.filter(i => i._action === 'update').length} update
                    </Badge>
                    <Badge variant="secondary">
                      {previewItems.filter(i => i._action === 'skip').length} skip
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Review items before importing. Duplicates will be skipped.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Modalities</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewItems.map((item, index) => (
                        <TableRow key={index} className={item._action === 'skip' ? 'opacity-50' : ''}>
                          <TableCell>
                            {item._action === 'insert' && (
                              <Badge className="bg-green-600">Insert</Badge>
                            )}
                            {item._action === 'update' && (
                              <Badge className="bg-blue-600">Update</Badge>
                            )}
                            {item._action === 'skip' && (
                              <Badge variant="secondary" title={item._reason}>Skip</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={item.title}>
                            {item.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.domain}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.placement?.section}
                            {item.placement?.tab && ` / ${item.placement.tab}`}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {item.modalities?.read && (
                                <Badge variant="outline" className="text-xs">R</Badge>
                              )}
                              {item.modalities?.watch && (
                                <Badge variant="outline" className="text-xs">W</Badge>
                              )}
                              {item.modalities?.listen && (
                                <Badge variant="outline" className="text-xs">L</Badge>
                              )}
                              {item.modalities?.link && (
                                <Badge variant="outline" className="text-xs">🔗</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === 'published' ? 'default' : 'secondary'}
                              className={item.status === 'archived' ? 'border-amber-500/30 bg-amber-500/10 text-amber-500' : undefined}
                            >
                              {item.status || 'published'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
