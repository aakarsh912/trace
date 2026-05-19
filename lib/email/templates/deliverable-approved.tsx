import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type DeliverableApprovedEmailProps = {
  actionNumber: string;
  actionTitle: string;
  deliverableLetter: string;
  deliverableDescription: string;
  reviewerName: string;
  actionUrl: string;
};

export function DeliverableApprovedEmail({
  actionNumber,
  actionTitle,
  deliverableLetter,
  deliverableDescription,
  reviewerName,
  actionUrl,
}: DeliverableApprovedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`Your submission for ${actionNumber}${deliverableLetter} has been approved`}
    >
      <Text style={heading}>Submission approved</Text>
      <Text style={body}>
        <strong>{reviewerName}</strong> has approved your submission for:
      </Text>
      <div style={deliverableCard}>
        <Text style={deliverableRef}>
          {actionNumber}{deliverableLetter}
        </Text>
        <Text style={deliverableTitle}>{actionTitle}</Text>
        <Text style={deliverableDesc}>{deliverableDescription}</Text>
      </div>
      <Text style={body}>
        This deliverable is now marked as complete. View the action to see the
        full status.
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

const deliverableCard = {
  backgroundColor: "#f0fdf4",
  borderLeft: "3px solid #166534",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const deliverableRef = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#166534",
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
