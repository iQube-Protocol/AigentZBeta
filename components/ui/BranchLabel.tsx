import * as React from "react";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// BRANCH LABEL
// Indicates which Living Canon branch a content item belongs to.
// Canon | Community | Correspondent
// =============================================================================

export type CanonBranch = "canon" | "community" | "correspondent";

const BRANCH_CONFIG: Record<
  CanonBranch,
  { label: string; className: string }
> = {
  canon: {
    label: "Canon",
    className:
      "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30",
  },
  community: {
    label: "Community",
    className:
      "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30",
  },
  correspondent: {
    label: "Correspondent",
    className:
      "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30",
  },
};

export interface BranchLabelProps {
  branch: CanonBranch;
  className?: string;
}

export function BranchLabel({ branch, className = "" }: BranchLabelProps) {
  const cfg = BRANCH_CONFIG[branch];
  if (!cfg) return null;
  return (
    <Badge variant="outline" className={`${cfg.className} ${className}`}>
      {cfg.label}
    </Badge>
  );
}

// =============================================================================
// PUBLICATION STATE BADGE
// Shows the review/publication lifecycle state of a content item.
// =============================================================================

export type PublicationState =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "archived"
  | "canon_eligible"
  | "canon";

const STATE_CONFIG: Record<
  PublicationState,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-zinc-500/20 text-zinc-400 border-zinc-500/40 hover:bg-zinc-500/30",
  },
  submitted: {
    label: "Submitted",
    className:
      "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30",
  },
  under_review: {
    label: "Under Review",
    className:
      "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30",
  },
  approved: {
    label: "Approved",
    className:
      "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30",
  },
  archived: {
    label: "Archived",
    className:
      "bg-zinc-600/20 text-zinc-500 border-zinc-600/40 hover:bg-zinc-600/30",
  },
  canon_eligible: {
    label: "Canon Eligible",
    className:
      "bg-violet-500/20 text-violet-300 border-violet-500/40 hover:bg-violet-500/30",
  },
  canon: {
    label: "Canon",
    className:
      "bg-purple-600/30 text-purple-200 border-purple-500/60 hover:bg-purple-600/40 font-bold",
  },
};

export interface PublicationStateBadgeProps {
  state: PublicationState;
  className?: string;
}

export function PublicationStateBadge({
  state,
  className = "",
}: PublicationStateBadgeProps) {
  const cfg = STATE_CONFIG[state];
  if (!cfg) return null;
  return (
    <Badge variant="outline" className={`${cfg.className} ${className}`}>
      {cfg.label}
    </Badge>
  );
}
