import { useEffect } from "react";

type CopilotActionParameter = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
};

type CopilotActionConfig = {
  name: string;
  description?: string;
  parameters?: CopilotActionParameter[];
  handler?: (args: Record<string, any>) => Promise<string | void> | string | void;
};

export function useCopilotAction(_config: CopilotActionConfig) {
  useEffect(() => {
    // Stub: CopilotKit is not wired in this workspace build.
  }, [_config.name]);
}
