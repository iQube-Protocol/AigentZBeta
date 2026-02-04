import { Button } from "@/components/ui/button";
import { BookOpen, Shield, Users, Newspaper } from "lucide-react";

export const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                The Qriptopian
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-6">
              <Button variant="ghost" size="sm" className="gap-2">
                <Newspaper className="h-4 w-4" />
                Articles
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Comics
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                Community
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <Shield className="h-4 w-4" />
                Verify
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-primary to-secondary">
              Subscribe
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
