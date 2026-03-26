export type ExecutionReceiptType = "pipeline_completion" | "workflow_invocation" | "manual";
export type ExecutionReceiptStatus = "pending" | "completed" | "failed";

export interface ExecutionReceiptQube {
  id: string;
  pipelineRunId?: string;
  workflowId?: string;
  tenantId: string;
  receiptType: ExecutionReceiptType;
  status: ExecutionReceiptStatus;
  dvnMessageId?: string;
  dvnSubmittedAt?: string;
  fromAgentId?: string;
  toAgentId?: string;
  taskCompleted?: string;
  policyEvaluation: Record<string, unknown>;
  resultData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
