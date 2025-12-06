/**
 * MoneyPenny Drawer Configuration Example
 * 
 * Demonstrates the modal-centered variant for immersive focus modes
 */

export const moneyPennyDrawerConfig = {
  drawers: [
    {
      id: "portfolio",
      label: "Portfolio",
      icon: "TrendingUp",
      
      // Centered modal for immersive analytics
      defaultSize: "modal-centered" as const,
      defaultMenuBehavior: {
        mode: "fixed-rail" as const,
        side: "right" as const,
      },
      
      tabs: [
        {
          id: "overview",
          label: "Overview",
          // Portfolio analytics - stay modal-centered
        },
        {
          id: "positions",
          label: "Positions",
          // Live positions - stay modal-centered
        },
      ],
    },
    
    {
      id: "metavatar",
      label: "MetaAvatar",
      icon: "Bot",
      
      // Full-screen immersive conversation
      defaultSize: "modal-centered" as const,
      defaultMenuBehavior: {
        mode: "auto-hide" as const,
        side: "right" as const,
        autoHideAfterMs: 3000,
      },
    },
    
    {
      id: "wallet",
      label: "Wallet",
      icon: "Wallet",
      
      // Standard wallet - narrow by default
      defaultSize: "wallet-narrow" as const,
      
      tabs: [
        {
          id: "balances",
          label: "Balances",
        },
        {
          id: "copilot",
          label: "Copilot",
          // Expand when Copilot active
          sizeOverride: "wallet-wide" as const,
        },
      ],
    },
    
    {
      id: "insights",
      label: "Live Insights",
      icon: "Zap",
      
      // Centered modal for execution feed + insights
      defaultSize: "modal-centered" as const,
    },
  ],
};

/**
 * Usage example:
 * 
 * <SmartDrawerShell
 *   isOpen={portfolioOpen}
 *   size="modal-centered"  // Menu will be hidden behind this drawer
 *   title="Portfolio"
 *   subtitle="Real-time performance and analytics"
 * >
 *   <PortfolioDashboard />
 * </SmartDrawerShell>
 * 
 * Key differences from panel-3q:
 * - Centered instead of right-anchored
 * - Higher z-index (60 vs 50) - sits ABOVE menu
 * - Rounded corners with shadow
 * - Perfect for focused tasks: trading, MetaVatar chat, deep analytics
 */
