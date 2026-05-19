import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type ActionApprovedEmailProps = {
  actionNumber: string;
  actionTitle: string;
  projectName: string;
  reviewerName: string;
  actionUrl: string;
};

export function ActionApprovedEmail({
  actionNumber,
  actionTitle,
  projectName,
  reviewerName,
  actionUrl,
}: ActionApprovedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`Action ${actionNumber} — ${actionTitle} has been fully approved`}
    >
      <Text style={heading}>Action fully approved</Text>
      <Text style={body}>
        All deliverables for action <strong>{actionNumber}</strong> in{" "}
        <strong>{projectName}</strong> have been approved by{" "}
        <strong>{reviewerName}</strong>.
      </Text>
      <div style={actionCard}>
        <Text style={actionRef}>{actionNumber}</Text>
        <Text style={actionTitle_}>{actionTitle}</Text>
      </div>
      <Text style={body}>
        This action is now marked as complete.
      </Text>
      <Button href={actionUrl} style={button}>
        View action
      </Button>
    </EmailBase>
  );
}

const heading = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#111111",
  margin: "0 0 16px",
};

const body = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#444444",
  margin: "0 0 14px",
};

const actionCard = {
  backgroundColor: "#f0fdf4",
  borderLeft: "3px solid #166534",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const actionRef = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#166534",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "0 0 4px",
};

const actionTitle_ = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#111111",
  margin: "0",
};

const button = {
  backgroundColor: "#0A0A0A",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "500",
  padding: "10px 20px",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "8px",
};
