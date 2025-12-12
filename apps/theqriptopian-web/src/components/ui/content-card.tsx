import * as React from "react";
import { cn } from "@/lib/utils";

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'agent' | 'featured' | 'media';
  thumbnail?: string;
  avatar?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  description?: string;
  meta?: string[];
}

const ContentCard = React.forwardRef<HTMLDivElement, ContentCardProps>(
  ({ className, variant = 'default', thumbnail, avatar, badge, title, subtitle, description, meta, children, ...props }, ref) => {
    
    return (
      <div
        ref={ref}
        className={cn(
          "p-4 rounded-lg border transition-all cursor-pointer",
          "bg-card/50 border-border/30",
          "hover:bg-card/80 hover:border-border/50",
          "group",
          className
        )}
        {...props}
      >
        {/* Thumbnail for media variant */}
        {variant === 'media' && thumbnail && (
          <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted">
            <img 
              src={thumbnail} 
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}

        {/* Agent header with avatar */}
        {variant === 'agent' && avatar && (
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br", avatar)} />
            <div className="flex-1">
              <div className="font-semibold text-foreground text-sm">{title}</div>
              {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
            </div>
          </div>
        )}

        {/* Featured variant with gradient */}
        {variant === 'featured' && (
          <div className="mb-3">
            {badge && (
              <div className="text-xs font-semibold text-primary mb-2">{badge}</div>
            )}
          </div>
        )}

        {/* Default content */}
        {variant !== 'agent' && (
          <>
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground leading-snug">{title}</h4>
              {badge && variant !== 'featured' && (
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded whitespace-nowrap ml-2">
                  {badge}
                </span>
              )}
            </div>
            
            {subtitle && (
              <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
            )}
          </>
        )}

        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{description}</p>
        )}

        {/* Meta information */}
        {meta && meta.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {meta.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                {item}
                {i < meta.length - 1 && <span className="text-border">•</span>}
              </span>
            ))}
          </div>
        )}

        {/* Custom children content */}
        {children}
      </div>
    );
  }
);

ContentCard.displayName = "ContentCard";

export { ContentCard };
