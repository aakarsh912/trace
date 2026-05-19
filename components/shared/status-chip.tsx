import type { ActionStatus, DeliverableStatus } from "@/lib/db/schema";

type Status = ActionStatus | DeliverableStatus;

const STATUS_CONFIG: Record<
  Status,
  { label: string; fg: string; bg: string }
> = {
  draft: {
    label: "Draft",
    fg: "var(--status-draft-fg)",
    bg: "var(--status-draft-bg)",
  },
  in_progress: {
    label: "In Progress",
    fg: "var(--status-submitted-fg)",
    bg: "var(--status-submitted-bg)",
  },
  requires_attention: {
    label: "Requires Attention",
    fg: "var(--status-attention-fg)",
    bg: "var(--status-attention-bg)",
  },
  completed: {
    label: "Completed",
    fg: "var(--status-approved-fg)",
    bg: "var(--status-approved-bg)",
  },
  pending: {
    label: "Pending",
    fg: "var(--status-draft-fg)",
    bg: "var(--status-draft-bg)",
  },
  submitted: {
    label: "Submitted",
    fg: "var(--status-submitted-fg)",
    bg: "var(--status-submitted-bg)",
  },
  approved: {
    label: "Approved",
    fg: "var(--status-approved-fg)",
    bg: "var(--status-approved-bg)",
  },
  sent_back: {
    label: "Sent Back",
    fg: "var(--status-returned-fg)",
    bg: "var(--status-returned-bg)",
  },
};

type StatusChipProps = {
  status: Status;
};

export function StatusChip({ status }: StatusChipProps): JSX.Element {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: config.fg, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}
