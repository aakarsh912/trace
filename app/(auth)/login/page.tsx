"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage(): JSX.Element {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        // Surface the actual status for debugging
        setError(`Sign in status: ${result.status}. Please try again.`);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string; longMessage?: string }[] };
      const message =
        clerkErr.errors?.[0]?.longMessage ??
        clerkErr.errors?.[0]?.message ??
        (err instanceof Error ? err.message : "Invalid email or password.");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "#0A0A0A",
              color: "white",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            T
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
            Trace
          </span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            margin: "0 0 6px",
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--fg-secondary)",
            margin: "0 0 24px",
            lineHeight: 1.5,
          }}
        >
          Sign in to your workspace.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--fg-secondary)",
                marginBottom: 6,
              }}
            >
              Work email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13.5,
                fontFamily: "inherit",
                background: "var(--bg-surface)",
                color: "var(--fg)",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--fg)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--fg-secondary)",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13.5,
                fontFamily: "inherit",
                background: "var(--bg-surface)",
                color: "var(--fg)",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--fg)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--status-attention-fg)",
                background: "var(--status-attention-bg)",
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: "8px 12px",
                margin: "0 0 12px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              background: loading ? "#525252" : "#0A0A0A",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 13.5,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              marginTop: 4,
              transition: "background 100ms",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Forgot password */}
        <div
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--fg-tertiary)",
            marginTop: 16,
          }}
        >
          <a
            href="/forgot-password"
            style={{ color: "var(--fg)", textDecoration: "none" }}
            onMouseOver={(e) =>
              ((e.target as HTMLAnchorElement).style.textDecoration = "underline")
            }
            onMouseOut={(e) =>
              ((e.target as HTMLAnchorElement).style.textDecoration = "none")
            }
          >
            Forgot your password?
          </a>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "var(--border)",
            margin: "20px 0",
          }}
        />

        {/* Invite-only note */}
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--fg-tertiary)",
          }}
        >
          {"Don't have an account? "}
          <span style={{ color: "var(--fg)" }}>
            You&apos;ll need an invite from your admin.
          </span>
        </div>
      </div>
    </div>
  );
}
