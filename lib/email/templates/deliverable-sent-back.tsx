import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type DeliverableSentBackEmailProps = {
  actionNumber: string;
  actionTitle: string;
  deliverableLetter: string;
  deliverableDescription: string;
  reviewerName: string;
  reviewComment: string;
  actionUrl: string;
};

export function DeliverableSentBackEmail({
  actionNumber,
  actionTitle,
  deliverableLetter,
  deliverableDescription,
  reviewerName,
  reviewComment,
  actionUrl,
}: DeliverableSentBackEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`Your submission for ${actionNumber}${deliverableLetter} needs revision — feedback from ${reviewerName}`}
    >
      <Text style={heading}>Submission sent back for revision</Text>
      <Text style={body}>
        <strong>{reviewerName}</strong> has sent back your submission for:
      </Text>
      <div style={deliverableCard}>
        <Text style={deliverableRef}>
          {actionNumber}{deliverableLetter}
        </Text>
        <Text style={deliverableTitle}>{actionTitle}</Text>
        <Text style={deliverableDesc}>{deliverableDescription}</Text>
      </div>
      <Text style={feedbackLabel}>Reviewer&apos;s feedback</Text>
      <div style={commentBlock}>
        <Text style={commentText}>{reviewComment}</Text>
      </div>
      <Text style={body}>
        Please address the feedback and upload a revised document.
      </Text>
      <Button href={actionUrl} style={button}>
        Upload revision
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
  backgroundColor: "#fff7ed",
  borderLeft: "3px solid #c2410c",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const deliverableRef = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#c2410c",
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

const feedbackLabel = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "0 0 8px",
};

const commentBlock = {
  backgroundColor: "#f8f8f8",
  borderRadius: "4px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const commentText = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#333333",
  margin: "0",
  fontStyle: "italic" as const,
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
