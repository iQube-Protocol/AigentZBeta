import quantumTechHero from "@/assets/quantum-tech-hero.jpg";

export function SecondHeroSection() {
  return (
    <div className="w-full h-[60vh] relative flex-shrink-0 bg-[#050f1f]">
      <img 
        src={quantumTechHero} 
        alt="Quantum Technology - The Future of Computing" 
        className="w-full h-full object-cover" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050f1f] via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-8 max-w-4xl">
          <h2 className="text-5xl font-bold text-[#d0f6ff] mb-6 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)]">
            Powering the Quantum Future
          </h2>
          <p className="text-xl text-[#8fb3c0] mb-8 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            Advanced computing infrastructure for the next generation of digital innovation
          </p>
          <button className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors shadow-[0_0_20px_rgba(0,196,255,0.3)]">
            Explore Technology
          </button>
        </div>
      </div>
    </div>
  );
}
