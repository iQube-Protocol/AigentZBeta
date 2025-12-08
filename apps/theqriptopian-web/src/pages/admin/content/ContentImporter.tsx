import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileJson, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ContentImporter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState("");
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please sign in to import content",
        variant: "destructive",
      });
      navigate("/auth");
    }
  };

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : parsed.content_items || [];
      setPreviewItems(items);
      toast({
        title: "Preview ready",
        description: `${items.length} items loaded for preview`,
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

    // Verify session before importing
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

    setIsImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('import-content', {
        body: { content_items: previewItems },
      });

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `${data.imported} items imported successfully`,
      });

      setJsonInput("");
      setPreviewItems([]);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

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
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                JSON Input
              </CardTitle>
              <CardDescription>
                Paste your content items JSON array here. Each item should have: title, domain, format, type, content, placement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[\n  {\n    "title": "Article Title",\n    "domain": "21knowdz",\n    "format": "article",\n    "type": "educational",\n    "status": "published",\n    "content": { "body": "Content here..." },\n    "placement": { "section": "feature", "tab": "dev" }\n  }\n]`}
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handlePreview} variant="outline">
                  Preview Items
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={previewItems.length === 0 || isImporting}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? "Importing..." : `Import ${previewItems.length} Items`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {previewItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview ({previewItems.length} items)</CardTitle>
                <CardDescription>
                  Review items before importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Placement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.domain}</Badge>
                          </TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{item.format}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                              {item.status || 'draft'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.placement?.section} / {item.placement?.tab}
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
