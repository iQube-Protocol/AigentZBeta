import { DrawerSize } from "./types";

export function getDrawerClasses(size: DrawerSize): string {
  const base = "fixed bg-background/95 backdrop-blur-xl flex flex-col transition-all duration-300";
  
  const sizes: Record<DrawerSize, string> = {
    "wallet-narrow": "inset-0 md:right-[80px] md:top-[88px] md:left-auto md:h-[calc(100vh-88px)] md:w-[375px] z-50",
    "wallet-wide": "inset-0 md:right-[80px] md:top-[88px] md:left-auto md:h-[calc(100vh-88px)] md:w-[640px] z-50",
    "panel-3q": "inset-0 md:right-[80px] md:top-[88px] md:left-auto md:h-[calc(100vh-88px)] md:w-[min(960px,calc(100vw-160px))] z-50",
    "immersive-3q": "inset-0 md:right-[80px] md:top-0 md:left-auto md:h-screen md:w-[calc(100vw-80px)] z-50",
    "modal-centered": "inset-0 flex items-center justify-center p-4 md:p-8 z-[60]",
    "full-immersive": "inset-0 bg-black z-[100]",
  };
  
  return `${base} ${sizes[size]}`;
}
