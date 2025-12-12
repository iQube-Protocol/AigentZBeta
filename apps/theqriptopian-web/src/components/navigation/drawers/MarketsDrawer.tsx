import { DrawerLayer } from "@agentiq/smarttriad";

interface MarketsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketsDrawer({ isOpen, onClose }: MarketsDrawerProps) {
  const tabs = [
    { id: 'briefing', label: 'Briefing' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'learn', label: 'Learn' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Markets"
      subtitle="MoneyPenny's Ledger"
      columns={2}
      tabs={tabs}
    >
      {/* Agent Header */}
      <div className="flex items-center gap-4 p-4 bg-primary/10 border border-primary/30 rounded-xl col-span-full">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary" />
        <div>
          <div className="font-semibold text-foreground">MoneyPenny</div>
          <div className="text-xs text-muted-foreground">Analyzing • Updated 2 min ago</div>
        </div>
      </div>

      {/* Market Summary - 3 columns within the 2-column grid */}
      {[
        { label: 'Q¢ Volume (24h)', value: '$1.2M', change: '+15%', positive: true },
        { label: 'Avg Spread', value: '0.03%', change: '-12%', positive: true },
        { label: 'Active Strategies', value: '47', change: '+3', positive: true },
      ].map((stat, i) => (
        <div key={i} className="p-4 bg-card/50 rounded-lg border border-border/30">
          <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
          <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
          <div className={stat.positive ? 'text-primary text-sm' : 'text-destructive text-sm'}>
            {stat.change}
          </div>
        </div>
      ))}

      {/* Recent Briefings - full width */}
      <div className="col-span-full">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">RECENT BRIEFINGS</h4>
        <div className="space-y-3">
          {[
            'Weekly Market Patterns Analysis',
            'Strategies in the Sandbox: HFT Results',
            'Understanding Micro-Liquidity',
          ].map((title, i) => (
            <div
              key={i}
              className="p-4 bg-card/50 rounded-lg hover:bg-card/80 transition-colors cursor-pointer border border-border/30"
            >
              <div className="font-medium text-foreground">{title}</div>
              <div className="text-xs text-muted-foreground mt-1">by MoneyPenny • 2 days ago</div>
            </div>
          ))}
        </div>
      </div>
    </DrawerLayer>
  );
}
