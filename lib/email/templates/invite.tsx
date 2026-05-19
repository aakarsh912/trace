import { Text, Button, Link } from "@react-email/components";
import { EmailBase } from "./base";

export type InviteEmailProps = {
  workspaceName: string;
  workspaceType: "bank" | "consultant" | "loanee";
  role: "admin" | "member";
  inviteUrl: string;
  inviterName?: string;
};

const TYPE_LABEL = { bank: "Bank", consultant: "Consultant", loanee: "Loanee" };
const ROLE_LABEL = { admin: "Admin", member: "Member" };

export function InviteEmail({
  workspaceName,
  workspaceType,
  role,
  inviteUrl,
  inviterName,
}: InviteEmailProps): JSX.Element {
  const from = inviterName ? `${inviterName} has invited` : "You've been invited";

  return (
    <EmailBase preview={`${from} you to join ${workspaceName} on Trace`}>
      <Text style={heading}>You&apos;ve been invited to Trace</Text>
      <Text style={body}>
        {from} you to join <strong>{workspaceName}</strong> as a{" "}
        {TYPE_LABEL[workspaceType]} {ROLE_LABEL[role]}.
      </Text>
      <Text style={body}>
        Trace is the ESDD compliance platform. Once you accept, you&apos;ll be
        able to log in and collaborate on your workspace.
      </Text>
      <Button href={inviteUrl} style={button}>
        Accept invitation
      </Button>
      <Text style={hint}>
        Or copy this link:{" "}
        <Link href={inviteUrl} style={linkStyle}>
          {inviteUrl}
        </Link>
      </Text>
      <Text style={hint}>
        This link expires in 7 days. If you weren&apos;t expecting this, you
        can ignore it.
      </Text>
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
  marginBottom: "16px",
};

const hint = {
  fontSize: "12px",
  color: "#888888",
  margin: "0 0 8px",
  lineHeight: "1.5",
};

const linkStyle = {
  color: "#0A0A0A",
  wordBreak: "break-all" as const,
};
