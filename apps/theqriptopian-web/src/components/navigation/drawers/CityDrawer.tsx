import { DrawerLayer } from "@agentiq/smarttriad";

interface CityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CityDrawer({ isOpen, onClose }: CityDrawerProps) {
  const tabs = [
    { id: 'events', label: 'Events' },
    { id: 'recaps', label: 'Recaps' },
    { id: 'calendar', label: 'Calendar' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="City"
      subtitle="NYC & The Real World"
      columns={1}
      tabs={tabs}
    >
      {/* City Header */}
      <div className="p-6 bg-gradient-to-br from-accent/20 to-secondary/20 border border-accent/30 rounded-xl col-span-full">
        <div className="text-xs text-accent font-semibold mb-2">CURRENT CITY</div>
        <h3 className="text-2xl font-bold text-foreground mb-1">New York City</h3>
        <p className="text-muted-foreground text-sm">The Digital Mint</p>
        <div className="mt-4 text-sm text-foreground/80">
          <span className="text-primary">Next Event:</span> Bitcoin 2026 • Jun 15-17
        </div>
      </div>

      {/* Upcoming Events - full width single column */}
      <div className="col-span-full">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">UPCOMING EVENTS</h4>
        <div className="space-y-3">
          {[
            { title: 'metaKNYT Gallery Opening', date: 'Dec 1, 2025', location: 'SoHo, NYC', type: 'Art Exhibit' },
            { title: 'Q¢ Trading Workshop', date: 'Dec 5, 2025', location: 'Wall Street', type: 'Workshop' },
            { title: 'Qriptopian Meetup', date: 'Dec 10, 2025', location: 'Brooklyn', type: 'Social' },
          ].map((event, i) => (
            <div
              key={i}
              className="p-4 bg-card/50 rounded-lg hover:bg-card/80 transition-colors cursor-pointer border border-border/30"
            >
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-foreground">{event.title}</h5>
                <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded">
                  {event.type}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{event.date}</div>
              <div className="text-xs text-muted-foreground/70">{event.location}</div>
            </div>
          ))}
        </div>
      </div>
    </DrawerLayer>
  );
}
