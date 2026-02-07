import React from "react";

type LiquidTemplateComponent = React.ComponentType<any>;

export const liquidTemplateRegistry: Record<string, LiquidTemplateComponent> = {
  "liquidui:reader_viewer_v1": ({ contentObject }: { contentObject?: any }) => (
    <div className="min-h-[320px] rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
      <h3 className="text-lg font-semibold">LiquidUI Template Preview</h3>
      <p className="mt-2 text-sm text-white/60">
        Template rendering placeholder. Replace with the actual LiquidUI renderer.
      </p>
      {contentObject?.title && <p className="mt-4 text-sm">Content: {contentObject.title}</p>}
    </div>
  ),
};
