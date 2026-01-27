/**
 * Content Browser
 * 
 * Browse and search Nakamoto knowledge base content
 */

import { useState } from "react";
import { Search, Filter, BookOpen, Code2, BarChart3, Network, GitBranch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NakamotoContent, ContentBrowserProps } from "@/app/types/nakamoto";

export function ContentBrowser({ 
  content, 
  selectedContent, 
  onContentSelect, 
  searchQuery, 
  onSearchChange, 
  selectedTags, 
  onTagsChange, 
  loading = false 
}: ContentBrowserProps) {
  const [showFilters, setShowFilters] = useState(false);

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'mermaid-diagram': return <GitBranch className="w-4 h-4 text-cyan-400" />;
      case 'code-example': return <Code2 className="w-4 h-4 text-purple-400" />;
      case 'chart': return <BarChart3 className="w-4 h-4 text-green-400" />;
      case 'blockchain-viz': return <Network className="w-4 h-4 text-orange-400" />;
      default: return <BookOpen className="w-4 h-4 text-blue-400" />;
    }
  };

  const allTags = Array.from(new Set(content.flatMap(item => item.tags)));

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Filter by tags:</div>
            <div className="flex flex-wrap gap-1">
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    if (selectedTags.includes(tag)) {
                      onTagsChange(selectedTags.filter(t => t !== tag));
                    } else {
                      onTagsChange([...selectedTags, tag]);
                    }
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading content...</p>
            </div>
          </div>
        ) : content.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No content found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.map(item => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all hover:scale-105 ${
                  selectedContent?.id === item.id ? 'ring-2 ring-cyan-400' : ''
                }`}
                onClick={() => onContentSelect(item)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getContentIcon(item.type)}
                      <Badge variant="outline" className="text-xs">
                        {item.type.replace('-', ' ')}
                      </Badge>
                    </div>
                    {item.scope === 'root' && (
                      <Badge variant="secondary" className="text-xs">Root</Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {item.description && (
                    <CardDescription className="text-xs mb-2">
                      {item.description}
                    </CardDescription>
                  )}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
