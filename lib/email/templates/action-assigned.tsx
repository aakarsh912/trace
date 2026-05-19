import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type ActionAssignedEmailProps = {
  actionNumber: string;
  actionTitle: string;
  projectName: string;
  assignerName: string;
  actionUrl: string;
};

export function ActionAssignedEmail({
  actionNumber,
  actionTitle,
  projectName,
  assignerName,
  actionUrl,
}: ActionAssignedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`${assignerName} assigned you to ${actionNumber} in ${projectName}`}
    >
      <Text style={heading}>You&apos;ve been assigned an action</Text>
      <Text style={body}>
        <strong>{assignerName}</strong> has assigned you to an action in{" "}
        <strong>{projectName}</strong>:
      </Text>
      <div style={actionCard}>
        <Text style={actionRef}>{actionNumber}</Text>
        <Text style={actionTitle_}>{actionTitle}</Text>
      </div>
      <Text style={body}>
        Log in to view the full action requirements and upload your evidence.
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
  backgroundColor: "#f8f8f8",
  borderLeft: "3px solid #0A0A0A",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const actionRef = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#888888",
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
