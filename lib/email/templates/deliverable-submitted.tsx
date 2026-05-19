import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type DeliverableSubmittedEmailProps = {
  actionNumber: string;
  actionTitle: string;
  deliverableLetter: string;
  deliverableDescription: string;
  submitterName: string;
  loaneeWorkspaceName: string;
  actionUrl: string;
};

export function DeliverableSubmittedEmail({
  actionNumber,
  actionTitle,
  deliverableLetter,
  deliverableDescription,
  submitterName,
  loaneeWorkspaceName,
  actionUrl,
}: DeliverableSubmittedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`${submitterName} submitted evidence for ${actionNumber}${deliverableLetter} — ready for review`}
    >
      <Text style={heading}>New submission ready for review</Text>
      <Text style={body}>
        <strong>{submitterName}</strong> from <strong>{loaneeWorkspaceName}</strong>{" "}
        has submitted evidence for:
      </Text>
      <div style={deliverableCard}>
        <Text style={deliverableRef}>
          {actionNumber}{deliverableLetter}
        </Text>
        <Text style={deliverableTitle}>{actionTitle}</Text>
        <Text style={deliverableDesc}>{deliverableDescription}</Text>
      </div>
      <Text style={body}>
        Log in to review the uploaded document and approve or send it back.
      </Text>
      <Button href={actionUrl} style={button}>
        Review submission
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
