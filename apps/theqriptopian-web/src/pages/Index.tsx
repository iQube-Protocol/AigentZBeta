import { MoneyPennyHero } from "@/components/content/MoneyPennyHero";

const Index = () => {
  return (
    <div className="h-full">
      {/* Visual indicator - Qriptopian Thin Client */}
      <div className="fixed top-20 left-4 z-50 bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 rounded-lg px-4 py-2 text-cyan-400 text-sm font-mono">
        ✓ Qriptopian Thin Client (Port 8080)
      </div>
      <MoneyPennyHero />
    </div>
  );
};

export default Index;
