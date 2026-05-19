import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type ActionAssignedEmailProps = {
  actionNumber: string;
  actionTitle: string;
  projectName: string;
  assignerName: string;
  deliverableLetter: string;
  deliverableDescription: string;
  dueDate?: string;
  actionUrl: string;
};

export function ActionAssignedEmail({
  actionNumber,
  actionTitle,
  projectName,
  assignerName,
  deliverableLetter,
  deliverableDescription,
  dueDate,
  actionUrl,
}: ActionAssignedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`${assignerName} assigned you to ${actionNumber}${deliverableLetter} in ${projectName}`}
    >
      <Text style={heading}>You&apos;ve been assigned a deliverable</Text>
      <Text style={body}>
        <strong>{assignerName}</strong> has assigned you to a deliverable in{" "}
        <strong>{projectName}</strong>:
      </Text>
      <div style={deliverableCard}>
        <Text style={deliverableRef}>
          {actionNumber}{deliverableLetter}
        </Text>
        <Text style={deliverableTitle}>{actionTitle}</Text>
        <Text style={deliverableDesc}>{deliverableDescription}</Text>
        {dueDate && (
          <Text style={dueDateText}>Due: {dueDate}</Text>
        )}
      </div>
      <Text style={body}>
        Log in to view the full action requirements and upload your evidence.
      </Text>
      <Button href={actionUrl} style={button}>
        View deliverable
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

const deliverableCard = {
  backgroundColor: "#f8f8f8",
  borderLeft: "3px solid #0A0A0A",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const deliverableRef = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "0 0 4px",
};

const deliverableTitle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#111111",
  margin: "0 0 4px",
};

const deliverableDesc = {
  fontSize: "13px",
  color: "#555555",
  margin: "0",
  lineHeight: "1.5",
};

const dueDateText = {
  fontSize: "12px",
  color: "#888888",
  margin: "8px 0 0",
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
