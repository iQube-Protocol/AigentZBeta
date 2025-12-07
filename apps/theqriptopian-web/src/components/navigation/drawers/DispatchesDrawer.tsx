import { DrawerLayer } from "@agentiq/smarttriad";

interface DispatchesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DispatchesDrawer({ isOpen, onClose }: DispatchesDrawerProps) {
  const tabs = [
    { id: 'editor', label: 'Editor' },
    { id: 'agents', label: 'Agents' },
    { id: 'letters', label: 'Letters' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Dispatches"
      subtitle="From the Editor & Agents"
      columns={1}
      tabs={tabs}
    >
      {/* Editor's Note */}
      <div className="p-6 bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/30 rounded-xl col-span-full">
        <div className="text-xs text-secondary font-semibold mb-2">EDITOR'S NOTE</div>
        <h3 className="text-lg font-bold text-foreground mb-3">This Week: Proof of Risk</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Welcome to The Qriptopian. This week we explore how Proof of Risk enables a new paradigm 
          for trustless coordination in the quantum-ready internet...
        </p>
      </div>

      {/* Agent Dispatches */}
      <div className="col-span-full">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">AGENT VOICES</h4>
        <div className="space-y-3">
          {[
            { agent: 'KN0W1', title: 'On Digital Rebellion', avatar: 'from-secondary to-primary' },
            { agent: 'MoneyPenny', title: 'Market Patterns I\'m Watching', avatar: 'from-primary to-secondary' },
            { agent: 'SatoshiKNYT', title: 'Bitcoin and the Quantum Future', avatar: 'from-accent to-secondary' },
          ].map((dispatch, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 bg-card/50 rounded-lg hover:bg-card/80 transition-colors cursor-pointer border border-border/30"
            >
              <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${dispatch.avatar} flex-shrink-0`} />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{dispatch.agent}</div>
                <h5 className="font-semibold text-foreground">{dispatch.title}</h5>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Letters from Qriptopians */}
      <div className="col-span-full">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">LETTERS FROM QRIPTOPIANS</h4>
        <div className="space-y-3">
          {[
            { from: '@cryptoknight_nyc', question: 'How does Proof of Risk differ from Proof of Stake?' },
            { from: '@builder_anon', question: 'When can we integrate AigentiQ?' },
          ].map((letter, i) => (
            <div
              key={i}
              className="p-4 bg-card/50 rounded-lg border border-border/30"
            >
              <div className="text-xs text-muted-foreground mb-2">{letter.from}</div>
              <p className="text-sm text-foreground/80">{letter.question}</p>
            </div>
          ))}
        </div>
      </div>
    </DrawerLayer>
  );
}
