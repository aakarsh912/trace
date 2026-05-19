import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
} from "@react-email/components";

type Props = {
  preview: string;
  children: React.ReactNode;
};

export function EmailBase({ preview, children }: Props): JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Trace</Text>
          </Section>

          {/* Body */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Trace · ESDD Compliance Platform
            </Text>
            <Text style={footerText}>
              You received this email because you have an account on Trace. If
              this wasn&apos;t you,{" "}
              <Link href="mailto:support@usetrace.com" style={footerLink}>
                contact support
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f3f4f6",
  fontFamily: "system-ui, -apple-system, sans-serif",
  margin: "0",
  padding: "40px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #e5e5e5",
  maxWidth: "560px",
  margin: "0 auto",
  overflow: "hidden" as const,
};

const header = {
  backgroundColor: "#0A0A0A",
  padding: "18px 32px",
};

const logo = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  margin: "0",
  letterSpacing: "-0.01em",
};

const content = {
  padding: "32px 32px 24px",
};

const hr = {
  borderColor: "#e5e5e5",
  margin: "0 32px",
};

const footer = {
  padding: "20px 32px 28px",
};

const footerText = {
  color: "#999999",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

const footerLink = {
  color: "#999999",
};
