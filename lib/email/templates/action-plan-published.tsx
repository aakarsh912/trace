import { Text, Button } from "@react-email/components";
import { EmailBase } from "./base";

export type ActionPlanPublishedEmailProps = {
  projectName: string;
  loaneeWorkspaceName: string;
  consultantWorkspaceName: string;
  actionCount: number;
  dashboardUrl: string;
};

export function ActionPlanPublishedEmail({
  projectName,
  loaneeWorkspaceName,
  consultantWorkspaceName,
  actionCount,
  dashboardUrl,
}: ActionPlanPublishedEmailProps): JSX.Element {
  return (
    <EmailBase
      preview={`Your action plan for ${projectName} is ready — ${actionCount} action${actionCount !== 1 ? "s" : ""} to complete`}
    >
      <Text style={heading}>Action plan published</Text>
      <Text style={body}>
        <strong>{consultantWorkspaceName}</strong> has published the ESDD action
        plan for <strong>{projectName}</strong>.
      </Text>
      <Text style={body}>
        There {actionCount === 1 ? "is" : "are"}{" "}
        <strong>
          {actionCount} action{actionCount !== 1 ? "s" : ""}
        </strong>{" "}
        requiring your team&apos;s attention. Log in to {loaneeWorkspaceName}{" "}
        to review the plan and start uploading evidence.
      </Text>
      <Button href={dashboardUrl} style={button}>
        View action plan
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
