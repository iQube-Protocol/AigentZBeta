import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted to-background" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container relative z-10 px-4 mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-card/50 backdrop-blur-sm border border-border">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Powered by Verifiable Intelligence</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient">
          The Qriptopian
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto">
          Digital Intelligence Meets Immutable Truth
        </p>
        
        <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
          Experience journalism where every story is verifiable, every insight is traceable, 
          and AI agents work alongside humans to uncover the truth in the digital age.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-secondary">
            Explore Stories
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border">
            <div className="text-3xl font-bold text-primary mb-2">100%</div>
            <div className="text-sm text-muted-foreground">Verifiable Content</div>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border">
            <div className="text-3xl font-bold text-secondary mb-2">AI+Human</div>
            <div className="text-sm text-muted-foreground">Hybrid Intelligence</div>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
              Web3
            </div>
            <div className="text-sm text-muted-foreground">Native Platform</div>
          </div>
        </div>
      </div>
    </section>
  );
};
