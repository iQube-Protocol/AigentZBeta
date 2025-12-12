import { DrawerLayer } from "@agentiq/smarttriad";

interface LogosDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogosDrawer({ isOpen, onClose }: LogosDrawerProps) {
  const tabs = [
    { id: 'stack', label: 'Stack' },
    { id: 'proofs', label: 'Proofs' },
    { id: 'tutorials', label: 'Tutorials' },
    { id: 'economics', label: 'Economics' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Logos"
      subtitle="The Stack"
      columns={1}
      tabs={tabs}
    >
      {/* Featured Protocol */}
      <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/30 rounded-xl col-span-full">
        <div className="text-xs text-primary font-semibold mb-2">FEATURED PROTOCOL</div>
        <h3 className="text-2xl font-bold text-foreground mb-2">DIDQube</h3>
        <p className="text-muted-foreground mb-4">Verifiable Identity for Agents</p>
        <div className="aspect-video bg-accent/20 rounded-lg" />
      </div>

      {/* Content Cards - will flow in 2 columns due to columns prop */}
      {[
        { title: 'Understanding Proof of Risk', difficulty: 'Intermediate', time: '5 min' },
        { title: 'Integrate Q¢ in 3 Steps', difficulty: 'Advanced', time: '10 min' },
        { title: 'Three Signal Currencies', difficulty: 'Beginner', time: '7 min' },
        { title: 'iQubes Deep Dive', difficulty: 'Advanced', time: '15 min' },
      ].map((item, i) => (
        <div
          key={i}
          className="p-4 bg-card/50 rounded-lg hover:bg-card/80 transition-colors cursor-pointer border border-border/30"
        >
          <h4 className="font-semibold text-foreground mb-2">{item.title}</h4>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-primary/20 text-primary rounded">{item.difficulty}</span>
            <span>{item.time}</span>
          </div>
        </div>
      ))}
    </DrawerLayer>
  );
}
