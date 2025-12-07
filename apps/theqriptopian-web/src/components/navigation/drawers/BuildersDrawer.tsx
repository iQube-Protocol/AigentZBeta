import { DrawerLayer } from "@agentiq/smarttriad";

interface BuildersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuildersDrawer({ isOpen, onClose }: BuildersDrawerProps) {
  const tabs = [
    { id: 'blueprints', label: 'Blueprints' },
    { id: 'showcase', label: 'Show & Tell' },
    { id: 'docs', label: 'Docs' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Builders"
      subtitle="Protocol & Product Workshop"
      columns={2}
      tabs={tabs}
    >
      {/* Quick Start */}
      <div className="p-6 bg-gradient-to-br from-accent/20 to-secondary/20 border border-accent/30 rounded-xl col-span-full">
        <h3 className="text-lg font-bold text-foreground mb-4">Integrate AigentiQ in 10 Minutes</h3>
        <div className="space-y-2">
          {[
            'Install @qripto/aigentiq',
            'Configure agent keys',
            'Connect to A2A network',
            'Deploy your first agent',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-foreground/80">
              <div className="h-6 w-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                {i + 1}
              </div>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tutorial Grid */}
      {[
        { title: 'Build a Q¢ Trading Bot', tech: ['TypeScript', 'AigentiQ'], difficulty: 'Intermediate' },
        { title: 'Verify Content with DIDQube', tech: ['React', 'DIDQube'], difficulty: 'Beginner' },
        { title: 'Create Custom iQubes', tech: ['Node.js', 'x402'], difficulty: 'Advanced' },
        { title: 'Deploy Multi-Agent System', tech: ['Docker', 'AigentiQ'], difficulty: 'Advanced' },
      ].map((tutorial, i) => (
        <div
          key={i}
          className="p-4 bg-card/50 rounded-lg hover:bg-card/80 transition-colors cursor-pointer border border-border/30"
        >
          <h4 className="font-semibold text-foreground mb-2">{tutorial.title}</h4>
          <div className="flex flex-wrap gap-2 mb-2">
            {tutorial.tech.map((t, j) => (
              <span key={j} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded">
                {t}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{tutorial.difficulty}</div>
        </div>
      ))}
    </DrawerLayer>
  );
}
