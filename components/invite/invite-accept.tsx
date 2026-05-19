"use client";

import { useState } from "react";
import { useSignIn, useSignUp, useAuth, useUser, useClerk } from "@clerk/nextjs";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

const TYPE_LABEL: Record<WorkspaceType, string> = {
  bank: "Bank",
  consultant: "Consultant",
  loanee: "Loanee",
};

const TYPE_COLOR: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

const ROLE_LABEL: Record<WorkspaceMemberRole, string> = {
  admin: "Admin",
  member: "Member",
};

type Props = {
  token: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  role: WorkspaceMemberRole;
  email: string;
};

type Step = "form" | "verify" | "accepting";

export function InviteAccept({ token, workspaceName, workspaceType, role, email }: Props): JSX.Element {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const currentEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [step, setStep] = useState<Step>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Existing signed-in user: just accept
  async function handleAccept(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong");
        setLoading(false);
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  // New user: create Clerk account then accept
  async function handleSignUp(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      // Trigger email verification
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      const msg = extractClerkError(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        setStep("accepting");
        // Session is now active — call accept
        const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to join workspace");
          setStep("verify");
        }
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      setError(extractClerkError(err));
    } finally {
      setLoading(false);
    }
  }

  // Existing user not signed in: sign in then accept
  async function handleSignIn(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        setStep("accepting");
        const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to join workspace");
          setStep("form");
        }
      } else {
        setError("Sign-in incomplete. Please try again.");
      }
    } catch (err: unknown) {
      setError(extractClerkError(err));
    } finally {
      setLoading(false);
    }
  }

  const typeColor = TYPE_COLOR[workspaceType];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: "0 16px" }}>

        {/* Workspace card */}
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: "20px 24px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>You&apos;re invited to join</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#111", marginBottom: 6 }}>{workspaceName}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: typeColor + "18", color: typeColor }}>
              {TYPE_LABEL[workspaceType]}
            </span>
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#555" }}>
              {ROLE_LABEL[role]}
            </span>
          </div>
        </div>

        {/* Action panel */}
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

          {step === "accepting" && (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#555", fontSize: 14 }}>
              Joining workspace…
            </div>
          )}

          {isSignedIn && step === "form" && (
            <AcceptPanel
              inviteEmail={email}
              currentEmail={currentEmail}
              workspaceName={workspaceName}
              loading={loading}
              error={error}
              onAccept={() => void handleAccept()}
              onSignOut={() => void signOut()}
            />
          )}

          {!isSignedIn && step === "form" && (
            <SignUpPanel
              email={email}
              firstName={firstName}
              lastName={lastName}
              password={password}
              loading={loading}
              error={error}
              onFirstNameChange={setFirstName}
              onLastNameChange={setLastName}
              onPasswordChange={setPassword}
              onSubmit={(e) => void handleSignUp(e)}
              onSignIn={(e) => void handleSignIn(e)}
            />
          )}

          {step === "verify" && (
            <VerifyPanel
              email={email}
              code={code}
              loading={loading}
              error={error}
              onCodeChange={setCode}
              onSubmit={(e) => void handleVerify(e)}
            />
          )}
        </div>

      </div>
    </div>
  );
}

function AcceptPanel({ inviteEmail, currentEmail, workspaceName, loading, error, onAccept, onSignOut }: {
  inviteEmail: string;
  currentEmail: string | null;
  workspaceName: string;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onSignOut: () => void;
}): JSX.Element {
  const emailMismatch = currentEmail !== null && currentEmail.toLowerCase() !== inviteEmail.toLowerCase();

  if (emailMismatch) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 6, padding: "12px 14px" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#854d0e", marginBottom: 4 }}>Wrong account</div>
          <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
            You&apos;re signed in as <strong>{currentEmail}</strong>, but this invite is for <strong>{inviteEmail}</strong>. Please sign out first and create a new account.
          </div>
        </div>
        <button onClick={onSignOut} style={btnStyle(false)}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Accept invitation</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          Signed in as <strong>{currentEmail ?? inviteEmail}</strong>. Click below to join {workspaceName}.
        </div>
      </div>
      {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
      <button
        onClick={onAccept}
        disabled={loading}
        style={btnStyle(loading)}
      >
        {loading ? "Joining…" : `Accept & join ${workspaceName}`}
      </button>
    </div>
  );
}

function SignUpPanel({ email, firstName, lastName, password, loading, error, onFirstNameChange, onLastNameChange, onPasswordChange, onSubmit, onSignIn }: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  loading: boolean;
  error: string | null;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSignIn: (e: React.FormEvent) => void;
}): JSX.Element {
  const [mode, setMode] = useState<"signup" | "signin">("signup");

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
        {mode === "signup" ? "Create your account" : "Sign in to accept"}
      </div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        {mode === "signup"
          ? "Set up your account to join the workspace."
          : "Use your existing Trace account to accept this invite."}
      </div>

      <form onSubmit={mode === "signup" ? onSubmit : onSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Email</label>
          <input value={email} disabled style={{ ...inputStyle, background: "#f5f5f5", color: "#888" }} />
        </div>

        {mode === "signup" && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>First name</label>
              <input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="First" style={inputStyle} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Last name</label>
              <input value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Last" style={inputStyle} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} required placeholder={mode === "signup" ? "Create a password" : "Your password"} style={inputStyle} />
        </div>

        {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

        <button type="submit" disabled={loading || !password} style={btnStyle(loading || !password)}>
          {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : (mode === "signup" ? "Create account & join" : "Sign in & join")}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#888" }}>
        {mode === "signup" ? (
          <>Already have an account?{" "}
            <button onClick={() => setMode("signin")} style={{ background: "none", border: "none", color: "#0A0A0A", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in instead</button>
          </>
        ) : (
          <>Don&apos;t have an account?{" "}
            <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: "#0A0A0A", fontWeight: 500, cursor: "pointer", fontSize: 13, padding: 0 }}>Create one</button>
          </>
        )}
      </div>
    </div>
  );
}

function VerifyPanel({ email, code, loading, error, onCodeChange, onSubmit }: {
  email: string;
  code: string;
  loading: boolean;
  error: string | null;
  onCodeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}): JSX.Element {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Check your email</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>Verification code</label>
        <input
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="000000"
          maxLength={6}
          required
          style={{ ...inputStyle, letterSpacing: "0.2em", fontSize: 18, textAlign: "center" }}
        />
      </div>
      {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
      <button type="submit" disabled={loading || code.length < 6} style={btnStyle(loading || code.length < 6)}>
        {loading ? "Verifying…" : "Verify & join workspace"}
      </button>
    </form>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 16px",
    fontSize: 13,
    fontFamily: "inherit",
    fontWeight: 500,
    background: disabled ? "#888" : "#0A0A0A",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#555",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #ddd",
  borderRadius: 5,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#fff",
  color: "#111",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

function extractClerkError(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errs = (err as { errors: { message: string }[] }).errors;
    return errs[0]?.message ?? "Something went wrong";
  }
  return "Something went wrong";
}
